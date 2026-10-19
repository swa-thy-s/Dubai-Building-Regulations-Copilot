import io
import urllib.error

import pytest

from ingest import embed


def http_error(code: int, body: bytes):
    return urllib.error.HTTPError("http://x", code, "err", {}, io.BytesIO(body))


def test_daily_quota_stops_immediately_without_retrying(monkeypatch):
    calls = []

    def fake_urlopen(req, timeout=0):
        calls.append(1)
        raise http_error(429, b'{"error":{"details":[{"violations":[{"quotaId":"EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier"}]}]}}')

    monkeypatch.setattr(embed.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(embed.time, "sleep", lambda s: pytest.fail("must not sleep on a daily quota"))
    with pytest.raises(embed.QuotaExhausted):
        embed._call("m", ["a"], "RETRIEVAL_DOCUMENT", "key")
    assert len(calls) == 1


def test_per_minute_429_is_retried(monkeypatch):
    seq = [http_error(429, b'{"error":{"message":"slow down"}}')]

    class Ok:
        def __enter__(self):
            return io.BytesIO(b'{"embeddings":[{"values":[0.1,0.2]}]}')

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=0):
        if seq:
            raise seq.pop()
        return Ok()

    monkeypatch.setattr(embed.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(embed.time, "sleep", lambda s: None)
    assert embed._call("m", ["a"], "RETRIEVAL_DOCUMENT", "key") == [[0.1, 0.2]]


def test_record_sources_plan_merges_without_dropping_existing_dates():
    from ingest import record_sources as R

    sources = [
        {"slug": "a", "source_url": "https://x/a", "verified_on": "2026-10-19"},
        {"slug": "b"},
        {"slug": "c", "source_url": "https://x/c"},
    ]
    urls, ver = R.plan(sources, {"old": "2026-01-01", "a": "2025-01-01"})
    assert urls == {"a": "https://x/a", "c": "https://x/c"}
    assert ver == {"old": "2026-01-01", "a": "2026-10-19"}
