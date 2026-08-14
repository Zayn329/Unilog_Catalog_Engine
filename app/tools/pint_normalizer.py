import json
from pathlib import Path
from typing import Any

import pint
from pydantic import BaseModel, ConfigDict


CANONICAL_UNITS_PATH = Path(__file__).parents[2] / "data" / "seed" / "canonical_units.json"


class NormalizedValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: float
    unit: str


def _load_unit_definitions() -> dict[str, Any]:
    return json.loads(CANONICAL_UNITS_PATH.read_text(encoding="utf-8"))


def _unit_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for category in _load_unit_definitions()["unit_categories"].values():
        for canonical, definition in category["units"].items():
            for symbol in definition["symbols"]:
                aliases[symbol.casefold()] = canonical
    return aliases


def _pint_unit(unit: str) -> str:
    canonical = _unit_aliases().get(unit.strip().casefold(), unit.strip())
    return {
        "in": "inch",
        "C": "degC",
        "F": "degF",
        "K": "kelvin",
    }.get(canonical, canonical)


def normalize_scalar(value: float, from_unit: str, to_unit: str) -> NormalizedValue:
    registry = pint.UnitRegistry(autoconvert_offset_to_baseunit=False)
    converted = (value * registry(_pint_unit(from_unit))).to(_pint_unit(to_unit))
    return NormalizedValue(value=float(converted.magnitude), unit=to_unit)


def normalize_temperature(value: float, from_unit: str, to_unit: str) -> NormalizedValue:
    registry = pint.UnitRegistry()
    converted = registry.Quantity(value, _pint_unit(from_unit)).to(_pint_unit(to_unit))
    return NormalizedValue(value=float(converted.magnitude), unit=to_unit)
