'use client';

/**
 * Re-encodes a picked photo before upload (audit P1-5).
 *
 * The API decodes with ImageIO, which ignores the EXIF Orientation tag, and
 * refuses anything over 5 MB or other than JPEG/PNG. A portrait phone photo
 * therefore arrived sideways, a modern phone's 5-12 MB photo was refused, and
 * a WebP the picker offered failed after upload.
 *
 * Drawing the picture onto a canvas fixes all three in one pass: browsers
 * apply EXIF orientation when they draw an `<img>` (`image-orientation:
 * from-image` is the default), the canvas is sized to at most
 * {@link MAX_EDGE_PX} on the long edge, and it exports JPEG whatever went in.
 * An `<img>`, not `createImageBitmap`, because the latter's orientation
 * default changed between spec revisions and browsers disagree on it.
 */

/** Long edge of the uploaded photo: sharp on a retina listing page, a few MB at most. */
export const MAX_EDGE_PX = 2560;
/** The API's limit (`ImageProcessor.MAX_FILE_SIZE_BYTES`). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Tried in order; a lower one is used only if a very detailed photo is still over the limit. */
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Returns an upright JPEG no larger than {@link MAX_EDGE_PX} on its long edge.
 *
 * A file the browser cannot decode (a HEIC in Chrome, a corrupt file) is
 * returned unchanged: the API stays the judge of what it accepts, and its
 * error message is the one the user then sees.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const canvas = document.createElement('canvas');
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return file;
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    // JPEG has no alpha: transparent PNG pixels would otherwise come out black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }

  let blob: Blob | null = null;
  for (const quality of JPEG_QUALITIES) {
    blob = await toJpeg(canvas, quality);
    if (!blob || blob.size <= MAX_UPLOAD_BYTES) break;
  }
  if (!blob) return file;

  const name = `${file.name.replace(/\.[^./\\]+$/, '') || 'photo'}.jpg`;
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
