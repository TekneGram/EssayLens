from reasoning_guard import normalize_and_reject_reasoning

def validate_enhance_vocabulary(
  obj
):
  if not isinstance(obj, dict):
    raise ValueError("Top-level response is not an object.")

  required_keys = {"recommendations"}
  actual_keys = set(obj.keys())

  missing = required_keys - actual_keys
  extra = actual_keys - required_keys

  if missing:
    raise ValueError(f"Missing keys: {sorted(missing)}")
  if extra:
    raise ValueError(f"Unexpected keys: {sorted(extra)}")

  recommendations = obj["recommendations"]
  if not isinstance(recommendations, dict):
    raise ValueError("recommendations must be an object.")
  if set(recommendations.keys()) != {"items"}:
    raise ValueError("recommendations must contain only the 'items' key.")

  items = recommendations["items"]
  if not isinstance(items, list):
    raise ValueError("recommendations.items must be an array.")

  validated_items = []
  for index, item in enumerate(items):
    if not isinstance(item, dict):
      raise ValueError(f"recommendations.items[{index}] must be an object.")
    if set(item.keys()) != {
      "sentence",
      "word_to_change",
      "updated_sentence",
      "comments",
    }:
      raise ValueError(
        f"recommendations.items[{index}] must contain only 'sentence', 'word_to_change', 'updated_sentence', and 'comments'."
      )

    sentence = item["sentence"]
    word_to_change = item["word_to_change"]
    updated_sentence = item["updated_sentence"]
    comments = item["comments"]

    if not isinstance(sentence, str):
      raise ValueError(f"recommendations.items[{index}].sentence must be a string.")
    if not isinstance(word_to_change, str):
      raise ValueError(
        f"recommendations.items[{index}].word_to_change must be a string."
      )
    if not isinstance(updated_sentence, str):
      raise ValueError(
        f"recommendations.items[{index}].updated_sentence must be a string."
      )
    if not isinstance(comments, str):
      raise ValueError(f"recommendations.items[{index}].comments must be a string.")

    normalized_sentence = normalize_and_reject_reasoning(
      sentence, f"recommendations.items[{index}].sentence"
    )
    normalized_word_to_change = normalize_and_reject_reasoning(
      word_to_change, f"recommendations.items[{index}].word_to_change"
    )
    normalized_updated_sentence = normalize_and_reject_reasoning(
      updated_sentence, f"recommendations.items[{index}].updated_sentence"
    )
    normalized_comments = normalize_and_reject_reasoning(
      comments, f"recommendations.items[{index}].comments"
    )

    if not normalized_sentence:
      raise ValueError(f"recommendations.items[{index}].sentence must not be empty.")
    if not normalized_word_to_change:
      raise ValueError(
        f"recommendations.items[{index}].word_to_change must not be empty."
      )
    if not normalized_updated_sentence:
      raise ValueError(
        f"recommendations.items[{index}].updated_sentence must not be empty."
      )
    if not normalized_comments:
      raise ValueError(f"recommendations.items[{index}].comments must not be empty.")

    validated_items.append(
      {
        "sentence": normalized_sentence,
        "word_to_change": normalized_word_to_change,
        "updated_sentence": normalized_updated_sentence,
        "comments": normalized_comments,
      }
    )

  return {
    "recommendations": {
      "items": validated_items,
    }
  }
