# Agent Skill: Formatting & Serialization Enforcement

## Core Objective
Ensure all system outputs, logs, state payloads, and API contracts follow spec-compliant JSON and YAML structures.

## Standard Naming Contracts
- **Node Names**: Strictly use architectural target names:
  - `category_agent` (NOT `categorizer_agent`)
  - `parser_agent`
  - `extractor_agent`
  - `validator_agent`
  - `critic_agent`
  - `enricher_agent`
- **Status Identifiers**: Standardize enum identifiers:
  - `FAILED_PARSING`
  - `UNCLASSIFIED_HUMAN_REVIEW`
  - `REVIEW_REQUIRED`
  - `PUBLISHED`

## Unit & Serialization Rules
- Format all numeric values with standard precision.
- Affine temperature conversions (Celsius, Fahrenheit) must use offset calculations specified in `data/seed/canonical_units.json` rather than direct multiplicative factors.
- Ensure all serialized JSON outputs adhere to `data/schemas/target_schemas.yaml`.