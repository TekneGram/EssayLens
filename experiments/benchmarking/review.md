- run_benchmarks.py | run_analyze_conclusions_benchmark | 361: missing comma
    between the CSV header list and row list in append_to_csv(...); this is a
    syntax error and prevents the module from importing. *OK*

  - run_introduction_retries.py | module import | 3: imports
    validate_analyze_gen_spec, but validate_introduction.py defines
    validate_anaylze_gen_spec; this causes an import error before the program
    starts. *OK*

  - run_identify_paragraphs_retries.py | run_identify_paragraphs_with_retries |
    33, 50: append_attempt_log(...) is called without benchmark_type; the first
    paragraph-identification attempt will raise TypeError. *OK*

  - run_benchmarks.py | run_identify_essay_benchmark | 30: failure returns 4
    values, but main.py unpacks 6 values from this function; any paragraph-
    identification failure will raise ValueError in the caller. *OK*

  - main.py | main | 159, 166: uses citations_data["has_citation"], but the
    validated shape uses has_citations; this will raise KeyError or skip the
    intended citation logic. *OK*

  - run_benchmarks.py | run_check_references_no_citations_benchmark | 125:
    expects reference_has_no_citations, but the validator returns
    reference_has_no_citation; this is a shape mismatch and will raise KeyError. *OK*

  - run_benchmarks.py | run_check_citations_no_references_benchmark | 158:
    returns from inside the for loop, so only the first item is ever written; if
    items is empty, the function falls through without returning the validated
    result. *OK*

  - run_thesis_retries.py | run_determine_thesis_statement_with_retries 36,
    run_thesis_statement_charateristics_with_retries 97,
    run_thesis_statement_advice_with_retries 160,
    run_thesis_statement_comment_with_retries 223,
    run_thesis_statement_heap_praise_with_retries 284: every
    append_attempt_log(...) call is missing paragraph_num and sentence_num; all
    thesis retry paths will raise TypeError. *OK*

  - run_benchmarks.py | run_determine_thesis_statement_benchmark | 179: iterates
    for data in result["thesis_data"], but thesis_data is a dict, not a list;
    data becomes a string key and data["..."] will fail. *OK*

  - run_benchmarks.py | run_thesis_statement_characteristics_benchmark | 197:
    passes max_token= instead of max_tokens= to the retry function; this is a
    missing/incorrect parameter name and will raise TypeError. *OK*

  - run_benchmarks.py | run_thesis_statement_characteristics_benchmark | 205:
    same dict-vs-list iteration bug as above on result["thesis_data"]. *OK*

  - run_benchmarks.py | run_thesis_statement_advice_benchmark | 222: passes
    max_token= instead of max_tokens= to the retry function; this is a missing/
    incorrect parameter name and will raise TypeError. *OK*

  - run_benchmarks.py | run_thesis_statement_advice_benchmark | 230,
    run_thesis_statement_comment_benchmark 255,
    run_thesis_statement_heap_praise_benchmark 280: each function iterates a
    dict as if it were a list, so the CSV write logic will fail on string keys. *OK*

  - run_thesis_retries.py | run_thesis_statement_comment_with_retries | 208:
    calls thesis_statement_advice(...) instead of thesis_statement_comment(...);
    the wrong LLM task is executed. *OK*

  - run_thesis_retries.py | run_thesis_statement_heap_praise_with_retries | 270:
    calls thesis_statement_advice(...) instead of
    thesis_statement_heap_praise(...); the wrong function is called and the
    argument list does not match the target signature. *OK*

  - validate_thesis.py | validate_thesis_statement_advice_shape | 102: the enum
    set contains one concatenated string instead of two separate allowed
    strings, so valid praise_advice responses will fail validation. *OK*

## CHECK THIS ONE AGAIN
  - run_introduction_retries.py | run_provide_introduction_feedback_with_retries
    | 101: validates feedback with validate_analyze_gen_spec(...) instead of
    validate_introduction_feedback(...); the feedback response shape will fail
    validation. *NOT SURE ABOUT THIS ONE - it looks like validate_introduction_feedback(...) to me - did codex hallucinate?*
