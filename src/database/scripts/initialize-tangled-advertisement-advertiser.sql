PRAGMA journal_mode= WAL;
PRAGMA auto_vacuum= FULL;
PRAGMA journal_size_limit = 4096;
BEGIN TRANSACTION;
CREATE TABLE advertisement
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
CREATE INDEX idx_advertisement_create_date ON advertisement ("create_date");
-- status smallint (0=inactive, 1=active, 2=pause_funding),

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
-- object_guid char(32) (language, country, region, city, target phrase)
CREATE INDEX attr_adv_type_obj_key ON advertisement_attribute (advertisement_attribute_guid, advertisement_guid, attribute_type_guid, object_guid, object_key);
CREATE INDEX idx_advertisement_attribute_create_date ON advertisement_attribute ("create_date");

-- advertisement_image_path, advertisement_image_url_prefix, advertisement_image_url, advertisement_headline, advertisement_deck
-- target_language, target_country_include, target_country_exclude, target_region_include, target_region_exclude, target_city_include, target_city_exclude, target_phrase, target_phrase_link

CREATE TABLE advertisement_attribute_type
(
    attribute_type_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    attribute_type_guid char(32) UNIQUE,
    attribute_type char(32),
    description varchar(400),
    phrase_guid char(32),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('advertisement_image_path', 'hm8v3IUSZ'); /*advertisement_attribute_type*/
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('advertisement_image_url_prefix', '79ptg9u0U');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('advertisement_image_url', '8cy53snGi');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('advertisement_headline', 'z9rgcVdjU');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('advertisement_deck', 'pH1cO8MUe');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_language', 'zM3z4cqOT');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_country_include', '3S17tKq7V');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_country_exclude', 'SU2wLnnRn');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_region_include', 'paFfJlqeR');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_region_exclude', '05nwtV6Kq');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_city_include', 'SGnzctXqJ');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_city_exclude', 'jpbnal2Dr');
INSERT INTO advertisement_attribute_type (attribute_type, attribute_type_guid) VALUES  ('target_phrase', '99J0Ra9lJ');


