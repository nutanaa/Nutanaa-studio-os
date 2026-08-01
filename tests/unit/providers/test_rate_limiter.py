from runtime.providers import ProviderRateLimiter


def test_rate_limiter_tokens() -> None:
    limiter = ProviderRateLimiter(capacity=2, refill_rate=1000)
    assert limiter.try_acquire()
    assert limiter.try_acquire()
