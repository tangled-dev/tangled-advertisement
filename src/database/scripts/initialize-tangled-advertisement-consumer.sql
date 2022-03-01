PRAGMA journal_mode= WAL;
PRAGMA auto_vacuum= FULL;
PRAGMA journal_size_limit = 4096;
BEGIN TRANSACTION;
-- advertisement_queue
-- populated by advertiser
-- populated by consumer

CREATE TABLE advertisement_queue
(
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    queue_guid char(32) UNIQUE,
    ledger_guid char(32),
    advertisement_guid char(32),
    tangled_guid_advertiser char(32),
    ip_address_advertiser varchar(45), -- (used to send settlement request and inform the advertiser of click)
    port_advertiser varchar(10),
    creative_request_guid char(32),
    bid_impression_mlx bigint(16),
    impression_guid char(32), -- (md5 shared with advertiser to confirm the record has not been altered by the consumer)
    advertisement_url varchar(2048),
    protocol_transaction_id varchar(128), -- (populated when the advertisement has settled)
    protocol_output_position int(11),
    search_guid char(32), -- (advertisements targeted by phrase get prioritized for presentation)
    count_impression smallint,
    expiration timestamp,
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer'),
    UNIQUE (advertisement_guid, creative_request_guid)
);

-- advertisement_attribute
-- contains a reduced set of attribute types from the advertiser schema.
-- contains advertisement header, deck, image path etc to display the ad

CREATE TABLE advertisement_attribute
(
    advertisement_attribute_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    advertisement_attribute_guid char(32) UNIQUE,
    advertisement_guid char(32),
    attribute_type_guid char(32),
    object_guid char(32),
    object_key char(32),
    value varchar(8000),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

-- settlement_ledger
-- the settlement ledger tracks payments received by the consumer from advertisements.  this can report consumer revenue by date.  it is not a ledger because it doesn't need to track balance or withdrawals.

CREATE TABLE settlement_ledger
(
    ledger_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    ledger_guid char(32) UNIQUE,
    advertisement_request_guid char(32),
    object_guid char(32),
    object_key char(32),
    protocol_address_hash char(128), -- (address received to)
    protocol_transaction_id char(64),
    protocol_output_position int(11),
    tx_address_deposit_vout_md5 char(32) UNIQUE, -- (unique index based on md5 of 4 values prevents duplicate deposit records from the same protocol tx)
    deposit decimal(32,16),
    price_usd decimal(32,16),
    protocol_is_stable tinyint(1),
    protocol_is_double_spend tinyint(1),
    expiration timestamp, -- (indicates when the record can be pruned)
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

-- advertisement_block
-- a block list is included with the consumer's advertisement requests from the network.
-- advertisers compare the block list to their advertisement inventory to filter their response.
-- the block list data is formatted as name value pairs of object_guid | object_key to reduce the size of the list.

CREATE TABLE advertisement_block
(
    advertisement_block_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    advertisement_block_guid char(32) UNIQUE,
    block_type_guid char(32),
    object_guid char(32), -- (tangled_guid_advertiser, advertiser_ip_address, advertisement_domain, advertisement_category_type_guid)
    object_key char(32), -- (contain a record identifier associated with any object)
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

-- block_type
-- (category block, advertiser block, domain block, offensive content, distracting content)

CREATE TABLE block_type
(
    block_type_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    block_type_guid char(32) UNIQUE,
    block_type varchar(200),
    phrase_guid char(32),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO block_type (block_type_guid, block_type) VALUES  ('xTOylgMsL', 'category block');
INSERT INTO block_type (block_type_guid, block_type) VALUES  ('9hnbfRqGw', 'advertiser block');
INSERT INTO block_type (block_type_guid, block_type) VALUES  ('Xf5BaLUDd', 'domain block');
INSERT INTO block_type (block_type_guid, block_type) VALUES  ('f7uTD9wx0', 'offensive content');
INSERT INTO block_type (block_type_guid, block_type) VALUES  ('QuAHfUj96', 'distracting content');

COMMIT;
