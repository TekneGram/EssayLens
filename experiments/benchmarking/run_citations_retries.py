import json
from attempts_logs import append_identify_citations_attempt_log
from validators.validate_citations import validate_identify_sentences_with_citations_shape
from essay_analysis_citations import identify_citations, check_references_no_citation, check_citation_no_reference
MAX_IDENTIFY_CITATIONS_ATTEMPTS = 6

def run_identify_citations_with_retries(
        essay,
        essay_id,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts = MAX_IDENTIFY_CITATIONS_ATTEMPTS
):
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            identified_citations = identify_citations(
                essay,
                "experiments/tasks_citations/citations_knowledge.md",
                "experiments/tasks_citations/identify_citations.md",
                base_url,
                max_tokens,
                temp
            )

            identified_citations_data = identified_citations["choices"][0]["message"]["content"]
            identified_citations_data = json.loads(identified_citations_data)
            validated = validate_identify_sentences_with_citations_shape(identified_citations_data)
            
            append_identify_citations_attempt_log(
                essay_id=essay_id,
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=True,
                failure_reason=""
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "citations_data": validated,
                "failure_reason": None
            }

        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            append_identify_citations_attempt_log(
                essay_id=essay_id,
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error
            )

    

    return {
        "passed": False,
        "attempts_used": max_attempts,
        "citations_data": None,
        "failure_reason": last_error
    }

def run_check_references_no_citation_with_retries():
    return

def run_check_citation_no_reference_with_retries():
    return
