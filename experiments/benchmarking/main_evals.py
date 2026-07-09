import argparse
import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parent
try:
    from benchmarking.main_eval_modules.identify_citations_evals import (
        citation_no_references,
        identified_citations,
        reference_no_citations,
        save_citation_no_reference_duplicates,
        save_citation_no_reference_hallucinations,
        save_identify_citation_duplicates,
        save_reference_no_citation_hallucinations,
        save_identify_sentence_hallucinations,
    )
    from benchmarking.main_eval_modules.identify_paragraphs_evals import (
        identify_paragraphs,
        save_identify_paragraph_results,
        save_identify_paragraph_token_f1_results,
    )
    from benchmarking.main_eval_modules.conclusion_analysis_evals import (
        conclusion_analysis_eval,
        save_conclusion_analysis_eval_summary,
    )
    from benchmarking.main_eval_modules.coherence_linguistic_evals import (
        coherence_linguistic_eval,
        save_coherence_linguistic_end_to_end_summary,
        save_coherence_linguistic_hallucinations,
        save_coherence_linguistic_label_summary,
        save_coherence_linguistic_matching_summary,
    )
    from benchmarking.main_eval_modules.coherence_topic_sentence_unity_evals import (
        coherence_topic_sentence_unity_eval,
        save_coherence_topic_sentence_unity_behavior_summary,
        save_coherence_topic_sentence_unity_end_to_end_summary,
        save_coherence_topic_sentence_unity_hallucinations,
        save_coherence_topic_sentence_unity_matching_summary,
    )
    from benchmarking.main_eval_modules.grammar_repairs_evals import (
        grammar_repairs_eval,
        save_grammar_repairs_duplicates,
        save_grammar_repairs_hallucinations,
    )
    from benchmarking.main_eval_modules.introduction_gen_spec_evals import (
        introduction_gen_spec_eval,
        save_introduction_gen_spec_eval_summary,
    )
    from benchmarking.main_eval_modules.vocabulary_enhancements_evals import (
        save_vocabulary_enhancements_summary,
        vocabulary_enhancements_eval,
    )
    from benchmarking.main_eval_modules.thesis_statement_evals import (
        save_thesis_statement_eval_rows,
        save_thesis_statement_eval_summary,
        thesis_statement_eval,
    )
    from benchmarking.main_eval_modules.thesis_statement_characteristics_evals import (
        save_thesis_statement_characteristics_eval_summary,
        thesis_statement_characteristics_eval,
    )
    from benchmarking.main_eval_modules.style_edits_evals import (
        save_style_edits_duplicates,
        save_style_edits_hallucinations,
        style_edits_eval,
    )
    from benchmarking.main_eval_modules.utils import (
        EVALUATION_RESULTS_DIR,
        GOLD_CITATION_PATH,
        GOLD_REFERENCE_PATH,
        round_metric,
        safe_divide,
    )
except ModuleNotFoundError:
    from main_eval_modules.identify_citations_evals import (
        citation_no_references,
        identified_citations,
        reference_no_citations,
        save_citation_no_reference_duplicates,
        save_citation_no_reference_hallucinations,
        save_identify_citation_duplicates,
        save_reference_no_citation_hallucinations,
        save_identify_sentence_hallucinations,
    )
    from main_eval_modules.identify_paragraphs_evals import (
        identify_paragraphs,
        save_identify_paragraph_results,
        save_identify_paragraph_token_f1_results,
    )
    from main_eval_modules.conclusion_analysis_evals import (
        conclusion_analysis_eval,
        save_conclusion_analysis_eval_summary,
    )
    from main_eval_modules.coherence_linguistic_evals import (
        coherence_linguistic_eval,
        save_coherence_linguistic_end_to_end_summary,
        save_coherence_linguistic_hallucinations,
        save_coherence_linguistic_label_summary,
        save_coherence_linguistic_matching_summary,
    )
    from main_eval_modules.coherence_topic_sentence_unity_evals import (
        coherence_topic_sentence_unity_eval,
        save_coherence_topic_sentence_unity_behavior_summary,
        save_coherence_topic_sentence_unity_end_to_end_summary,
        save_coherence_topic_sentence_unity_hallucinations,
        save_coherence_topic_sentence_unity_matching_summary,
    )
    from main_eval_modules.grammar_repairs_evals import (
        grammar_repairs_eval,
        save_grammar_repairs_duplicates,
        save_grammar_repairs_hallucinations,
    )
    from main_eval_modules.introduction_gen_spec_evals import (
        introduction_gen_spec_eval,
        save_introduction_gen_spec_eval_summary,
    )
    from main_eval_modules.vocabulary_enhancements_evals import (
        save_vocabulary_enhancements_summary,
        vocabulary_enhancements_eval,
    )
    from main_eval_modules.thesis_statement_evals import (
        save_thesis_statement_eval_rows,
        save_thesis_statement_eval_summary,
        thesis_statement_eval,
    )
    from main_eval_modules.thesis_statement_characteristics_evals import (
        save_thesis_statement_characteristics_eval_summary,
        thesis_statement_characteristics_eval,
    )
    from main_eval_modules.style_edits_evals import (
        save_style_edits_duplicates,
        save_style_edits_hallucinations,
        style_edits_eval,
    )
    from main_eval_modules.utils import (
        EVALUATION_RESULTS_DIR,
        GOLD_CITATION_PATH,
        GOLD_REFERENCE_PATH,
        round_metric,
        safe_divide,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, choices=["qwen3.5_2b", "bonsai_8b", "gemma_e4b", "qwen3.5_4b"])
    return parser.parse_args()


