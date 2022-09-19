BEGIN TRANSACTION;
UPDATE schema_information SET value = "11" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_ip_address_consumer_status ON advertisement_request_log ("ip_address_consumer", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_advertisement_request_guid ON advertisement_request_log ("advertisement_request_guid");
DROP INDEX IF EXISTS advertisement_advertiser.idx_advertisement_request_log_status_create_date;

COMMIT;
