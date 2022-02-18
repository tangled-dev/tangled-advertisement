BEGIN TRANSACTION;
UPDATE schema_information SET value = "5" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_advertisement_request ON advertisement_request_log ("advertisement_guid", "advertisement_request_guid");

COMMIT;
