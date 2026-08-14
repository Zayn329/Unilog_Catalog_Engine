"""Gate 8 enforcement for human-locked attributes."""

from app.models.domain import ProductAttribute
from app.security.hasher import compute_locked_state_hash


class LockedAttributeMutationError(PermissionError):
    """Raised when a proposed mutation changes a human-locked value."""


def verify_locked_attribute_mutation(
    locked_attribute: ProductAttribute,
    proposed_attribute: ProductAttribute,
) -> None:
    """Reject a proposed state whose hash differs from the recorded lock."""
    if not locked_attribute.is_human_locked:
        return

    expected_hash = locked_attribute.locked_state_hash
    if not expected_hash:
        raise LockedAttributeMutationError(
            f"Human-locked attribute {locked_attribute.attribute_id} has no hash"
        )

    if compute_locked_state_hash(proposed_attribute) != expected_hash:
        raise LockedAttributeMutationError(
            f"Gate 8 rejected mutation of locked attribute {locked_attribute.attribute_id}"
        )

