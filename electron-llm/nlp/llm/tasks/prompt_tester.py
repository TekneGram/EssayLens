from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any, Generator, Sequence

from nlp.llm.llm_types import ChatRequest, ChatStreamEvent

if TYPE_CHECKING:
    from services.llm_service import LlmService
    from app.settings import AppConfig


# --- RUBRIC DESCRIPTORS ONLY ----
SYSTEM_PROMPT_NICE_WITH_QWEN_8B = (
    "Write a detailed evaluation of the learner's paragraph.\n"
    "Refer to the following rubric. If a student did something well, say explicitly what they did. If a student needs to improve, say explicitly what is weak about the writing.\n"
    "Organization: Clear topic sentence, well developed points in the body support the topic sentence, clear conclusion sentence.\n"
    "Coherence: Ideas flow naturally and the organization is logical and easy for the reader.\n"
    "Language: Language is accurate, with natural expressions that are appropriate for the topic.\n"
    "Content: Content is original and engaging for the reader; ideas feel like the students' own ideas.\n"
)

# --- ONE CATEGORY RUBRIC WITH SCORING / DETAILED ---
SYSTEM_PROMPT_NICE_WITH_QWEN_8B = (
    "Write a detailed evaluation of the learner's paragraph. Use examples from the writing to support your evaluation.\n"
    "Refer to the following rubric.\n"
    "Coherence: 5 points: The student uses advanced techniques to connect ideas in the paragraph.\n"
    "Coherence: 4 points: The student uses general techniques to connect ideas in the paragraph.\n"
    "Coherence: 3 points: The student uses some basic techniques to connect ideas but there could be improvements.\n"
    "Coherence: 2 points: The student rarely demonstrates coherence. Improvements are necessary.\n"
    "Coherence: 1 point: There is little coherence between the sentences. The student needs to learn the basics of coherence.\n"
)

# --- ONE CATEGORY RUBRIC WITH SCORING / BRIEF ---
SYSTEM_PROMPT_REASONABLE_WITH_QWEN_8B = (
    "Write a brief evaluation of the learner's paragraph. Use one or two examples from the writing to support your evaluation.\n"
    "Refer to the following rubric.\n"
    "Coherence: 5 points: The student uses advanced techniques to connect ideas in the paragraph.\n"
    "Coherence: 4 points: The student uses general techniques to connect ideas in the paragraph.\n"
    "Coherence: 3 points: The student uses some basic techniques to connect ideas but there could be improvements.\n"
    "Coherence: 2 points: The student rarely demonstrates coherence. Improvements are necessary.\n"
    "Coherence: 1 point: There is little coherence between the sentences. The student needs to learn the basics of coherence.\n"
)

# --- ONE CATEGORY RUBRIC WITH SCORING / BRIEF ---
SYSTEM_PROMPT_NICE_WITH_QWEN_8B = (
    "Write a brief evaluation of the learner's paragraph. Use one or two examples from the writing to support your evaluation.\n"
    "Refer to the following rubric.\n"
    "Content: 5 points: The ideas are original and thoroughly explored and evaluated\n"
    "Content: 4 points: The ideas are original and explored in some depth.\n"
    "Content: 3 points: The ideas are interesting for the reader but there is not much exploration or evaluation.\n"
    "Content: 2 points: The ideas are stated, but they lack insight and there is no exploration or evaluation.\n"
    "Content: 1 point: There is nothing original in the student's writing. It is quite boring to read and shows no insight, no depth and no evaluation.\n"
)

# --- CAN-DO STATEMENTS / BRIEF ---
SYSTEM_PROMPT_REASONABLE_WITH_QWEN_8B = (
    "Write a brief evaluation of the learners achievement on the criteria below.\n"
    "For each criteria, decide whether the learner 'can do well', 'still learning', 'cannot do'"
    "For each decision, explain with an example from the text."
    "Topic sentence: The learner can write an effective topic sentence that introduces the issues discussed in the writing.\n"
    "Supporting details: The learner can provide explanations and reasons that develop and support the topic sentence.\n"
    "Analytical insight: The learner can explore and evaluate each point in detail.\n"
    "Language: The learner uses compare / contrast language like 'However', 'In contrast', 'more than ~ ', '~er', '~est' and others to develop the discussion accurately and coherently.\n"
)

SYSTEM_PROMPT = (
    "You are a nice teacher!"
)


def _build_chat_request(text: str, app_cfg: "AppConfig") -> ChatRequest:
    _, _, llm_request = app_cfg.require_real_config()
    return ChatRequest(
        system=SYSTEM_PROMPT,
        user=text,
        max_tokens=llm_request.max_tokens,
        temperature=llm_request.temperature,
        top_p=llm_request.top_p,
        top_k=llm_request.top_k,
        repeat_penalty=llm_request.repeat_penalty,
        seed=llm_request.seed,
        stop=llm_request.stop,
        response_format=llm_request.response_format,
    )


def build_prompt_tester(text_tasks: Sequence[str], app_cfg: "AppConfig") -> list[ChatRequest]:
    return [
        _build_chat_request(text, app_cfg)
        for text in text_tasks
    ]


def build_stream_tester(text: str, app_cfg: "AppConfig") -> ChatRequest:
    return _build_chat_request(text, app_cfg)


async def run_parallel_prompt_tester(
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    text_tasks: Sequence[str],
    max_concurrency: int | None = None,
) -> dict[str, Any]:
    requests_ = build_prompt_tester(text_tasks, app_cfg)
    concurrency = max_concurrency or app_cfg.llm_server.llm_n_parallel

    started = time.perf_counter()
    outputs = await llm_service.chat_many(
        requests_,
        max_concurrency=concurrency,
    )
    elapsed_s = time.perf_counter() - started

    success_count = len([res for res in outputs if not isinstance(res, Exception)])
    failure_count = len([res for res in outputs if isinstance(res, Exception)])

    return {
        "mode": "parallel_chat",
        "task_count": len(requests_),
        "success_count": success_count,
        "failure_count": failure_count,
        "max_concurrency": concurrency,
        "elapsed_s": elapsed_s,
        "outputs": outputs,  # list[dict[str, Any] | Exception]
    }


def run_stream_prompt_tester(
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    text: str,
) -> Generator[ChatStreamEvent, None, str]:
    request = build_stream_tester(text, app_cfg)
    events: list[ChatStreamEvent] = []

    for event in llm_service.chat_stream(
        system=request.system,
        user=request.user,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
        repeat_penalty=request.repeat_penalty,
        seed=request.seed,
        stop=request.stop,
        response_format=request.response_format,
    ):
        events.append(event)
        yield event

    response = llm_service.client.aggregate_stream_events(events)
    reply = response.content.strip() if isinstance(response.content, str) else ""
    if not reply:
        raise RuntimeError("LLM request failed: stream did not return textual content.")
    return reply
