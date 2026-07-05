import json

from append_to_csv import append_to_csv
from request_timeout_utils import BENCHMARK_REQUEST_TIMEOUT

from run_identify_paragraphs_retries import run_identify_paragraphs_with_retries
from run_citations_retries import run_identify_citations_with_retries, run_check_citations_no_references_with_retries, run_check_references_no_citations_with_retries
from run_thesis_retries import run_determine_thesis_statement_with_retries, run_thesis_statement_charateristics_with_retries, run_thesis_statement_advice_with_retries, run_thesis_statement_comment_with_retries, run_thesis_statement_heap_praise_with_retries
from run_introduction_retries import run_analyze_gen_spec_with_retries, run_provide_introduction_feedback_with_retries
from run_conclusion_retries import run_analyze_conclusions_with_retries, run_provide_conclusion_feedback_with_retries
from run_coherence_retries import run_analyze_topic_sentence_coherence_with_retries, run_analyze_pronouns_with_retries, run_analyze_linguistic_coherence_with_retries
from run_paragraphs_retries import run_encourage_development_with_retries, run_anything_unclear_with_retries
from run_vocabulary_retries import run_enhance_vocabulary_with_retries
from run_grammar_retries import run_edit_for_style_with_retries, run_repair_grammar_with_retries


# ----- 1. IDENTIFY PARAGRAPHS ------

def run_identify_essay_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):

    result = run_identify_paragraphs_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None, None, None, None, None, None

    essay_paragraphs = result["essay_paragraphs"]
    
    # Introduction
    introduction = essay_paragraphs["introduction_paragraph"]
    append_to_csv(
        "experiments/benchmarking/llm_responses", 
        "identify_paragraphs_" + csv_file_append + ".csv", 
        ["ESSAY_ID", "PARA_TYPE", "PARAGRAPH"], 
        [essay_id, "introduction", introduction]
    )

    # Body paragraphs
    body_paragraphs = essay_paragraphs["body_paragraphs"]["items"]

    # Conclusion paragraph
    conclusion = essay_paragraphs["conclusion_paragraph"]

    # References section
    references = essay_paragraphs["references_section"]
    has_references = essay_paragraphs["contains_references"]

    # Essay main idea
    full_essay = introduction
    i = 1
    for bp in body_paragraphs:
        append_to_csv(
            "experiments/benchmarking/llm_responses", 
            f"identify_paragraphs_{csv_file_append}.csv", 
            ["ESSAY_ID", "PARA_TYPE", "PARAGRAPH"], 
            [essay_id, f"body paragraph {str(i)}", bp["body_paragraph"]]
        )
        full_essay = full_essay + "\n\n" +  bp["body_paragraph"]
        i += 1
    
    append_to_csv(
        "experiments/benchmarking/llm_responses", 
        "identify_paragraphs_" + csv_file_append + ".csv", 
        ["ESSAY_ID", "PARA_TYPE", "PARAGRAPH"], 
        [essay_id, "conclusion", conclusion]
    )
    append_to_csv(
        "experiments/benchmarking/llm_responses", 
        "identify_paragraphs_" + csv_file_append + ".csv", 
        ["ESSAY_ID", "PARA_TYPE", "PARAGRAPH"], 
        [essay_id, "references", references]
    )

    full_essay = full_essay + "\n\n" + conclusion
    full_essay_with_refs = full_essay + "\n\n" + references
    return full_essay, introduction, conclusion, full_essay_with_refs, body_paragraphs, has_references


# ----- 2. CITATIONS -----

def run_identify_citations_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_identify_citations_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    for sentence_obj in result["citations_data"]["sentences"]["items"]:
        sentence = sentence_obj["sentence"]
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"identify_citations_{csv_file_append}.csv",
            ['ESSAY_ID', 'SENTENCE_WITH_CITATION'],
            [essay_id, sentence]
        )
    
    citations_data = result["citations_data"]

    return citations_data

