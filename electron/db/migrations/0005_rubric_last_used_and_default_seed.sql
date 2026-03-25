PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rubric_last_used (
  profile_key TEXT PRIMARY KEY,
  rubric_entity_uuid TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (rubric_entity_uuid) REFERENCES rubrics(entity_uuid) ON DELETE CASCADE
);

INSERT OR IGNORE INTO entities (uuid, type, created_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'rubric', '2026-02-20T00:00:00.000Z');

INSERT OR IGNORE INTO rubrics (entity_uuid, name, type)
VALUES ('11111111-1111-4111-8111-111111111111', 'ESL Writing Rubric', 'detailed');

INSERT OR IGNORE INTO rubric_details (uuid, entity_uuid, category, description) VALUES
('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Content', 'The writing is fully engaging for the reader and the writer explores ideas in depth.'),
('21111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'Content', 'The writing is engaging for the reader and the writer explore ideas in some depth.'),
('21111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111111', 'Content', 'The writing is interesting in places; the writer could expand on a few points.'),
('21111111-1111-4111-8111-111111111114', '11111111-1111-4111-8111-111111111111', 'Content', 'The writing relies mainly on standard tropes; the writer needs to expand with examples and explanations.'),
('21111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111111', 'Content', 'The writing seems to lack originality; the writer needs to expand on many points in the writing.'),
('21111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111111', 'Language', 'A variety of complex and simple sentences; excellent control of coherence across sentences; wide range of vocabulary'),
('21111111-1111-4111-8111-111111111117', '11111111-1111-4111-8111-111111111111', 'Language', 'A good variety of complex and simple sentences; good control of coherence; good range of vocabulary'),
('21111111-1111-4111-8111-111111111118', '11111111-1111-4111-8111-111111111111', 'Language', 'Some evidence of variety in sentence structure; coherence is reasonable; vocabulary could be expanded'),
('21111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111111', 'Language', 'Sentence structures varied only a little; sometimes coherence breaks down; range of vocabulary is narrow'),
('21111111-1111-4111-8111-111111111120', '11111111-1111-4111-8111-111111111111', 'Language', 'Control over sentence structures needs improving; coherence needs more work; vocabulary is sometimes inappropriate'),
('21111111-1111-4111-8111-111111111121', '11111111-1111-4111-8111-111111111111', 'Organization', 'All features of well organized writing are clear and precise (thesis statement, topic sentences, etc)'),
('21111111-1111-4111-8111-111111111122', '11111111-1111-4111-8111-111111111111', 'Organization', 'Evidence of well organized writing is mostly obvious.'),
('21111111-1111-4111-8111-111111111123', '11111111-1111-4111-8111-111111111111', 'Organization', 'Writing is generally well organized but a few areas need revising (e.g., thesis statement only in the conclusion)'),
('21111111-1111-4111-8111-111111111124', '11111111-1111-4111-8111-111111111111', 'Organization', 'Writing lacks some of the features of good organization such as poorly worded topic sentences or no conclusion'),
('21111111-1111-4111-8111-111111111125', '11111111-1111-4111-8111-111111111111', 'Organization', 'Writing lacks many of the features of good organization and needs significant revision');

INSERT OR IGNORE INTO rubric_scores (uuid, details_uuid, score_values) VALUES
('31111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 5),
('31111111-1111-4111-8111-111111111112', '21111111-1111-4111-8111-111111111112', 4),
('31111111-1111-4111-8111-111111111113', '21111111-1111-4111-8111-111111111113', 3),
('31111111-1111-4111-8111-111111111114', '21111111-1111-4111-8111-111111111114', 2),
('31111111-1111-4111-8111-111111111115', '21111111-1111-4111-8111-111111111115', 1),
('31111111-1111-4111-8111-111111111116', '21111111-1111-4111-8111-111111111116', 5),
('31111111-1111-4111-8111-111111111117', '21111111-1111-4111-8111-111111111117', 4),
('31111111-1111-4111-8111-111111111118', '21111111-1111-4111-8111-111111111118', 3),
('31111111-1111-4111-8111-111111111119', '21111111-1111-4111-8111-111111111119', 2),
('31111111-1111-4111-8111-111111111120', '21111111-1111-4111-8111-111111111120', 1),
('31111111-1111-4111-8111-111111111121', '21111111-1111-4111-8111-111111111121', 5),
('31111111-1111-4111-8111-111111111122', '21111111-1111-4111-8111-111111111122', 4),
('31111111-1111-4111-8111-111111111123', '21111111-1111-4111-8111-111111111123', 3),
('31111111-1111-4111-8111-111111111124', '21111111-1111-4111-8111-111111111124', 2),
('31111111-1111-4111-8111-111111111125', '21111111-1111-4111-8111-111111111125', 1);

INSERT INTO rubric_last_used (profile_key, rubric_entity_uuid, updated_at)
VALUES ('default', '11111111-1111-4111-8111-111111111111', '2026-02-20T00:00:00.000Z')
ON CONFLICT(profile_key) DO UPDATE SET
  rubric_entity_uuid = excluded.rubric_entity_uuid,
  updated_at = excluded.updated_at;
