_cancelled_job_ids: set[int] = set()


def request_cancel(job_id: int) -> None:
    _cancelled_job_ids.add(job_id)


def is_cancelled(job_id: int) -> bool:
    return job_id in _cancelled_job_ids


def clear(job_id: int) -> None:
    _cancelled_job_ids.discard(job_id)
