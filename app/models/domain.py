from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class EvidenceTypeEnum(StrEnum):
    SOURCE = "SOURCE"
    RULE = "RULE"
    DERIVED = "DERIVED"


class JobStatusEnum(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED_PARSING = "FAILED_PARSING"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ProductStatusEnum(StrEnum):
    RAW = "RAW"
    VALIDATED = "VALIDATED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    UNCLASSIFIED_HUMAN_REVIEW = "UNCLASSIFIED_HUMAN_REVIEW"
    MANUAL_ENTRY = "MANUAL_ENTRY"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class CriticActionEnum(StrEnum):
    ACCEPT = "ACCEPT"
    RE_EXTRACT = "RE_EXTRACT"
    RE_NORMALIZE = "RE_NORMALIZE"
    ESCALATE_HUMAN = "ESCALATE_HUMAN"


class ValidationSeverityEnum(StrEnum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"


class NormalizationMethodEnum(StrEnum):
    PINT = "PINT"
    REGEX = "REGEX"
    DICTIONARY = "DICTIONARY"
    LLM_FALLBACK = "LLM_FALLBACK"
    DERIVED_RULE = "DERIVED_RULE"
    MANUAL_ENTRY = "MANUAL_ENTRY"


class BoundingBox(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_number: Annotated[int, Field(ge=1)]
    top_pct: Annotated[float, Field(ge=0.0, le=100.0)]
    left_pct: Annotated[float, Field(ge=0.0, le=100.0)]
    width_pct: Annotated[float, Field(ge=0.0, le=100.0)]
    height_pct: Annotated[float, Field(ge=0.0, le=100.0)]


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_id: UUID
    evidence_type: EvidenceTypeEnum
    source_text: str | None = None
    page_number: Annotated[int, Field(ge=1)] | None = None
    bounding_box: BoundingBox | None = None
    rule_id: str | None = None
    parent_attribute_ids: list[UUID] | None = None
    confidence_score: Annotated[float, Field(ge=0.0, le=1.0)]
    is_verified: bool = False

    @model_validator(mode="after")
    def validate_lineage(self) -> "Evidence":
        if self.evidence_type is EvidenceTypeEnum.SOURCE:
            if not self.source_text or self.page_number is None or self.bounding_box is None:
                raise ValueError(
                    "SOURCE evidence requires source_text, page_number, and bounding_box"
                )
        elif self.evidence_type is EvidenceTypeEnum.RULE:
            if not self.rule_id:
                raise ValueError("RULE evidence requires rule_id")
        elif self.evidence_type is EvidenceTypeEnum.DERIVED:
            if not self.rule_id or not self.parent_attribute_ids:
                raise ValueError(
                    "DERIVED evidence requires rule_id and parent_attribute_ids"
                )
        return self


class ProcessingJob(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    status: JobStatusEnum
    file_path: str
    total_pages: int | None = Field(default=None, ge=0)
    skus_found: int | None = Field(default=None, ge=0)
    created_at: datetime
    completed_at: datetime | None = None
    error_code: str | None = None
    error_message: str | None = None


class ProductAttribute(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
    )

    attribute_id: UUID
    canonical_key: str = Field(min_length=1)
    raw_key: str = Field(min_length=1)
    raw_value: str
    normalized_value: str | None = None
    numeric_value: float | None = None
    unit: str | None = None
    attribute_confidence: Annotated[float, Field(ge=0.0, le=1.0)] = 1.0
    normalization_method: NormalizationMethodEnum
    is_derived: bool = False
    is_human_locked: bool = Field(
        default=False,
        validation_alias=AliasChoices("is_human_locked", "is_locked"),
        serialization_alias="is_human_locked",
    )
    locked_state_hash: str | None = Field(
        default=None,
        validation_alias=AliasChoices("locked_state_hash", "locked_hash"),
        serialization_alias="locked_state_hash",
    )
    requires_human_review: bool = False
    evidence: Evidence
    evidence_id: UUID | None = None

    @model_validator(mode="after")
    def validate_evidence_reference(self) -> "ProductAttribute":
        if self.evidence_id is None:
            self.evidence_id = self.evidence.evidence_id
        elif self.evidence_id != self.evidence.evidence_id:
            raise ValueError("evidence_id must match the nested evidence object")
        return self

    @property
    def is_locked(self) -> bool:
        return self.is_human_locked


class ValidationReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id: UUID
    attribute_id: UUID
    passed: bool
    rule_name: str = Field(min_length=1)
    severity: ValidationSeverityEnum
    error_message: str
    created_at: datetime | None = None


class CriticDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision_id: UUID
    action: CriticActionEnum
    target_attributes: list[UUID] = Field(default_factory=list)
    rationale: str = Field(min_length=1)
    retry_count: int = Field(default=0, ge=0)
    created_at: datetime | None = None


class Product(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    sku: str = Field(min_length=1)
    category_id: str = Field(min_length=1)
    status: ProductStatusEnum
    attributes: list[ProductAttribute]
    composite_confidence: Annotated[float, Field(ge=0.0, le=1.0)] = 0.0
    category_confidence: Annotated[float, Field(ge=0.0, le=1.0)] | None = None