def citation_no_reference(model: str) -> dict[str, str | int | float]:
    result, _, _ = citation_no_references(model)
    return result


def reference_no_citation(model: str) -> dict[str, str | int | float]:
    result, _ = reference_no_citations(model)
    return result


def save_benchmark_results(model: str, results: list[dict[str, str | int | float]]) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_benchmark_evals.csv"

    existing_rows: list[dict[str, str]] = []
    if output_path.exists():
        with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
            existing_rows = list(csv.DictReader(handle))

    fieldnames = list(results[0].keys())
    new_rows_by_type = {
        str(result["BENCHMARK_TYPE"]): {key: str(value) for key, value in result.items()}
        for result in results
    }

    filtered_rows = [
        row
        for row in existing_rows
        if row.get("BENCHMARK_TYPE") not in new_rows_by_type
    ]
    filtered_rows.extend(new_rows_by_type.values())

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(filtered_rows)

    return output_path


def save_results(model: str, results: list[dict[str, str | int | float]]) -> Path:
    return save_benchmark_results(model, results)


def build_pooled_coherence_summary(
    topic_behavior_summary: dict[str, str | int | float],
    topic_end_to_end_summary: dict[str, str | int | float],
    linguistic_label_summary: dict[str, str | int | float],
    linguistic_end_to_end_summary: dict[str, str | int | float],
) -> dict[str, str | int | float]:
    pooled_matched_sentence_count = int(topic_behavior_summary["MATCHED_SENTENCE_COUNT"]) + int(
        linguistic_label_summary["MATCHED_SENTENCE_COUNT"]
    )
    pooled_agreement_count = int(topic_behavior_summary["AGREEMENT_COUNT"]) + int(
        linguistic_label_summary["AGREEMENT_COUNT"]
    )
    pooled_disagreement_count = int(topic_behavior_summary["DISAGREEMENT_COUNT"]) + int(
        linguistic_label_summary["DISAGREEMENT_COUNT"]
    )
    pooled_label_accuracy = round_metric(
        safe_divide(pooled_agreement_count, pooled_matched_sentence_count)
    )

    pooled_end_to_end_tp = int(topic_end_to_end_summary["END_TO_END_TP"]) + int(
        linguistic_end_to_end_summary["END_TO_END_TP"]
    )
    pooled_end_to_end_fp = int(topic_end_to_end_summary["END_TO_END_FP"]) + int(
        linguistic_end_to_end_summary["END_TO_END_FP"]
    )
    pooled_end_to_end_fn = int(topic_end_to_end_summary["END_TO_END_FN"]) + int(
        linguistic_end_to_end_summary["END_TO_END_FN"]
    )
    pooled_end_to_end_precision = round_metric(
        safe_divide(pooled_end_to_end_tp, pooled_end_to_end_tp + pooled_end_to_end_fp)
    )
    pooled_end_to_end_recall = round_metric(
        safe_divide(pooled_end_to_end_tp, pooled_end_to_end_tp + pooled_end_to_end_fn)
    )
    pooled_end_to_end_f1 = round_metric(
        safe_divide(
            2 * pooled_end_to_end_precision * pooled_end_to_end_recall,
            pooled_end_to_end_precision + pooled_end_to_end_recall,
        )
    )

    return {
        "MATCHED_SENTENCE_COUNT": pooled_matched_sentence_count,
        "AGREEMENT_COUNT": pooled_agreement_count,
        "DISAGREEMENT_COUNT": pooled_disagreement_count,
        "LABEL_ACCURACY": pooled_label_accuracy,
        "END_TO_END_TP": pooled_end_to_end_tp,
        "END_TO_END_FP": pooled_end_to_end_fp,
        "END_TO_END_FN": pooled_end_to_end_fn,
        "END_TO_END_PRECISION": pooled_end_to_end_precision,
        "END_TO_END_RECALL": pooled_end_to_end_recall,
        "END_TO_END_F1": pooled_end_to_end_f1,
    }


