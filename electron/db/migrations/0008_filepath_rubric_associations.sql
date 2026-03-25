PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS filepath_rubric_associations (
  filepath_uuid TEXT PRIMARY KEY,
  rubric_entity_uuid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  FOREIGN KEY (filepath_uuid) REFERENCES filepath(uuid) ON DELETE CASCADE,
  FOREIGN KEY (rubric_entity_uuid) REFERENCES rubrics(entity_uuid) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_filepath_rubric_associations_rubric
  ON filepath_rubric_associations(rubric_entity_uuid);
