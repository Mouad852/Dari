/**
 * Photo upload, processing and storage.
 *
 * Every image is re-encoded rather than stored as received, which strips EXIF as
 * a side effect. That is the point: a listing photo taken at home carries GPS,
 * and the whole location-fuzzing scheme is void if the metadata survives.
 *
 * Built in phase 05, reused for avatars in phase 09.
 */
package ma.dari.api.media;
