import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/*
 * Photos are re-encoded in the browser before upload (audit P1-5): the API
 * ignores EXIF orientation, refuses anything over 5 MB and accepts only JPEG
 * or PNG. Each case here is built in the page, handed to the avatar picker,
 * and checked in the multipart body the mock API received.
 */

type Fixture = 'portrait-exif' | 'large-png' | 'webp';

/** Builds the fixture in the page and selects it in the avatar file input. */
async function pickGeneratedImage(page: Page, fixture: Fixture): Promise<number> {
  return page.evaluate(async (kind) => {
    const draw = (width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      paint(canvas.getContext('2d')!);
      return canvas;
    };
    const encode = (canvas: HTMLCanvasElement, type: string) =>
      new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), type, 0.9));

    let file: File;
    if (kind === 'portrait-exif') {
      // Stored 40x20 landscape, tagged Orientation 6 (rotate 90° clockwise): a
      // phone photo taken upright, which must arrive 20x40.
      const stored = new Uint8Array(await (await encode(draw(40, 20, (c) => { c.fillStyle = '#c33'; c.fillRect(0, 0, 40, 20); }), 'image/jpeg')).arrayBuffer());
      const exif = [
        0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1, length 34, "Exif\0\0"
        0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD at 8
        0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation = 6
        0x00, 0x00, 0x00, 0x00, // no next IFD
      ];
      file = new File([stored.slice(0, 2), new Uint8Array(exif), stored.slice(2)], 'portrait.jpg', { type: 'image/jpeg' });
    } else if (kind === 'large-png') {
      // 3000x2000 with low-amplitude noise: poorly compressible as PNG (well over 5 MB),
      // but an ordinary photo's worth of detail for JPEG.
      const canvas = draw(3000, 2000, (c) => {
        const pixels = c.createImageData(3000, 2000);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const base = ((i / 4) % 3000) / 12;
          pixels.data[i] = base + Math.random() * 16;
          pixels.data[i + 1] = 120 + Math.random() * 16;
          pixels.data[i + 2] = 200 - base / 2 + Math.random() * 16;
          pixels.data[i + 3] = 255;
        }
        c.putImageData(pixels, 0, 0);
      });
      file = new File([await encode(canvas, 'image/png')], 'large.png', { type: 'image/png' });
    } else {
      const canvas = draw(300, 200, (c) => { c.fillStyle = '#2a6'; c.fillRect(0, 0, 300, 200); });
      file = new File([await encode(canvas, 'image/webp')], 'photo.webp', { type: 'image/webp' });
    }

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return file.size;
  }, fixture);
}

/** The `file` part of the last avatar upload: its declared type, file name and bytes. */
async function uploadedFile(page: Page) {
  const received = await page.request.get('http://127.0.0.1:4110/__avatar-upload');
  expect(received.status(), 'an avatar upload reached the API').toBe(200);
  const boundary = /boundary=(.+)$/.exec(received.headers()['x-upload-content-type'] ?? '')![1]!;
  const body = await received.body();
  const headersStart = body.indexOf('name="file"');
  const bytesStart = body.indexOf('\r\n\r\n', headersStart) + 4;
  const bytesEnd = body.indexOf(`\r\n--${boundary}`, bytesStart);
  const headers = body.subarray(headersStart, bytesStart).toString('latin1');
  return {
    type: /Content-Type: (\S+)/i.exec(headers)?.[1],
    name: /filename="([^"]+)"/.exec(headers)?.[1],
    bytes: body.subarray(bytesStart, bytesEnd),
  };
}

/** Width and height from a JPEG's start-of-frame segment. */
function jpegSize(bytes: Buffer) {
  expect(bytes.readUInt16BE(0), 'JPEG start-of-image').toBe(0xffd8);
  let offset = 2;
  while (offset < bytes.length) {
    const marker = bytes.readUInt16BE(offset);
    const isFrame = marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker);
    if (isFrame) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('no start-of-frame segment');
}

const cases: { fixture: Fixture; check: (size: { width: number; height: number }, pickedBytes: number) => void }[] = [
  { fixture: 'portrait-exif', check: (size) => expect(size).toEqual({ width: 20, height: 40 }) },
  {
    fixture: 'large-png',
    check: (size, pickedBytes) => {
      expect(pickedBytes).toBeGreaterThan(5 * 1024 * 1024);
      expect(size).toEqual({ width: 2560, height: 1707 });
    },
  },
  { fixture: 'webp', check: (size) => expect(size).toEqual({ width: 300, height: 200 }) },
];

for (const { fixture, check } of cases) {
  test(`a picked ${fixture} photo is uploaded as an upright JPEG within the API's limits`, async ({ authenticatedPage: page }) => {
    await page.goto('/account/profile');
    await expect(page.getByRole('button', { name: /Changer la photo|Ajouter une photo/ })).toBeVisible();

    const upload = page.waitForResponse((response) => response.url().endsWith('/users/me/avatar') && response.request().method() === 'POST');
    const pickedBytes = await pickGeneratedImage(page, fixture);
    await upload;
    const file = await uploadedFile(page);

    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/\.jpg$/);
    expect(file.bytes.length).toBeLessThanOrEqual(5 * 1024 * 1024);
    check(jpegSize(file.bytes), pickedBytes);
  });
}
