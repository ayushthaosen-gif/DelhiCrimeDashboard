from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .http import allowed
from .models import Candidate, SourceConfig

ANNUAL = [
    r"jan(?:uary)?\s*2025.*dec(?:ember)?\s*2025",
    r"01\s*jan\s*2025.*31\s*dec\s*2025",
    r"annual",
]
TARGETS = [
    r"road crash report\s*2025",
    r"crime in india\s*2025",
    r"police station wise accident",
    r"preferred vends?",
    r"iRAD",
    r"eDAR",
]
MONTHS = (
    "january february march april may june july august september october november december".split()
)


def score_candidate(title: str, url: str, year: int, dataset: str) -> tuple[int, list[str]]:
    text = f"{title} {url}".lower()
    score = 0
    reasons = []
    if str(year) in text:
        score += 30
        reasons.append("requested year")
    if any(re.search(p, text, re.I) for p in TARGETS):
        score += 30
        reasons.append("dataset title pattern")
    if any(re.search(p, text, re.I) for p in ANNUAL):
        score += 25
        reasons.append("annual coverage")
    month_hits = sum(m in text for m in MONTHS)
    if month_hits:
        score += min(12, month_hits * 2)
        reasons.append("monthly coverage")
    if url.lower().split("?")[0].endswith((".pdf", ".csv", ".xlsx", ".json", ".geojson")):
        score += 10
        reasons.append("downloadable document")
    if dataset == "liquor_vends" and "current" in text:
        score -= 5
        reasons.append("date may be unclear")
    return score, reasons


def discover_html(
    source: SourceConfig, html: str, landing_url: str | None = None
) -> list[Candidate]:
    base = landing_url or str(source.page_url)
    soup = BeautifulSoup(html, "lxml")
    candidates = []
    for link in soup.select("a[href]"):
        url = urljoin(base, link.get("href", ""))
        title = " ".join(link.stripped_strings) or url
        if not allowed(url, source.allowed_domains):
            continue
        score, reasons = score_candidate(title, url, source.year, source.dataset)
        if score > 0:
            candidates.append(
                Candidate(
                    source_id=source.source_id, title=title, url=url, score=score, reasons=reasons
                )
            )
    has_exact_candidate = any(
        "dataset title pattern" in c.reasons and "requested year" in c.reasons for c in candidates
    )
    if source.mode.value != "monitor" and not has_exact_candidate:
        candidates.append(
            Candidate(
                source_id=source.source_id,
                title=f"Configured official landing page: {source.dataset}",
                url=base,
                score=50,
                reasons=["configured official landing page snapshot"],
                selected=True,
            )
        )
    candidates.sort(key=lambda c: (-c.score, str(c.url)))
    eligible = [
        c
        for c in candidates
        if "dataset title pattern" in c.reasons and "requested year" in c.reasons
    ]
    if eligible:
        for candidate in candidates:
            candidate.selected = False
        best_annual = next((c for c in eligible if "annual coverage" in c.reasons), eligible[0])
        best_annual.selected = True
    return candidates


def discover_source(source: SourceConfig, client) -> list[Candidate]:
    if source.endpoint and not source.page_url:
        return []
    response = client.get(str(source.page_url), source.allowed_domains)
    return discover_html(source, response.text)
