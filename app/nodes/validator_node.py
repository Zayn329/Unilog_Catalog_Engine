import json
import re
from pathlib import Path
from uuid import uuid4

from app.models.domain import ProductAttribute, ValidationReport


RULES_PATH = Path(__file__).parents[2] / "data" / "rules" / "physics_constraints.json"


def validate_attributes(
    attributes: list[ProductAttribute], category_id: str
) -> list[ValidationReport]:
    rules = json.loads(RULES_PATH.read_text(encoding="utf-8"))["rules"]
    values = {attribute.canonical_key: attribute.numeric_value for attribute in attributes}
    text_values = {attribute.canonical_key: attribute.raw_value for attribute in attributes}
    reports: list[ValidationReport] = []

    material = text_values.get("material", "")
    temperature = values.get("max_operating_temp")
    if re.search(r"pvc", material, re.IGNORECASE) and temperature is not None and temperature > 60.0:
        reports.append(
            _report(
                attributes,
                "PVC_MAX_OPERATING_TEMP",
                False,
                "CRITICAL",
                "PVC maximum operating temperature exceeds 60 degC.",
            )
        )

    for rule in rules:
        targets = set(rule["target_attributes"])
        present = targets & set(values)
        if rule["rule_id"] == "PHYS_BOUND_001":
            for key in present:
                passed = values[key] is not None and values[key] > 0
                reports.append(_report(attributes, rule["rule_id"], passed, rule["severity"], rule["error_message"], key))
        elif rule["rule_id"] == "PHYS_DIM_002" and {"length", "width"} <= set(values):
            length, width = values["length"], values["width"]
            passed = length is not None and width is not None and length > 0 and width > 0 and max(length / width, width / length) <= 50.0
            reports.append(_report(attributes, rule["rule_id"], passed, rule["severity"], rule["error_message"]))
        elif rule["rule_id"] == "PHYS_TEMP_004" and {"min_operating_temp", "max_operating_temp"} <= set(values):
            passed = values["max_operating_temp"] > values["min_operating_temp"]
            reports.append(_report(attributes, rule["rule_id"], passed, rule["severity"], rule["error_message"]))
        elif rule["rule_id"] == "PHYS_ELEC_005" and {"voltage", "current", "resistance"} <= set(values):
            voltage, current, resistance = values["voltage"], values["current"], values["resistance"]
            passed = abs(voltage - (current * resistance)) / voltage <= 0.05
            reports.append(_report(attributes, rule["rule_id"], passed, rule["severity"], rule["error_message"]))
    return reports


def _report(
    attributes: list[ProductAttribute],
    rule_name: str,
    passed: bool,
    severity: str,
    error_message: str,
    attribute_key: str | None = None,
) -> ValidationReport:
    attribute_id = next(
        (attribute.attribute_id for attribute in attributes if attribute.canonical_key == attribute_key),
        attributes[0].attribute_id,
    )
    return ValidationReport(
        report_id=uuid4(),
        attribute_id=attribute_id,
        passed=passed,
        rule_name=rule_name,
        severity=severity,
        error_message="" if passed else error_message,
    )

