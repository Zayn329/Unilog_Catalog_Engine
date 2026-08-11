# Meta-Tool: TDD Test Generator

## Purpose
Automates the scaffolding of isolated Pytest (backend) and Vitest (frontend) test suites from BDD feature files and architectural evaluation contracts (`04_evaluation.yaml`).

## Usage Guide
When developing a new graph node or feature, follow this generation protocol:

1. **Select BDD Scenario**: Reference the relevant scenario in `specs/bdd/`.
2. **Scaffold Test File**: Create a corresponding test file under `tests/unit/` or `tests/integration/`.
3. **Enforce Red-Green-Refactor**:
   - Write test assertions covering boundary conditions (e.g., confidence score `0.60` vs `0.59`).
   - Run pytest to verify the test **fails** (Red).
   - Implement the minimum code required in the LangGraph node (Green).
   - Refactor for cleanliness while keeping tests passing.

## Example Pytest Stub Pattern (`tests/unit/test_validator_agent.py`)
```python
import pytest
from app.agents.validator import validate_attribute
from app.models.domain import NormalizedAttribute, ValidationReport

def test_physics_temperature_violation():
    # Arrange: PVC material with extreme temperature
    attr = NormalizedAttribute(
        canonical_key="max_temperature",
        numeric_value=300.0,
        unit="degC",
        evidence_id="ev_test_01"
    )
    material_attr = NormalizedAttribute(
        canonical_key="body_material",
        numeric_value="PVC",
        unit="",
        evidence_id="ev_test_02"
    )
    
    # Act
    report = validate_attribute(attr, context_attributes=[material_attr])
    
    # Assert
    assert report.passed is False
    assert report.severity == "CRITICAL"
    assert "temperature limit exceeded" in report.error_message.lower()