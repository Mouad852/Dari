package ma.dari.api.media;

import java.io.IOException;
import java.io.InputStream;

/**
 * Reads the EXIF Orientation tag of a JPEG, and nothing else.
 *
 * ImageIO decodes the stored pixels and ignores this tag, so a portrait phone
 * photo came out sideways once re-encoded (audit P1-5). The web client now
 * sends upright pixels, but other API clients may not. A full metadata library
 * would be a dependency for one 16-bit value; every offset here is
 * bounds-checked, and anything malformed means "no rotation" (1).
 */
final class ExifOrientation {
    static final int NORMAL = 1;
    /** APP1 segments are at most 64 KB and come first, after at most an APP0. */
    private static final int HEADER_BYTES = 256 * 1024;
    private static final int ORIENTATION_TAG = 0x0112;

    private ExifOrientation() {
    }

    static int read(InputStream in) throws IOException {
        byte[] bytes = in.readNBytes(HEADER_BYTES);
        if (bytes.length < 4 || u8(bytes, 0) != 0xFF || u8(bytes, 1) != 0xD8) return NORMAL;
        int offset = 2;
        while (offset + 4 <= bytes.length && u8(bytes, offset) == 0xFF) {
            int marker = u8(bytes, offset + 1);
            if (marker == 0xDA || marker == 0xD9) break; // start of scan / end of image: no more headers
            int length = (u8(bytes, offset + 2) << 8) | u8(bytes, offset + 3);
            int segment = offset + 4;
            if (length < 2 || segment + length - 2 > bytes.length) break;
            if (marker == 0xE1 && length >= 8 && isExifHeader(bytes, segment)) {
                return fromTiff(bytes, segment + 6, segment + length - 2);
            }
            offset += 2 + length;
        }
        return NORMAL;
    }

    private static boolean isExifHeader(byte[] bytes, int at) {
        return bytes[at] == 'E' && bytes[at + 1] == 'x' && bytes[at + 2] == 'i' && bytes[at + 3] == 'f'
                && bytes[at + 4] == 0 && bytes[at + 5] == 0;
    }

    /** Looks for tag 0x0112 in IFD0 of the TIFF structure between {@code tiff} and {@code end}. */
    private static int fromTiff(byte[] bytes, int tiff, int end) {
        if (tiff + 8 > end) return NORMAL;
        boolean littleEndian;
        if (bytes[tiff] == 'I' && bytes[tiff + 1] == 'I') littleEndian = true;
        else if (bytes[tiff] == 'M' && bytes[tiff + 1] == 'M') littleEndian = false;
        else return NORMAL;

        long ifd = tiff + u32(bytes, tiff + 4, littleEndian);
        if (ifd + 2 > end) return NORMAL;
        int entries = u16(bytes, (int) ifd, littleEndian);
        for (int i = 0; i < entries; i++) {
            int entry = (int) ifd + 2 + i * 12;
            if (entry + 12 > end) return NORMAL;
            if (u16(bytes, entry, littleEndian) == ORIENTATION_TAG) {
                int value = u16(bytes, entry + 8, littleEndian); // SHORT, stored left-aligned in the value field
                return value >= 1 && value <= 8 ? value : NORMAL;
            }
        }
        return NORMAL;
    }

    private static int u8(byte[] bytes, int at) {
        return bytes[at] & 0xFF;
    }

    private static int u16(byte[] bytes, int at, boolean littleEndian) {
        return littleEndian ? u8(bytes, at) | (u8(bytes, at + 1) << 8) : (u8(bytes, at) << 8) | u8(bytes, at + 1);
    }

    private static long u32(byte[] bytes, int at, boolean littleEndian) {
        long high = u16(bytes, littleEndian ? at + 2 : at, littleEndian);
        long low = u16(bytes, littleEndian ? at : at + 2, littleEndian);
        return (high << 16) | low;
    }
}
