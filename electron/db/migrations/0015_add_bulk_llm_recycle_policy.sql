ALTER TABLE llm_settings
ADD COLUMN bulk_llm_recycle_policy TEXT NOT NULL DEFAULT 'after_each_file'
CHECK (bulk_llm_recycle_policy IN ('never', 'after_each_file'));

ALTER TABLE llm_selection_defaults
ADD COLUMN bulk_llm_recycle_policy TEXT NOT NULL DEFAULT 'after_each_file'
CHECK (bulk_llm_recycle_policy IN ('never', 'after_each_file'));
