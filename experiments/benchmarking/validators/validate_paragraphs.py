from reasoning_guard import normalize_and_reject_reasoning

def validate_encourage_development(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"sentence", "feedback"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  sentence = obj["sentence"]
  feedback = obj["feedback"]

  if not isinstance(sentence, str):
    raise ValueError("sentence must be a string.")
  if not isinstance(feedback, str):
    raise ValueError("feedback must be a string.")

  normalized_sentence = normalize_and_reject_reasoning(sentence, "sentence")
  normalized_feedback = normalize_and_reject_reasoning(feedback, "feedback")

  if not normalized_sentence:
    raise ValueError("sentence must not be empty.")
  if not normalized_feedback:
    raise ValueError("feedback must not be empty.")

  return {
    "sentence": normalized_sentence,
    "feedback": normalized_feedback,
  }

def validate_anything_unclear(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"all_clear", "sentence", "feedback"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  all_clear = obj["all_clear"]
  sentence = obj["sentence"]
  feedback = obj["feedback"]

  if all_clear not in {"yes", "no"}:
    raise ValueError("all_clear must be 'yes' or 'no'.")
  if not isinstance(sentence, str):
    raise ValueError("sentence must be a string.")
  if not isinstance(feedback, str):
    raise ValueError("feedback must be a string.")

  normalized_sentence = normalize_and_reject_reasoning(sentence, "sentence")
  normalized_feedback = normalize_and_reject_reasoning(feedback, "feedback")

  if all_clear == "no" and not normalized_sentence:
    raise ValueError("sentence must be non-empty when all_clear is 'no'.")
  if all_clear == "no" and not normalized_feedback:
    raise ValueError("feedback must be non-empty when all_clear is 'no'.")

  return {
    "all_clear": all_clear,
    "sentence": normalized_sentence,
    "feedback": normalized_feedback,
  }