## *END DOUBLE CHECK*

  - run_benchmarks.py | run_analyze_gen_spec_benchmark | 306,
    run_provide_introduction_feedback_benchmark 330: both functions iterate
    result["introduction_data"] as if it were a list, but the retry wrapper
    returns a dict. *OK*

  - run_benchmarks.py | run_analyze_gen_spec_benchmark | 311: reads
    data["sufficient_content"], but the validated shape uses sufficient_context;
    this will raise KeyError. *OK*

  - run_conclusion_retries.py | run_provide_conclusion_feedback_with_retries |
    101: validates feedback with validate_anaylze_conclusions(...) instead of
    validate_provide_conclusion_feedback(...); the feedback response shape will
    fail validation. *OK*

  - run_benchmarks.py | run_provide_conclusion_feedback_benchmark | 381:
    iterates result["conclusion_data"] as if it were a list, but the retry
    wrapper returns a dict. *OK*

  - main.py | main | 260: calls run_analyze_conclusions_benchmark(full_essay,
    essay,id, conclusion, ...); essay,id passes the wrong values/argument count
    and will break the conclusion step. *OK*

  - run_coherence_retries.py | run_analyze_topic_sentence_coherence_with_retries
    | 25: task file name is bosy_coherence_with_topic.md; this looks like a typo
    and likely causes a missing-file error. *OK*

  - run_coherence_retries.py | run_analyze_linguistic_coherence_with_retries |
    150: calls analyze_pronouns(...) instead of
    analyze_linguistic_coherence(...); the wrong experiment runs. *OK*

  - run_benchmarks.py | run_analyze_pronouns_benchmark | 435: writes to
    coherence_linguistic_...csv and expects coherence / comment, but pronoun
    analysis returns pronoun_issue / recommendation; the output shape is
    mismatched. *OK*

  - run_benchmarks.py | run_analyze_linguistic_coherence_benchmark | 461: writes
    to coherence_pronouns_...csv and expects pronoun_issue / recommendation, but
    linguistic coherence returns coherence / comment; the output shape is
    swapped. *OK*

  - run_benchmarks.py | run_encourage_development_benchmark | 485,
    run_anything_unclear_benchmark 509: both iterate result["paragraph_data"] as
    if it were a list, but the retry wrapper returns a dict. *OK*

  - main.py | main | 295, 349, 356: uses for bp, para_num in enumerate(...); bp
    becomes the integer index and para_num becomes the paragraph dict, so
    bp["body_paragraph"] will fail. The variables are reversed. *OK*

  - run_vocabulary_retries.py | run_enhance_vocabulary_with_retries | 26: task
    file name is vocabulary_enrichment_tasks.md, but the repo task file is
    singular (vocabulary_enrichment_task.md); likely missing-file error. *OK*

  - run_benchmarks.py | run_enhance_vocabulary_benchmark | 535: recommendations
    is an object with items, but the code iterates the object directly instead
    of recommendations["items"]; this is a shape mismatch. *OK*

  - main.py | main | 321-361: indentation is inconsistent with the overall goal;
    the vocabulary print/block runs outside the essay loop, and the grammar
    benchmarks are nested inside the vocabulary-word loop, which will reuse
    stale essay state and rerun grammar multiple times per word list. *OK*

  - run_grammar_retries.py | run_repair_grammar_with_retries | 86: calls
    edit_for_style(...) instead of repair_grammar(...); the wrong grammar task
    runs. *OK*

# SECOND PASS

- run_benchmarks.py | run_thesis_statement_comment_benchmark | 263: iterates
    result["thesis_data"] as if it were a list, but thesis_data is a dict; data
    becomes a string key and data["..."] will fail. *OK*

  - run_benchmarks.py | run_thesis_statement_heap_praise_benchmark | 288: same
    dict-vs-list iteration bug as above on result["thesis_data"]. *OK*

  - run_benchmarks.py | run_provide_introduction_feedback_benchmark | 339:
    iterates result["introduction_data"] as if it were a list, but the retry
    wrapper returns a dict. *OK*

  - run_benchmarks.py | run_analyze_conclusions_benchmark | 366: iterates
    result["conclusion_data"] as if it were a list, but the retry wrapper
    returns a dict. *OK*

  - run_benchmarks.py | run_anything_unclear_benchmark | 520: iterates
    result["paragraph_data"] as if it were a list, but the retry wrapper returns
    a dict. *OK*

  - main.py | main | 211: uses args.csv_append_file, but the argument name is
    args.csv_file_append; this will raise AttributeError. *OK*

  - main.py | main | 238: same args.csv_append_file typo as above. *OK*

  - run_thesis_retries.py | run_determine_thesis_statement_with_retries | 36:
    append_attempt_log(...) is still missing paragraph_num and sentence_num;
    this will raise TypeError. *OK - actually this was fixed, so not sure what the AI is talking about here*

  - run_thesis_retries.py | run_thesis_statement_charateristics_with_retries |
    97: same missing paragraph_num / sentence_num arguments to
    append_attempt_log(...). *OK - actually this was fixed already!*

  - run_thesis_retries.py | run_thesis_statement_advice_with_retries | 160: same
    missing paragraph_num / sentence_num arguments to append_attempt_log(...). *OK AI pointed this out incorrectly*

  - run_thesis_retries.py | run_thesis_statement_comment_with_retries | 223:
    same missing paragraph_num / sentence_num arguments to
    append_attempt_log(...). *OK AI pointed this out incorrectly*

  - run_thesis_retries.py | run_thesis_statement_heap_praise_with_retries | 284:
    same missing paragraph_num / sentence_num arguments to
    append_attempt_log(...). *OK AI pointed this out incorrectly*

  - run_thesis_retries.py | run_thesis_statement_comment_with_retries | 208:
    calls thesis_statement_advice(...) instead of thesis_statement_comment(...);
    the wrong LLM task is executed. *OK Pointed out incorrectly*

  - run_thesis_retries.py | run_thesis_statement_heap_praise_with_retries | 270:
    calls thesis_statement_advice(...) instead of
    thesis_statement_heap_praise(...); the wrong function is called and the
    argument shape does not match. *OK pointed out incorrectly*

  - run_benchmarks.py | run_analyze_pronouns_benchmark | 445: writes pronoun-
    analysis output to coherence_linguistic_...csv; the CSV target is swapped
    with linguistic coherence. *OK pointed out incorrectly*

  - run_benchmarks.py | run_analyze_linguistic_coherence_benchmark | 471: writes
    linguistic-coherence output to coherence_pronouns_...csv; the CSV target is
    swapped with pronoun analysis. *OK pointed out incorrectly*