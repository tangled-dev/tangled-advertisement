BEGIN TRANSACTION;
UPDATE schema_information SET value = "7" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_tangled_guid_consumer_status ON advertisement_request_log ("tangled_guid_consumer", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_request_log_status_create_date ON advertisement_request_log ("status", "create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_ledger_attribute_ledger_guid ON advertisement_ledger_attribute ("ledger_guid");
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_queue_create_date_protocol_transaction_id_count_impression ON advertisement_queue ("create_date",  "protocol_transaction_id",  "count_impression");

COMMIT;
