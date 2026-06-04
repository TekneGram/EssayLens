from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path
from topic_sentences import topic_sentence_identifier, topic_sentence_controlling_idea, topic_sentence_judgement
from coherence import determine_coherence_level, recommend_coherence_improvement, praise_coherence
from supporting_sentences import find_supporting_sentences, find_supporting_sentences_more, judge_fact, judge_definition, judge_example, judge_description
from inline_comments import inline_praise, inline_changes

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

def get_prompts(system_prompt_knowledge_path: str, system_prompt_task_path: str, user_prompt_path: str) -> tuple[str, str]:
    repo_root = Path(__file__).resolve().parents[1]
    system_prompt_task_path = repo_root / system_prompt_task_path
    system_prompt_knowledge_path = repo_root / system_prompt_knowledge_path
    user_prompt_path = repo_root / user_prompt_path

    system_prompt_knowledge = system_prompt_knowledge_path.read_text(encoding="utf-8")
    system_prompt_task = system_prompt_task_path.read_text(encoding="utf-8")
    system_prompt = system_prompt_knowledge + "\n" + system_prompt_task
    user_content = user_prompt_path.read_text(encoding="utf-8")

    return (system_prompt, user_content)

def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    if model == "gemma":
        return repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"
    if model == "bonsai":
        return repo_root / "third_party_prismml" / "llama-cpp" / "build" / "bin" / "llama-server"
    
def select_jinja(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    if model =="gemma":
        return repo_root / "assets" / "models" / "gemma_4_chat_template.jinja"

def multiple_decision_maker(base_url, system_prompt, user_prompt):
    tools = [
        {
            "type": "function",
            "function": {
                "name": "route_paragraph_actions",
                "description": "Select all applicable improvement actions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "actions": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "improve_paragraph_topic_sentence",
                                    "improve_paragraph_with_examples",
                                    "improve_paragraph_unity",
                                    "add_definition",
                                    "add_explanation",
                                    "combine_short_sentences",
                                    "improve_coherence"
                                ]
                            }
                        },
                        "reason": { "type": "string" }
                    },
                    "required": ["actions", "reason"],
                    "additionalProperties": False
                }
            }
        }
    ]
    payload = {
            "model": "local-gguf",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 512,
            "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": False},
            "tools": tools,
            "tool_choice": "auto"
    }

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    print(json.dumps(data, indent=2))
    choice = data["choices"][0]["message"]
    tool_calls = choice.get("tool_calls", [])
    if not tool_calls:
        raise RuntimeError("Model did not return a function call.")
    
    call = tool_calls[0]
    fn_name= call["function"]["name"]
    fn_args = json.loads(call["function"]["arguments"])

    print("Chosen function:", fn_name)
    print("Arguments:", json.dumps(fn_args, indent=2))

