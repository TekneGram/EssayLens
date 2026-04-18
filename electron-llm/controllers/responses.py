from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def failure(request_id: str, code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {
        "requestId": request_id,
        "ok": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "timestamp": now_iso(),
    }


def success(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "requestId": request_id,
        "ok": True,
        "data": data,
        "timestamp": now_iso(),
    }


def stream_event(
    request_id: str,
    event_type: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    return {
        "requestId": request_id,
        "type": event_type,
        "data": data,
        "timestamp": now_iso(),
    }
