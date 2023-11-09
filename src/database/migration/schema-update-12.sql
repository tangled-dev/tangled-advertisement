BEGIN TRANSACTION;
UPDATE schema_information SET value = "12" WHERE key = "version";

CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_ledger_advertisement_request_guid ON advertisement_ledger ("advertisement_request_guid");

CREATE TABLE IF NOT EXISTS advertisement_advertiser.advertisement_network
(
    network_id                      INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    network_guid                    char(32) UNIQUE NOT NULL,
    network_name                    varchar(256)    NOT NULL,
    network_domain                  varchar(256),
    budget_daily_usd                decimal(16, 8)  NOT NULL DEFAULT 0.0,
    budget_daily_mlx                bigint(16)      NOT NULL DEFAULT 0,
    protocol_address_hash           char(128)       NOT NULL,
    protocol_address_key_public     char(45)        NOT NULL,
    object_guid                     char(32),
    object_key                      char(32),
    status                          smallint        NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date                     timestamp       NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_guid_status ON advertisement_network ("network_guid", "status");

CREATE TABLE IF NOT EXISTS advertisement_advertiser.advertisement_network_request_log
(
    log_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    log_guid                        char(32) UNIQUE,
    advertisement_guid              char(32),
    advertisement_url               varchar(2048),
    advertisement_request_guid      char(32),
    network_guid                    char(32),
    network_guid_device             char(64),
    ip_address_device               varchar(45),
    advertisement_request_raw       varchar(2000),
    bid_impression_mlx              bigint(16),
    count_impression                int(32),
    expiration                      timestamp, -- (indicates when the record can be pruned)
    object_guid                     char(32), -- (i.e. advertisement_attribute)
    object_key                      char(32), -- (i.e. create_attribute_guid of a target phrase that matched targeting)
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_request_log_advertisement_request ON advertisement_network_request_log ("advertisement_guid", "advertisement_request_guid");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_request_log_advertisement_request_guid_status ON advertisement_network_request_log ("advertisement_request_guid", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_request_log_network_guid_status ON advertisement_network_request_log ("network_guid", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_request_log_network_guid_device_status ON advertisement_network_request_log ("network_guid_device", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_request_log_ip_address_device_status ON advertisement_network_request_log ("ip_address_device", "status");
CREATE INDEX IF NOT EXISTS advertisement_advertiser.idx_advertisement_network_request_log_expiration_status ON advertisement_network_request_log ("expiration", "status");

CREATE TABLE IF NOT EXISTS advertisement_consumer.advertisement_network_publisher
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
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_network_publisher_guid_status ON advertisement_network_publisher ("publisher_guid", "status");

CREATE TABLE IF NOT EXISTS advertisement_consumer.advertisement_network_webmaster
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
CREATE INDEX IF NOT EXISTS advertisement_consumer.advertisement_network_webmaster_guid_status ON advertisement_network_webmaster ("webmaster_guid", "status");

CREATE TABLE IF NOT EXISTS advertisement_consumer.advertisement_network_webmaster_queue
(
    queue_id                            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    queue_guid                          char(32) UNIQUE,
    ledger_guid                         char(32),
    webmaster_guid                      char(32) NOT NULL,
    webmaster_target_guid               varchar(32) NOT NULL,
    webmaster_targer_ip_address         varchar(40) NOT NULL,
    webmaster_targer_language           varchar(10),
    advertisement_network_queue_guid    char(32) NOT NULL,
    bid_impression_mlx                  bigint(16) NOT NULL,
    impression_guid                     char(32),     -- (md5 shared with advertiser to confirm the record has not been altered by the consumer)
    advertisement_url                   varchar(2048) NOT NULL,
    count_impression                    smallint DEFAULT 1,
    status                              smallint  NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'), /*status 0=inactive, 1=active */
    create_date                         timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_network_webmaster_queue_ledger_guid_webmaster_guid ON advertisement_network_webmaster_queue ("ledger_guid", "webmaster_guid");
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_network_webmaster_queue_webmaster_guid_webmaster_target_guid_advertisement_guid_status ON advertisement_network_webmaster_queue ("webmaster_guid", "webmaster_target_guid", "advertisement_guid", "status");
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_network_webmaster_queue_create_date_status ON advertisement_network_webmaster_queue ("create_date", "status");

CREATE TABLE IF NOT EXISTS advertisement_consumer.advertisement_network_queue
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
CREATE INDEX IF NOT EXISTS advertisement_consumer.idx_advertisement_network_queue_ledger_status_payment_received_date ON advertisement_network_queue ("status", "payment_received_date");

COMMIT;
