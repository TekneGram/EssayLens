
def validate_identify_sentences_with_citations_shape(obj):
      if not isinstance(obj, dict):
          raise ValueError("Top-level response is not an object.")

      required_keys = {"has_citations", "sentences"}
      actual_keys = set(obj.keys())

      missing = required_keys - actual_keys
      extra = actual_keys - required_keys

      if missing:
          raise ValueError(f"Missing keys: {sorted(missing)}")
      if extra:
          raise ValueError(f"Unexpected keys: {sorted(extra)}")

      has_citations = obj["has_citations"]
      sentences = obj["sentences"]

      if has_citations not in {"yes", "no"}:
          raise ValueError("has_citations must be 'yes' or 'no'.")

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

          if set(item.keys()) != {"sentence"}:
              raise ValueError(
                  f"sentences.items[{index}] must contain only the 'sentence' key."
              )

          sentence = item["sentence"]
          if not isinstance(sentence, str):
              raise ValueError(
                  f"sentences.items[{index}].sentence must be a string."
              )

          sentence = sentence.strip()
          if not sentence:
              raise ValueError(
                  f"sentences.items[{index}].sentence must not be empty."
              )

          validated_items.append({"sentence": sentence})

      if has_citations == "yes" and not validated_items:
          raise ValueError(
              "sentences.items must contain at least one sentence when has_citations is 'yes'."
          )

      return {
          "has_citations": has_citations,
          "sentences": {"items": validated_items},
      }