-- trigger populated roll up table.
CREATE TABLE advertisement_balance
(
    balance_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    balance_guid char(32) UNIQUE,
    advertisement_guid char(32),
    request_count bigint(32),
    impression_count bigint(32),
    settlement_count bigint(32),
    click_count bigint(32),
    block_count bigint(32),
    spent_mlx_sum bigint(16),
    spent_usd_sum decimal(16,8),
    update_count bigint(32),
    updated timestamp,
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_advertisement_balance_create_date ON advertisement_balance ("create_date");

-- each time a consumer requests advertisements, a log entry is made.
-- a advertisement_request_guid is provided with the request, and with the subsequent settlement request.
-- the bid for the impression is stamped with the request log entry.
-- the settlement request must match an unexpired record in the request log for it to be paid.

-- populated by advertiser
-- provided by consumer

CREATE TABLE advertisement_request_log
(
    log_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    log_guid char(32) UNIQUE,
    advertisement_guid char(32),
    advertisement_request_guid char(32),
    tangled_guid_consumer char(32),
    tangled_guid_device   char(64),
    protocol_address_key_identifier char(64),
    ip_address_consumer varchar(45),
    object_guid char(32), -- (i.e. advertisement_attribute)
    object_key char(32), -- (i.e. create_attribute_guid of a target phrase that matched targeting)
    advertisement_request_raw varchar(2000),
    bid_impression_mlx bigint(16),
    expiration_settlement timestamp, -- (indicates when the request is no longer eligible for settlement)
    expiration timestamp, -- (indicates when the record can be pruned)
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'), -- (0=not settled, 1=settled)
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_advertisement_request_log_advertisement_request ON advertisement_request_log ("advertisement_guid", "advertisement_request_guid");
CREATE INDEX idx_advertisement_request_log_advertisement_request_guid_status ON advertisement_request_log ("advertisement_request_guid", "status");
CREATE INDEX idx_advertisement_request_log_tangled_guid_consumer_status ON advertisement_request_log ("tangled_guid_consumer", "status");
CREATE INDEX idx_advertisement_request_log_tangled_guid_device_status ON advertisement_request_log ("tangled_guid_device", "status");
CREATE INDEX idx_advertisement_request_log_ip_address_consumer_status ON advertisement_request_log ("ip_address_consumer", "status");

-- replace click log with umbrella table
-- advertisement_engagement_log

-- when the consumer tangled detects than ad advertisement has been clicked,
-- it posts the event back to the advertiser to be logged.
-- this table is for advertiser reporting, it is not used for any process logic.

CREATE TABLE advertisement_click_log
(
    log_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    log_guid char(32) UNIQUE,
    advertisement_guid char(32),
    advertisement_request_guid char(32),
    tangled_guid_consumer char(32),
    protocol_address_key_identifier char(64),
    ip_address_consumer varchar(45),
    expiration timestamp,
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_advertisement_click_log_create_date ON advertisement_click_log ("create_date");

-- records deposits to the funding address, payments to consumers and transaction fees.
-- used to calculate the minute, hourly and daily spend amount to manage daily budget limits.
-- a payment has two records: the intended payment amount and the protocol transaction fee,
-- which is associated using the ledger_guid_pair.

CREATE TABLE advertisement_ledger
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
CREATE INDEX idx_advertisement_ledger_advertisement_request ON advertisement_ledger ("advertisement_guid", "advertisement_request_guid");
CREATE INDEX idx_advertisement_ledger_create_date ON advertisement_ledger ("create_date");

CREATE TABLE advertisement_ledger_attribute
(
    ledger_attribute_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    ledger_attribute_guid char(32) UNIQUE,
    ledger_guid char(32),
    attribute_type_guid char(32),
    object_guid char(32),
    object_key char(32),
    value varchar(8000),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_advertisement_ledger_attribute_ledger_guid ON advertisement_ledger_attribute ("ledger_guid");
CREATE INDEX idx_advertisement_ledger_attribute_create_date ON advertisement_ledger_attribute ("create_date");

-- protocol_transaction_id, protocol_output_position

CREATE TABLE ledger_attribute_type
(
    attribute_type_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    attribute_type_guid char(32) UNIQUE,
    attribute_type varchar(400),
    description varchar(2000),
    phrase_guid char(32),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO ledger_attribute_type (attribute_type_guid, attribute_type) VALUES ('1VESrvDin', 'protocol_transaction_id');
INSERT INTO ledger_attribute_type (attribute_type_guid, attribute_type) VALUES ('HaaC5HUYp', 'protocol_output_position');

-- transaction_type
-- populate records:
-- jJOwx2Mgb	= deposit:external
-- DnDdawfh8 	= withdrawal:external
-- I27HitV7P 	= expense:operation:protocol fee
-- UiQJcobEe 	= expense:marketing:advertising

CREATE TABLE transaction_type
(
    transaction_type_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    transaction_type_guid char(32) UNIQUE,
    transaction_type varchar(100),
    accounting_report varchar(45),
    ledger varchar(45),
    ui_icon varchar(100),
    phrase_guid char(32),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO transaction_type (transaction_type_guid, transaction_type) VALUES ('jJOwx2Mgb', 'deposit:external');
INSERT INTO transaction_type (transaction_type_guid, transaction_type) VALUES ('DnDdawfh8', 'withdrawal:external');
INSERT INTO transaction_type (transaction_type_guid, transaction_type) VALUES ('I27HitV7P', 'expense:operation:protocol fee');
INSERT INTO transaction_type (transaction_type_guid, transaction_type) VALUES ('UiQJcobEe', 'expense:marketing:advertising');


-- (text_headline, text_headline_deck, banner_300x50, banner_728x90)

CREATE TABLE advertisement_type
(
    advertisement_type_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    advertisement_type_guid char(32) UNIQUE,
    advertisement_type varchar(100),
    phrase_guid char(32),
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);

INSERT INTO advertisement_type (advertisement_type, advertisement_type_guid) VALUES  ('text_headline', 'i0URgvoeM'); /*advertisement_type*/
INSERT INTO advertisement_type (advertisement_type, advertisement_type_guid) VALUES  ('text_headline_deck', 'iJuMChK8q');
INSERT INTO advertisement_type (advertisement_type, advertisement_type_guid) VALUES  ('banner_300x50', '43pfkqsQN');
INSERT INTO advertisement_type (advertisement_type, advertisement_type_guid) VALUES  ('banner_728x90', 'z28qi5Si9');

-- advertisement_block_log
-- when a consumer initiates a block while viewing the advertiser's advertisement,
-- the event is submitted to the advertiser for their reports.
-- the tangled consumer that blocked the advertiser is not identified.

CREATE TABLE advertisement_block_log
(
    log_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    log_guid char(32) UNIQUE,
    block_type_guid char(32),
    advertisement_guid char(32),
    language_guid char(32),
    country_guid char(32),
    region_guid char(32),
    city_guid char(32),
    object_guid char(32), -- (tangled_guid_advertiser, advertiser_ip_address, advertisement_domain, advertisement_category_guid)
    object_key char(32), -- (contain a record identifier associated with any object)
    expiration timestamp,
    status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_advertisement_block_log_create_date ON advertisement_block_log ("create_date");


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

-- advertisement_category
-- lookup table with broad categories of industry and sub categories represented with the parent field.
-- tangled.com will maintain a master table which nodes should poll regularly.
-- the categories are loose enough for every ad to have an assignment
-- and tight enough for a consumer to block a category without affecting potential ads of interest.  for example:

-- automotive, automotive - insurance, automotive - loan
-- travel
-- coupons
-- drug & alcohol
-- education
-- entertainment, entertainment - gaming
-- food & beverage
-- finance, finance - credit card, finance - loan, finance - cryptocurrency
-- fashion, fashion - men, fashion - women, fashion - children
-- health, health - weight loss, health - fitness
-- home, home - decoration, home - insurance, home - loan, home - rental
-- pets
-- relationship, relationship - women seeking men, relationship - men seeking women
-- technology, technology - phone, technology - service
-- etc

CREATE TABLE advertisement_category
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

INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('automotive', 'wlgaQIpo5', NULL); /*advertisement_category*/
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('automotive - insurance', 'rZ3TS5d1j', 'wlgaQIpo5');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('automotive - loan', 'mgNNklCb2', 'wlgaQIpo5');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('travel', 'L9308amjm', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('coupons', 'U7sXdimXu', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('drug & alcohol', 'gSgf37DFT', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('education', 'lA2MnMRwk', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('entertainment', 'j4b7ndu8h', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('entertainment - gaming', 'OGMfSgRcx', 'j4b7ndu8h');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('food & beverage', 'XB6szJFk5', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('finance', 'by82Ao3dW', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('finance - credit card', '4mKt8VOzO', 'by82Ao3dW');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('finance - loan', 'GsR6Ghxnz', 'by82Ao3dW');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('finance - cryptocurrency', 'b5F6bDx0k', 'by82Ao3dW');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('fashion', '2nLHWSLR9', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('fashion - men', '4MAQtMyn0', '2nLHWSLR9');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('fashion - women', 'an4sRQjSv', '2nLHWSLR9');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('fashion - children', 'KQNQkOt3K', '2nLHWSLR9');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('health', '0REKO74dR', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('health - weight loss', 'JQWEIhrya', '0REKO74dR');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('health - fitness', 'CSg5eUZnd', '0REKO74dR');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('home', 'kBDMGx9yw', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('home - decoration', '3VDf1lOBi', 'kBDMGx9yw');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('home - insurance', 'KW00VaYCl', 'kBDMGx9yw');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('home - loan', 'nIfqZDnml', 'kBDMGx9yw');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('home - rental', '1NnQO0zkG', 'kBDMGx9yw');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('pets', 'Wg9ETN4rx', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('relationship', 'Bj8yHWu2U', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('relationship - women seeking men', 'e4Dyay9eV', 'Bj8yHWu2U');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('relationship - men seeking women', 'pOLNT9oKD', 'Bj8yHWu2U');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('technology', 'TQPs3dfZt', NULL);
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('technology - phone', 'NQ2JTh96P', 'TQPs3dfZt');
INSERT INTO advertisement_category (advertisement_category, advertisement_category_guid, advertisement_category_guid_parent) VALUES  ('technology - service', '884LpvLlG', 'TQPs3dfZt');

COMMIT;