def save_pooled_coherence_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_coherence_pooled_summary.csv"
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary.keys()))
        writer.writeheader()
        writer.writerow(summary)
    return output_path


def main() -> None:
    args = parse_args()
    (
        identified_citations_result,
        hallucinated_sentence_rows,
        duplicated_citation_rows,
    ) = identified_citations(args.model)
    (
        citation_no_reference_result,
        citation_no_reference_hallucinations,
        citation_no_reference_duplicates,
    ) = citation_no_references(args.model)
    (
        reference_no_citation_result,
        reference_no_citation_hallucinations,
    ) = reference_no_citations(args.model)
    (
        grammar_repairs_result,
        grammar_repairs_hallucinations,
        grammar_repairs_duplicates,
    ) = grammar_repairs_eval(args.model)
    (
        style_edits_result,
        style_edits_hallucinations,
        style_edits_duplicates,
    ) = style_edits_eval(args.model)
    thesis_row_results, thesis_summary = thesis_statement_eval(args.model)
    thesis_characteristics_summary = thesis_statement_characteristics_eval(args.model)
    (
        coherence_matching_summary,
        coherence_behavior_summary,
        coherence_end_to_end_summary,
        coherence_hallucination_rows,
    ) = coherence_topic_sentence_unity_eval(args.model)
    (
        coherence_linguistic_matching_summary,
        coherence_linguistic_label_summary,
        coherence_linguistic_end_to_end_summary,
        coherence_linguistic_hallucination_rows,
    ) = coherence_linguistic_eval(args.model)
    pooled_coherence_summary = build_pooled_coherence_summary(
        coherence_behavior_summary,
        coherence_end_to_end_summary,
        coherence_linguistic_label_summary,
        coherence_linguistic_end_to_end_summary,
    )
    conclusion_analysis_summary = conclusion_analysis_eval(args.model)
    introduction_gen_spec_summary = introduction_gen_spec_eval(args.model)
    vocabulary_enhancements_summary_rows = vocabulary_enhancements_eval(args.model)
    benchmark_results = [
        identified_citations_result,
        citation_no_reference_result,
        reference_no_citation_result,
        grammar_repairs_result,
        style_edits_result,
    ]
    benchmark_output_path = save_results(args.model, benchmark_results)
    identify_result, identify_token_f1_rows = identify_paragraphs(args.model)
    identify_output_path = save_identify_paragraph_results(args.model, identify_result)
    identify_token_f1_output_path = save_identify_paragraph_token_f1_results(
        args.model, identify_token_f1_rows
    )
    hallucination_output_path = save_identify_sentence_hallucinations(
        args.model, hallucinated_sentence_rows
    )
    duplicated_output_path = save_identify_citation_duplicates(
        args.model, duplicated_citation_rows
    )
    citation_no_reference_hallucination_output_path = (
        save_citation_no_reference_hallucinations(
            args.model, citation_no_reference_hallucinations
        )
    )
    citation_no_reference_duplicate_output_path = save_citation_no_reference_duplicates(
        args.model, citation_no_reference_duplicates
    )
    reference_no_citation_hallucination_output_path = (
        save_reference_no_citation_hallucinations(
            args.model, reference_no_citation_hallucinations
        )
    )
    grammar_repairs_hallucination_output_path = save_grammar_repairs_hallucinations(
        args.model, grammar_repairs_hallucinations
    )
    grammar_repairs_duplicate_output_path = save_grammar_repairs_duplicates(
        args.model, grammar_repairs_duplicates
    )
    style_edits_hallucination_output_path = save_style_edits_hallucinations(
        args.model, style_edits_hallucinations
    )
    style_edits_duplicate_output_path = save_style_edits_duplicates(
        args.model, style_edits_duplicates
    )
    thesis_rows_output_path = save_thesis_statement_eval_rows(args.model, thesis_row_results)
    thesis_summary_output_path = save_thesis_statement_eval_summary(args.model, thesis_summary)
    thesis_characteristics_summary_output_path = (
        save_thesis_statement_characteristics_eval_summary(
            args.model, thesis_characteristics_summary
        )
    )
    coherence_matching_summary_output_path = (
        save_coherence_topic_sentence_unity_matching_summary(
            args.model, coherence_matching_summary
        )
    )
    coherence_behavior_summary_output_path = (
        save_coherence_topic_sentence_unity_behavior_summary(
            args.model, coherence_behavior_summary
        )
    )
    coherence_end_to_end_summary_output_path = (
        save_coherence_topic_sentence_unity_end_to_end_summary(
            args.model, coherence_end_to_end_summary
        )
    )
    coherence_hallucinations_output_path = save_coherence_topic_sentence_unity_hallucinations(
        args.model, coherence_hallucination_rows
    )
    coherence_linguistic_matching_summary_output_path = (
        save_coherence_linguistic_matching_summary(
            args.model, coherence_linguistic_matching_summary
        )
    )
    coherence_linguistic_label_summary_output_path = (
        save_coherence_linguistic_label_summary(
            args.model, coherence_linguistic_label_summary
        )
    )
    coherence_linguistic_end_to_end_summary_output_path = (
        save_coherence_linguistic_end_to_end_summary(
            args.model, coherence_linguistic_end_to_end_summary
        )
    )
    coherence_linguistic_hallucinations_output_path = save_coherence_linguistic_hallucinations(
        args.model, coherence_linguistic_hallucination_rows
    )
    pooled_coherence_summary_output_path = save_pooled_coherence_summary(
        args.model, pooled_coherence_summary
    )
    conclusion_analysis_summary_output_path = save_conclusion_analysis_eval_summary(
        args.model, conclusion_analysis_summary
    )
    introduction_gen_spec_summary_output_path = save_introduction_gen_spec_eval_summary(
        args.model, introduction_gen_spec_summary
    )
    vocabulary_enhancements_summary_output_path = save_vocabulary_enhancements_summary(
        args.model, vocabulary_enhancements_summary_rows
    )
    print(f"Saved benchmark results to {benchmark_output_path}")
    print(f"Saved identify-paragraph results to {identify_output_path}")
    print(f"Saved identify-paragraph token F1 results to {identify_token_f1_output_path}")
    print(f"Saved identify-sentence hallucinations to {hallucination_output_path}")
    print(f"Saved identify-citation duplicates to {duplicated_output_path}")
    print(
        "Saved citation-no-reference hallucinations to "
        f"{citation_no_reference_hallucination_output_path}"
    )
    print(
        "Saved citation-no-reference duplicates to "
        f"{citation_no_reference_duplicate_output_path}"
    )
    print(
        "Saved reference-no-citation hallucinations to "
        f"{reference_no_citation_hallucination_output_path}"
    )
    print(
        "Saved grammar-repairs hallucinations to "
        f"{grammar_repairs_hallucination_output_path}"
    )
    print(
        "Saved grammar-repairs duplicates to "
        f"{grammar_repairs_duplicate_output_path}"
    )
    print(
        "Saved style-edits hallucinations to "
        f"{style_edits_hallucination_output_path}"
    )
    print(
        "Saved style-edits duplicates to "
        f"{style_edits_duplicate_output_path}"
    )
    print(f"Saved thesis-statement row evals to {thesis_rows_output_path}")
    print(f"Saved thesis-statement summary evals to {thesis_summary_output_path}")
    print(
        "Saved thesis-statement characteristics summary evals to "
        f"{thesis_characteristics_summary_output_path}"
    )
    print(
        "Saved coherence matching summary evals to "
        f"{coherence_matching_summary_output_path}"
    )
    print(
        "Saved coherence behavior summary evals to "
        f"{coherence_behavior_summary_output_path}"
    )
    print(
        "Saved coherence end-to-end summary evals to "
        f"{coherence_end_to_end_summary_output_path}"
    )
    print(
        "Saved coherence hallucinations to "
        f"{coherence_hallucinations_output_path}"
    )
    print(
        "Saved coherence linguistic matching summary evals to "
        f"{coherence_linguistic_matching_summary_output_path}"
    )
    print(
        "Saved coherence linguistic label summary evals to "
        f"{coherence_linguistic_label_summary_output_path}"
    )
    print(
        "Saved coherence linguistic end-to-end summary evals to "
        f"{coherence_linguistic_end_to_end_summary_output_path}"
    )
    print(
        "Saved coherence linguistic hallucinations to "
        f"{coherence_linguistic_hallucinations_output_path}"
    )
    print(f"Saved pooled coherence summary evals to {pooled_coherence_summary_output_path}")
    print(
        "Saved conclusion-analysis summary evals to "
        f"{conclusion_analysis_summary_output_path}"
    )
    print(
        "Saved introduction-gen-spec summary evals to "
        f"{introduction_gen_spec_summary_output_path}"
    )
    print(
        "Saved vocabulary-enhancements summary evals to "
        f"{vocabulary_enhancements_summary_output_path}"
    )


if __name__ == "__main__":
    main()