def run_check_references_no_citations_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_check_references_no_citations_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None

    for item in result["check_reference_no_citations_data"]["reference_has_no_citation"]["items"]:
        reference = item["reference"]
        missing_citation = item["missing_citation"]
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"reference_has_no_citations_{csv_file_append}.csv",
            ['ESSAY_ID', 'REFERENCE', 'MISSING_CITATION'],
            [essay_id, reference, missing_citation]
        )
    return result["check_reference_no_citations_data"]

def run_check_citations_no_references_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_check_citations_no_references_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    for item in result["check_citations_no_references_data"]["citation_has_no_reference"]["items"]:
        sentence_with_citation = item["sentence_with_citation"]
        missing_reference = item["missing_reference"]
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"citations_no_references_{csv_file_append}.csv",
            ['ESSAY_ID', 'CITATION', 'MISSING_REFERENCE'],
            [essay_id, sentence_with_citation, missing_reference]
        )
    
    return result["check_citations_no_references_data"]
    




# ----- 3. THESIS STATEMENTS -----
def run_determine_thesis_statement_benchmark(essay, essay_id, introduction, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_determine_thesis_statement_with_retries(
        essay=essay,
        essay_id=essay_id,
        introduction=introduction,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    has_thesis_statement = result["thesis_data"]["has_thesis_statement"]
    thesis_statement = result["thesis_data"]["thesis_statement"]
    append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"thesis_statement_{csv_file_append}.csv",
            ['ESSAY_ID', 'HAS_THESIS_STATEMENT', 'THESIS_STATEMENT'],
            [essay_id, has_thesis_statement, thesis_statement]
    )
    
    return result["thesis_data"]

def run_thesis_statement_characteristics_benchmark(essay, essay_id, thesis_statement, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_thesis_statement_charateristics_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    main_idea = result["thesis_data"]["main_idea"]
    clear_goal = result["thesis_data"]["clear_goal"]
    preview_topics = result["thesis_data"]["preview_topics"]
    writer_opinion = result["thesis_data"]["writer_opinion"]

    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"thesis_statement_characteristics_{csv_file_append}.csv",
        ['ESSAY_ID', "MAIN_IDEA", "CLEAR_GOAL", "PREVIEW_TOPICS", "WRITER_OPINION"],
        [essay_id, main_idea, clear_goal, preview_topics, writer_opinion]
    )
        
    
    return result["thesis_data"]

def run_thesis_statement_advice_benchmark(essay, essay_id, thesis_statement, no_characteristics_count, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_thesis_statement_advice_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        no_characteristics_count=no_characteristics_count,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    praise_advice = result["thesis_data"]["praise_advice"]
    example_thesis = result["thesis_data"]["example_thesis"]
    explain_example = result["thesis_data"]["explain_example"]

    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"thesis_statement_advice_{csv_file_append}.csv",
        ['ESSAY_ID', 'PRAISE_ADVICE', 'EXAMPLE_THESIS', 'EXPLAIN_EXAMPLE'],
        [essay_id, praise_advice, example_thesis, explain_example]
    )

    return result["thesis_data"]

def run_thesis_statement_comment_benchmark(essay, essay_id, thesis_statement, what_is_missing, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_thesis_statement_comment_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        what_is_missing=what_is_missing,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    thesis_data = result["thesis_data"]
    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"thesis_statement_comment_{csv_file_append}.csv",
        ['ESSAY_ID', 'PRAISE', 'COMMENT', 'ADVICE'],
        [essay_id, thesis_data["praise"], thesis_data["comment"], thesis_data["advice"]]
    )

    return result["thesis_data"]


def run_thesis_statement_heap_praise_benchmark(essay, essay_id, thesis_statement, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_thesis_statement_heap_praise_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    thesis_data = result["thesis_data"]

    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"thesis_statement_heap_praise_{csv_file_append}.csv",
        ['ESSAY_ID', 'PRAISE', 'COMMENT'],
        [essay_id, thesis_data["praise"], thesis_data["comment"]]
    )
    
    return result["thesis_data"]

# ----- 4. INTRODUCTION -----

def run_analyze_gen_spec_benchmark(essay, essay_id, introduction, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_analyze_gen_spec_with_retries(
        essay=essay,
        essay_id=essay_id,
        introduction=introduction,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    intro_data = result["introduction_data"]
    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"introduction_gen_spec_{csv_file_append}.csv",
        ['ESSAY_ID', 'CLEAR_TOPIC', 'SUFFICIENT_CONTEXT', 'RELEVANCE_HIGHLIGHTED', 'SPECIFIC_FOCUS_IDENTIFIED', 'TOPIC', 'ESSAY_CONTEXT', 'RELEVANCE', 'FOCUS'],
        [essay_id, intro_data["clear_topic"], intro_data["sufficient_context"], intro_data["relevance_highlighted"], intro_data["specific_focus_identified"], intro_data["topic"], intro_data["essay_context"], intro_data["relevance"], intro_data["focus"]]
    )
        
    return result["introduction_data"]

def run_provide_introduction_feedback_benchmark(essay, essay_id, introduction, gen_spec_content, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_provide_introduction_feedback_with_retries(
        essay=essay,
        essay_id=essay_id,
        introduction=introduction,
        gen_spec_content=gen_spec_content,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    introduction_data = result["introduction_data"]

    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"introduction_feedback_{csv_file_append}.csv",
        ['ESSAY_ID', 'INTRODUCTION_FEEDBACK'],
        [essay_id, introduction_data["feedback"]]
    )
    
    return result["introduction_data"]



# ----- 5. CONCLUSION -----
def run_analyze_conclusions_benchmark(essay, essay_id, conclusion, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_analyze_conclusions_with_retries(
        essay=essay,
        essay_id=essay_id,
        conclusion=conclusion,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    conclusion_data = result["conclusion_data"]
    
    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"conclusion_analysis_{csv_file_append}.csv",
        ['ESSAY_ID', 'RESTATE_MAIN_IDEA', 'SUFFICIENT_SUMMARY', 'STRONG_FINAL_COMMENT', 'MAIN_IDEA', 'SUMMARY', 'FINAL_COMMENT'],
        [essay_id, conclusion_data["restate_main_idea"], conclusion_data["sufficient_summary"], conclusion_data["strong_final_comment"], conclusion_data["main_idea"], conclusion_data["summary"], conclusion_data["final_comment"]]
    )
    return result["conclusion_data"]

def run_provide_conclusion_feedback_benchmark(essay, essay_id, conclusion, evaluation_content, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_provide_conclusion_feedback_with_retries(
        essay=essay,
        essay_id=essay_id,
        conclusion=conclusion,
        evaluation_content=evaluation_content,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    conclusion_data = result["conclusion_data"]

    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"conclusion_feedback_{csv_file_append}.csv",
        ['ESSAY_ID', 'CONCLUSION_FEEDBACK'],
        [essay_id, conclusion_data["feedback"]]
    )   
    
    return result["conclusion_data"]



# ----- 6. COHERENCE -----
def run_analyze_topic_sentence_coherence_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_analyze_topic_sentence_coherence_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    sentences = result["coherence_data"]["sentences"]
    for item in sentences["items"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"coherence_topic_sentence_unity_{csv_file_append}.csv",
            ['ESSAY_ID', 'PARA_NUM', 'SENTENCE', "BEHAVIOR", "COMMENT"],
            [essay_id, para_num, item["sentence"], item["behavior"], item["comment"]]
        )
    return sentences

def run_analyze_pronouns_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_analyze_pronouns_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )
    if not result["passed"]:
        return None
    
    sentences = result["coherence_data"]["sentences"]
    for item in sentences["items"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"coherence_pronouns_{csv_file_append}.csv",
            ['ESSAY_ID', 'PARA_NUM', 'SENTENCE', 'PRONOUN_ISSUE', 'RECOMMENDATION'],
            [essay_id, para_num, item["sentence"], item["pronoun_issue"], item["recommendation"]]
        )
    return sentences
    


def run_analyze_linguistic_coherence_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_analyze_linguistic_coherence_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    sentences = result["coherence_data"]["sentences"]
    for item in sentences["items"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"coherence_linguistic_{csv_file_append}.csv",
            ['ESSAY_ID', 'PARA_NUM', 'SENTENCE', 'COHERENCE', 'COMMENT'],
            [essay_id, para_num, item["sentence"], item["coherence"], item["comment"]]
        )
    return sentences



# ----- 7. PARAGRAPHS -----
def run_encourage_development_benchmark(essay, essay_id, bp, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_encourage_development_with_retries(
        essay=essay,
        essay_id=essay_id,
        bp=bp,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    paragraph_data = result["paragraph_data"]
    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"paragraphs_encourage_development_{csv_file_append}.csv",
        ['ESSAY_ID', 'PARA_NUM', 'SENTENCE', 'FEEDBACK'],
        [essay_id, para_num, paragraph_data["sentence"], paragraph_data["feedback"]]
    )
        
    return result["paragraph_data"]

def run_anything_unclear_benchmark(essay, essay_id, bp, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_anything_unclear_with_retries(
        essay=essay,
        essay_id=essay_id,
        bp=bp,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    paragraph_data = result["paragraph_data"]
    
    append_to_csv(
        "experiments/benchmarking/llm_responses",
        f"paragraph_anything_unclear_{csv_file_append}.csv",
        ['ESSAY_ID', 'PARA_NUM', 'ALL_CLEAR', 'SENTENCE', 'FEEDBACK'],
        [essay_id, para_num, paragraph_data["all_clear"], paragraph_data["sentence"], paragraph_data["feedback"]]
    )
    return result["paragraph_data"]



# ----- 8. VOCABULARY -----
def run_enhance_vocabulary_benchmark(essay, essay_id, word_list, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_enhance_vocabulary_with_retries(
        essay=essay,
        essay_id=essay_id,
        word_list=word_list,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    recommendations = result["vocabulary_data"]["recommendations"]
    for item in recommendations["items"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"vocabulary_enhancements_{csv_file_append}.csv",
            ['ESSAY_ID', 'SENTENCE', 'WORD_TO_CHANGE', 'UPDATED_SENTENCE', 'COMMENTS'],
            [essay_id, item["sentence"], item["word_to_change"], item["updated_sentence"], item["comments"]]
        )
    
    return recommendations



# ----- 9. GRAMMAR -----
def run_edit_for_style_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_edit_for_style_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    sentences = result["grammar_data"]["sentences"]
    for item in sentences["items"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"grammar_style_edits_{csv_file_append}.csv",
            ['ESSAY_ID', 'PARA_NUM', 'SENTENCE', 'REVISION', 'NECESSARY'],
            [essay_id, para_num, item["sentence"], item["revision"], item["necessary"]]
        )
    
    return sentences

def run_repair_grammar_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append, sampling_params, request_timeout=BENCHMARK_REQUEST_TIMEOUT):
    result = run_repair_grammar_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append,
        sampling_params=sampling_params,
        request_timeout=request_timeout,
    )

    if not result["passed"]:
        return None
    
    sentences = result["grammar_data"]["sentences"]
    for item in sentences["items"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"grammar_repairs_{csv_file_append}.csv",
            ['ESSAY_ID', 'PARA_NUM', 'SENTENCE', 'CORRECTION', 'COMMENTS'],
            [essay_id, para_num, item["sentence"], item["correction"], item["comments"]]
        )
    return sentences
