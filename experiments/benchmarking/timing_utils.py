import logging
import time

from codecarbon import EmissionsTracker

logging.getLogger("codecarbon").setLevel(logging.ERROR)


def call_with_timer_ms(func, *args, **kwargs):
    tracker = None
    emissions_kg = None
    start = time.perf_counter()

    try:
        tracker = EmissionsTracker(
            save_to_file=False,
            save_to_api=False,
            save_to_logger=False,
            save_to_prometheus=False,
            save_to_logfire=False,
            log_level="error",
            tracking_mode="process",
            allow_multiple_runs=True,
        )
        tracker.start()
    except Exception:
        tracker = None

    try:
        result = func(*args, **kwargs)
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000)
        if tracker is not None:
            try:
                emissions_kg = tracker.stop()
            except Exception:
                emissions_kg = None
        exc.elapsed_ms = elapsed_ms
        exc.emissions_kg = emissions_kg
        raise

    elapsed_ms = round((time.perf_counter() - start) * 1000)
    if tracker is not None:
        try:
            emissions_kg = tracker.stop()
        except Exception:
            emissions_kg = None

    return result, elapsed_ms, emissions_kg
