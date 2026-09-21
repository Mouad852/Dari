-- Test-only migration for DatabaseTimeoutIntegrationTest. Stands in for a slow
-- production migration (a CREATE INDEX on a large table): it must outlive the
-- application's statement timeout when run the way Flyway runs at startup.
SELECT pg_sleep(2);
