# Agent Skill: Security & Gate 8 Human-Lock Protection

## Core Objective
Guarantee data immutability for human-verified fields, protect against agent over-writing, and sanitize input boundaries.

## Immutability Protocol (Gate 8)
1. **Canonical Hashing Formula**:
   Compute SHA-256 over string formatted as:
   `{canonical_key}|{raw_value}|{normalized_value}|{numeric_value}|{unit}|{evidence_id}`
2. **Lock Evaluation**:
   Before an agent applies a mutation to an attribute where `is_human_locked == true`:
   - Compute `recomputed_hash` over proposed state or existing locked state.
   - Compare `recomputed_hash` against `locked_state_hash`.
   - If `recomputed_hash != locked_state_hash`: **FAIL GATE 8 IMMEDIATELY**.
3. **Hard Blocking Behavior**:
   - Reject agent mutation attempt.
   - Preserve human-locked value in graph state.
   - Log security boundary violation event.

## Input & Boundary Security
- Validate raw inputs against target schemas in `data/schemas/target_schemas.yaml`.
- Isolate human draft states in PostgreSQL storage; prevent unvalidated draft states from reaching publication services.