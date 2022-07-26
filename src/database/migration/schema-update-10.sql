BEGIN TRANSACTION;
UPDATE schema_information SET value = "10" WHERE key = "version";

DELETE FROM advertisement_consumer.advertisement_attribute;

DROP TABLE advertisement_consumer.advertisement_queue;
CREATE TABLE advertisement_consumer.advertisement_queue
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
CREATE INDEX advertisement_consumer.idx_advertisement_queue_create_date_protocol_transaction_id_count_impression ON advertisement_queue ("create_date",  "protocol_transaction_id",  "count_impression");

COMMIT;
