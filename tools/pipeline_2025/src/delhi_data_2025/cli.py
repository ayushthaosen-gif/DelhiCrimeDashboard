from __future__ import annotations

import json
import logging

import typer

from . import pipeline

app = typer.Typer(no_args_is_help=True)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def emit(value) -> None:
    typer.echo(json.dumps(value, ensure_ascii=True, default=str))


@app.command()
def discover(year: int = 2025, source: str | None = None, offline: bool = False):
    emit(pipeline.discover(year, source, offline))


@app.command()
def download(year: int = 2025, source: str | None = None, offline: bool = False):
    emit(pipeline.download(year, source, offline))


@app.command()
def extract(year: int = 2025, source: str | None = None, offline: bool = False):
    emit(pipeline.extract(year, source, offline))


@app.command()
def normalize(year: int = 2025, source: str | None = None, offline: bool = False):
    emit(pipeline.normalize(year, source, offline))


@app.command()
def validate(year: int = 2025, strict: bool = False):
    result = pipeline.validate(year, strict)
    typer.echo(result)
    if strict and not result["valid"]:
        raise typer.Exit(1)


@app.command()
def report(year: int = 2025):
    emit(pipeline.report(year))


@app.command()
def collect(year: int = 2025, source: str | None = None, offline: bool = False):
    emit(pipeline.collect(year, source, offline))


@app.command("prepare-dashboard-patch")
def prepare_dashboard_patch(year: int = 2025):
    emit(pipeline.prepare_dashboard_patch(year))
