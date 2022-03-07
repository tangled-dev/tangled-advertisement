BEGIN TRANSACTION;
UPDATE schema_information SET value = "7" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_tangled_guid_consumer_status ON advertisement_request_log ("tangled_guid_consumer", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_ledger_attribute_ledger_guid ON advertisement_ledger_attribute ("ledger_guid");

COMMIT;
