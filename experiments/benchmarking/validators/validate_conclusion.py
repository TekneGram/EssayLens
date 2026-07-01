def validate_anaylze_conclusions(
    obj
):
    if not isinstance(obj, dict):
        raise ValueError("Top-level response is not an object.")

    required_keys = {
        "restate_main_idea",
        "main_idea",
        "sufficient_summary",
        "summary",
        "strong_final_comment",
        "final_comment",
    }
    actual_keys = set(obj.keys())

    missing = required_keys - actual_keys
    extra = actual_keys - required_keys

    if missing:
        raise ValueError(f"Missing keys: {sorted(missing)}")
    if extra:
        raise ValueError(f"Unexpected keys: {sorted(extra)}")

    restate_main_idea = obj["restate_main_idea"]
    main_idea = obj["main_idea"]
    sufficient_summary = obj["sufficient_summary"]
    summary = obj["summary"]
    strong_final_comment = obj["strong_final_comment"]
    final_comment = obj["final_comment"]

    if restate_main_idea not in {"yes", "no"}:
        raise ValueError("restate_main_idea must be 'yes' or 'no'.")
    if sufficient_summary not in {"yes", "no"}:
        raise ValueError("sufficient_summary must be 'yes' or 'no'.")
    if strong_final_comment not in {"yes", "no"}:
        raise ValueError("strong_final_comment must be 'yes' or 'no'.")

    if not isinstance(main_idea, str):
        raise ValueError("main_idea must be a string.")
    if not isinstance(summary, str):
        raise ValueError("summary must be a string.")
    if not isinstance(final_comment, str):
        raise ValueError("final_comment must be a string.")

    normalized_main_idea = main_idea.strip()
    normalized_summary = summary.strip()
    normalized_final_comment = final_comment.strip()

    if restate_main_idea == "yes" and not normalized_main_idea:
        raise ValueError("main_idea must be non-empty when restate_main_idea is 'yes'.")
    if sufficient_summary == "yes" and not normalized_summary:
        raise ValueError("summary must be non-empty when sufficient_summary is 'yes'.")
    if strong_final_comment == "yes" and not normalized_final_comment:
        raise ValueError("final_comment must be non-empty when strong_final_comment is 'yes'.")

    return {
        "restate_main_idea": restate_main_idea,
        "main_idea": normalized_main_idea,
        "sufficient_summary": sufficient_summary,
        "summary": normalized_summary,
        "strong_final_comment": strong_final_comment,
        "final_comment": normalized_final_comment,
    }

def validate_provide_conclusion_feedback(
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

    normalized_feedback = feedback.strip()
    if not normalized_feedback:
        raise ValueError("feedback must not be empty.")

    return {
        "feedback": normalized_feedback,
    }