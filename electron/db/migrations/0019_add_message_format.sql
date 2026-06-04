ALTER TABLE llm_settings
ADD COLUMN llm_message_format TEXT NOT NULL DEFAULT 'openai'
CHECK (llm_message_format IN ('openai', 'gemma'));

ALTER TABLE llm_selection_defaults
ADD COLUMN llm_message_format TEXT NOT NULL DEFAULT 'openai'
CHECK (llm_message_format IN ('openai', 'gemma'));

UPDATE llm_selection_defaults
SET llm_message_format = 'gemma'
WHERE model_key = 'gemma4_e4b_it_q4_k_m';

UPDATE llm_selection_defaults
SET llm_message_format = 'openai'
WHERE model_key != 'gemma4_e4b_it_q4_k_m';

UPDATE llm_settings
SET llm_message_format = 'gemma'
WHERE id = 'default'
  AND EXISTS (
    SELECT 1
    FROM llm_selection s
    WHERE s.model_key = 'gemma4_e4b_it_q4_k_m'
      AND s.is_active = 1
  );

UPDATE llm_settings
SET llm_message_format = 'openai'
WHERE id = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM llm_selection s
    WHERE s.model_key = 'gemma4_e4b_it_q4_k_m'
      AND s.is_active = 1
  );
