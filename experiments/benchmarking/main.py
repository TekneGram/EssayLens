from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path
import re

import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
EXPERIMENTS_DIR = CURRENT_DIR.parent
REPO_ROOT = CURRENT_DIR.parent.parent
VALIDATORS_DIR = CURRENT_DIR / "validators"

sys.path.insert(0, str(CURRENT_DIR))
sys.path.insert(0, str(EXPERIMENTS_DIR))
sys.path.insert(0, str(VALIDATORS_DIR))

from run_benchmarks import run_identify_essay_benchmark
from run_benchmarks import run_identify_citations_benchmark, run_check_citations_no_references_benchmark, run_check_references_no_citations_benchmark
from run_benchmarks import run_determine_thesis_statement_benchmark, run_thesis_statement_characteristics_benchmark, run_thesis_statement_advice_benchmark, run_thesis_statement_comment_benchmark, run_thesis_statement_heap_praise_benchmark
from run_benchmarks import run_analyze_gen_spec_benchmark, run_provide_introduction_feedback_benchmark
from run_benchmarks import run_analyze_conclusions_benchmark, run_provide_conclusion_feedback_benchmark
from run_benchmarks import run_analyze_topic_sentence_coherence_benchmark, run_analyze_linguistic_coherence_benchmark, run_analyze_pronouns_benchmark
from run_benchmarks import run_encourage_development_benchmark, run_anything_unclear_benchmark
from run_benchmarks import run_enhance_vocabulary_benchmark
from vocabulary_helpers import run_vocabulary_analysis

import requests

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

