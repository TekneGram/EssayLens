from __future__ import annotations

import atexit
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from app.settings import AppConfig


@dataclass
class RuntimeLifecycle:
    """
    Process-lifecycle safety helper.

    Register long-lived process wrappers once so they are stopped on interpreter
    exit as a fallback. Normal stage code should still use try/finally stop().
    """

    _registered_ids: set[int] = field(default_factory=set)
    _cached_runtime_key: tuple[Any, ...] | None = None
    _cached_runtime: dict[str, Any] | None = None

    def register_process(self, proc: Any) -> None:
        if proc is None:
            return

        key = id(proc)
        if key in self._registered_ids:
            return

        def _shutdown() -> None:
            self._safe_stop(proc)

        atexit.register(_shutdown)
        self._registered_ids.add(key)

    def get_or_create_llm_runtime(
        self,
        app_cfg: "AppConfig",
        builder: Callable[["AppConfig"], dict[str, Any]],
    ) -> dict[str, Any]:
        runtime_key = app_cfg.runtime_identity()
        if self._cached_runtime is not None and self._cached_runtime_key == runtime_key:
            return self._cached_runtime

        self._teardown_cached_runtime()
        runtime = builder(app_cfg)
        self.register_process(runtime.get("server_proc"))
        self._cached_runtime_key = runtime_key
        self._cached_runtime = runtime
        return runtime

    def shutdown(self) -> None:
        self._teardown_cached_runtime()

    def get_status(self) -> dict[str, Any]:
        server_running = False
        runtime_key = self._cached_runtime_key
        if self._cached_runtime is not None:
            proc = self._cached_runtime.get("server_proc")
            is_running = getattr(proc, "is_running", None)
            if callable(is_running):
                try:
                    server_running = bool(is_running())
                except Exception:
                    server_running = False
        return {
            "hasRuntime": self._cached_runtime is not None,
            "runtimeKey": list(runtime_key) if runtime_key is not None else None,
            "serverRunning": server_running,
        }

    def _teardown_cached_runtime(self) -> None:
        if self._cached_runtime is None:
            self._cached_runtime_key = None
            return
        self._safe_stop(self._cached_runtime.get("server_proc"))
        self._cached_runtime = None
        self._cached_runtime_key = None

    @staticmethod
    def _safe_stop(proc: Any) -> None:
        stop: Callable[[], None] | None = getattr(proc, "stop", None)
        is_running: Callable[[], bool] | None = getattr(proc, "is_running", None)
        if not callable(stop):
            return
        try:
            if callable(is_running) and not is_running():
                return
            stop()
        except Exception:
            # Exit handlers must not crash shutdown flow.
            return
