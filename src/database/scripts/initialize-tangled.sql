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
