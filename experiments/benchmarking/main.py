from __future__ import annotations
import csv
import json
import re
import subprocess
import argparse
import time
from pathlib import Path

from topic_sentences_benchmarks import identify_topic_sentence, select_best_topic_sentence, write_topic_sentence, judge_topic_sentence
from vocabulary_benchmarks import enhance_specified_word, identify_words_to_improve, suggest_multiple_word_improvements
from coherence_benchmarks import identify_signposts, recommend_signposts, detect_transition, recommend_transition, detect_summary_noun, recommend_summary_noun
from supporting_claims import supporting_claims, weak_support

import requests


BENCHMARKING_ROOT = Path(__file__).resolve().parent
MODEL_ID_BY_BASENAME = {
    "Ternary-Bonsai-8B-Q2_0.gguf": "bonsai_8B",
    "gemma-4-12b-it-Q4_K_M.gguf": "gemma4_12B_nothink",
    "gemma-4-E4B-it-Q4_K_M.gguf": "gemma4_E4B_nothink",
}
CSV_FIELDNAMES = [
    "Row ID",
    "Parent Row ID",
    "Paragraph",
    "Enhanced Knowledge",
    "LLM",
    "Model Path",
    "Task",
    "Stage",
    "Item Index",
    "Answer",
    "Reason",
    "First Sentence",
    "Second Sentence",
    "Judgement",
    "Reason Judgement",
    "Raw Response",
]

