from __future__ import annotations

import json
import sys
import traceback

from app.pipeline_simple import WorkerActionError
from controllers.responses import failure, stream_event
from app.runtime_lifecycle import RuntimeLifecycle
from typing import Any


def _write_response(resp: dict[str, Any]) -> None:
    # IMPORTANT: stdout must be JSON lines only
    sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
    sys.stdout.flush()
from controllers.handle_request import HandleRequest


def main() -> None:
    runtime_lifecycle = RuntimeLifecycle()

    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue

            request_id = "unknown-request"
            try:
                parsed = json.loads(line)
                if not isinstance(parsed, dict):
                    raise ValueError("Request must be a JSON object.")
                
                if isinstance(parsed.get("requestId"), str):
                    request_id = parsed["requestId"]

                def emit_stream_event(event_type: str, data: dict[str, Any]) -> None:
                    _write_response(stream_event(request_id, event_type, data))

                handle_request = HandleRequest(runtime_lifecycle, emit_stream_event=emit_stream_event)
                response = handle_request(parsed)
                _write_response(response)
            except WorkerActionError as exc:
                _write_response(
                    failure(
                        request_id,
                        exc.code,
                        str(exc),
                        exc.details,
                    )
                )
            except Exception as exc:
                _write_response(
                    failure(
                        request_id,
                        "PY_ACTION_FAILED",
                        str(exc),
                        {
                            "type": exc.__class__.__name__,
                            "traceback": traceback.format_exc(),
                        },
                    )
                )
    finally:
        runtime_lifecycle.shutdown()


if __name__ == "__main__":
    main()
