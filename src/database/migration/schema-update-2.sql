BEGIN TRANSACTION;
UPDATE schema_information SET value = "2" WHERE key = "version";

CREATE TABLE language(
     language_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
     language_code char(32),
     language_guid char(32) UNIQUE,
     language_name varchar(255),
     language_name_native varchar(255),
     list_order int(32),
     status smallint NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
     create_date timestamp NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);


INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('en', '49015ffef', 'english', 'english', 10);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ht', 'e987aba70', 'haitian', 'ayisyen', 20);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('et', '3149d8e01', 'estonian', 'eesti', 29);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('es', '01ad5be5c', 'spanish', 'español', 30);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('bn', 'c251b5ab4', 'bengali', 'bengali', 30);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('cs', '1ef8f0b1f', 'czech', 'čeština', 31);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('it', '0e033c6e9', 'italian', 'italiano', 50);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('da', '9c69d12d3', 'danish', 'dansk', 50);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('el', '0776fda62', 'greek', 'Ελληνικά', 52);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('de', '995d6ba0a', 'german', 'deutsche', 55);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('id', '441f09009', 'indonesian', 'indonesia', 60);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('tl', 'ba88bb28e', 'filipino', 'filipino', 60);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('is', '367fe37f5', 'icelandic', 'islensku', 62);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('kn', '4339f421b', 'kannada', 'kannada', 65);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('gu', 'ed0053bc6', 'gujarati', 'gujarati', 65);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('jw', '0c68b8b29', 'javanese', 'javanese', 65);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('fr', '8e727efdf', 'french', 'français', 65);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ku', 'a0ba5fe57', 'kurdish', 'kurdî', 66);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('hu', 'd836cde91', 'hungarian', 'magyar', 69);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ms', '9b0423ac1', 'malay', 'malay', 70);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('nl', 'e84e2b578', 'dutch', 'nederlands', 75);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('pl', 'dc5c4f299', 'polish', 'polskie', 78);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('pt', '6094877ec', 'portuguese', 'português', 80);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ru', 'abfc4f1b4', 'russian', 'pусский', 85);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('fi', 'd5f016c0c', 'finnish', 'suomalainen', 89);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('sw', 'f8bc06ece', 'swahili', 'swahili', 90);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('tr', '7b34df94f', 'turkish', 'türk', 91);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('uk', '760d77ce0', 'ukranian', 'український', 92);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('vi', '84dc74c4c', 'vietnamese', 'tiếng việt', 105);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('th', 'f3cca98d5', 'thai', 'ไทย', 140);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('zh', '6adbbb718', 'chinese', '中文', 300);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('iw', 'efcc258d6', 'hebrew', 'עִברִית', 320);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('hi', 'c6fa87b52', 'hindi', 'हिंदी', 330);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ja', '439e1b03f', 'japanese', '日本語', 340);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ko', '94b60b92c', 'korean', '한국어', 350);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ml', '8163c45e1', 'malayam', 'മല്യ്മ്', 360);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('fa', 'e3a715eb7', 'persian', 'فارسی', 370);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ta', 'a27b6c43a', 'tamil', 'தமிழ்', 380);
INSERT INTO language (language_code, language_guid, language_name, language_name_native, list_order) VALUES ('ur', '45c8f00f4', 'urdu', 'اردو', 390);

CREATE TABLE advertisement_advertiser.new_advertisement_click_log
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

INSERT INTO advertisement_advertiser.new_advertisement_click_log (log_id, log_guid, advertisement_guid, advertisement_request_guid, tangled_guid_consumer, protocol_address_key_identifier, ip_address_consumer, expiration) SELECT log_id, log_guid, advertisement_guid, advertisement_request_guid, tangled_guid_consumer, protocol_address_key_identifier, ip_address_consumer, expiration FROM advertisement_advertiser.advertisement_click_log;
DROP TABLE advertisement_advertiser.advertisement_click_log;
ALTER TABLE advertisement_advertiser.new_advertisement_click_log RENAME TO advertisement_click_log;

INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('protocol_transaction_id', 'xOg6QHxWh');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('protocol_output_position', 'NFusedKqF');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('mlx', 'MfWwkiPfX');

INSERT INTO advertisement_advertiser.ledger_attribute_type (attribute_type, attribute_type_guid) VALUES  ('protocol_transaction_id', 'xOg6QHxWh');
INSERT INTO advertisement_advertiser.ledger_attribute_type (attribute_type, attribute_type_guid) VALUES  ('protocol_output_position', 'NFusedKqF');

COMMIT;
