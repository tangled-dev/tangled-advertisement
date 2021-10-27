BEGIN TRANSACTION;
UPDATE schema_information SET value = "3" WHERE key = "version";

CREATE TABLE advertisement_advertiser.advertisement_category
(
    advertisement_category_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    advertisement_category_guid char(32) UNIQUE,
    advertisement_category_guid_parent char(32),
    advertisement_category varchar(200),
    phrase_guid char(32),
    require_opt_in tinyint NOT NULL DEFAULT 0 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO advertisement_advertiser.advertisement_category SELECT * FROM advertisement_advertiser.advertisement_category_type;
DROP TABLE advertisement_advertiser.advertisement_category_type;


CREATE TABLE advertisement_advertiser.new_advertisement
(
    advertisement_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    advertisement_guid char(32) UNIQUE,
    advertisement_type_guid char(32),
    advertisement_category_guid char(32),
    advertisement_name varchar(200),
    advertisement_url varchar(2048),
    protocol_address_funding char(128),
    budget_daily_usd decimal(16,8),
    budget_daily_mlx bigint(16),
    bid_impression_usd decimal(16,8),
    bid_impression_mlx bigint(16),
    expiration timestamp,
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO advertisement_advertiser.new_advertisement SELECT * FROM advertisement_advertiser.advertisement;
DROP TABLE advertisement_advertiser.advertisement;
ALTER TABLE advertisement_advertiser.new_advertisement RENAME TO advertisement;


CREATE TABLE advertisement_consumer.settlement_ledger
(
    ledger_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    ledger_guid char(32) UNIQUE,
    advertisement_request_guid char(32),
    object_guid char(32),
    object_key char(32),
    protocol_address_hash char(128), -- (address received to)
    protocol_transaction_id char(64),
    protocol_output_position int(11),
    tx_address_deposit_vout_md5 char(32), -- (unique index based on md5 of 4 values prevents duplicate deposit records from the same protocol tx)
    deposit decimal(32,16),
    price_usd decimal(32,16),
    protocol_is_stable tinyint(1),
    protocol_is_double_spend tinyint(1),
    expiration timestamp, -- (indicates when the record can be pruned)
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO advertisement_consumer.settlement_ledger SELECT * FROM advertisement_consumer.advertisement_attribute_type;
DROP TABLE advertisement_consumer.advertisement_attribute_type;

INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('mlx', 'ytvVWD56H'); /*currency type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('usd', '03VWEI5AS');

CREATE TABLE advertisement_consumer.new_advertisement_ledger
(
    ledger_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    ledger_guid char(32) UNIQUE,
    ledger_guid_pair char(32),
    advertisement_guid char(32),
    advertisement_request_guid char(32), -- (matches payment to request and click logs)
    transaction_type_guid char(32),
    tx_address_deposit_vout_md5 char(32) UNIQUE, -- md5 of 4 values prevents duplicate deposit records from the same protocol tx
    currency_guid char(32),
    deposit decimal(32,16),
    withdrawal decimal(32,16),
    price_usd decimal(32,16),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer'),
    UNIQUE(advertisement_guid, advertisement_request_guid, transaction_type_guid)
);
CREATE INDEX idx_advertisement_ledger_advertisement_request ON advertisement_consumer.advertisement_ledger ("advertisement_guid", "advertisement_request_guid");

INSERT INTO advertisement_advertiser.new_advertisement_ledger SELECT * FROM advertisement_advertiser.advertisement_ledger;
DROP TABLE advertisement_advertiser.advertisement_ledger;
ALTER TABLE advertisement_advertiser.new_advertisement_ledger RENAME TO advertisement_ledger;

INSERT INTO advertisement_advertiser.ledger_attribute_type (attribute_type_guid, attribute_type) VALUES ('1VESrvDin', 'protocol_transaction_id');
INSERT INTO advertisement_advertiser.ledger_attribute_type (attribute_type_guid, attribute_type) VALUES ('HaaC5HUYp', 'protocol_output_position');

COMMIT;
