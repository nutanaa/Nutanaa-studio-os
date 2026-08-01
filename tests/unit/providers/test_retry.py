import asyncio

from runtime.providers import RetryPolicy


def test_retry_policy_eventual_success() -> None:
    attempts = {"count": 0}

    async def work() -> str:
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise TimeoutError("transient")
        return "ok"

    result = asyncio.run(RetryPolicy(attempts=3, initial_delay=0.0).execute(work))
    assert result == "ok"
    assert attempts["count"] == 3
