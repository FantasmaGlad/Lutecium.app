from app.core.ratelimit import check_rate_limit


def test_allows_up_to_limit():
    key = "test-ip-1"
    for _ in range(5):
        assert check_rate_limit(key, max_per_window=5) is True


def test_rejects_beyond_limit():
    key = "test-ip-2"
    for _ in range(5):
        check_rate_limit(key, max_per_window=5)
    assert check_rate_limit(key, max_per_window=5) is False


def test_different_keys_are_independent():
    assert check_rate_limit("a", max_per_window=1) is True
    assert check_rate_limit("b", max_per_window=1) is True
