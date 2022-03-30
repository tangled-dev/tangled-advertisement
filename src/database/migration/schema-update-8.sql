BEGIN TRANSACTION;
UPDATE schema_information SET value = "8" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_create_date ON advertisement ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_attribute_create_date ON advertisement_attribute ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_balance_create_date ON advertisement_balance ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_click_log_create_date ON advertisement_click_log ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_ledger_create_date ON advertisement_ledger ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_ledger_attribute_create_date ON advertisement_ledger_attribute ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_block_log_create_date ON advertisement_block_log ("create_date");

CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_attribute_create_date ON advertisement_attribute ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_settlement_ledger_create_date ON settlement_ledger ("create_date");
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_block_create_date ON advertisement_block ("create_date");

COMMIT;
