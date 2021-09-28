BEGIN TRANSACTION;
UPDATE schema_information SET value = "1" WHERE key = "version";
COMMIT;
