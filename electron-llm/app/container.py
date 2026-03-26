# Import services and processes
from nlp.llm.llm_server_process import LlmServerProcess
from nlp.llm.llm_client import OpenAICompatChatClient
from services.llm_service import LlmService
from services.llm_task_service import LlmTaskService

from pathlib import Path
from app.settings import AppConfig

def build_container(app_cfg: AppConfig):
    """
    Dependency container builder
    Responsibility:
    - Takes a fully loaded config object
    - Constructs all the shared services exactly once
    - Wires dependencies together
    - Returns a dictionay of ready-to-use services
    """

    llm_config, llm_server, llm_request = app_cfg.require_real_config()

    # ----- LLM Wiring (server model) -----
    if llm_server.llm_backend != "server":
        raise ValueError(f"Unsupported backend: {llm_server.llm_backend}")

    server_proc = LlmServerProcess(
        server_cfg=llm_server,
        llm_cfg=llm_config,
    )

    client = OpenAICompatChatClient(
        server_url=llm_server.llm_server_url,
        model_name="",
        model_family="",
        request_cfg=llm_request
    )

    llm_service = LlmService(
        client=client,
        max_parallel=4
    )
    llm_task_service = LlmTaskService(llm_service=llm_service)
    project_root = Path(__file__).resolve().parents[1]

    return {
        "project_root": project_root,
        "server_bin": llm_server.llm_server_path,
        "server_proc": server_proc,
        "llm_client": client,
        "llm_service": llm_service,
        "llm_task_service": llm_task_service
    }
