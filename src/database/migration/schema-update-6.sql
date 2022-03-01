BEGIN TRANSACTION;
UPDATE schema_information SET value = "6" WHERE key = "version";

DROP TABLE advertisement_consumer.advertisement_queue;

CREATE TABLE advertisement_consumer.advertisement_queue
(
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    queue_guid char(32) UNIQUE,
    ledger_guid char(32),
    advertisement_guid char(32),
    tangled_guid_advertiser char(32),
    ip_address_advertiser varchar(45),
    port_advertiser varchar(10),
    creative_request_guid char(32),
    bid_impression_mlx bigint(16),
    impression_guid char(32),
    advertisement_url varchar(2048),
    protocol_transaction_id varchar(128),
    protocol_output_position int(11),
    search_guid char(32),
    count_impression smallint,
    expiration timestamp,
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer'),
    UNIQUE (advertisement_guid, creative_request_guid)
);

COMMIT;
