from app.core import throughput


def test_no_estimate_without_samples():
    throughput._durations_seconds.clear()
    assert throughput.estimate_wait_seconds(1) is None


def test_estimate_after_samples():
    throughput._durations_seconds.clear()
    throughput.record_job_duration(10)
    throughput.record_job_duration(20)
    # moyenne = 15s ; avec 2 slots (défaut settings), position 2 -> ceil(2/2)*15 = 15
    estimate = throughput.estimate_wait_seconds(2)
    assert estimate == 15


def test_zero_position_returns_none():
    throughput._durations_seconds.clear()
    throughput.record_job_duration(10)
    assert throughput.estimate_wait_seconds(0) is None
