
from reasoning_guard import normalize_and_reject_reasoning

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

          sentence = normalize_and_reject_reasoning(
              sentence, f"sentences.items[{index}].sentence"
          )
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

def validate_check_references_no_citation_results(
        obj
):
    if not isinstance(obj, dict):
        raise ValueError("Top-level response is not an object.")
    
    required_keys = {"reference_has_no_citation"}
    actual_keys = set(obj.keys())
    missing = required_keys - actual_keys
    extra = actual_keys - required_keys

    if missing:
        raise ValueError(f"Missing keys: {sorted(missing)}")
    if extra:
        raise ValueError(f"Unexpected keys: {sorted(extra)}")
    
    reference_has_no_citation = obj["reference_has_no_citation"]
    if not isinstance(reference_has_no_citation, dict):
        raise ValueError("reference_has_no_citation must be an object")

    if set(reference_has_no_citation.keys()) != {"items"}:
        raise ValueError(
            "reference_has_no_citation must contain onlt the 'items' key."
        )
    
    items = reference_has_no_citation["items"]
    if not isinstance(items, list):
        raise ValueError("reference_has_no_citation.items must be an array")
    
    expected_message = ("This reference has no in-text citation; either remove the reference or add the relevant in-text citation.")

    validated_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(
                f"reference_has_no_citation.items[{index}] must be an object."
            )
        if set(item.keys()) != {"reference", "missing_citation"}:
              raise ValueError(
                  f"reference_has_no_citation.items[{index}] must contain only "
                  f"'reference' and 'missing_citation'."
              )

        reference = item["reference"]
        missing_citation = item["missing_citation"]

        if not isinstance(reference, str):
            raise ValueError(
                f"reference_has_no_citation.items[{index}].reference must be a string."
            )

        reference = normalize_and_reject_reasoning(
            reference, f"reference_has_no_citation.items[{index}].reference"
        )
        if not reference:
            raise ValueError(
                f"reference_has_no_citation.items[{index}].reference must not be empty."
            )

        if not isinstance(missing_citation, str):
            raise ValueError(
                f"reference_has_no_citation.items[{index}].missing_citation must be a string."
            )

        if missing_citation != expected_message:
            raise ValueError(
                f"reference_has_no_citation.items[{index}].missing_citation must match the expected enum value."
            )

        validated_items.append(
            {
                "reference": reference,
                "missing_citation": missing_citation,
            }
        )

    return {
        "reference_has_no_citation": {
            "items": validated_items,
        }
    }

def validate_check_citation_no_ref_results(
        obj
):
    if not isinstance(obj, dict):
          raise ValueError("Top-level response is not an object.")

    required_keys = {"citation_has_no_reference"}
    actual_keys = set(obj.keys())

    missing = required_keys - actual_keys
    extra = actual_keys - required_keys

    if missing:
        raise ValueError(f"Missing keys: {sorted(missing)}")
    if extra:
        raise ValueError(f"Unexpected keys: {sorted(extra)}")

    citation_has_no_reference = obj["citation_has_no_reference"]
    if not isinstance(citation_has_no_reference, dict):
        raise ValueError("citation_has_no_reference must be an object.")

    if set(citation_has_no_reference.keys()) != {"items"}:
        raise ValueError(
            "citation_has_no_reference must contain only the 'items' key."
        )

    items = citation_has_no_reference["items"]
    if not isinstance(items, list):
        raise ValueError("citation_has_no_reference.items must be an array.")

    expected_message = "Reference missing for this citation"

    validated_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(
                f"citation_has_no_reference.items[{index}] must be an object."
            )

        if set(item.keys()) != {"sentence_with_citation",
        "missing_reference"}:
            raise ValueError(
                f"citation_has_no_reference.items[{index}] must contain only 'sentence_with_citation' and 'missing_reference'."
            )

        sentence_with_citation = item["sentence_with_citation"]
        missing_reference = item["missing_reference"]

        if not isinstance(sentence_with_citation, str):
            raise ValueError(

                f"citation_has_no_reference.items[{index}].sentence_with_citation must be a string."
            )

        sentence_with_citation = normalize_and_reject_reasoning(
            sentence_with_citation,
            f"citation_has_no_reference.items[{index}].sentence_with_citation",
        )
        if not sentence_with_citation:
            raise ValueError(

                f"citation_has_no_reference.items[{index}].sentence_with_citation must not be empty."
            )

        if not isinstance(missing_reference, str):
            raise ValueError(
                f"citation_has_no_reference.items[{index}].missing_reference must be a string."
            )

        if missing_reference != expected_message:
            raise ValueError(
                f"citation_has_no_reference.items[{index}].missing_reference must match the expected enum value."
            )

        validated_items.append(
            {
                "sentence_with_citation": sentence_with_citation,
                "missing_reference": missing_reference,
            }
        )

    return {
        "citation_has_no_reference": {
            "items": validated_items,
        }
    }
