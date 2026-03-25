PRAGMA foreign_keys = ON;

INSERT INTO entities (uuid, type, created_at)
VALUES ('file-alpha', 'file', '2026-02-19T00:00:00.000Z')
ON CONFLICT(uuid) DO NOTHING;

INSERT INTO filepath (uuid, path, created_at)
VALUES ('folder-alpha', '/tmp/alpha', '2026-02-19T00:00:00.000Z')
ON CONFLICT(uuid) DO NOTHING;

INSERT INTO filename (entity_uuid, filepath_uuid, append_path, file_name, created_at)
VALUES ('file-alpha', 'folder-alpha', NULL, 'file-alpha.docx', '2026-02-19T00:00:00.000Z')
ON CONFLICT(entity_uuid) DO NOTHING;

INSERT INTO feedback (
  uuid,
  entity_uuid,
  source,
  kind,
  comment_text,
  exact_quote,
  prefix_text,
  suffix_text,
  applied,
  created_at,
  updated_at
) VALUES (
  'feedback-inline-1',
  'file-alpha',
  'teacher',
  'inline',
  'Use a more formal transition phrase in this sentence.',
  'in my opinion',
  'However, ',
  ', this can be stated more objectively.',
  0,
  '2026-02-19T00:00:00.000Z',
  NULL
);

INSERT INTO feedback_anchors (
  feedback_uuid,
  anchor_kind,
  part,
  paragraph_index,
  run_index,
  text_node_index,
  char_offset
) VALUES
  ('feedback-inline-1', 'start', 'body', 2, 0, 0, 5),
  ('feedback-inline-1', 'end', 'body', 2, 0, 0, 18);

INSERT INTO feedback (
  uuid,
  entity_uuid,
  source,
  kind,
  comment_text,
  applied,
  created_at,
  updated_at
) VALUES (
  'feedback-block-1',
  'file-alpha',
  'llm',
  'block',
  'Your conclusion summarizes key points well. Add one sentence about future impact.',
  1,
  '2026-02-19T00:10:00.000Z',
  '2026-02-19T00:12:00.000Z'
);

SELECT
  f.uuid,
  f.entity_uuid,
  f.source,
  f.kind,
  f.comment_text,
  f.exact_quote,
  f.prefix_text,
  f.suffix_text,
  f.applied,
  f.created_at,
  f.updated_at,
  a.anchor_kind,
  a.part,
  a.paragraph_index,
  a.run_index,
  a.text_node_index,
  a.char_offset
FROM feedback f
LEFT JOIN feedback_anchors a ON a.feedback_uuid = f.uuid
WHERE f.entity_uuid = 'file-alpha'
ORDER BY f.created_at ASC, a.anchor_kind ASC;
