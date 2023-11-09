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
    payment_request_date timestamp NULL CHECK (payment_request_date IS NULL OR (length(payment_request_date) <= 10 AND TYPEOF(payment_request_date) = 'integer')),
    payment_received_date timestamp NULL CHECK (payment_received_date IS NULL OR (length(payment_received_date) <= 10 AND TYPEOF(payment_received_date) = 'integer')),
    impression_guid char(32), -- (md5 shared with advertiser to confirm the record has not been altered by the consumer)
    impression_date_first timestamp NULL CHECK (impression_date_first IS NULL OR (length(impression_date_first) <= 10 AND TYPEOF(impression_date_first) = 'integer')),
    impression_date_last timestamp NULL CHECK (impression_date_last IS NULL OR (length(impression_date_last) <= 10 AND TYPEOF(impression_date_last) = 'integer')),
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
CREATE INDEX idx_advertisement_queue_create_date_protocol_transaction_id_count_impression ON advertisement_queue ("create_date",  "protocol_transaction_id",  "count_impression");

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
CREATE INDEX idx_advertisement_attribute_create_date ON advertisement_attribute ("create_date");

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
CREATE INDEX idx_settlement_ledger_create_date ON settlement_ledger ("create_date");

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
CREATE INDEX idx_advertisement_block_create_date ON advertisement_block ("create_date");

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

CREATE TABLE advertisement_network_publisher
(
    publisher_id                    INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    publisher_guid                  char(32) UNIQUE NOT NULL,
    publisher_name                  varchar(256)    NOT NULL,
    publisher_domain                varchar(256),
    protocol_address_hash           char(128)       NOT NULL,
    protocol_address_key_public     char(45)        NOT NULL,
    object_guid                     char(32),
    object_key                      char(32),
    status                          smallint        NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date                     timestamp       NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
    );
CREATE INDEX idx_advertisement_network_publisher_guid_status ON advertisement_network_publisher ("publisher_guid", "status");

CREATE TABLE advertisement_network_webmaster
(
    webmaster_id                    INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    webmaster_guid                  char(32)        UNIQUE NOT NULL,
    webmaster_name                  varchar(256)    UNIQUE NOT NULL,
    webmaster_domain                varchar(256),
    webmaster_callback_url          varchar(256),
    protocol_address_hash           char(128)       NOT NULL,
    protocol_address_key_public     char(45)        NOT NULL,
    object_guid                     char(32),
    object_key                      char(32),
    status                          smallint        NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date                     timestamp       NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
    );
CREATE INDEX advertisement_network_webmaster_guid_status ON advertisement_network_webmaster ("webmaster_guid", "status");

CREATE TABLE advertisement_network_webmaster_queue
(
    queue_id                            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    queue_guid                          char(32) UNIQUE,
    ledger_guid                         char(32),
    webmaster_guid                      char(32) NOT NULL,
    webmaster_target_guid               varchar(32) NOT NULL,
    webmaster_target_ip_address         varchar(40) NOT NULL,
    webmaster_target_language           varchar(10),
    advertisement_network_queue_guid    char(32) NOT NULL,
    bid_impression_mlx                  bigint(16) NOT NULL,
    impression_guid                     char(32),     -- (md5 shared with advertiser to confirm the record has not been altered by the consumer)
    advertisement_url                   varchar(2048) NOT NULL,
    count_impression                    smallint DEFAULT 1,
    status                              smallint  NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'), /*status 0=inactive, 1=active */
    create_date                         timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
    );
CREATE INDEX idx_advertisement_network_webmaster_queue_ledger_guid_webmaster_guid ON advertisement_network_webmaster_queue ("ledger_guid", "webmaster_guid");
CREATE INDEX idx_advertisement_network_webmaster_queue_webmaster_guid_webmaster_target_guid_advertisement_guid_status ON advertisement_network_webmaster_queue ("webmaster_guid", "webmaster_target_guid", "advertisement_guid", "status");
CREATE INDEX idx_advertisement_network_webmaster_queue_create_date_status ON advertisement_network_webmaster_queue ("create_date", "status");

CREATE TABLE advertisement_network_queue
(
    queue_id                 INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    queue_guid               char(32) UNIQUE NOT NULL,
    ledger_guid              char(32) NOT NULL,
    publisher_guid           char(32) NOT NULL,
    advertisement_guid       char(32) NOT NULL,
    creative_request_guid    char(32) NOT NULL,
    bid_impression_mlx       bigint(16) NOT NULL,
    payment_request_date     timestamp NULL CHECK (payment_request_date IS NULL OR (length (payment_request_date) <= 10 AND TYPEOF(payment_request_date) = 'integer')),
    payment_received_date    timestamp NULL CHECK (payment_received_date IS NULL OR (length (payment_received_date) <= 10 AND TYPEOF(payment_received_date) = 'integer')),
    impression_guid          char(32),     -- (md5 shared with advertiser to confirm the record has not been altered by the consumer)
    impression_date_first    timestamp NULL CHECK (impression_date_first IS NULL OR (length (impression_date_first) <= 10 AND TYPEOF(impression_date_first) = 'integer')),
    impression_date_last     timestamp NULL CHECK (impression_date_last IS NULL OR (length (impression_date_last) <= 10 AND TYPEOF(impression_date_last) = 'integer')),
    advertisement_url        varchar(2048) NOT NULL,
    count_impression         smallint NOT NULL DEFAULT 0,
    count_paid_impression    smallint NOT NULL,
    expiration               timestamp NOT NULL,
    status                   smallint  NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'), /*status 0=inactive, 1=active */
    create_date              timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer'),
    UNIQUE (advertisement_guid, creative_request_guid)
    );
CREATE INDEX idx_advertisement_network_queue_ledger_status_payment_received_date ON advertisement_network_queue ("status", "payment_received_date");

COMMIT;
