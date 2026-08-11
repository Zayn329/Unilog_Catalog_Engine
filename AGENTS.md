# Project Context & AI Agent Directives: Unilog Catalog Engine

## 1. Tech Stack & Layer Boundaries
Respect strict separation of concerns across layers. Never mix responsibilities:
* **Next.js (App Router, Tailwind, shadcn/ui):** UI rendering, side-by-side review workbench, and bounding-box display.
* **FastAPI (Python managed via `uv`):** API contracts, request validation, and asynchronous orchestration endpoints.
* **LangGraph / LangChain:** Multi-agent graph orchestration and execution state flow.
* **Deterministic Python:** Unit conversions (`Pint`), regex normalization, and physics/rule validation scripts.
* **Qdrant:** Vector embeddings and similarity retrieval (never use as the structured source of truth).

## 2. Core Behavioral Rules
* **Concise Execution Planning:** Before writing code, provide a brief execution outline: concise implementation plan, core assumptions, affected files, important tradeoffs, and success criteria. Avoid verbose chain-of-thought.
* **Halt on Ambiguity:** If requirements are unclear or critical context is missing, stop and ask the user for clarification. Never silently guess implementation details.
* **Goal-Driven Execution:** Break complex tasks into clear, sequential steps. Verify changes using tests before finalizing.

## 3. Evidence-First System Invariants
This is the core domain rule of the project. Enforce these invariants in all backend and agent code:
* **Mandatory Provenance:** Every extracted attribute must carry an evidence object containing source text span + page number + percentage-based bounding box coordinates, or a deterministic rule ID.
* **No Orphan Data:** Fabricated industrial specifications or ungrounded generative guesses are strictly forbidden.
* **Transparent States:** Raw, normalized, derived, enriched, and rejected values must remain clearly distinguishable in the graph state.
* **Enforced Enrichment & Validation:** Enrichment must cite its underlying rule/evidence. Validation failures must never be hidden or repaired silently.

## 4. Hard Code Guardrails & "Never-Dos"
* **Surgical Edits Only:** Write only the minimum amount of code necessary. Restrict modifications to exact lines required.
* **Controlled Scope Approvals:** Keep changes scoped to the task. Request explicit human approval *only* for architectural changes, new dependencies, database/schema changes, or public API modifications.
* **No Temporary Hacks:** Never implement placeholders, fake data mocks, stub functions, or UI band-aids under the guise of a bug fix.
* **Mandatory Root Cause Analysis (RCA):** Before fixing a bug, explicitly isolate, trace, and document the root cause. Trial-and-error patching is forbidden.

## 5. Testing & Evaluation Rules
* **TDD Enforcement:** Before implementing a new feature or fixing a bug, generate isolated failing tests (Pytest for backend, Vitest for frontend).
* **Deterministic Guardrails:** Use Pydantic v2 validation models at all node boundaries. Never bypass schema verification.

## 6. Agent Skills Router
When a trigger condition occurs, load the relevant skill, follow its instructions precisely, and do not invent missing behavior:

### Frontend & UI Skills
* **`frontend-design`** *(Trigger: Building/styling Next.js, Tailwind, or shadcn components with high-end enterprise layouts).*
* **`visual-critique-reviewer`** *(Trigger: UI/UX review before finalizing canvas or workbench components).*

### Backend & Data Skills
* **`json-to-pydantic`** *(Trigger: Converting JSON payloads into strict Pydantic v2 models using few-shot example folders).*
* **`database-operations`** *(Trigger: Qdrant vector queries, schema adjustments, or batch data pipelines).*

### Security & Quality Skills
* **`stride-threat-modeling`** *(Trigger: Planning major features or file-upload pipeline changes).*
* **`tdd-test-generator`** *(Trigger: Generating failing Pytest/Vitest tests prior to feature implementation).*
* **`automated-code-reviewer`** *(Trigger: Reviewing code diffs for bugs, secrets, or maintainability issues).*

### Workflow Skills
* **`git-commit-formatter`** *(Trigger: Formatting commit messages per Conventional Commits standards).*