def decision_maker(base_url, system_prompt, user_prompt):

    tools = [
        {
            "type": "function",
            "function": {
                "name": "improve_paragraph_with_examples",
                "description": "Revise paragraph by refocusing an example as the controlling idea.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": { "type": "string" }
                    },
                    "required": ["reason"],
                    "additionalProperties": False
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "improve_paragraph_topic_sentence",
                "description": "Revise paragraph by strengthening the controlling idea in the topic sentence.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": { "type": "string" }
                    },
                    "required": ["reason"],
                    "additionalProperties": False
                },
            },
        }
    ]

    payload = {
            "model": "local-gguf",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 512,
            "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": False},
            "tools": tools,
            "tool_choice": "auto"
    }

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    print(json.dumps(data, indent=2))
    choice = data["choices"][0]["message"]
    tool_calls = choice.get("tool_calls", [])
    if not tool_calls:
        raise RuntimeError("Model did not return a function call.")
    
    call = tool_calls[0]
    fn_name= call["function"]["name"]
    fn_args = json.loads(call["function"]["arguments"])

    print("Chosen function:", fn_name)
    print("Arguments:", json.dumps(fn_args, indent=2))




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

    # Get system prompt and user prompt
    # prompts = get_prompts("experiments/system_prompts_v2/paragraph_knowledge.md", "experiments/system_prompts/topic_sentence_1.md", "experiments/writing_examples/w4.md")
    # system_prompt = prompts[0]
    # user_prompt = prompts[1]

    # Make the decision based on decision_maker.md
    # Call one of the functions improve_paragraph_with_examples OR improve_paragraph_topic_sentence

    # Run basic inference

    # Plan for running inference with decision makers
    # decision_maker returns one decision so extract it and call that function.
    # multiple_decision_maker returns multiple decisions so extract them and loop through and call each function.
    try:
        wait_for_server(base_url)
        writing_path = "experiments/writing_examples/w4.md"
        feedback_data = {
            "writing": writing_path,
            "topic_sentence": {
                "sentence": "",
                "controlling_idea": "",
                "verdict": "",
                "reason": "",
                "revision_suggestion": ""
            },
            "coherence": {
                "verdict": "",
                "reason": "",
            },
            "supporting_sentences": {
                "facts": {
                    "facts": "",
                    "verdict": "",
                    "reason": ""
                },
                "definitions": {
                    "definitions": "",
                    "verdict": "",
                    "reason": ""
                },
                "examples": {
                    "examples": "",
                    "verdict": "",
                    "reason": ""
                },
                "descriptions": {
                    "descriptions": "",
                    "verdict": "",
                    "reason": ""
                }
            },
            "summary_feedback": ""
        }

        # praise = inline_praise("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/phrase_praise.md", base_url, args.max_tokens, args.temp)
        # print(json.dumps(praise, indent=2))

        # changes = inline_changes("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/phrase_change.md", base_url, args.max_tokens, args.temp)
        # print(json.dumps(changes, indent=2))
        
        # Topic sentence analysis
        data = topic_sentence_identifier(args.model, "experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/topic_sentence_1.md", base_url, args.max_tokens, args.temp)
        print(json.dumps(data, indent=2))
        topic_sentence = data["choices"][0]["message"]["content"]
        feedback_data["topic_sentence"]["sentence"] = topic_sentence

        data_2 = topic_sentence_controlling_idea(args.model, "experiments/system_prompts_v2/paragraph_knowledge.md", topic_sentence, "experiments/system_prompts_v2/topic_sentence_2.md", base_url, args.max_tokens, args.temp)
        print(json.dumps(data_2, indent=2))
        controlling_idea = data_2["choices"][0]["message"]["content"]
        feedback_data["topic_sentence"]["controlling_idea"] = controlling_idea

        data_3 = topic_sentence_judgement(args.model, "experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/topic_sentence_3.md", topic_sentence, controlling_idea, base_url, args.max_tokens, args.temp)
        print(json.dumps(data_3, indent=2))
        ts_judgement = data_3["choices"][0]["message"]["content"]
        ts_judgement_content = json.loads(ts_judgement)
        feedback_data["topic_sentence"]["verdict"] = ts_judgement_content["verdict"]
        feedback_data["topic_sentence"]["reason"] = ts_judgement_content["reason"]
        feedback_data["topic_sentence"]["revision_suggestion"] = ts_judgement_content["revision_suggestion"]

        print(feedback_data)


        # # Coherence analysis
        # data_4 = determine_coherence_level("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/coherence_1.md", base_url, args.max_tokens, args.temp)
        # print(json.dumps(data_4, indent=2))
        # content = data_4["choices"][0]["message"]["content"]
        # obj = json.loads(content)
        # feedback_data["coherence"]["verdict"] = obj["verdict"]
        # feedback_data["coherence"]["reason"] = obj["reason"]

        # print(feedback_data)

        # # Verify that verdict is either yes or no. If neither, then skip and emit this as an error.
        # if (verdict == "no"):
        #     data_5 = recommend_coherence_improvement("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/coherence_2.md", base_url, args.max_tokens, args.temp)
        #     print(json.dumps(data_5, indent=2))
        # else:
        #     data_6 = praise_coherence("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/coherence_3.md", base_url, args.max_tokens, args.temp)
        #     print(json.dumps(data_6, indent=2))

        # Supporting sentences analysis
        # data_6 = find_supporting_sentences("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/supporting_sentences_1.md", base_url, args.max_tokens, args.temp)
        # print(json.dumps(data_6, indent=2))
        # content = data_6["choices"][0]["message"]["content"]
        # obj = json.loads(content)
        # facts = obj["facts"]
        # if facts:
        #     data_7 = judge_fact("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/supporting_sentences_3.md", facts, base_url, args.max_tokens, args.temp)
        #     print(json.dumps(data_7, indent=2))
        
        # definitions = obj["definitions"]
        # if definitions:
        #     data_8 = judge_definition("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/supporting_sentences_4.md", definitions, base_url, args.max_tokens, args.temp)
        #     print(json.dumps(data_8, indent=2))

        # data_9 = find_supporting_sentences_more("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/supporting_sentences_2.md", base_url, args.max_tokens, args.temp)
        # print(json.dumps(data_9, indent=2))
        # content = data_9["choices"][0]["message"]["content"]
        # obj = json.loads(content)
        # examples = obj["examples"]
        # descriptions = obj["descriptions"]

        # if examples:
        #     data_10 = judge_example("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/supporting_sentences_5.md", examples, base_url, args.max_tokens, args.temp)
        #     print(json.dumps(data_10, indent=2))

        # if descriptions:
        #     data_11 = judge_description("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/supporting_sentences_6.md", descriptions, base_url, args.max_tokens, args.temp)
        #     print(json.dumps(data_11, indent=2))

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
# python experiments/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16"

# With Gemma 4
# python experiments/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/main.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3