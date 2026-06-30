import json
from attempts_logs import append_attempt_log
from validators.validate_coherence import validate_analyze_topic_sentence_coherence, validate_analyze_pronouns, validate_analyze_linguistic_coherence
from essay_analysis_coherence import analyze_topic_sentence_coherence, analyze_pronouns, analyze_linguistic_coherence
MAX_ATTEMPTS = 6

def run_analyze_topic_sentence_coherence_with_retries(
        bp,
        essay_id,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="topic_sentence_coherence_unity"

    for attempt in range(1, max_attempts + 1):
        try:
            ts_coh = analyze_topic_sentence_coherence(
                bp,
                "experiments/tasks_body_paras/topic_sentence_coherence_knowledge.md",
                "experiments/tasks_conclusions/bosy_coherence_with_topic.md",
                base_url,
                max_tokens,
                temp
            )

            ts_coh_data = ts_coh["choices"][0]["message"]["content"]
            ts_coh_data = json.loads(ts_coh_data)
            validated = validate_analyze_topic_sentence_coherence(ts_coh_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=True,
                failure_reason="",
                benchmark_type=BENCHMARK_TYPE
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "conclusion_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "conclusion_data": None,
        "failure_reason": last_error
    }