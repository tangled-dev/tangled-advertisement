BEGIN TRANSACTION;
UPDATE schema_information SET value = "13" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_status_create_date ON advertisement_request_log ("status", "create_date");

COMMIT;
