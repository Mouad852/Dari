package ma.dari.api.common.jpa;

import java.security.SecureRandom;
import java.nio.ByteBuffer;
import java.util.UUID;

/**
 * Application-side UUID generation.
 *
 * <p>Not {@code gen_random_uuid()} in the database: an entity's id must be known
 * before insert, or the transactional outbox (phase 04) and batched photo
 * inserts (phase 05) both become awkward.
 *
 * <p>Version 7 rather than 4. v7 embeds a millisecond timestamp in its high
 * bits, so keys are time-ordered and inserts append to the right edge of the
 * B-tree instead of scattering across it. On a table that only grows, that is
 * the difference between a dense index and a fragmented one.
 *
 * <p>UUIDv7 is not in the JDK, so it is built here rather than pulling a
 * dependency for forty lines of bit-twiddling.
 */
public final class Ids {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {
    }

    public static UUID newId() {
        byte[] value = new byte[16];
        RANDOM.nextBytes(value);

        long millis = System.currentTimeMillis();

        // 48 bits of big-endian timestamp, then version 7 and the RFC variant.
        value[0] = (byte) (millis >>> 40);
        value[1] = (byte) (millis >>> 32);
        value[2] = (byte) (millis >>> 24);
        value[3] = (byte) (millis >>> 16);
        value[4] = (byte) (millis >>> 8);
        value[5] = (byte) millis;
        value[6] = (byte) ((value[6] & 0x0F) | 0x70);
        value[8] = (byte) ((value[8] & 0x3F) | 0x80);

        ByteBuffer buffer = ByteBuffer.wrap(value);
        return new UUID(buffer.getLong(), buffer.getLong());
    }
}
