from reasoning_guard import normalize_and_reject_reasoning

def validate_analyze_gen_spec(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {
    "clear_topic",
    "topic",
    "sufficient_context",
    "essay_context",
    "relevance_highlighted",
    "relevance",
    "specific_focus_identified",
    "focus",
  }
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  clear_topic = obj["clear_topic"]
  topic = obj["topic"]
  sufficient_context = obj["sufficient_context"]
  essay_context = obj["essay_context"]
  relevance_highlighted = obj["relevance_highlighted"]
  relevance = obj["relevance"]
  specific_focus_identified = obj["specific_focus_identified"]
  focus = obj["focus"]

  if clear_topic not in {"yes", "no"}:
    raise ValueError("clear_topic must be 'yes' or 'no'.")
  if sufficient_context not in {"yes", "no"}:
    raise ValueError("sufficient_context must be 'yes' or 'no'.")
  if relevance_highlighted not in {"yes", "no"}:
    raise ValueError("relevance_highlighted must be 'yes' or 'no'.")
  if specific_focus_identified not in {"yes", "no"}:
    raise ValueError("specific_focus_identified must be 'yes' or 'no'.")

  if not isinstance(topic, str):
    raise ValueError("topic must be a string.")
  if not isinstance(essay_context, str):
    raise ValueError("essay_context must be a string.")
  if not isinstance(relevance, str):
    raise ValueError("relevance must be a string.")
  if not isinstance(focus, str):
    raise ValueError("focus must be a string.")

  normalized_topic = normalize_and_reject_reasoning(topic, "topic")
  normalized_essay_context = normalize_and_reject_reasoning(
    essay_context, "essay_context"
  )
  normalized_relevance = normalize_and_reject_reasoning(relevance, "relevance")
  normalized_focus = normalize_and_reject_reasoning(focus, "focus")

  if clear_topic == "yes" and not normalized_topic:
      raise ValueError("topic must be non-empty when clear_topic is 'yes'.")
  if sufficient_context == "yes" and not normalized_essay_context:
      raise ValueError("essay_context must be non-empty when sufficient_context is 'yes'.")
  if relevance_highlighted == "yes" and not normalized_relevance:
      raise ValueError("relevance must be non-empty when relevance_highlighted is 'yes'.")
  if specific_focus_identified == "yes" and not normalized_focus:
      raise ValueError("focus must be non-empty when specific_focus_identified is 'yes'.")

  return {
    "clear_topic": clear_topic,
    "topic": normalized_topic,
    "sufficient_context": sufficient_context,
    "essay_context": normalized_essay_context,
    "relevance_highlighted": relevance_highlighted,
    "relevance": normalized_relevance,
    "specific_focus_identified": specific_focus_identified,
    "focus": normalized_focus,
  }

def validate_introduction_feedback(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"feedback"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
      raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
      raise ValueError(f"Unexpected keys: {sorted(extra)}")

  feedback = obj["feedback"]

  if not isinstance(feedback, str):
      raise ValueError("feedback must be a string.")

  normalized_feedback = normalize_and_reject_reasoning(feedback, "feedback")
  if not normalized_feedback:
      raise ValueError("feedback must not be empty.")

  return {
      "feedback": normalized_feedback,
  }
