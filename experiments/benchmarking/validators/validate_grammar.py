def validate_edit_for_style(
    obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"sentences"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  sentences = obj["sentences"]
  if not isinstance(sentences, dict):
    raise ValueError("sentences must be an object.")
  if set(sentences.keys()) != {"items"}:
    raise ValueError("sentences must contain only the 'items' key.")

  items = sentences["items"]
  if not isinstance(items, list):
    raise ValueError("sentences.items must be an array.")

  validated_items = []
  for index, item in enumerate(items):
    if not isinstance(item, dict):
      raise ValueError(f"sentences.items[{index}] must be an object.")
    if set(item.keys()) != {"sentence", "revision", "necessary"}:
      raise ValueError(
        f"sentences.items[{index}] must contain only 'sentence', 'revision', and 'necessary'."
      )

    sentence = item["sentence"]
    revision = item["revision"]
    necessary = item["necessary"]

    if not isinstance(sentence, str):
      raise ValueError(f"sentences.items[{index}].sentence must be a string.")
    if not isinstance(revision, str):
      raise ValueError(f"sentences.items[{index}].revision must be a string.")
    if necessary not in {"yes", "no"}:
      raise ValueError(f"sentences.items[{index}].necessary must be 'yes' or 'no'.")

    normalized_sentence = sentence.strip()
    normalized_revision = revision.strip()

    if not normalized_sentence:
      raise ValueError(f"sentences.items[{index}].sentence must not be empty.")
    if not normalized_revision:
      raise ValueError(f"sentences.items[{index}].revision must not be empty.")

    validated_items.append(
      {
        "sentence": normalized_sentence,
        "revision": normalized_revision,
        "necessary": necessary,
      }
    )

  return {
    "sentences": {
      "items": validated_items,
    }
  }

def validate_repair_grammar(
    obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"sentences"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  sentences = obj["sentences"]
  if not isinstance(sentences, dict):
    raise ValueError("sentences must be an object.")
  if set(sentences.keys()) != {"items"}:
    raise ValueError("sentences must contain only the 'items' key.")

  items = sentences["items"]
  if not isinstance(items, list):
    raise ValueError("sentences.items must be an array.")

  validated_items = []
  for index, item in enumerate(items):
    if not isinstance(item, dict):
      raise ValueError(f"sentences.items[{index}] must be an object.")
    if set(item.keys()) != {"sentence", "correction", "comments"}:
      raise ValueError(
        f"sentences.items[{index}] must contain only 'sentence', 'correction', and 'comments'."
      )

    sentence = item["sentence"]
    correction = item["correction"]
    comments = item["comments"]

    if not isinstance(sentence, str):
      raise ValueError(f"sentences.items[{index}].sentence must be a string.")
    if not isinstance(correction, str):
      raise ValueError(f"sentences.items[{index}].correction must be a string.")
    if not isinstance(comments, str):
      raise ValueError(f"sentences.items[{index}].comments must be a string.")

    normalized_sentence = sentence.strip()
    normalized_correction = correction.strip()
    normalized_comments = comments.strip()

    if not normalized_sentence:
      raise ValueError(f"sentences.items[{index}].sentence must not be empty.")
    if not normalized_correction:
      raise ValueError(f"sentences.items[{index}].correction must not be empty.")
    if not normalized_comments:
      raise ValueError(f"sentences.items[{index}].comments must not be empty.")

    validated_items.append(
      {
        "sentence": normalized_sentence,
        "correction": normalized_correction,
        "comments": normalized_comments,
      }
    )

  return {
    "sentences": {
      "items": validated_items,
    }
  }
