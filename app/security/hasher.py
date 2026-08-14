"""Canonical hashing for Gate 8 human-lock protection."""

from hashlib import sha256

from app.models.domain import ProductAttribute


def canonical_hash_input(attribute: ProductAttribute) -> str:
    """Return the stable scalar representation used by the human-lock hash."""
    return "|".join(
        (
            attribute.canonical_key,
            attribute.raw_value,
            str(attribute.numeric_value),
            str(attribute.unit),
            str(attribute.evidence_id),
        )
    )


def compute_locked_state_hash(attribute: ProductAttribute) -> str:
    """Compute the SHA-256 digest for a product attribute's locked state."""
    return sha256(canonical_hash_input(attribute).encode("utf-8")).hexdigest()

