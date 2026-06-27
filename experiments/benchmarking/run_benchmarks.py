import json

from append_to_csv import append_to_csv

from run_identify_paragraphs_retries import run_identify_paragraphs_with_retries

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
        return None, None, None

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
            [essay_id, f"body paragraph{str(i)}", bp["body_paragraph"]]
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
    return full_essay, full_essay_with_refs, has_references

def run_citations_benchmarks(base_url, max_tokens, temp):
    return

def run_coherence_benchmarks(base_url, max_tokens, temp):
    return

def run_conclusion_benchmarks(base_url, max_tokens, temp):
    return

def run_grammar_benchmarks(base_url, max_tokens, temp):
    return

def run_introduction_benchmarks(base_url, max_tokens, temp):
    return

def run_paragraph_benchmarks(base_url, max_tokens, temp):
    return

def run_thesis_benchmarks(base_url, max_tokens, temp):
    return

def run_vocabulary_benchmarks(base_url, max_tokens, temp):
    return
