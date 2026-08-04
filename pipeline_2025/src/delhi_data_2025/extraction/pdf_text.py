from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader


def extract_pdf_text(path: Path, minimum_chars: int = 100) -> tuple[str, str]:
    text = "\n".join((page.extract_text() or "") for page in PdfReader(path).pages)
    return text, "extracted" if len(text.strip()) >= minimum_chars else "needs_manual_review"
