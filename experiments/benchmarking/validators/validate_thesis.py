
def validate_determine_thesis_statement_shape(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"has_thesis_statement", "thesis_statement"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  has_thesis_statement = obj["has_thesis_statement"]
  thesis_statement = obj["thesis_statement"]

  if has_thesis_statement not in {"yes", "no clear statement"}:
    raise ValueError("has_thesis_statement must be 'yes' or 'no clear statement'.")

  if not isinstance(thesis_statement, str):
    raise ValueError("thesis_statement must be a string.")

  normalized_thesis_statement = thesis_statement.strip()

  if has_thesis_statement == "yes" and not normalized_thesis_statement:
    raise ValueError("thesis_statement must be non-empty when has_thesis_statement is 'yes'.")

  return { 
    "has_thesis_statement": has_thesis_statement,
    "thesis_statement": normalized_thesis_statement,
  }

def validate_thesis_statement_characteristics_shape(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")
  required_keys = {
    "main_idea",
    "clear_goal",
    "preview_topics",
    "writer_opinion",
  }
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  main_idea = obj["main_idea"]
  clear_goal = obj["clear_goal"]
  preview_topics = obj["preview_topics"]
  writer_opinion = obj["writer_opinion"]

  if main_idea not in {"yes", "no"}:
    raise ValueError("main_idea must be 'yes' or 'no'.")
  if clear_goal not in {"yes", "no"}:
    raise ValueError("clear_goal must be 'yes' or 'no'.")
  if preview_topics not in {"yes", "no"}:
    raise ValueError("preview_topics must be 'yes' or 'no'.")
  if writer_opinion not in {"yes", "no"}:
    raise ValueError("writer_opinion must be 'yes' or 'no'.")

  return {
    "main_idea": main_idea,
    "clear_goal": clear_goal,
    "preview_topics": preview_topics,
    "writer_opinion": writer_opinion,
  }

def validate_thesis_statement_advice_shape(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"praise_advice", "example_thesis", "explain_example"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  praise_advice = obj["praise_advice"]
  example_thesis = obj["example_thesis"]
  explain_example = obj["explain_example"]

  allowed_praise_advice = {
    "Your thesis statement is good so far, but it can be improved as follows: Your introduction is coming along nicely, but you need to work on your thesis statement. Try this:",
  }

  if praise_advice not in allowed_praise_advice:
    raise ValueError(
      "praise_advice must match one of the expected enum values."
    )

  if not isinstance(example_thesis, str):
    raise ValueError("example_thesis must be a string.")
  if not isinstance(explain_example, str):
    raise ValueError("explain_example must be a string.")

  normalized_example_thesis = example_thesis.strip()
  normalized_explain_example = explain_example.strip()

  if not normalized_example_thesis:
    raise ValueError("example_thesis must not be empty.")
  if not normalized_explain_example:
    raise ValueError("explain_example must not be empty.")

  return {
    "praise_advice": praise_advice,
    "example_thesis": normalized_example_thesis,
    "explain_example": normalized_explain_example,
  }

def validate_thesis_statement_comment(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"praise", "comment", "advice"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  praise = obj["praise"]
  comment = obj["comment"]
  advice = obj["advice"]

  allowed_praise = {
    "Your thesis statement is very nicely written.",
    "Well done on your thesis statement.",
    "Excellent work on your thesis statement.",
  }

  if praise not in allowed_praise:
    raise ValueError("praise must match one of the expected enum values.")

  if not isinstance(comment, str):
    raise ValueError("comment must be a string.")
  if not isinstance(advice, str):
    raise ValueError("advice must be a string.")

  normalized_comment = comment.strip()
  normalized_advice = advice.strip()

  if not normalized_comment:
    raise ValueError("comment must not be empty.")
  if not normalized_advice:
    raise ValueError("advice must not be empty.")

  return {
    "praise": praise,
    "comment": normalized_comment,
    "advice": normalized_advice,
  }

def validate_thesis_statement_heap_praise(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"praise", "comment"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  praise = obj["praise"]
  comment = obj["comment"]

  allowed_praise = {
    "A very impressive thesis statement.",
    "Outstanding thesis statement.",
    "Great work on your amazing thesis statement.",
  }

  if praise not in allowed_praise:
    raise ValueError("praise must match one of the expected enum values.")

  if not isinstance(comment, str):
    raise ValueError("comment must be a string.")

  normalized_comment = comment.strip()

  if not normalized_comment:
    raise ValueError("comment must not be empty.")

  return {
    "praise": praise,
    "comment": normalized_comment,
  }