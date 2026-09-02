-- Account deletion (phase 09) soft-deletes the user row, and V2's unique index
-- on lower(email) covered every row regardless of deleted_at. The consequence
-- was that deleting an account permanently burned that email address: the
-- person could delete their Firebase identity, sign up again, and then fail at
-- POST /users with a constraint violation they could do nothing about.
--
-- Scoping the index to live rows lets a deleted address be used again while
-- still preventing two active accounts from sharing one. Banned identities are
-- unaffected -- they are blocked earlier, by their own banned_identities table,
-- which keeps its own copy of the address precisely so it survives this.
DROP INDEX IF EXISTS idx_users_email_lower;

CREATE UNIQUE INDEX idx_users_email_lower
    ON users (lower(email))
    WHERE deleted_at IS NULL;