def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
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
    parser.add_argument("--model", required=True, help="Name of model: bonsai, gemma", choices=["bonsai", "gemma"])
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)
    parser.add_argument("--cache-k", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--cache-v", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max_tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)
    parser.add_argument("--csv_file_append", required=True, help="Add a csv file identifier for the benchmark, usually the name of the language model being used")
    args = parser.parse_args()

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
    print(cmd)


    # Start the server
    print("Starting server:\n", " ".join(cmd))
    proc = subprocess.Popen(cmd)
    base_url = f"http://127.0.0.1:{args.port}"

    try:
        wait_for_server(base_url)
        # Look through essays and run benchmarks on each essay
        folder = Path("experiments/generated_essays")

        for md_file in folder.rglob("*.md"):
            filename = md_file.name

            match = re.search(r"essay_(\d+)_", filename)

            if match:
                essay_id = match.group(1)
            else:
                raise ValueError(f"Could not extract essay ID from filename: {filename}")
            try:
                essay = md_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                essay = md_file.read_text(encoding="utf-8", errors="replace")
            
            # ----- STEP 1: IDENTIFY THE PARAGRAPHS -----
            # First, get the essay as individual paragraphs
            full_essay, introduction, conclusion, full_essay_with_references, body_paragraphs, has_references = run_identify_essay_benchmark(essay, essay_id, base_url, args.max_tokens, args.temp, args.csv_file_append)
            # If there is any failure, continue with the next essay since a lack of essay is impossible to work with!
            if full_essay is None:
                continue
            
            # ----- STEP 2: RUN CITATIONS BENCHMARKS -----
            # run citations benchmark
            citations_data = run_identify_citations_benchmark(
                essay=full_essay_with_references,
                essay_id=essay_id,
                base_url=base_url,
                max_tokens=args.max_tokens,
                temp=args.temp,
                csv_file_append=args.csv_file_append
            )
            # Move on to the next file if everything failed
            if citations_data is None:
                print("It seems the check citations benchmark failed")
            else:
                if citations_data["has_citations"] == "yes" and has_references == "yes":
                    print("Citations and references included - but do they match?")
                    # check citation no reference
                    ref_check = run_check_references_no_citations_benchmark(full_essay_with_references, essay_id, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    if ref_check is None:
                        print("It seems the check references with no citations benchmark failed.")
                    else:
                        print(json.dumps(ref_check))
                    # AND check reference no citation
                    cit_check = run_check_citations_no_references_benchmark(full_essay_with_references, essay_id, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    if cit_check is None:
                        print('it seems the check citations with no references benchmark failed.')
                    else:
                        print(json.dumps(cit_check))

                if citations_data["has_citation"] == "yes" and has_references == "no":
                    cit_check = run_check_citations_no_references_benchmark(full_essay_with_references, essay_id, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    if cit_check is None:
                        print('it seems the check citations with no references benchmark failed.')
                    else:
                        print(json.dumps(cit_check))
                
                if citations_data["has_citation"] == "no" and has_references == "yes":
                    ref_check = run_check_references_no_citations_benchmark(full_essay_with_references, essay_id, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    if ref_check is None:
                        print("It seems the check references with no citations benchmark failed.")
                    else:
                        print(json.dumps(ref_check))

                if citations_data["has_citations"] == "no" and has_references == "no":
                    # Add a function here to handle this case. The function should examine the text
                    # and recommend to the writer a claim or idea that can benefit from being supported by a citation or reference
                    print("Create a function to encourage the writer to add cited and referenced support to a claim.")

            # ----- STEP 3: RUN THESIS BENCHMARKS -----
            
            # Extract the thesis statement
            thesis_statement_extracted_data = run_determine_thesis_statement_benchmark(full_essay, essay_id, introduction, base_url, args.max_tokens, args.temp, args.csv_file_append)
            
            if thesis_statement_extracted_data is None:
                print("It seems thesis statement extraction failed.")
            else:
                thesis_statement = thesis_statement_extracted_data["thesis_statement"]
                has_thesis_statement = thesis_statement_extracted_data["has_thesis_statement"]
                
                if has_thesis_statement == "yes":
                    ts_characteristics = run_thesis_statement_characteristics_benchmark(full_essay, essay_id, thesis_statement, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    
                    if ts_characteristics is None:
                        print("It seems getting the characteristics failed")
                    else:
                        no_characteristics_count = 0
                        missing_features = []
                        if ts_characteristics["main_idea"] == "no":
                            no_characteristics_count = no_characteristics_count + 1
                            missing_features.append("have a main idea")
                        if ts_characteristics["clear_goal"] == "no":
                            no_characteristics_count = no_characteristics_count + 1
                            missing_features.append("have a clear goal")
                        if ts_characteristics["preview_topics"] == "no":
                            no_characteristics_count = no_characteristics_count + 1
                            missing_features.append("preview topics")
                        if ts_characteristics["writer_opinion"] == "no":
                            no_characteristics_count = no_characteristics_count + 1
                            missing_features.append("have the writer's opinion")
                        
                        if no_characteristics_count >= 3:
                            ts_advice = run_thesis_statement_advice_benchmark(full_essay, essay_id, thesis_statement, no_characteristics_count, base_url, args.max_tokens, args.temp, args.csv_append_file)
                            if ts_advice is None:
                                print("It seems getting advice on the thesis statement failed.")
                            else:
                                print(ts_advice)

                        if no_characteristics_count == 2:
                            what_is_missing = "The writer's thesis statement appears to not "
                            if len(missing_features) == 1:
                                what_is_missing = what_is_missing + missing_features[0]
                            else:
                                what_is_missing = what_is_missing + ", ".join(missing_features[:-1]) + " or " + missing_features[-1]

                            ts_comment = run_thesis_statement_comment_benchmark(full_essay, essay_id, thesis_statement, what_is_missing, base_url, args.max_tokens, args.temp, args.csv_file_append)
                            if ts_comment is None:
                                print("It seems the ts_comment failed")
                            else:
                                print(ts_comment)
                            
                        if no_characteristics_count == 1 or no_characteristics_count == 0:
                            ts_praise = run_thesis_statement_heap_praise_benchmark(full_essay, essay_id, thesis_statement, base_url, args.max_tokens, args.temp, args.csv_file_append)
                            if ts_praise is None:
                                print("It seems ts_praise failed.")
                            else:
                                print(ts_praise)
                else:
                    # This is the case when there is no clear thesis statement
                    ts_advice = run_thesis_statement_advice_benchmark(full_essay, essay_id, "Actually, it was determined that there is no clear thesis statement in this essay", 4, base_url, args.max_tokens, args.temp, args.csv_append_file)
                    if ts_advice is None:
                        print("It seems getting advice on the thesis statement, when there is no thesi statement, failed.")
                    else:
                        print(ts_advice)


            # ----- STEP 4: RUN INTRODUCTIONS BENCHMARKS -----
            gen_spec = run_analyze_gen_spec_benchmark(full_essay, essay_id, introduction, base_url, args.max_tokens, args.temp, args.csv_file_append)
            if gen_spec is None:
                print("It seems running the analysis on general to specific formation of the introduction failed.")
            else:
                print(gen_spec)
                introduction_feedback = run_provide_introduction_feedback_benchmark(full_essay, essay_id, introduction, json.dumps(gen_spec), base_url, args.max_tokens, args.temp, args.csv_file_append)
                if introduction_feedback is None:
                    print("It seems getting the feedback on the introduction failed.")
                else:
                    print(introduction_feedback)

            

            # ----- STEP 5: RUN CONCLUSION BENCHMARKS -----
            conclusion_evaluation = run_analyze_conclusions_benchmark(full_essay, essay,id, conclusion, base_url, args.max_tokens, args.temp, args.csv_file_append)
            if conclusion_evaluation is None:
                print("It seems the analysis of the conclusion failed.")
            else:
                print(conclusion_evaluation)
                conclusion_feedback = run_provide_conclusion_feedback_benchmark(full_essay, essay_id, conclusion, json.dumps(conclusion_evaluation), base_url, args.max_tokens, args.temp, args.csv_file_append)
                if conclusion_feedback is None:
                    print("It seems getting feedback for the conclusion paragraph failed.")
                else:
                    print(conclusion_feedback)

            # ----- STEP 6: RUN COHERENCE BENCHMARKS -----
            for para_num, bp in enumerate(body_paragraphs, start=1):
                ts_coherence_analysis = run_analyze_topic_sentence_coherence_benchmark(bp["body_paragraph"], essay_id, para_num, base_url, args.max_tokens, args.temp, args.csv_file_append)
                if ts_coherence_analysis is None:
                    print(f"It seems getting the topic sentence coherence from body paragraph {para_num} failed.")
                else:
                    print(ts_coherence_analysis)

            for para_num, bp in enumerate(body_paragraphs, start=1):
                linguistic_coherence = run_analyze_linguistic_coherence_benchmark(bp["body_paragraph"], essay_id, para_num, base_url, args.max_tokens, args.temp, args.csv_file_append)
                if linguistic_coherence is None:
                    print(f"It seems getting the linguistic coherence in body paragraph {para_num} failed.")
                else:
                    print(linguistic_coherence)

            for para_num, bp in enumerate(body_paragraphs, start=1):
                pronouns_analysis = run_analyze_pronouns_benchmark(bp["body_paragraph"], essay_id, para_num, base_url, args.max_tokens, args.temp, args.csv_file_append)
                if pronouns_analysis is None:
                    print(f"It seems analysis of pronouns in body paragraph {para_num} failed.")
                else:
                    print(pronouns_analysis)


            # ----- STEP 7: RUN PARAGRAPHS BENCHMARKS -----
            for bp, para_num in enumerate(body_paragraphs, start=1):
                words = bp["body_paragraph"].split(" ")
                word_count = len(words)
                if word_count < 100:
                    paragraph_feedback = run_encourage_development_benchmark(full_essay, essay_id, bp["body_paragraph"], para_num, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    if paragraph_feedback is None:
                        print(f"It seems that to encourage development in body paragraph {para_num}, this llm process failed")
                    else:
                        print(paragraph_feedback)
                else:
                    clarity_feedback = run_anything_unclear_benchmark(full_essay, essay_id, bp["body_paragraph"], para_num, base_url, args.max_tokens, args.temp, args.csv_file_append)
                    if clarity_feedback is None:
                        print(f"It seems that getting feedback on clarity for body paragraph {para_num} failed.")
                    else:
                        print(clarity_feedback)

            # ----- STEP 8: RUN VOCABULARY BENCHMARKS -----
            vocabulary_analysis = run_vocabulary_analysis(full_essay)
            top_15_high_ll_top_1000_freq_3 = [
                row
                for row in vocabulary_analysis["word_log_likelihood_scores"]
                if row["band"] == "top_1000"
                and row["student_frequency"] >= 3
                and row["signed_log_likelihood"] > 0
            ][:15]

        print("Top 15 high-LL top-1000 lexical words with frequency >= 3")
        print("----------------------------------------------------------")
        i = 0
        word_list = "Look for the following words in the essay: "
        for row in top_15_high_ll_top_1000_freq_3:
            if i == 2:
                word_list = word_list + row['word'] + "."
                enhancements = run_enhance_vocabulary_benchmark(full_essay, essay_id, word_list, base_url, args.max_tokens, args.temp, args.csv_file_append)
                i = 0
                word_list = "Look for the following words in the essay: "
                print(enhancements)
            else:
                word_list = word_list + row['word'] + ", "
                i += 1
            
            print(
                f"{row['word']}\t"
                f"freq={row['student_frequency']}\t"
                f"student_pct={row['student_relative_frequency_pct']:.3f}\t"
                f"ref_pct={row['reference_relative_frequency_pct']:.3f}\t"
                f"signed_LL={row['signed_log_likelihood']:.2f}"
            )


            # ----- STEP 9: RUN GRAMMAR BENCHMARKS -----




    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()

# To run a quick experiment
# With Ternary Bonsai:
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --max_tokens 2048 --csv_file_append="gemma_e4b"

# With Gemma 4
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --max_tokens 2048 --csv_file_append="bonsai-8b"
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/benchmarking/main.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3