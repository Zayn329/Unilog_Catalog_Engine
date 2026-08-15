"""SQLModel / SQLAlchemy database models for Unilog Catalog Engine."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel


class ProcessingJob(SQLModel, table=True):
    """Tracks document and catalog extraction jobs."""

    __tablename__ = "processingjob"

    job_id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    status: str = Field(default="PENDING", index=True)
    file_path: str = Field(default="")
    total_pages: Optional[int] = Field(default=None)
    skus_found: Optional[int] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    completed_at: Optional[datetime] = Field(default=None)
    error_code: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    graph_state_json: Optional[str] = Field(default=None)

    products: List["ProductRecord"] = Relationship(back_populates="job")
    audit_logs: List["AuditLog"] = Relationship(back_populates="job")


class ProductRecord(SQLModel, table=True):
    """Database representation of an extracted catalog product."""

    __tablename__ = "productrecord"

    product_id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    job_id: UUID = Field(foreign_key="processingjob.job_id", index=True)
    sku: str = Field(default="UNKNOWN", index=True)
    category_id: str = Field(default="UNCLASSIFIED", index=True)
    status: str = Field(default="RAW", index=True)
    composite_confidence: float = Field(default=0.0)
    category_confidence: Optional[float] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    job: Optional[ProcessingJob] = Relationship(back_populates="products")
    attributes: List["AttributeRecord"] = Relationship(back_populates="product")


class AttributeRecord(SQLModel, table=True):
    """Database representation of a single product attribute with evidence."""

    __tablename__ = "attributerecord"

    attribute_id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    product_id: UUID = Field(foreign_key="productrecord.product_id", index=True)
    canonical_key: str = Field(index=True)
    raw_key: str = Field(default="")
    raw_value: str = Field(default="")
    normalized_value: Optional[str] = Field(default=None)
    numeric_value: Optional[float] = Field(default=None)
    unit: Optional[str] = Field(default=None)
    attribute_confidence: float = Field(default=1.0)
    normalization_method: str = Field(default="REGEX")
    is_derived: bool = Field(default=False)
    is_human_locked: bool = Field(default=False)
    locked_state_hash: Optional[str] = Field(default=None)
    requires_human_review: bool = Field(default=False)

    # Evidence details
    evidence_id: UUID = Field(default_factory=uuid4)
    evidence_type: str = Field(default="SOURCE")
    source_text: Optional[str] = Field(default=None)
    page_number: Optional[int] = Field(default=None)
    bounding_box_json: Optional[str] = Field(default=None)
    rule_id: Optional[str] = Field(default=None)
    parent_attribute_ids_json: Optional[str] = Field(default=None)
    evidence_confidence: float = Field(default=1.0)
    evidence_is_verified: bool = Field(default=False)

    product: Optional[ProductRecord] = Relationship(back_populates="attributes")


class AuditLog(SQLModel, table=True):
    """Immutable audit trail for human interventions and review actions."""

    __tablename__ = "auditlog"

    audit_id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    job_id: Optional[UUID] = Field(
        default=None, foreign_key="processingjob.job_id", index=True
    )
    user_id: str = Field(default="human_reviewer")
    attribute_id: Optional[UUID] = Field(default=None, index=True)
    action: str = Field(default="ACCEPT_AND_SUBMIT")
    previous_value: Optional[str] = Field(default=None)
    new_value: Optional[str] = Field(default=None)
    reason_code: str = Field(default="")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    details_json: Optional[str] = Field(default=None)

    job: Optional[ProcessingJob] = Relationship(back_populates="audit_logs")
