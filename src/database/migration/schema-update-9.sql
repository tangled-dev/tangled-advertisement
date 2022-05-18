BEGIN TRANSACTION;
UPDATE schema_information SET value = "9" WHERE key = "version";

CREATE TABLE advertisement_advertiser.new_advertisement_request_log
(
    log_id                          INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    log_guid                        char(32) UNIQUE,
    advertisement_guid              char(32),
    advertisement_request_guid      char(32),
    tangled_guid_consumer           char(32),
    tangled_guid_device             char(64),
    protocol_address_key_identifier char(64),
    ip_address_consumer             varchar(45),
    object_guid                     char(32),                                                                                -- (i.e. advertisement_attribute)
    object_key                      char(32),                                                                                -- (i.e. create_attribute_guid of a target phrase that matched targeting)
    advertisement_request_raw       varchar(2000),
    bid_impression_mlx              bigint(16),
    expiration_settlement           timestamp,                                                                               -- (indicates when the request is no longer eligible for settlement)
    expiration                      timestamp,                                                                               -- (indicates when the record can be pruned)
    status                          smallint  NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'), -- (0=not settled, 1=settled)
    create_date                     timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO advertisement_advertiser.new_advertisement_request_log(log_id, log_guid, advertisement_guid, advertisement_request_guid, tangled_guid_consumer, protocol_address_key_identifier, ip_address_consumer, object_guid, object_key, advertisement_request_raw, bid_impression_mlx, expiration_settlement, expiration, status, create_date)  SELECT log_id, log_guid, advertisement_guid, advertisement_request_guid, tangled_guid_consumer, protocol_address_key_identifier, ip_address_consumer, object_guid, object_key, advertisement_request_raw, bid_impression_mlx, expiration_settlement, expiration, status, create_date FROM advertisement_advertiser.advertisement_request_log;
DROP TABLE advertisement_advertiser.advertisement_request_log;
ALTER TABLE advertisement_advertiser.new_advertisement_request_log RENAME TO advertisement_request_log;

CREATE INDEX advertisement_advertiser.idx_advertisement_request_log_advertisement_request ON advertisement_request_log ("advertisement_guid", "advertisement_request_guid");
CREATE INDEX advertisement_advertiser.idx_advertisement_request_log_tangled_guid_consumer_status ON advertisement_request_log ("tangled_guid_consumer", "status");
CREATE INDEX advertisement_advertiser.idx_advertisement_request_log_tangled_guid_device_status ON advertisement_request_log ("tangled_guid_device", "status");
CREATE INDEX advertisement_advertiser.idx_advertisement_request_log_status_create_date ON advertisement_request_log ("status", "create_date");

COMMIT;
