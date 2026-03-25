PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS feedback (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('teacher', 'llm')),
  kind TEXT NOT NULL CHECK (kind IN ('inline', 'block')),
  comment_text TEXT NOT NULL,
  exact_quote TEXT,
  prefix_text TEXT,
  suffix_text TEXT,
  applied INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE,
  CHECK (
    kind <> 'block'
    OR (exact_quote IS NULL AND prefix_text IS NULL AND suffix_text IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS feedback_anchors (
  feedback_uuid TEXT NOT NULL,
  anchor_kind TEXT NOT NULL CHECK (anchor_kind IN ('start', 'end')),
  part TEXT NOT NULL,
  paragraph_index INTEGER NOT NULL CHECK (paragraph_index >= 0),
  run_index INTEGER NOT NULL CHECK (run_index >= 0),
  text_node_index INTEGER NOT NULL CHECK (text_node_index >= 0) DEFAULT 0,
  char_offset INTEGER NOT NULL CHECK (char_offset >= 0),
  PRIMARY KEY (feedback_uuid, anchor_kind),
  FOREIGN KEY (feedback_uuid) REFERENCES feedback(uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_entity ON feedback(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_feedback_anchor_lookup ON feedback_anchors(part, paragraph_index, run_index, char_offset);

CREATE TRIGGER IF NOT EXISTS trg_feedback_anchor_requires_inline_insert
BEFORE INSERT ON feedback_anchors
FOR EACH ROW
WHEN (SELECT kind FROM feedback WHERE uuid = NEW.feedback_uuid) <> 'inline'
BEGIN
  SELECT RAISE(ABORT, 'ANCHOR_REQUIRES_INLINE_FEEDBACK');
END;

CREATE TRIGGER IF NOT EXISTS trg_feedback_anchor_requires_inline_update
BEFORE UPDATE OF feedback_uuid ON feedback_anchors
FOR EACH ROW
WHEN (SELECT kind FROM feedback WHERE uuid = NEW.feedback_uuid) <> 'inline'
BEGIN
  SELECT RAISE(ABORT, 'ANCHOR_REQUIRES_INLINE_FEEDBACK');
END;

CREATE TRIGGER IF NOT EXISTS trg_feedback_block_cannot_keep_anchors
BEFORE UPDATE OF kind ON feedback
FOR EACH ROW
WHEN NEW.kind = 'block'
  AND EXISTS (
    SELECT 1
    FROM feedback_anchors fa
    WHERE fa.feedback_uuid = NEW.uuid
  )
BEGIN
  SELECT RAISE(ABORT, 'BLOCK_FEEDBACK_CANNOT_RETAIN_ANCHORS');
END;
