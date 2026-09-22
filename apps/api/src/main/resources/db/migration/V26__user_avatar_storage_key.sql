-- Store the avatar's storage key, not a rendered URL.
--
-- avatar_url held imageStore.publicUrl(key): "/uploads/<key>" in local mode,
-- "<DARI_MEDIA_PUBLIC_BASE_URL>/<key>" in S3 mode. Account deletion and avatar
-- replacement recovered the key by stripping "/uploads/", so in S3 mode they
-- never enqueued the object for deletion and it stayed public. The key is the
-- fact; the URL is a rendering of it for one deployment's configuration.
--
-- EXPAND ONLY. avatar_url stays: the previous release still reads and writes
-- it, and a rollback must keep working against this schema. A later contract
-- migration drops the column, the trigger and the function below together.
ALTER TABLE users ADD COLUMN avatar_storage_key TEXT;

-- Flyway cannot know DARI_MEDIA_PUBLIC_BASE_URL, so the key is recovered from
-- its fixed shape, avatars/<owner uuid>/<random uuid>.jpg, at the end of either
-- a "/uploads/..." path or an absolute http(s) URL (with or without a path
-- prefix). The owner segment must be this row's own id: the application only
-- ever wrote the owner's key, so anything else is not this person's avatar and
-- must never be enqueued for deletion on their behalf. Anything else stays NULL.
CREATE FUNCTION avatar_storage_key_from_url(url TEXT, owner_id UUID) RETURNS TEXT
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN split_part(k, '/', 2) = owner_id::text THEN k END
    FROM (SELECT substring(url FROM
            '^(?:/uploads/|https?://[^/?#]+(?:/[^?#]*)?/)'
            '(avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
            '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg)$') AS k) extracted
$$;

UPDATE users
SET avatar_storage_key = avatar_storage_key_from_url(avatar_url, id)
WHERE avatar_url IS NOT NULL;

-- While both releases can run (a rolling deploy, or a rollback and a later
-- roll-forward), the previous release keeps writing avatar_url only. Without
-- this, a person who changed their avatar under that release would come back
-- to this one with a stale key: the new object would never be cleaned up and
-- the old, already-deleted one would be rendered. The current release never
-- changes avatar_url except to clear it, which clears the key as well.
CREATE FUNCTION users_sync_avatar_storage_key() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.avatar_storage_key := avatar_storage_key_from_url(NEW.avatar_url, NEW.id);
    RETURN NEW;
END
$$;

CREATE TRIGGER users_sync_avatar_storage_key
    BEFORE UPDATE OF avatar_url ON users
    FOR EACH ROW
    WHEN (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url)
    EXECUTE FUNCTION users_sync_avatar_storage_key();
