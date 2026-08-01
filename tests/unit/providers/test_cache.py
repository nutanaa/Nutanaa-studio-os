from runtime.providers import ProviderCache


def test_cache_put_get_and_expiry() -> None:
    cache = ProviderCache()
    cache.put("alpha", {"value": 1}, ttl_seconds=0.1)
    assert cache.get("alpha") == {"value": 1}
    cache.delete("alpha")
    assert cache.get("alpha") is None
