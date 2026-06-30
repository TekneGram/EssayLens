import json

from append_to_csv import append_to_csv

from run_identify_paragraphs_retries import run_identify_paragraphs_with_retries
from run_citations_retries import run_identify_citations_with_retries, run_check_citations_no_references_with_retries, run_check_references_no_citations_with_retries
from run_thesis_retries import run_determine_thesis_statement_with_retries, run_thesis_statement_charateristics_with_retries, run_thesis_statement_advice_with_retries, run_thesis_statement_comment_with_retries, run_thesis_statement_heap_praise_with_retries
from run_introduction_retries import run_analyze_gen_spec_with_retries, run_provide_introduction_feedback_with_retries


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
    return full_essay, full_essay_with_refs, body_paragraphs, has_references


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

def run_check_citations_no_references_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):
    result = run_check_citations_no_references_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

def run_check_references_no_citations_benchmark(essay, essay_id, base_url, max_tokens, temp, csv_file_append):
    result = run_check_references_no_citations_with_retries(
        essay=essay,
        essay_id=essay_id,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

# ----- 3. THESIS STATEMENTS -----
def run_determine_thesis_statement_benchmark(essay, essay_id, thesis_statement, base_url, max_tokens, temp, csv_file_append):
    result = run_determine_thesis_statement_with_retries(
        essay=essay,
        essay_id=essay_id,
        thesis_statement=thesis_statement,
        base_url=base_url,
        max_tokens=max_tokens,
        temp=temp,
        csv_file_append=csv_file_append
    )

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




# ----- 6. COHERENCE -----




# ----- 7. PARAGRAPHS -----




# ----- 8. VOCABULARY -----




# ----- 9. GRAMMAR -----

def run_coherence_benchmark(base_url, max_tokens, temp):
    return

def run_conclusion_benchmark(base_url, max_tokens, temp):
    return

def run_grammar_benchmark(base_url, max_tokens, temp):
    return

def run_introduction_benchmark(base_url, max_tokens, temp):
    return

def run_paragraph_benchmark(base_url, max_tokens, temp):
    return

def run_vocabulary_benchmark(base_url, max_tokens, temp):
    return
