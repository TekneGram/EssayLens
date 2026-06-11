from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path

from topic_sentences_benchmarks import identify_topic_sentence, select_best_topic_sentence, write_topic_sentence, judge_topic_sentence
from vocabulary_benchmarks import enhance_specified_word, identify_words_to_improve, suggest_multiple_word_improvements
from coherence_benchmarks import identify_signposts, recommend_signposts, detect_transition, recommend_transition, detect_summary_noun, recommend_summary_noun
from supporting_claims import supporting_claims, weak_support

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
        writing_dir = repo_root / "benchmarking/questions/B2"
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