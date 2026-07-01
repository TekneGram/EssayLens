def validate_analyze_topic_sentence_coherence(
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

    allowed_behavior = {
        "topic sentence",
        "elaborates an earlier sentence",
        "introduces a new idea",
    }

    validated_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"sentences.items[{index}] must be an object.")
        if set(item.keys()) != {"sentence", "behavior", "comment"}:
            raise ValueError(
                f"sentences.items[{index}] must contain only 'sentence', 'behavior', and 'comment'."
            )

        sentence = item["sentence"]
        behavior = item["behavior"]
        comment = item["comment"]

        if not isinstance(sentence, str):
            raise ValueError(f"sentences.items[{index}].sentence must be a string.")
        if behavior not in allowed_behavior:
            raise ValueError(
                f"sentences.items[{index}].behavior must match an expected enum value."
            )
        if not isinstance(comment, str):
            raise ValueError(f"sentences.items[{index}].comment must be a string.")

        normalized_sentence = sentence.strip()
        normalized_comment = comment.strip()

        if not normalized_sentence:
            raise ValueError(f"sentences.items[{index}].sentence must not be empty.")
        if not normalized_comment:
            raise ValueError(f"sentences.items[{index}].comment must not be empty.")

        validated_items.append(
            {
                "sentence": normalized_sentence,
                "behavior": behavior,
                "comment": normalized_comment,
            }
        )

    return {
        "sentences": {
            "items": validated_items,
        }
    }


def validate_analyze_pronouns(
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
        if set(item.keys()) != {"sentence", "pronoun_issue", "recommendation"}:
            raise ValueError(
                f"sentences.items[{index}] must contain only 'sentence', 'pronoun_issue', and 'recommendation'."
            )

        sentence = item["sentence"]
        pronoun_issue = item["pronoun_issue"]
        recommendation = item["recommendation"]

        if not isinstance(sentence, str):
            raise ValueError(f"sentences.items[{index}].sentence must be a string.")
        if not isinstance(pronoun_issue, str):
            raise ValueError(
                f"sentences.items[{index}].pronoun_issue must be a string."
            )
        if not isinstance(recommendation, str):
            raise ValueError(
                f"sentences.items[{index}].recommendation must be a string."
            )

        normalized_sentence = sentence.strip()
        normalized_pronoun_issue = pronoun_issue.strip()
        normalized_recommendation = recommendation.strip()

        if not normalized_sentence:
            raise ValueError(f"sentences.items[{index}].sentence must not be empty.")
        if not normalized_pronoun_issue:
            raise ValueError(
                f"sentences.items[{index}].pronoun_issue must not be empty."
            )
        if not normalized_recommendation:
            raise ValueError(
                f"sentences.items[{index}].recommendation must not be empty."
            )

        validated_items.append(
            {
                "sentence": normalized_sentence,
                "pronoun_issue": normalized_pronoun_issue,
                "recommendation": normalized_recommendation,
            }
        )

    return {
        "sentences": {
            "items": validated_items,
        }
    }

def validate_analyze_linguistic_coherence(
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

    allowed_coherence = {
        "satisfactory",
        "add a contrast",
        "add an addition connector",
        "show cause and effect",
        "show reason",
        "use elaboration words",
    }

    validated_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"sentences.items[{index}] must be an object.")
        if set(item.keys()) != {"sentence", "coherence", "comment"}:
            raise ValueError(
                f"sentences.items[{index}] must contain only 'sentence', 'coherence', and 'comment'."
            )

        sentence = item["sentence"]
        coherence = item["coherence"]
        comment = item["comment"]

        if not isinstance(sentence, str):
            raise ValueError(f"sentences.items[{index}].sentence must be a string.")
        if coherence not in allowed_coherence:
            raise ValueError(
                f"sentences.items[{index}].coherence must match an expected enum value."
            )
        if not isinstance(comment, str):
            raise ValueError(f"sentences.items[{index}].comment must be a string.")

        normalized_sentence = sentence.strip()
        normalized_comment = comment.strip()

        if not normalized_sentence:
            raise ValueError(f"sentences.items[{index}].sentence must not be empty.")
        if not normalized_comment:
            raise ValueError(f"sentences.items[{index}].comment must not be empty.")

        validated_items.append(
            {
                "sentence": normalized_sentence,
                "coherence": coherence,
                "comment": normalized_comment,
            }
        )

    return {
        "sentences": {
            "items": validated_items,
        }
    }
    
