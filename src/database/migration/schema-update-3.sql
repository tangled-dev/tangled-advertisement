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

COMMIT;
