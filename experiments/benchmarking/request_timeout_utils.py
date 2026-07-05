DEFAULT_REQUEST_TIMEOUT = 120
BENCHMARK_REQUEST_TIMEOUT = (10, 360)


def format_timeout_failure(benchmark_type, essay_id, paragraph_num, request_timeout, exc):
    read_timeout = (
        request_timeout[1]
        if isinstance(request_timeout, tuple) and len(request_timeout) >= 2
        else request_timeout
    )
    paragraph_value = paragraph_num if paragraph_num != "" else "-"
    message = (
        f"TIMEOUT benchmark={benchmark_type} essay_id={essay_id} "
        f"paragraph_num={paragraph_value} read_timeout={read_timeout} error={exc}"
    )
    print(message)
    return message
