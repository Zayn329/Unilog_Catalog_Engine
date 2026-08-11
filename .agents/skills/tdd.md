# Agent Skill: Evaluation-Driven Development (EDD) & TDD Execution

## Core Objective
Enforce Evaluation-Driven Development (EDD) across all graph node implementations. All code must satisfy the architectural contract defined in `04_evaluation.yaml` and pass the BDD feature scenarios.

## Execution Rules
1. **Red-Green-Refactor Loop**: Write or bind tests against `specs/bdd/` prior to implementing node router logic.
2. **Gate Validation Order**:
   - Gate 1: Check document `parse_status == 'SUCCESS'`.
   - Gate 2: Ensure 100% of attributes possess non-null `evidence` (`SOURCE`, `RULE`, or `DERIVED`).
   - Gate 3: Verify derived attributes have valid `rule_id` and zero failing validation reports.
   - Gate 5: Ensure `is_verified == true` for published extractions.
   - Gate 8: Verify locked hash equality before permitting state updates.
3. **Boundary Value Testing**: Ensure threshold boundaries are tested strictly (e.g., confidence `0.60` vs `0.59`).
4. **State Transition Integrity**: Every state transformation must match the transitions in `state_transition_matrix`.