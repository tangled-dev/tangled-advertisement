PRAGMA journal_mode= WAL;
PRAGMA auto_vacuum= FULL;
PRAGMA journal_size_limit = 4096;
BEGIN TRANSACTION;

CREATE TABLE api
(
    api_id             CHAR(16)   NOT NULL UNIQUE CHECK (length(api_id) <= 16),
    name               CHAR(255)  NOT NULL CHECK (length(name) <= 255),
    description        CHAR(1024) NOT NULL CHECK (length(description) <= 1024),
    method             CHAR(10)   NOT NULL CHECK (length(method) <= 10),
    version_released   CHAR(10)   NOT NULL CHECK (length(version_released) <= 10),
    version_deprecated CHAR(10)   NULL CHECK (length(version_deprecated) <= 10),
    version_removed    CHAR(10)   NULL CHECK (length(version_removed) <= 10),
    permission         TEXT       NOT NULL DEFAULT "true",
    status             TINYINT    NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date        INT        NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK (length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_api_create_date ON api (create_date);

CREATE TABLE normalization
(
    normalization_id   CHAR(20)     NOT NULL PRIMARY KEY CHECK (length(normalization_id) <= 20),
    normalization_name CHAR(255)    NOT NULL UNIQUE CHECK (length(normalization_name) <= 255),
    status             SMALLINT     NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date        INT          NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK(length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_normalization_create_date ON normalization (create_date);

CREATE TABLE schema_information
(
    key         TEXT         NOT NULL UNIQUE,
    value       TEXT         NOT NULL,
    status      TINYINT      NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date INT          NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK(length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_schema_information_create_date ON schema_information (create_date);

CREATE TABLE node
(
    node_id         CHAR(34)    NOT NULL PRIMARY KEY CHECK (length(node_id) <= 34),
    node_prefix     CHAR(10)    NOT NULL CHECK (length(node_prefix) <= 10),
    node_address CHAR(45)       NOT NULL CHECK (length(node_address) <= 45),
    node_port       INT         NOT NULL CHECK (length(node_port) <= 10 AND TYPEOF(node_port) = 'integer'),
    status          TINYINT     NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    update_date     INT         NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK(length(update_date) <= 10 AND TYPEOF(update_date) = 'integer'),
    create_date     INT         NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK(length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_node_create_date ON node (create_date);

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

INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('protocol_transaction_id', '1VESrvDin');/*advertisement ledger attribute*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('protocol_output_position', 'HaaC5HUYp');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('mlx', 'ytvVWD56H'); /*currency type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('usd', '03VWEI5AS');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('deposit:external', 'jJOwx2Mgb'); /*transaction_type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('withdrawal:external', 'DnDdawfh8');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('expense:operation:protocol fee', 'I27HitV7P');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('expense:marketing:advertising', 'UiQJcobEe');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('language', 'RmVag9taI'); /*advertisement_attribute object_guid*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('country', 'vbNcVMZWG');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('region', 'OQmJmLbqG');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('city', 'GO32wzIje');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target phrase', 'toIu91ah6');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('advertisement_image_path', 'hm8v3IUSZ'); /*advertisement_attribute_type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('advertisement_image_url_prefix', '79ptg9u0U');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('advertisement_image_url', '8cy53snGi');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('advertisement_headline', 'z9rgcVdjU');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('advertisement_deck', 'pH1cO8MUe');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_language', 'zM3z4cqOT');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_country_include', '3S17tKq7V');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_country_exclude', 'SU2wLnnRn');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_region_include', 'paFfJlqeR');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_region_exclude', '05nwtV6Kq');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_city_include', 'SGnzctXqJ');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_city_exclude', 'jpbnal2Dr');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('target_phrase', '99J0Ra9lJ');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('text_headline', 'i0URgvoeM'); /*advertisement_type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('text_headline_deck', 'iJuMChK8q');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('banner_300x50', '43pfkqsQN');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('banner_728x90', 'z28qi5Si9');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('category block', 'xTOylgMsL'); /*block_type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('advertiser block', '9hnbfRqGw');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('domain block', 'Xf5BaLUDd');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('offensive content', 'f7uTD9wx0');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('distracting content', 'QuAHfUj96');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('automotive', 'wlgaQIpo5'); /*advertisement_category_type*/
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('automotive - insurance', 'rZ3TS5d1j');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('automotive - loan', 'mgNNklCb2');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('travel', 'L9308amjm');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('coupons', 'U7sXdimXu');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('drug & alcohol', 'gSgf37DFT');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('education', 'lA2MnMRwk');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('entertainment', 'j4b7ndu8h');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('entertainment - gaming', 'OGMfSgRcx');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('food & beverage', 'XB6szJFk5');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('finance', 'by82Ao3dW');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('finance - credit card', '4mKt8VOzO');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('finance - loan', 'GsR6Ghxnz');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('finance - cryptocurrency', 'b5F6bDx0k');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('fashion', '2nLHWSLR9');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('fashion - men', '4MAQtMyn0');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('fashion - women', 'an4sRQjSv');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('fashion - children', 'KQNQkOt3K');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('health', '0REKO74dR');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('health - weight loss', 'JQWEIhrya');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('health - fitness', 'CSg5eUZnd');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('home', 'kBDMGx9yw');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('home - decoration', '3VDf1lOBi');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('home - insurance', 'KW00VaYCl');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('home - loan', 'nIfqZDnml');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('home - rental', '1NnQO0zkG');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('pets', 'Wg9ETN4rx');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('relationship', 'Bj8yHWu2U');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('relationship - women seeking men', 'e4Dyay9eV');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('relationship - men seeking women', 'pOLNT9oKD');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('technology', 'TQPs3dfZt');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('technology - phone', 'NQ2JTh96P');
INSERT INTO normalization (normalization_name, normalization_id) VALUES  ('technology - service', '884LpvLlG');

INSERT INTO schema_information (key, value) VALUES ("version", "3");

COMMIT;