def wait_for_server(base_url: str, timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    health_url = f"{base_url}/health"
    while time.time() < deadline:
        try:
            r = requests.get(health_url, timeout=2)
            if r.ok:
                return
        except requests.RequestException:
            pass
        time.sleep(0.5)
    raise TimeoutError(f"Server did not become healthy in {timeout_s}s: {health_url}")


def resolve_model_id(model_path: str, explicit_model_id: str | None) -> str:
    if explicit_model_id:
        return explicit_model_id

    basename = Path(model_path).name
    if basename in MODEL_ID_BY_BASENAME:
        return MODEL_ID_BY_BASENAME[basename]

    stem = Path(model_path).stem
    return re.sub(r"[^A-Za-z0-9]+", "_", stem).strip("_")


def benchmark_results_path(model_id: str) -> Path:
    return BENCHMARKING_ROOT / "results" / model_id / "benchmark_results.csv"


def append_rows_to_csv(csv_path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        return

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = csv_path.exists() and csv_path.stat().st_size > 0

    with csv_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDNAMES, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()
        writer.writerows(rows)


def normalize_for_compare(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.strip().strip("“”\"'`")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", "", text.lower())
    return text.strip()


def first_nonempty_line(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return ""


def parse_content(response: dict) -> object:
    content = response["choices"][0]["message"]["content"]
    if isinstance(content, str):
        stripped = content.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                return content
    return content


def load_gold_text(question: str, paragraph_name: str) -> str:
    gold_path = BENCHMARKING_ROOT / "answers" / question / f"{paragraph_name}.md"
    if gold_path.exists():
        return gold_path.read_text(encoding="utf-8")
    return ""


def parse_gold_answer_value(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith("answer:"):
            value = stripped.split(":", 1)[1].strip()
            value = re.split(r"\b(?:reason|transition|phrase)\s*:\s*", value, maxsplit=1, flags=re.IGNORECASE)[0]
            return value.strip().rstrip(".")
        return stripped
    return ""


def parse_gold_key_values(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        values[key.strip().lower()] = value.strip()
    return values


def parse_gold_expressions(text: str) -> list[str]:
    expressions: list[str] = []
    for block in re.split(r"\n\s*\n", text.strip()):
        for line in block.splitlines():
            stripped = line.strip()
            if stripped.lower().startswith("expression:"):
                expressions.append(stripped.split(":", 1)[1].strip())
                break
    return expressions


def parse_gold_signposts(text: str) -> list[str]:
    line = first_nonempty_line(text)
    if not line:
        return []
    return [part.strip() for part in line.split("/") if part.strip()]


def judge_answer(
    question: str,
    paragraph_name: str,
    answer: str,
    reason: str = "",
    item_data: dict | None = None,
    stage: str = "primary",
) -> str:
    gold_text = load_gold_text(question, paragraph_name)
    if not gold_text:
        return "pending"

    if question in {"A1", "A3", "D2"}:
        gold_answer = parse_gold_answer_value(gold_text)
        return "correct" if normalize_for_compare(answer) == normalize_for_compare(gold_answer) else "incorrect"

    if question == "A2":
        gold_answer = parse_gold_answer_value(gold_text)
        return "correct" if normalize_for_compare(answer) == normalize_for_compare(gold_answer) else "incorrect"

    if question in {"A4", "D1"}:
        gold_values = parse_gold_key_values(gold_text)
        gold_answer = parse_gold_answer_value(gold_text) or gold_values.get("answer", "")
        return "correct" if normalize_for_compare(answer) == normalize_for_compare(gold_answer) else "incorrect"

    if question in {"B1", "B2", "B3"} and item_data:
        return "pending"

    if question == "C1":
        gold_signposts = parse_gold_signposts(gold_text)
        if not gold_signposts:
            return "pending"
        return "correct" if any(
            normalize_for_compare(answer) == normalize_for_compare(gold_signpost)
            for gold_signpost in gold_signposts
        ) else "incorrect"

    if question == "C2":
        return "pending"

    if question in {"C3", "C4"}:
        gold_values = parse_gold_key_values(gold_text)
        expected_answer = parse_gold_answer_value(gold_text) or gold_values.get("answer", "")
        if normalize_for_compare(answer) != normalize_for_compare(expected_answer):
            return "incorrect"

        if stage == "detect":
            expected_reason = gold_values.get("transition", gold_values.get("phrase", ""))
            if expected_reason and normalize_for_compare(reason) != normalize_for_compare(expected_reason):
                return "incorrect"
            return "correct"
        return "n/a"

    return "pending"


def build_rows_for_response(
    *,
    question: str,
    paragraph_name: str,
    enhanced_knowledge: str,
    model_id: str,
    model_path: str,
    task_file: Path,
    response: dict,
    stage: str = "primary",
    parent_row_id: str = "",
) -> list[dict[str, object]]:
    content = parse_content(response)
    task_name = task_file.name
    raw_response = json.dumps(response, ensure_ascii=False)
    rows: list[dict[str, object]] = []

    def add_row(answer: str, reason: str = "", item_index: int = 1, item_data: dict | None = None) -> None:
        row_id = f"{paragraph_name}|{enhanced_knowledge}|{model_id}|{task_name}|{stage}|{item_index}"
        rows.append(
            {
                "Row ID": row_id,
                "Parent Row ID": parent_row_id,
                "Paragraph": paragraph_name,
                "Enhanced Knowledge": enhanced_knowledge,
                "LLM": model_id,
                "Model Path": model_path,
                "Task": task_name,
                "Stage": stage,
                "Item Index": item_index,
                "Answer": answer,
                "Reason": reason,
                "First Sentence": "",
                "Second Sentence": "",
                "Judgement": judge_answer(
                    question,
                    paragraph_name,
                    answer,
                    reason=reason,
                    item_data=item_data,
                    stage=stage,
                ),
                "Reason Judgement": "pending",
                "Raw Response": raw_response,
            }
        )

    if question in {"A1", "A3", "D2"}:
        answer = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
        add_row(answer=answer)
        return rows

    if question == "A2":
        answer = ""
        reason = ""
        if isinstance(content, dict):
            answer = str(content.get("verdict", ""))
            reason = str(content.get("reason", ""))
        add_row(answer=answer, reason=reason)
        return rows

    if question == "A4":
        answer = ""
        reason = ""
        if isinstance(content, dict):
            answer = str(content.get("verdict", ""))
            reason = str(content.get("reason", ""))
        add_row(answer=answer, reason=reason)
        return rows

    if question in {"B1", "B2", "B3"}:
        items = []
        if isinstance(content, dict):
            items = content.get("items", []) or []
        elif isinstance(content, list):
            items = content
        for index, item in enumerate(items, start=1):
            item_data = item if isinstance(item, dict) else {"value": item}
            add_row(
                answer=json.dumps(item, ensure_ascii=False),
                item_index=index,
                item_data=item_data,
            )
        return rows

    if question == "C1":
        items = []
        if isinstance(content, dict):
            items = content.get("items", []) or []
        elif isinstance(content, list):
            items = content
        for index, item in enumerate(items, start=1):
            if isinstance(item, dict):
                answer = str(item.get("signpost", ""))
            else:
                answer = str(item)
            add_row(answer=answer, item_index=index)
        return rows

    if question == "C2":
        items = []
        if isinstance(content, dict):
            items = content.get("items", []) or []
        elif isinstance(content, list):
            items = content
        for index, item in enumerate(items, start=1):
            item_data = item if isinstance(item, dict) else {"value": item}
            first_sentence = str(item_data.get("first_sentence", ""))
            second_sentence = str(item_data.get("second_sentence", ""))
            necessary_to_add = str(item_data.get("necessary_to_add", ""))
            signpost = str(item_data.get("signpost", ""))

            decision_row_id = f"{paragraph_name}|{enhanced_knowledge}|{model_id}|{task_name}|decision|{index}"
            rows.append(
                {
                    "Row ID": decision_row_id,
                    "Parent Row ID": parent_row_id,
                    "Paragraph": paragraph_name,
                    "Enhanced Knowledge": enhanced_knowledge,
                    "LLM": model_id,
                    "Model Path": model_path,
                    "Task": task_name,
                    "Stage": "decision",
                    "Item Index": index,
                    "Answer": necessary_to_add,
                    "Reason": "",
                    "First Sentence": first_sentence,
                    "Second Sentence": second_sentence,
                    "Judgement": "pending",
                    "Reason Judgement": "pending",
                    "Raw Response": raw_response,
                }
            )

            if necessary_to_add.lower() == "yes":
                rows.append(
                    {
                        "Row ID": f"{paragraph_name}|{enhanced_knowledge}|{model_id}|{task_name}|recommend|{index}",
                        "Parent Row ID": decision_row_id,
                        "Paragraph": paragraph_name,
                        "Enhanced Knowledge": enhanced_knowledge,
                        "LLM": model_id,
                        "Model Path": model_path,
                        "Task": task_name,
                        "Stage": "recommend",
                        "Item Index": index,
                        "Answer": signpost,
                        "Reason": "",
                        "First Sentence": first_sentence,
                        "Second Sentence": second_sentence,
                        "Judgement": "pending",
                        "Reason Judgement": "pending",
                        "Raw Response": raw_response,
                    }
                )
        return rows

    if question == "D1":
        answer = ""
        reason = ""
        if isinstance(content, dict):
            answer = str(content.get("has_support", ""))
            reason = str(content.get("details", ""))
        add_row(answer=answer, reason=reason)
        return rows

    if question == "D2":
        answer = ""
        reason = ""
        if isinstance(content, dict):
            answer = str(content.get("weak_support", ""))
            reason = str(content.get("details", ""))
        add_row(answer=answer, reason=reason)
        return rows

    if question == "C3":
        if stage == "detect":
            answer = ""
            reason = ""
            if isinstance(content, dict):
                answer = str(content.get("has_transition_sentence", ""))
                reason = str(content.get("detected_transition_sentence", ""))
            add_row(answer=answer, reason=reason)
            return rows
        if stage == "recommend":
            answer = ""
            reason = ""
            if isinstance(content, dict):
                answer = str(content.get("recommended_transition_sentence", ""))
                reason = str(content.get("transition_sentence_placement", ""))
            add_row(answer=answer, reason=reason)
            return rows

    if question == "C4":
        if stage == "detect":
            answer = ""
            reason = ""
            if isinstance(content, dict):
                answer = str(content.get("has_summary_noun_phrase", ""))
                reason = str(content.get("summary_noun_phrase", ""))
            add_row(answer=answer, reason=reason)
            return rows
        if stage == "recommend":
            answer = ""
            reason = ""
            if isinstance(content, dict):
                answer = str(content.get("recommended_summary_noun_phrase", ""))
                reason = str(content.get("summary_noun_phrase_placement", ""))
            add_row(answer=answer, reason=reason)
            return rows

    add_row(answer=json.dumps(content, ensure_ascii=False) if not isinstance(content, str) else content)
    return rows


def log_response(
    *,
    question: str,
    paragraph_file: Path,
    enhanced_knowledge: str,
    model_id: str,
    model_path: str,
    task_file: Path,
    response: dict,
    stage: str = "primary",
    parent_row_id: str = "",
) -> list[dict[str, object]]:
    rows = build_rows_for_response(
        question=question,
        paragraph_name=paragraph_file.stem,
        enhanced_knowledge=enhanced_knowledge,
        model_id=model_id,
        model_path=model_path,
        task_file=task_file,
        response=response,
        stage=stage,
        parent_row_id=parent_row_id,
    )
    append_rows_to_csv(benchmark_results_path(model_id), rows)
    return rows


def row_id_for(
    paragraph_name: str,
    enhanced_knowledge: str,
    model_id: str,
    task_name: str,
    stage: str,
    item_index: int = 1,
) -> str:
    return f"{paragraph_name}|{enhanced_knowledge}|{model_id}|{task_name}|{stage}|{item_index}"


def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    print(repo_root)
    if model == "gemma":
        return repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"
    if model == "bonsai":
        return repo_root / "third_party_prismml" / "llama-cpp" / "build" / "bin" / "llama-server"
    
def select_jinja(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    if model =="gemma":
        return repo_root / "assets" / "models" / "gemma_4_chat_template.jinja"




def main() -> None:
    # Set up arguments for command line
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", required=True, help="Path to GGUF model")
    parser.add_argument(
        "--model-id",
        default=None,
        help="Stable preset label for results output, such as bonsai_8B or gemma4_E4B_nothink",
    )
    parser.add_argument("--model", required=True, help="Name of model: bonsai, gemma", choices=["bonsai", "gemma"])
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)
    parser.add_argument("--cache-k", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--cache-v", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)
    parser.add_argument("--question", default="A1", choices=["A1", "A2", "A3", "A4", "B1", "B2", "B3", "C1", "C2", "C3", "C4", "D1", "D2"])
    args = parser.parse_args()
    model_id = resolve_model_id(args.model_path, args.model_id)

    # File path to server
    llama_server = select_server_for_model(args.model)
    jinja = select_jinja(args.model)
    cmd_extra = []
    if args.model=="gemma":
        # Set thinking to 0 for gemma
        cmd_extra = ["--reasoning", "off", "--reasoning-budget", "0", "--jinja", "--chat-template-file", str(jinja)]

    # Basic server settings
    cmd = [
        str(llama_server),
        "-m", str(Path(args.model_path).resolve()),
        "--port", str(args.port),
        "-c", str(args.ctx),
        "--cache-type-k", args.cache_k,
        "--cache-type-v", args.cache_v,
        "--flash-attn", "on",
        "--n-gpu-layers", str(args.n_gpu_layers),
    ]

    # Extra model-dependent flags
    cmd.extend(cmd_extra)


    # Start the server
    print("Starting server:\n", " ".join(cmd))
    proc = subprocess.Popen(cmd)
    base_url = f"http://127.0.0.1:{args.port}"
    
    # Set up directory where writing data is stored
    repo_root = Path(__file__).resolve().parents[1]
    writing_dir = ""
    if args.question == "A1":
        writing_dir = repo_root / "benchmarking/questions/A1"
    elif args.question == "A2":
        writing_dir = repo_root / "benchmarking/questions/A2"
    elif args.question == "A3":
        writing_dir = repo_root / "benchmarking/questions/A3"
    elif args.question == "A4":
        writing_dir = repo_root / "benchmarking/questions/A4"
    elif args.question == "B1":
        writing_dir = repo_root / "benchmarking/questions/B1"
    elif args.question == "B2":
        writing_dir = repo_root / "benchmarking/questions/B2"
    elif args.question == "B3":
        writing_dir = repo_root / "benchmarking/questions/B3"
    elif args.question == "C1":
        writing_dir = repo_root / "benchmarking/questions/C1"
    elif args.question == "C2":
        writing_dir = repo_root / "benchmarking/questions/C2"
    elif args.question == "C3":
        writing_dir = repo_root / "benchmarking/questions/C3"
    elif args.question == "C4":
        writing_dir = repo_root / "benchmarking/questions/C4"
    elif args.question == "D1":
        writing_dir = repo_root / "benchmarking/questions/D1"
    elif args.question == "D2":
        writing_dir = repo_root / "benchmarking/questions/D2"

    # Set up directory where system prompt is stored
    system_prompt_file = ""
    system_prompt_file_1 = ""
    system_prompt_file_2 = ""
    if args.question == "A1":
        system_prompt_file = repo_root / "benchmarking/system_prompts/A1_ts.md"
    elif args.question == "A2":
        system_prompt_file = repo_root / "benchmarking/system_prompts/A2_ts.md"
    elif args.question == "A3":
        system_prompt_file = repo_root / "benchmarking/system_prompts/A3_ts.md"
    elif args.question == "A4":
        system_prompt_file = repo_root / "benchmarking/system_prompts/A4_ts.md"
    elif args.question == "B1":
        system_prompt_file = repo_root / "benchmarking/system_prompts/B1_v.md"
    elif args.question == "B2":
        system_prompt_file = repo_root / "benchmarking/system_prompts/B2_v.md"
    elif args.question == "B3":
        system_prompt_file = repo_root / "benchmarking/system_prompts/B3_v.md"
    elif args.question == "C1":
        system_prompt_file = repo_root / "benchmarking/system_prompts/C1_coh.md"
    elif args.question == "C2":
        system_prompt_file = repo_root / "benchmarking/system_prompts/C2_coh.md"
    elif args.question == "C3":
        system_prompt_file_1 = repo_root / "benchmarking/system_prompts/C3_1_coh.md"
        system_prompt_file_2 = repo_root / "benchmarking/system_prompts/C3_2_coh.md"
    elif args.question == "C4":
        system_prompt_file_1 = repo_root / "benchmarking/system_prompts/C4_1_coh.md"
        system_prompt_file_2 = repo_root / "benchmarking/system_prompts/C4_2_coh.md"
    elif args.question == "D1":
        system_prompt_file = repo_root / "benchmarking/system_prompts/D1_ss.md"
    elif args.question == "D2":
        system_prompt_file = repo_root / "benchmarking/system_prompts/D2_ss.md"

    print(args.question)

    try:
        wait_for_server(base_url)

        # Topic sentence benchmarking: iterate files in the directory
        for writing_file in sorted(writing_dir.iterdir()):
            if not writing_file.is_file():
                continue

            if args.question == "A1":
                # Identify topic sentences
                identify_topic_sentences_with_knowledge = identify_topic_sentence(
                    "benchmarking/system_prompts/paragraph_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(identify_topic_sentences_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=identify_topic_sentences_with_knowledge,
                )

                identify_topic_sentences_without_knowledge = identify_topic_sentence(
                    "benchmarking/system_prompts/paragraph_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(identify_topic_sentences_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=identify_topic_sentences_without_knowledge,
                )

            elif args.question == "A2":
                # Select the best topic sentence.
                select_topic_sentence_with_knowledge = select_best_topic_sentence(
                    "benchmarking/system_prompts/paragraph_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(select_topic_sentence_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=select_topic_sentence_with_knowledge,
                )

                select_topic_sentence_without_knowledge = select_best_topic_sentence(
                    "benchmarking/system_prompts/paragraph_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(select_topic_sentence_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=select_topic_sentence_without_knowledge,
                )

            elif args.question == "A3":

                # Write an appropriate topic sentence
                write_topic_sentence_with_knowledge = write_topic_sentence(
                    "benchmarking/system_prompts/paragraph_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(write_topic_sentence_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=write_topic_sentence_with_knowledge,
                )

                write_topic_sentence_without_knowledge = write_topic_sentence(
                    "benchmarking/system_prompts/paragraph_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(write_topic_sentence_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=write_topic_sentence_without_knowledge,
                )
            elif args.question == "A4":
                # Write an appropriate topic sentence
                judge_ts_with_knowledge = judge_topic_sentence(
                    "benchmarking/system_prompts/paragraph_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(judge_ts_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=judge_ts_with_knowledge,
                )

                judge_ts_without_knowledge = judge_topic_sentence(
                    "benchmarking/system_prompts/paragraph_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(judge_ts_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=judge_ts_without_knowledge,
                )
            elif args.question == "B1":
                # Enhance pre-selected vocabulary
                enhance_vocab_with_knowledge = enhance_specified_word(
                    "benchmarking/system_prompts/vocabulary_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(enhance_vocab_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=enhance_vocab_with_knowledge,
                )

                enhance_vocab_without_knowledge = enhance_specified_word(
                    "benchmarking/system_prompts/vocabulary_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(enhance_vocab_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=enhance_vocab_without_knowledge,
                )
            elif args.question == "B2":
                # Identify words to enhance
                vocab_with_knowledge = identify_words_to_improve(
                    "benchmarking/system_prompts/vocabulary_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(vocab_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=vocab_with_knowledge,
                )

                vocab_without_knowledge = identify_words_to_improve(
                    "benchmarking/system_prompts/vocabulary_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(vocab_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=vocab_without_knowledge,
                )
            elif args.question == "B3":
                # Identify words to enhance
                vocab_with_knowledge = suggest_multiple_word_improvements(
                    "benchmarking/system_prompts/vocabulary_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(vocab_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=vocab_with_knowledge,
                )

                vocab_without_knowledge = suggest_multiple_word_improvements(
                    "benchmarking/system_prompts/vocabulary_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(vocab_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=vocab_without_knowledge,
                )
            elif args.question == "C1":
                # Identify signposts
                signposts_with_knowledge = identify_signposts(
                    "benchmarking/system_prompts/coherence_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(signposts_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=signposts_with_knowledge,
                )

                signposts_without_knowledge = identify_signposts(
                    "benchmarking/system_prompts/coherence_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(signposts_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=signposts_without_knowledge,
                )
            elif args.question == "C2":
                # Recommend signposts
                signposts_with_knowledge = recommend_signposts(
                    "benchmarking/system_prompts/coherence_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(signposts_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=signposts_with_knowledge,
                )

                signposts_without_knowledge = recommend_signposts(
                    "benchmarking/system_prompts/coherence_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(signposts_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=signposts_without_knowledge,
                )
            elif args.question == "C3":
                # Detect and recommend transitions
                transitions_with_knowledge = detect_transition(
                    "benchmarking/system_prompts/coherence_knowledge.md",
                    writing_file,
                    system_prompt_file_1,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(transitions_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file_1,
                    response=transitions_with_knowledge,
                    stage="detect",
                )

                content = transitions_with_knowledge["choices"][0]["message"]["content"]
                detected = json.loads(content)

                if detected["has_transition_sentence"] == "No":
                    recommended_transition = recommend_transition(
                        "benchmarking/system_prompts/coherence_knowledge.md",
                        writing_file,
                        system_prompt_file_2,
                        base_url,
                        args.max_tokens,
                        args.temp,
                    )
                    print(f"--- {writing_file.name} ---")
                    print(json.dumps(recommended_transition, indent=2))
                    log_response(
                        question=args.question,
                        paragraph_file=writing_file,
                        enhanced_knowledge="yes",
                        model_id=model_id,
                        model_path=args.model_path,
                        task_file=system_prompt_file_2,
                        response=recommended_transition,
                        stage="recommend",
                        parent_row_id=row_id_for(writing_file.stem, "yes", model_id, system_prompt_file_1.name, "detect", 1),
                    )

                transitions_without_knowledge = detect_transition(
                    "benchmarking/system_prompts/coherence_no_knowledge.md",
                    writing_file,
                    system_prompt_file_1,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )
                print(f"--- {writing_file.name} ---")
                print(json.dumps(transitions_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file_1,
                    response=transitions_without_knowledge,
                    stage="detect",
                )
                
                content = transitions_without_knowledge["choices"][0]["message"]["content"]
                detected = json.loads(content)

                if detected["has_transition_sentence"] == "No":
                    recommended_transition = recommend_transition(
                        "benchmarking/system_prompts/coherence_no_knowledge.md",
                        writing_file,
                        system_prompt_file_2,
                        base_url,
                        args.max_tokens,
                        args.temp,
                    )
                    print(f"--- {writing_file.name} ---")
                    print(json.dumps(recommended_transition, indent=2))
                    log_response(
                        question=args.question,
                        paragraph_file=writing_file,
                        enhanced_knowledge="no",
                        model_id=model_id,
                        model_path=args.model_path,
                        task_file=system_prompt_file_2,
                        response=recommended_transition,
                        stage="recommend",
                        parent_row_id=row_id_for(writing_file.stem, "no", model_id, system_prompt_file_1.name, "detect", 1),
                    )

            elif args.question == "C4":
                # Detect and recommend summary nouns
                summary_nouns_with_knowledge = detect_summary_noun(
                    "benchmarking/system_prompts/coherence_knowledge.md",
                    writing_file,
                    system_prompt_file_1,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )
                print(f"--- {writing_file.name} ---")
                print(json.dumps(summary_nouns_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file_1,
                    response=summary_nouns_with_knowledge,
                    stage="detect",
                )

                # Now for the second step
                content = summary_nouns_with_knowledge["choices"][0]["message"]["content"]
                detected = json.loads(content)
                if detected["has_summary_noun_phrase"] == "No":
                    recommended_summary_with_knowledge = recommend_summary_noun(
                        "benchmarking/system_prompts/coherence_knowledge.md",
                        writing_file,
                        system_prompt_file_2,
                        base_url,
                        args.max_tokens,
                        args.temp,
                    )
                    print(f"--- {writing_file.name} ---")
                    print(json.dumps(recommended_summary_with_knowledge, indent=2))
                    log_response(
                        question=args.question,
                        paragraph_file=writing_file,
                        enhanced_knowledge="yes",
                        model_id=model_id,
                        model_path=args.model_path,
                        task_file=system_prompt_file_2,
                        response=recommended_summary_with_knowledge,
                        stage="recommend",
                        parent_row_id=row_id_for(writing_file.stem, "yes", model_id, system_prompt_file_1.name, "detect", 1),
                    )

                

                summary_nouns_without_knowledge = detect_summary_noun(
                    "benchmarking/system_prompts/coherence_no_knowledge.md",
                    writing_file,
                    system_prompt_file_1,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )
                print(f"--- {writing_file.name} ---")
                print(json.dumps(summary_nouns_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file_1,
                    response=summary_nouns_without_knowledge,
                    stage="detect",
                )

                # Now for the second step
                content = summary_nouns_without_knowledge["choices"][0]["message"]["content"]
                detected = json.loads(content)
                if detected["has_summary_noun_phrase"] == "No":
                    recommended_summary_without_knowledge = recommend_summary_noun(
                        "benchmarking/system_prompts/coherence_no_knowledge.md",
                        writing_file,
                        system_prompt_file_2,
                        base_url,
                        args.max_tokens,
                        args.temp,
                    )
                    print(f"--- {writing_file.name} ---")
                    print(json.dumps(recommended_summary_without_knowledge, indent=2))
                    log_response(
                        question=args.question,
                        paragraph_file=writing_file,
                        enhanced_knowledge="no",
                        model_id=model_id,
                        model_path=args.model_path,
                        task_file=system_prompt_file_2,
                        response=recommended_summary_without_knowledge,
                        stage="recommend",
                        parent_row_id=row_id_for(writing_file.stem, "no", model_id, system_prompt_file_1.name, "detect", 1),
                    )



            elif args.question == "D1":
                # Recommend signposts
                supporting_claims_with_knowledge = supporting_claims(
                    "benchmarking/system_prompts/supporting_claims_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(supporting_claims_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=supporting_claims_with_knowledge,
                )

                supporting_claims_without_knowledge = supporting_claims(
                    "benchmarking/system_prompts/supporting_claims_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(supporting_claims_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=supporting_claims_without_knowledge,
                )
            elif args.question == "D2":
                # weak support
                weak_support_with_knowledge = weak_support(
                    "benchmarking/system_prompts/paragraph_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(weak_support_with_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="yes",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=weak_support_with_knowledge,
                )

                weak_support_without_knowledge = weak_support(
                    "benchmarking/system_prompts/paragraph_no_knowledge.md",
                    writing_file,
                    system_prompt_file,
                    base_url,
                    args.max_tokens,
                    args.temp,
                )

                print(f"--- {writing_file.name} ---")
                print(json.dumps(weak_support_without_knowledge, indent=2))
                log_response(
                    question=args.question,
                    paragraph_file=writing_file,
                    enhanced_knowledge="no",
                    model_id=model_id,
                    model_path=args.model_path,
                    task_file=system_prompt_file,
                    response=weak_support_without_knowledge,
                )
            

            # TO DO
            # Write the results to a CSV file as follows
            # Get results into specific folders for specific models
            # Paragraph --- Enhanced Knowledge --- LLM --- Task --- Answer --- Judgement

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

# main
if __name__ == "__main__":
    main()

# Preferred way to run full benchmarks:
#   scripts/run_benchmark.sh <bonsai_8B|gemma4_12B_nothink|gemma4_E4B_nothink>
# If you run main.py directly, include --model-id so the CSV lands in the right folder.

# To run a quick experiment
# With Ternary Bonsai:
# - Change line 54 to llama_server = select_server_for_model("gemma")
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question A1

# With Gemma 4
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question A1 
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-12b-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question A1
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/benchmarking/main.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3


# GEMMA 4
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "A1" --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "A2" --max-tokens 128 (128 may be too small)
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "A3" --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "A4" --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "B1" --max-tokens 256
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "B2" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "B3" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "C1" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "C2" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "C3" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "C4" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "D1" --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --question "D2" --max-tokens 512

# TERNARY BONSAI
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question A1 --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question A2 --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question A3 --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question A4 --max-tokens 128
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question B1 --max-tokens 256
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question B2 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question B3 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question C1 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question C2 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question C3 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question C4 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question D1 --max-tokens 512
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --question D2 --max-tokens 512
