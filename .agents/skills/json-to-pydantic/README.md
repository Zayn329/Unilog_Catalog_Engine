# Meta-Tool: JSON-to-Pydantic Model Generator

## Purpose
Ensures all node input/output boundaries and target schemas are strictly validated using Pydantic v2 models, preventing raw dictionary injection or schema drift.

## Core Rules
1. **Never use vanilla `dict`** for inter-agent message passing. All state payloads must be typed Pydantic models.
2. **Use Field Constraints**: Enforce strict validation bounds (e.g., `Field(ge=0.0, le=1.0)` for confidence scores, `Field(min_length=1)` for required strings).

## Pydantic v2 Blueprint Template (`app/schemas/domain_models.py`)
```python
from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class NormalizedValueModel(BaseModel):
    value: float
    unit: str

class EvidenceModel(BaseModel):
    evidence_id: str
    evidence_type: Literal["SOURCE", "RULE", "DERIVED"]
    source_text: Optional[str] = None
    page_number: Optional[int] = None
    bounding_box: Optional[List[float]] = Field(None, description="[page, top%, left%, width%, height%]ordinate array")
    rule_id: Optional[str] = None
    is_verified: bool = False

class ProductAttributeModel(BaseModel):
    attribute_id: str
    canonical_key: str
    name: str
    raw_value: str
    normalized_value: NormalizedValueModel
    numeric_value: float
    unit: str
    evidence_id: str
    evidence: EvidenceModel
    is_human_locked: bool = False
    locked_state_hash: Optional[str] = None