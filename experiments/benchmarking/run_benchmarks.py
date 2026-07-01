import json

from append_to_csv import append_to_csv

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

def run_identify_essay_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):

    result = run_identify_paragraphs_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None, None, None, None

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

def run_identify_citations_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):
    result = run_identify_citations_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
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

def run_check_references_no_citations_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):
    result = run_check_references_no_citations_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None

    for item in result["check_reference_no_citations_data"]["reference_has_no_citations"]["items"]:
        reference = item["reference"]
        missing_citation = item["missing_citation"]
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"reference_has_no_citations_{csv_file_append}.csv",
            ['ESSAY_ID', 'REFERENCE', 'MISSING_CITATION'],
            [essay_id, reference, missing_citation]
        )
    return result["check_reference_no_citations_data"]

def run_check_citations_no_references_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):
    result = run_check_citations_no_references_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
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
def run_determine_thesis_statement_benchmark(essay, essay_id, introduction, base_url, max_tokens, temp, csv_file_append):
    result = run_determine_thesis_statement_with_retries(
        essay=essay,
        essay_id=essay_id,
        introduction=introduction,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None
    
    for data in result["thesis_data"]:
        has_thesis_statement = data["has_thesis_statement"]
        thesis_statement = data["thesis_statement"]
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"thesis_statement_{csv_file_append}.csv",
            ['ESSAY_ID', 'HAS_THESIS_STATEMENT', 'THESIS_STATEMENT'],
            [essay_id, has_thesis_statement, thesis_statement]
        )
    
    return result["thesis_data"]

def run_thesis_statement_characteristics_benchmark(essay, essay_id, thesis_statement, base_url, max_tokens, temp, csv_file_append):
    result = run_thesis_statement_charateristics_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        base_url=base_url,
        max_token=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None
    
    for data in result["thesis_data"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"thesis_statement_characteristics_{csv_file_append}.csv",
            ['ESSAY_ID', "MAIN_IDEA", "CLEAR_GOAL", "PREVIEW_TOPICS", "WRITER_OPINION"],
            [essay_id, data["main_idea"], data["clear_goal"], data["preview_topics"], data["writer_opinion"]]
        )
    
    return result["thesis_data"]

def run_thesis_statement_advice_benchmark(essay, essay_id, thesis_statement, no_characteristics_count, base_url, max_tokens, temp, csv_file_append):
    result = run_thesis_statement_advice_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        no_characteristics_count=no_characteristics_count,
        base_url=base_url,
        max_token=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None
    
    for data in result["thesis_data"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"thesis_statement_advice_{csv_file_append}.csv",
            ['ESSAY_ID', 'PRAISE_ADVICE', 'EXAMPLE_THESIS', 'EXPLAIN_EXAMPLE'],
            [essay_id, data["praise_advice"], data["example_thesis"], data["explain_example"]]
        )
    
    return result["thesis_data"]

def run_thesis_statement_comment_benchmark(essay, essay_id, thesis_statement, what_is_missing, base_url, max_tokens, temp, csv_file_append):
    result = run_thesis_statement_comment_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        what_is_missing=what_is_missing,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None
    
    for data in result["thesis_data"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"thesis_statement_comment_{csv_file_append}.csv",
            ['ESSAY_ID', 'PRAISE', 'COMMENT', 'ADVICE'],
            [essay_id, data["praise"], data["comment"], data["advice"]]
        )
    
    return result["thesis_data"]


def run_thesis_statement_heap_praise_benchmark(essay, essay_id, thesis_statement, base_url, max_tokens, temp, csv_file_append):
    result = run_thesis_statement_heap_praise_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

    if not result["passed"]:
        return None
    
    for data in result["thesis_data"]:
        append_to_csv(
            "experiments/benchmarking/llm_responses",
            f"thesis_statement_heap_praise_{csv_file_append}.csv",
            ['ESSAY_ID', 'PRAISE', 'COMMENT'],
            [essay_id, data["praise"], data["comment"]]
        )
    
    return result["thesis_data"]

# ----- 4. INTRODUCTION -----

def run_analyze_gen_spec_benchmark(essay, essay_id, introduction, base_url, max_tokens, temp, csv_file_append):
    result = run_analyze_gen_spec_with_retries(
        essay=essay,
        essay_id=essay_id,
        introduction=introduction,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_provide_introduction_feedback_benchmark(essay, essay_id, introduction, gen_spec_content, base_url, max_tokens, temp, csv_file_append):
    result = run_provide_introduction_feedback_with_retries(
        essay=essay,
        essay_id=essay_id,
        introduction=introduction,
        gen_spec_content=gen_spec_content,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )



# ----- 5. CONCLUSION -----
def run_analyze_conclusions_benchmark(essay, essay_id, conclusion, base_url, max_tokens, temp, csv_file_append):
    result = run_analyze_conclusions_with_retries(
        essay=essay,
        essay_id=essay_id,
        conclusion=conclusion,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_provide_conclusion_feedback_benchmark(essay, essay_id, conclusion, base_url, max_tokens, temp, csv_file_append):
    result = run_provide_conclusion_feedback_with_retries(
        essay=essay,
        essay_id=essay_id,
        conclusion=conclusion,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )



# ----- 6. COHERENCE -----
def run_analyze_topic_sentence_coherence_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_analyze_topic_sentence_coherence_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_analyze_pronouns_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_analyze_pronouns_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_analyze_linguistic_coherence_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_analyze_linguistic_coherence_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )



# ----- 7. PARAGRAPHS -----
def run_encourage_development_benchmark(essay, essay_id, bp, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_encourage_development_with_retries(
        essay=essay,
        essay_id=essay_id,
        bp=bp,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_anything_unclear_benchmark(essay, essay_id, bp, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_anything_unclear_with_retries(
        essay=essay,
        essay_id=essay_id,
        bp=bp,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )



# ----- 8. VOCABULARY -----
def run_enhance_vocabulary_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):
    result = run_enhance_vocabulary_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )



# ----- 9. GRAMMAR -----
def run_edit_for_style_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_edit_for_style_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_repair_grammar_benchmark(bp, essay_id, para_num, base_url, max_tokens, temp, csv_file_append):
    result = run_repair_grammar_with_retries(
        bp=bp,
        essay_id=essay_id,
        para_num=para_num,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

