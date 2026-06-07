ALTER TABLE llm_settings
ADD COLUMN llm_log_outbound_payload INTEGER NOT NULL DEFAULT 0
CHECK (llm_log_outbound_payload IN (0, 1));

ALTER TABLE llm_selection_defaults
ADD COLUMN llm_log_outbound_payload INTEGER NOT NULL DEFAULT 0
CHECK (llm_log_outbound_payload IN (0, 1));
