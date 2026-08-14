"""Bounded critic handling for failed validation reports."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import ValidationReport


MAX_RETRIES = 3


class CriticInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    validation_reports: list[ValidationReport]
    retry_count: int = Field(default=0, ge=0)


class CriticOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    retry_count: int = Field(ge=0)
    route: str
    correction_prompt: str | None = None


def process_critic(payload: CriticInput) -> CriticOutput:
    failed_reports = [report for report in payload.validation_reports if not report.passed]
    if not failed_reports:
        return CriticOutput(retry_count=payload.retry_count, route="validator_agent")

    next_retry = payload.retry_count + 1
    if payload.retry_count >= MAX_RETRIES:
        return CriticOutput(retry_count=next_retry, route="REVIEW_REQUIRED")

    rules = ", ".join(report.rule_name for report in failed_reports)
    return CriticOutput(
        retry_count=next_retry,
        route="extractor_agent",
        correction_prompt=f"Re-extract attributes failing validation rules: {rules}",
    )

