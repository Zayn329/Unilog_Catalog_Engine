# Meta-Tool: Automated Code Reviewer & Invariant Guard

## Purpose
Provides a checklist and automated review guidelines for code diffs before merging pull requests or committing code changes.

## Code Review Checklist

### 1. Evidence-First Invariants
- [ ] Does every extracted attribute carry an associated `Evidence` object with verifiable bounding box coordinates or a rule ID?
- [ ] Are there any ungrounded LLM generations or placeholder mock values bypassing the validation layer?

### 2. State & Node Naming Contracts
- [ ] Are all LangGraph nodes named strictly per architectural specs (`category_agent`, `parser_agent`, `extractor_agent`, `validator_agent`, `critic_agent`, `enricher_agent`)?
- [ ] Are status enums matching exact specifications (`FAILED_PARSING`, `UNCLASSIFIED_HUMAN_REVIEW`, `REVIEW_REQUIRED`, `PUBLISHED`)?

### 3. Gate 8 Security & Immutability
- [ ] Does any code attempt to mutate an attribute where `is_human_locked == true` without verifying the SHA-256 `locked_state_hash`?
- [ ] Is canonical string hashing utilizing scalar primitives (`canonical_key|raw_value|numeric_value|unit|evidence_id`) to prevent JSON spacing/key-ordering discrepancies?

### 4. Code Quality & Scope
- [ ] Are all numeric calculations involving temperature using affine transformation rules rather than simple multipliers?
- [ ] Is the code free of temporary hacks, debug print statements, and trial-and-error patching?