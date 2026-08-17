from pydantic import BaseModel, ConfigDict

from app.models.domain import NormalizationMethodEnum, ProductAttribute
from app.security.gate8 import verify_locked_attribute_mutation
from app.tools.pint_normalizer import (
    normalize_scalar,
    normalize_temperature,
)


class NormalizerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attributes: list[ProductAttribute]


class NormalizerOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attributes: list[ProductAttribute]


def normalize_attributes(state: NormalizerInput) -> NormalizerOutput:
    if not isinstance(state, NormalizerInput):
        raise TypeError("normalize_attributes requires NormalizerInput")
    normalized: list[ProductAttribute] = []
    for attribute in state.attributes:
        if attribute.is_human_locked:
            # A locked value is immutable, but a stale or tampered lock must not
            # be silently accepted merely because normalization skips it.
            verify_locked_attribute_mutation(attribute, attribute)
            normalized.append(attribute)
            continue
        updated = attribute
        if (
            attribute.numeric_value is not None
            and attribute.unit
        ):
            target_unit = _canonical_target(attribute.unit)
            if target_unit != attribute.unit:
                result = normalize_scalar(attribute.numeric_value, attribute.unit, target_unit)
                updated = attribute.model_copy(
                    update={
                        "numeric_value": result.value,
                        "unit": result.unit,
                        "normalized_value": f"{result.value} {result.unit}",
                        "normalization_method": NormalizationMethodEnum.PINT,
                    }
                )
        normalized.append(updated)
    return NormalizerOutput(attributes=normalized)


def _canonical_target(unit: str) -> str:
    targets = {
        "bar": "Pa",
        "psi": "Pa",
        "inch": "m",
        "in": "m",
        "mm": "m",
        "cm": "m",
        "degc": "K",
        "c": "K",
        "degf": "K",
        "f": "K",
    }
    return targets.get(unit.strip().casefold(), unit)
