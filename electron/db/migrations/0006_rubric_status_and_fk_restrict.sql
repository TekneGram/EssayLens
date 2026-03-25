PRAGMA foreign_keys = OFF;

ALTER TABLE rubrics ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1));
ALTER TABLE rubrics ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1));

UPDATE rubrics
SET is_active = COALESCE(is_active, 1),
    is_archived = COALESCE(is_archived, 0);

CREATE TABLE file_rubric_instances_new (
  uuid TEXT PRIMARY KEY,
  file_entity_uuid TEXT NOT NULL,
  rubric_entity_uuid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  FOREIGN KEY (file_entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE,
  FOREIGN KEY (rubric_entity_uuid) REFERENCES rubrics(entity_uuid) ON DELETE RESTRICT
);

INSERT INTO file_rubric_instances_new (uuid, file_entity_uuid, rubric_entity_uuid, created_at, edited_at)
SELECT uuid, file_entity_uuid, rubric_entity_uuid, created_at, edited_at
FROM file_rubric_instances;

DROP TABLE file_rubric_instances;
ALTER TABLE file_rubric_instances_new RENAME TO file_rubric_instances;

CREATE TABLE file_rubric_scores_new (
  uuid TEXT PRIMARY KEY,
  rubric_instance_uuid TEXT NOT NULL,
  rubric_detail_uuid TEXT NOT NULL,
  assigned_score TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  FOREIGN KEY (rubric_instance_uuid) REFERENCES file_rubric_instances(uuid) ON DELETE CASCADE,
  FOREIGN KEY (rubric_detail_uuid) REFERENCES rubric_details(uuid) ON DELETE RESTRICT
);

INSERT INTO file_rubric_scores_new (uuid, rubric_instance_uuid, rubric_detail_uuid, assigned_score, created_at, edited_at)
SELECT uuid, rubric_instance_uuid, rubric_detail_uuid, assigned_score, created_at, edited_at
FROM file_rubric_scores;

DROP TABLE file_rubric_scores;
ALTER TABLE file_rubric_scores_new RENAME TO file_rubric_scores;

CREATE INDEX IF NOT EXISTS idx_rubric_instances_file ON file_rubric_instances(file_entity_uuid);
CREATE INDEX IF NOT EXISTS idx_rubric_instances_rubric ON file_rubric_instances(rubric_entity_uuid);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_instance ON file_rubric_scores(rubric_instance_uuid);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_detail ON file_rubric_scores(rubric_detail_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_instance_detail ON file_rubric_scores(rubric_instance_uuid, rubric_detail_uuid);
CREATE INDEX IF NOT EXISTS idx_rubrics_archived_name ON rubrics(is_archived, name COLLATE NOCASE);

PRAGMA foreign_keys = ON;
