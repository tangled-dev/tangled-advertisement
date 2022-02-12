BEGIN TRANSACTION;
UPDATE schema_information SET value = "4" WHERE key = "version";

CREATE TABLE config
(
    config_id   CHAR(20)     NOT NULL PRIMARY KEY CHECK (length(config_id) <= 20),
    config_name TEXT         NOT NULL UNIQUE,
    value       TEXT         NOT NULL,
    type        TEXT         NOT NULL,
    status      SMALLINT     NOT NULL DEFAULT 1 CHECK (length(status) <= 3 AND TYPEOF(status) = 'integer'),
    create_date INT          NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)) CHECK(length(create_date) <= 10 AND TYPEOF(create_date) = 'integer')
);
CREATE INDEX idx_config_create_date ON config (create_date);

COMMIT;
