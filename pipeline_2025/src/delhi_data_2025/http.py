from __future__ import annotations

import hashlib
import json
import os
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

SENSITIVE = {"token", "key", "api_key", "access_token", "signature"}


def redact_url(url: str) -> str:
    parts = urlparse(url)
    query = [(k, "REDACTED" if k.lower() in SENSITIVE else v) for k, v in parse_qsl(parts.query)]
    return urlunparse(parts._replace(query=urlencode(query)))


def allowed(url: str, domains: list[str]) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == d.lower() or host.endswith("." + d.lower()) for d in domains)


def signature_ok(data: bytes, content_type: str | None, suffix: str) -> bool:
    ctype = (content_type or "").lower()
    suffix = suffix.lower()
    if suffix == ".pdf" or "pdf" in ctype:
        return data.startswith(b"%PDF-")
    if suffix in {".json", ".geojson"} or "json" in ctype:
        try:
            json.loads(data.decode("utf-8-sig"))
            return True
        except (ValueError, UnicodeDecodeError):
            return False
    if suffix == ".csv" or "csv" in ctype:
        return b"\x00" not in data and (b"," in data[:4096] or b"\t" in data[:4096])
    return bool(data)


class SafeHttpClient:
    def __init__(
        self,
        user_agent: str,
        timeout: float = 30,
        rate: float = 1,
        max_bytes: int = 52_428_800,
        transport=None,
    ):
        self.client = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=timeout,
            follow_redirects=True,
            transport=transport,
        )
        self.rate = rate
        self.max_bytes = max_bytes
        self.last_request = defaultdict(float)

    def close(self):
        self.client.close()

    def _limit(self, host: str):
        wait = 1 / self.rate - (time.monotonic() - self.last_request[host])
        if wait > 0:
            time.sleep(wait)
        self.last_request[host] = time.monotonic()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def get(self, url: str, domains: list[str]) -> httpx.Response:
        if not allowed(url, domains):
            raise ValueError(f"Host outside allowlist: {redact_url(url)}")
        self._limit(urlparse(url).hostname or "")
        response = self.client.get(url)
        response.raise_for_status()
        if len(response.content) > self.max_bytes:
            raise ValueError("Response exceeds maximum file size")
        return response

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def post_form(self, url: str, domains: list[str], data: dict) -> httpx.Response:
        if not allowed(url, domains):
            raise ValueError(f"Host outside allowlist: {redact_url(url)}")
        self._limit(urlparse(url).hostname or "")
        response = self.client.post(url, data=data)
        response.raise_for_status()
        if len(response.content) > self.max_bytes:
            raise ValueError("Response exceeds maximum file size")
        return response

    def download(
        self, url: str, domains: list[str], destination: Path
    ) -> tuple[httpx.Response, str, bool]:
        if not allowed(url, domains):
            raise ValueError(f"Host outside allowlist: {redact_url(url)}")
        self._limit(urlparse(url).hostname or "")
        temp = destination.with_suffix(destination.suffix + ".part")
        digest = hashlib.sha256()
        size = 0
        with self.client.stream("GET", url) as response:
            response.raise_for_status()
            temp.parent.mkdir(parents=True, exist_ok=True)
            with temp.open("wb") as handle:
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise ValueError("Download exceeds maximum file size")
                    digest.update(chunk)
                    handle.write(chunk)
        data = temp.read_bytes()
        if not signature_ok(data, response.headers.get("content-type"), destination.suffix):
            temp.unlink(missing_ok=True)
            raise ValueError("Downloaded content signature does not match")
        unchanged = (
            destination.exists()
            and hashlib.sha256(destination.read_bytes()).hexdigest() == digest.hexdigest()
        )
        if unchanged:
            temp.unlink()
        else:
            os.replace(temp, destination)
        return response, digest.hexdigest(), unchanged
