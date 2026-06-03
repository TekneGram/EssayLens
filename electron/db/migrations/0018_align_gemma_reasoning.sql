ALTER TABLE llm_settings
ADD COLUMN llm_reasoning_mode TEXT;

ALTER TABLE llm_settings
ADD COLUMN llm_reasoning_budget INTEGER;

ALTER TABLE llm_selection_defaults
ADD COLUMN llm_reasoning_mode TEXT;

ALTER TABLE llm_selection_defaults
ADD COLUMN llm_reasoning_budget INTEGER;

UPDATE llm_selection_defaults
SET model_family = 'instruct/think',
    llm_reasoning_mode = 'off',
    llm_reasoning_budget = 0
WHERE model_key = 'gemma4_e4b_it_q4_k_m';

UPDATE llm_settings
SET llm_model_family = 'instruct/think',
    llm_reasoning_mode = 'off',
    llm_reasoning_budget = 0
WHERE id = 'default'
  AND EXISTS (
    SELECT 1
    FROM llm_selection s
    WHERE s.model_key = 'gemma4_e4b_it_q4_k_m'
      AND s.is_active = 1
  );
