# Product Requirements Document (PRD): Unilog Catalog Engine

## 1. Executive Summary & Product Philosophy

### 1.1 Product Vision

The **Unilog Catalog Engine** is an **Evidence-First catalog intelligence platform** built for B2B industrial catalog processing. It replaces probabilistic generative guessing with a stateful **LangGraph multi-agent architecture** coupled with deterministic validation tools.

The system ingests messy, incomplete vendor documents—including PDFs, scanned datasheets, images, diagrams, spreadsheets, Word documents, and text-based product information—and transforms them into e-commerce-ready technical product catalogs where **every accepted and published value carries immutable proof of origin**.

The system is designed for industrial domains such as Plumbing, HVAC/HVACR, PVF, Electrical, and Industrial Supply, where incorrect technical specifications can result in equipment failure, safety risks, incorrect product selection, returns, and liability.

### 1.2 Core Philosophy: Evidence-First Intelligence

In industrial B2B e-commerce, a miscalculated specification such as an incorrect thread type, pressure rating, material, or operating temperature can have consequences beyond ordinary catalog-data errors.

The system therefore follows three foundational principles:

* **Zero Orphan Values:** No extracted, derived, or AI-generated value may be published without verifiable proof of origin.
* **Deterministic Priority:** Physical constraints, mathematical conversions, schema rules, and deterministic engineering rules take precedence over probabilistic LLM inference.
* **Auditability:** Every attribute maintains an immutable chain of custody from its original source evidence or explicit deterministic rule through validation, human review, and final publication.

If an attribute cannot be tied to a valid source citation or explicit deterministic rule, it is **rejected or routed for human review rather than guessed**.

---

## 2. Problem Statement

Industrial distributors and manufacturers maintain catalogs assembled from thousands of inconsistent vendor documents.

Common problems include:

* Attribute extraction is manual, slow, and error-prone.
* The same measurement can appear in multiple representations such as `1/2 in`, `0.5"`, `½"`, or `12.7 mm`.
* Terminology varies between vendors and product categories.
* LLM-based extraction can produce values without reliable evidence of origin.
* Existing extraction systems may fail to detect physically impossible combinations.
* Poor scans, diagrams, tables, and unusual layouts make extraction difficult.
* Reviewing and correcting catalog data at scale creates a major PIM bottleneck.
* Downstream PIM schemas may differ from the canonical representation produced by the intelligence system.

The result is slower catalog onboarding, inconsistent parametric search and filtering, increased manual review effort, and potential safety and liability risks caused by unverified technical data.

### 2.1 Product Opportunity

The Unilog Catalog Engine addresses this problem by combining:

1. Multimodal document understanding.
2. Structured technical attribute extraction.
3. Deterministic normalization.
4. Physics and domain-rule validation.
5. Controlled rule-backed enrichment.
6. Evidence and provenance tracking.
7. Confidence-based human escalation.
8. Scalable asynchronous processing.
9. Explainable functional cross-referencing.
10. Schema transformation into downstream PIM formats.

---

## 3. Goals & Non-Goals

### 3.1 Goals

The system must:

* Automate structured technical attribute extraction from realistic vendor documents.
* Guarantee that every published attribute is traceable to verifiable source evidence or an explicit deterministic rule.
* Normalize units and terminology into canonical representations.
* Detect physically implausible, contradictory, or unsafe attribute combinations before publication.
* Enrich only missing mandatory attributes using deterministic, evidence-backed rules.
* Reduce manual review through confidence-based routing while keeping humans in control of ambiguous or unsafe cases.
* Preserve complete provenance and agent decision history.
* Scale to full vendor catalogs through asynchronous processing.
* Provide explainable functional/competitor cross-referencing.
* Produce schema-conformant output for CX1 and other supported downstream schemas.
* Allow new product categories and verticals to be added primarily through taxonomy, schema, and constraint configuration rather than core pipeline rewrites.

### 3.2 Non-Goals — v1

The system will not:

* Provide fully autonomous publication with zero human review.
* Invent missing product attributes without a citable deterministic rule.
* Replace Unilog's existing PIM systems.
* Treat Qdrant as the authoritative catalog database.
* Guarantee sub-second processing for large catalog batches.
* Allow vendor document content to modify system instructions, agent policies, or tool permissions.
* Mutate backend Python domain models dynamically to accommodate external schemas.

---

## 4. Target Users & Personas

### 4.1 Catalog Manager

Owns product-data quality and catalog onboarding.

**Needs:**

* Faster vendor onboarding.
* Trustworthy technical specifications.
* Reduced manual review.
* Visibility into processing status and errors.

### 4.2 Data Steward / Reviewer

Reviews medium-confidence, low-confidence, or validation-failed records.

**Needs:**

* Clear source evidence.
* Side-by-side source and structured data.
* Confidence breakdown.
* Validation explanations.
* Fast accept/edit/reject workflows.
* Immutable audit history.

### 4.3 PIM / IT Administrator

Manages integration with downstream systems and schemas.

**Needs:**

* Stable canonical product representation.
* Schema-conformant output.
* API access.
* Reliable database persistence.
* Versioned schema adapters.
* Auditability and operational observability.

### 4.4 Sales / Merchandising

Uses cross-reference information to identify functional alternatives.

**Needs:**

* Explainable substitute recommendations.
* Numeric spec-parity scores.
* Explicit attribute differences.
* No unexplained black-box recommendations.

---

## 5. Technical Stack & System Boundaries

### 5.1 Layer Responsibilities

#### User Interface

**Next.js App Router, Tailwind CSS, shadcn/ui**

Responsible for:

* Review Workbench.
* Side-by-side source/specification view.
* PDF/image bounding-box visualization.
* Confidence breakdown.
* Validation warnings.
* Accept/edit/reject workflows.
* Audit history.
* Bulk processing progress.

#### API Service Layer

**FastAPI / Python managed via `uv`**

Responsible for:

* REST API contracts.
* File upload and streaming.
* Job creation and status.
* Background task dispatch.
* Review-workbench APIs.
* Publication APIs.
* Schema transformation endpoints.

#### Agent Orchestration

**LangGraph**

Responsible for:

* Stateful agent execution.
* Agent-to-agent state transitions.
* Tool dispatch.
* Conditional branching.
* Retry loops.
* Validation feedback.
* Human escalation.
* Publication gating.

#### Parsing & Extraction

* `Docling` for layout-aware document parsing.
* Vision LLMs as fallback for scanned or visually complex content.
* Structured outputs through Pydantic models.

#### Validation & Math

* `Pydantic v2` for schema validation.
* `Pint` for deterministic unit conversion.
* Python regex for syntax parsing.
* Deterministic taxonomy and engineering-rule engines.
* Physics/category constraint matrices.

#### Storage

**PostgreSQL** is the production authoritative source of truth for:

* `ProcessingJob`
* `Product`
* `RawAttribute`
* `NormalizedAttribute`
* `EnrichedAttribute`
* `Evidence`
* `ValidationReport`
* `CriticDecision`
* `AuditLog`

**SQLite** is permitted for local development and testing.

**Qdrant** is an indexing and retrieval layer only for:

* SKU embeddings.
* Functional similarity search.
* Competitor/reference matching.

Qdrant is **never** treated as the authoritative product database.

---

## 6. Domain Entities & Data Lifecycle

Attributes do not follow a permanently rigid linear pipeline. They progress through a stateful relationship graph with iterative validation and bounded correction loops.

```text
Evidence
   ↓
RawAttribute
   ↓
NormalizedAttribute
   ↓
ValidationReport
   ↓
Optional Enrichment
   ↓
Re-Validation
   ↓
Critic / Confidence
   ↓
Human Review if required
   ↓
Publication
```

### 6.1 `ProcessingJob`

**Purpose:** Tracks document or catalog processing.

**Fields:**

* `job_id` — UUID
* `status` — `QUEUED | PROCESSING | COMPLETED | FAILED`
* `file_path`
* `total_pages`
* `skus_found`
* `created_at`
* `completed_at`
* `error_code` — optional
* `error_message` — optional

### 6.2 `Evidence`

**Purpose:** Represents verifiable proof of origin from a source document or deterministic rule.

**Fields:**

* `evidence_id` — UUID
* `evidence_type` — `SOURCE | RULE | DERIVED`
* `source_text` — optional; required for `SOURCE`
* `page_number` — optional; required for `SOURCE`
* `bounding_box` — optional `[page, top%, left%, width%, height%]`; required for visual `SOURCE` evidence
* `rule_id` — optional; required for `RULE` or `DERIVED`
* `producing_agent`
* `confidence_score`
* `created_at`

A `SOURCE` evidence object must point to an actual source region. A `RULE` evidence object must identify the deterministic rule responsible for the derived value.

### 6.3 `RawAttribute`

**Purpose:** Captures the value as extracted from the source before transformation.

**Fields:**

* `raw_id` — UUID
* `key`
* `raw_value`
* `evidence_id` — foreign key
* `status` — `VALID | REJECTED_ORPHAN | UNVERIFIED_EVIDENCE`

### 6.4 `NormalizedAttribute`

**Purpose:** Holds standardized numerical values, canonical units, and terminology.

**Fields:**

* `normalized_id` — UUID
* `raw_id` — foreign key
* `standard_key`
* `numeric_value`
* `unit`
* `canonical_term`
* `normalization_method` — `PINT | REGEX | DICTIONARY | LLM_FALLBACK`
* `locked` — boolean
* `created_at`

Every normalized attribute retains a relationship to its original `RawAttribute`.

### 6.5 `EnrichedAttribute`

**Purpose:** Holds values derived by deterministic engineering/domain rules when required source information is missing.

**Fields:**

* `enriched_id` — UUID
* `standard_key`
* `inferred_value`
* `evidence_id` — foreign key to `RULE` evidence
* `parent_attribute_ids`
* `validation_status`

Enriched attributes may only be produced under the enrichment gate defined by the Category Agent and must undergo validation before publication.

### 6.6 `ValidationReport`

**Purpose:** Stores results of physics and domain constraint evaluation.

**Fields:**

* `report_id` — UUID
* `attribute_id`
* `passed`
* `rule_name`
* `severity` — `CRITICAL | WARNING`
* `error_message`
* `created_at`

### 6.7 `CriticDecision`

**Purpose:** Records the Auditor Agent's decision regarding validation failures and retry behavior.

**Fields:**

* `decision_id` — UUID
* `action` — `ACCEPT | RE_EXTRACT | RE_NORMALIZE | ESCALATE_HUMAN`
* `rationale`
* `retry_count`
* `created_at`

### 6.8 `AuditLog`

**Purpose:** Provides an immutable record of human modifications and important publication decisions.

**Fields:**

* `audit_id`
* `user_id`
* `attribute_id`
* `previous_value`
* `new_value`
* `reason_code`
* `timestamp`
* `action`

Audit records must not be overwritten or silently deleted as part of ordinary processing.

### 6.9 `Product`

**Purpose:** The internal canonical product representation before publication or export.

**Fields:**

* `product_id`
* `sku`
* `category`
* `status`
* `attributes`
* `composite_confidence`

Possible product statuses include:

`RAW | VALIDATED | REVIEW_REQUIRED | MANUAL_ENTRY | PUBLISHED | UNCLASSIFIED`

Human-approved or human-edited attributes additionally carry a `LOCKED` state.

---

## 7. Agent Definitions & Contracts

Each agent is a specialized LangGraph node with an explicit behavioral contract and bounded tool permissions.

### 7.1 Parser Agent

**Purpose:** Converts supported vendor documents into layout-aware structured content and coordinate maps.

**Supported inputs:**

* PDFs.
* Scanned PDFs.
* Images/labels.
* Spreadsheets.
* Word documents.
* Text snippets and email-derived product information where supported.

**Allowed Tools:**

* `docling_parse_tool`
* `vision_llm_parse_tool`

**Input State:**

`ProcessingJob.file_path`

**Output State:**

* `raw_document_markdown`
* `page_layout_map`
* structured tables
* image regions
* unreadable-region flags

**Exit Condition:**

A usable layout map with page and coordinate information is generated.

**Failure Condition:**

Unreadable/corrupted input after fallback processing → `FAILED_PARSING`.

Unreadable regions must be flagged rather than silently dropped.

### 7.2 Category Identification Agent

**Purpose:** Determines taxonomy classification and discrete SKU boundaries.

**Allowed Tools:**

* `taxonomy_lookup_tool`
* `sku_boundary_detector`

**Input State:**

`raw_document_markdown`

**Output State:**

* `category_id`
* `category_confidence`
* `sku_segments`

**Exit Gates:**

* **≥ 0.90:** Proceed to extraction; enrichment allowed downstream.
* **0.60–0.89:** Proceed to extraction; enrichment prohibited.
* **< 0.60:** Terminate automated extraction and route to `UNCLASSIFIED_HUMAN_REVIEW`.

### 7.3 Attribute Extraction Agent

**Purpose:** Extracts technical specifications according to the category schema and attaches source evidence.

**Allowed Tools:**

* `schema_lookup_tool`
* `spatial_text_search_tool`

**Input State:**

* `sku_segment`
* `category_schema`

**Output State:**

List of `RawAttribute` records with `SOURCE` evidence.

**Exit Condition:**

Candidate attributes are mapped with valid source evidence.

**Failure Condition:**

Value without verifiable source text/coordinates → `REJECTED_ORPHAN`.

Schema validation failures must be logged and surfaced rather than silently discarded.

### 7.4 Normalization Agent

**Purpose:** Standardizes units and terminology into canonical representations.

**Allowed Tools:**

* `pint_unit_convert_tool`
* `regex_cleaner_tool`
* `jargon_dictionary_tool`
* `llm_ambiguity_resolver`

The LLM ambiguity resolver may only be invoked when deterministic methods cannot resolve the interpretation.

**Input State:**

List of `RawAttribute` records.

**Output State:**

List of `NormalizedAttribute` records.

**Exit Condition:**

Values have canonical magnitudes, units, and terminology where resolvable.

**Failure Condition:**

Ambiguity that remains unresolved → Human Review.

Once successfully normalized, the result is immutable unless explicitly modified through the Human Review Contract.

### 7.5 Validation Agent — "Digital Physicist"

**Purpose:** Validates extracted and enriched attributes against physical laws, engineering constraints, material thresholds, and category rules.

**Allowed Tools:**

* `physics_rules_engine`
* `category_bounds_checker`

**Input State:**

`NormalizedAttribute` or `EnrichedAttribute` records.

**Output State:**

`ValidationReport` per applicable attribute/rule.

**Execution Order:**

1. Deterministic rule checks.
2. Category constraint checks.
3. Agent-level interpretation where required.
4. Produce human-readable validation explanations.

**Failure Condition:**

Critical violation → `CriticAgent`.

Failed validation must never be silently published.

### 7.6 Enrichment Agent

**Purpose:** Derives missing mandatory category attributes using explicit deterministic engineering rules.

**Allowed Tools:**

* `deterministic_enrichment_rules`

**Input State:**

* Validated `Product`
* `category_confidence`

**Gate Trigger:**

Enrichment executes only when:

```text
category_confidence >= 0.90
AND
zero unresolved critical validation errors
```

**Output State:**

`EnrichedAttribute` records with `RULE` evidence.

**Execution Boundary:**

Every enriched attribute must:

1. Reference its originating rule.
2. Preserve parent attribute relationships where applicable.
3. Re-enter the `ValidationAgent`.
4. Pass validation before publication.

Free-form LLM invention is prohibited.

### 7.7 Critic / Auditor Agent

**Purpose:** Analyzes validation failures, verifies evidence, determines whether correction is possible, and bounds retry behavior.

**Allowed Tools:**

* `evidence_verifier_tool`
* `prompt_refinement_tool`

**Input State:**

* `ValidationReport`
* `retry_count`

**Output State:**

`CriticDecision`

**Retry Policy:**

`MAX_RETRIES = 3`

This means one initial extraction attempt plus up to three re-extraction attempts, for a maximum of four extraction cycles.

**Behavior:**

* If `retry_count < 3`, generate correction instructions and return to the relevant extraction/normalization stage.
* If `retry_count >= 3`, set `ESCALATE_HUMAN` and route to Review Workbench.

The Critic must not override deterministic validation rules or manufacture evidence.

### 7.8 Cross-Reference Agent

**Purpose:** Identifies functionally equivalent replacement SKUs.

**Allowed Tools:**

* `qdrant_vector_search_tool`
* `spec_difference_matrix_tool`

**Input State:**

Published `Product` model.

**Output State:**

Top-K candidate equivalents containing:

* Candidate SKU.
* Similarity score.
* Spec-parity percentage.
* Attribute delta matrix.
* Human-readable differences.

**Exit Condition:**

A transparent comparison matrix is generated.

Cross-reference failure must not block the core catalog-ingestion pipeline.

---

## 8. LangGraph State Machine & Orchestration Contracts

### 8.1 State Transitions

| Current Node       | Condition / Trigger                                 | Next Node            | State Updates / Actions              |
| ------------------ | --------------------------------------------------- | -------------------- | ------------------------------------ |
| **Start**          | File upload received                                | `ParserAgent`        | Initialize `ProcessingJob`           |
| `ParserAgent`      | Parsing success                                     | `CategoryAgent`      | Store structured document state      |
| `ParserAgent`      | Parsing failure                                     | **Terminated**       | Job = `FAILED_PARSING`               |
| `CategoryAgent`    | Score ≥ 0.60                                        | `ExtractorAgent`     | Create `Product` state shell         |
| `CategoryAgent`    | Score < 0.60                                        | **Review Workbench** | Status = `UNCLASSIFIED_HUMAN_REVIEW` |
| `ExtractorAgent`   | Attributes extracted                                | `NormalizerAgent`    | Attach `RawAttribute` + Evidence     |
| `NormalizerAgent`  | Normalization complete                              | `ValidatorAgent`     | Attach `NormalizedAttribute`         |
| `ValidatorAgent`   | All pass + category ≥ 0.90 + not enriched           | `EnricherAgent`      | `has_critical_failures = False`      |
| `ValidatorAgent`   | All pass + category < 0.90 OR post-enrichment       | `ConfidenceRouter`   | Calculate final score                |
| `ValidatorAgent`   | Critical failure                                    | `CriticAgent`        | `has_critical_failures = True`       |
| `CriticAgent`      | Fixable + retry < 3                                 | `ExtractorAgent`     | Increment retry count                |
| `CriticAgent`      | Unfixable OR retry ≥ 3                              | `ConfidenceRouter`   | Mark validation failure              |
| `EnricherAgent`    | Enrichment complete                                 | `ValidatorAgent`     | Re-validate enriched fields          |
| `ConfidenceRouter` | Publication gates satisfied                         | **Publish**          | Status = `PUBLISHED`                 |
| `ConfidenceRouter` | Score 0.60–0.89 OR warnings                         | **Review Workbench** | Status = `REVIEW_REQUIRED`           |
| `ConfidenceRouter` | Score < 0.60 OR critical failure OR retry exhausted | **Manual Queue**     | Status = `MANUAL_ENTRY`              |

### 8.2 Publication Gate

The `ConfidenceRouter` may transition a product to `PUBLISHED` **only when all eight conditions are satisfied**:

1. **Zero unresolved critical failures.**
2. **Mandatory provenance coverage:** every published attribute has valid `SOURCE` or `RULE` evidence.
3. **Validated enrichment:** every enriched attribute has valid rule evidence and passed re-validation.
4. **Taxonomy completeness:** all mandatory category attributes are present.
5. **No `UNVERIFIED_EVIDENCE` attributes.**
6. **No pending human escalation.**
7. **Composite Trust Score `S >= 0.90`.**
8. **Lock protection:** publication cannot overwrite a human-locked attribute.

The first condition is an absolute safety invariant: **a high confidence score can never override a critical validation failure.**

---

## 9. Detailed 10-Feature Requirements

### Feature 1: Multi-Format Multimodal Parser

The parser must process PDFs, scanned documents, images/labels, tables, and other supported vendor-document formats.

All visual evidence uses standardized coordinate representation:

```text
[page_number, top_pct, left_pct, width_pct, height_pct]
```

with values ranging from `0.0%` to `100.0%`.

Complex tables, rotated text, diagrams, and scanned regions should be supported where the selected parser/vision stack can resolve them.

**Acceptance criteria:**

* Every successfully extracted visual region has page and coordinate metadata.
* Unreadable regions are flagged rather than silently discarded.
* Parser failure triggers the defined fallback mechanism where applicable.

### Feature 2: Structured Attribute Extractor

Extracts typed technical parameters such as:

* Voltage.
* Thread size/type.
* Operating temperature.
* Pressure rating.
* Material.
* IP rating.
* Approvals.
* Category-specific parameters.

Output must conform to strict structured schemas.

**Acceptance criteria:**

* No published attribute may lack valid evidence.
* Orphan values are automatically rejected.
* Schema validation failures are logged and surfaced.

### Feature 3: Canonical Unit & Term Normalizer

Converts representations such as:

```text
1/2 in
0.5"
½"
12.7 mm
```

into the appropriate canonical representation.

Deterministic normalization using regex, Pint, and terminology dictionaries must execute before LLM fallback.

**Acceptance criteria:**

* Deterministic normalization handles at least 90% of known unit/term patterns without LLM involvement.
* Every normalized value retains its source relationship.
* Unresolved ambiguity is routed to human review.

### Feature 4: Physics-Aware Validation & Anomaly Detection

Maintains explicit constraint matrices including:

* Material × pressure.
* Material × temperature.
* Material × medium compatibility.
* Required attributes by category.
* Known physical impossibilities.
* Category-specific bounds.

For example:

```text
PVC body + 300°C operating temperature
→ CRITICAL VALIDATION FAILURE
```

**Acceptance criteria:**

* Each production category has an associated constraint matrix.
* Deterministic validation executes before agent-level critique.
* Failed validation generates an explanation.
* Critical failures cannot reach publication.
* Fixable failures may trigger bounded re-extraction.

### Feature 5: Controlled Automated Data Enrichment

Only missing **mandatory** attributes may be enriched.

Enrichment requires:

* High-confidence category classification.
* Zero unresolved critical validation failures.
* A deterministic rule.
* Rule evidence.
* Subsequent validation.

**Acceptance criteria:**

No enriched attribute can be published without all required evidence and successful re-validation.

### Feature 6: Explainability, Provenance & Full Audit Trail

The Review Workbench provides:

* Original source snippet.
* Extracted value.
* Normalized value.
* Enriched value where applicable.
* Confidence breakdown.
* Validation results.
* Agent decision history.
* Exact PDF/image source highlight.

Clicking an attribute must identify the source region responsible for the value.

**Acceptance criteria:**

A reviewer can retrieve the provenance and decision history for a published attribute within two UI interactions.

### Feature 7: Multi-Signal Confidence Scoring & Exception Routing

The system computes:

$$
S = (T \times 0.4) + (V \times 0.4) + (C \times 0.2)
$$

Where:

**T — Text Match Score**

Ratio of extracted attributes with verified source citations to total extracted attributes.

**V — Validation Score**

Severity-weighted validation result:

* Critical failure = `0`
* Warning = `0.5`
* Pass = `1.0`

**C — Critic Score**

* Initial successful attempt = `1.0`
* Penalized by `0.25` per retry cycle.

`S` is a routing heuristic, **not a calibrated statistical probability**.

Routing:

* `S >= 0.90` → eligible for automatic publication subject to all publication gates.
* `0.60 <= S < 0.90` → Review Workbench.
* `S < 0.60` → Manual Queue.

**Hard Safety Invariant:**

Regardless of `S`, any unresolved `CRITICAL` validation failure blocks publication.

Confidence thresholds must remain configurable at the category/client policy level without changing the underlying scoring semantics.

### Feature 8: Scalable Bulk Processing

The system supports asynchronous catalog processing.

A bulk job:

1. Accepts a catalog containing multiple documents.
2. Creates parallel processing tasks.
3. Tracks progress.
4. Persists structured results and evidence.
5. Exposes failed/review-required items.
6. Allows individual items to be opened directly in the Review Workbench.

**Acceptance criteria:**

The system must process the configured benchmark catalog size without HTTP timeout or memory failure while providing observable job progress.

The exact production catalog-size target remains configurable.

### Feature 9: Competitor / Functional Cross-Referencing

Normalized product attribute matrices are converted into embeddings for Qdrant retrieval.

Every returned candidate must include:

* Candidate SKU.
* Similarity/match percentage.
* Spec-parity score.
* Explicit attribute differences.
* Delta matrix.

**Acceptance criteria:**

No substitute recommendation may be presented as an unexplained black-box match.

Cross-reference service failure must not prevent core catalog ingestion.

### Feature 10: Dynamic Taxonomy / Schema Adapter

The system maintains one stable **Internal Canonical Product Model**.

External schemas are handled through versioned schema adapters.

Supported target schemas may include:

* CX1.
* ETIM.
* UNSPSC.
* Other configured industry schemas.

The adapter must transform the canonical model without dynamically mutating backend Python domain classes.

**Acceptance criteria:**

Output for a supported target schema validates successfully before downstream hand-off and requires no manual reformatting.

Schema changes must be isolated to adapter/configuration layers wherever possible.

---

## 10. Human Review Contract

When a SKU is routed to human review because of confidence, validation failure, unresolved ambiguity, or retry exhaustion, the reviewer may:

### 10.1 Accept

Approve the existing AI-derived or enriched value.

### 10.2 Edit

Modify:

* Attribute value.
* Unit.
* Category mapping.
* Other permitted product metadata.

### 10.3 Reject

Mark an attribute as invalid or mark the SKU as unsupported.

### 10.4 Mandatory Audit Logging

Every manual edit requires a reason code, such as:

* `INCORRECT_UNIT`
* `OCR_TYPO`
* `WRONG_BOUNDING_BOX`
* `WRONG_CATEGORY`
* `INVALID_SOURCE`

Each edit produces an immutable `AuditLog` entry containing:

* `user_id`
* `previous_value`
* `new_value`
* `timestamp`
* `reason`

### 10.5 Attribute Locking

Human-approved or human-edited values enter `LOCKED` state.

Automated graph executions and reruns are **strictly prohibited from overwriting locked attributes**.

### 10.6 Evaluation Feedback

Human corrections are exported into:

```text
data/eval/human_corrections.json
```

These corrections become regression examples for future agent, tool, and prompt evaluation.

---

## 11. Non-Functional Requirements

| Category           | Requirement                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Reliability**    | No attribute reaches production without valid evidence or rule provenance. No silent failures.                                    |
| **Auditability**   | Agent decisions, validation results, publication decisions, and human edits remain queryable for the configured retention period. |
| **Performance**    | Bulk processing is asynchronous; the single-document/page SLA remains configurable during benchmarking.                           |
| **Scalability**    | Catalog documents can be processed in parallel without requiring architectural changes to individual agents.                      |
| **Security**       | Vendor documents are treated as untrusted data and cannot modify system instructions, agent policies, or tool permissions.        |
| **Resilience**     | Parser, vector database, and other auxiliary failures have explicit fallback/degradation behavior.                                |
| **Extensibility**  | New categories can be introduced primarily through taxonomy, schemas, rules, and constraint matrices.                             |
| **Usability**      | Non-technical catalog reviewers can complete review workflows without engineering assistance.                                     |
| **Data Integrity** | PostgreSQL remains the authoritative source of truth; derived indexes must never become authoritative catalog records.            |
| **Observability**  | Processing jobs, agent executions, failures, retries, validation results, and publication decisions must be traceable.            |

---

## 12. Security, Resilience & Safety Guardrails

### 12.1 Instruction/Data Separation

Vendor documents are untrusted external inputs.

Extracted text must be represented as **data**, never as system or developer instructions.

Document content must not be able to:

* Invoke tools directly.
* Modify LangGraph topology.
* Change system policies.
* Modify validation rules.
* Change publication gates.
* Override human locks.

### 12.2 Parser Isolation

Parser execution should occur within an isolated environment with:

* Restricted execution permissions.
* Appropriate file-type handling.
* Executable/macro restrictions where applicable.
* Per-page processing timeouts.

### 12.3 Graceful Fallbacks

**Parser failure:**

```text
Docling failure
→ vision_llm_parse_tool
→ if still unsuccessful → FAILED_PARSING
```

**Qdrant outage:**

```text
Qdrant unavailable
→ log warning
→ bypass cross-reference
→ continue core catalog processing
```

**Missing coordinates:**

```text
No verifiable bounding box
→ UNVERIFIED_EVIDENCE
→ Human Review
```

Core catalog ingestion must not depend on the availability of the optional cross-reference service.

---

## 13. Trajectory Evaluation Specifications

System quality is evaluated on **complete agent trajectories**, not only final JSON output.

Evaluation should inspect:

* Agent sequence.
* Tool calls.
* Tool arguments where applicable.
* State transitions.
* Evidence attachment.
* Validation decisions.
* Retry behavior.
* Confidence calculation.
* Publication/review routing.

### 13.1 Test Case 1 — Standard Extraction Trajectory

**Input:**

Clean one-page PDF for a stainless-steel ball valve containing:

```text
Max Pressure: 600 PSI
```

**Expected trajectory:**

1. `ParserAgent` calls `docling_parse_tool` → success.
2. `CategoryAgent` assigns `BALL_VALVE`, confidence `0.95`.
3. `ExtractorAgent` extracts `600 PSI` with `SOURCE` evidence and page coordinates.
4. `NormalizerAgent` standardizes to `600.0 PSI`.
5. `ValidatorAgent` evaluates the pressure against the applicable matrix → `PASS`.
6. `EnricherAgent` applies `RULE_VALVE_TYPE_DERIVATION` where applicable.
7. `ValidatorAgent` re-validates enriched output → `PASS`.
8. `ConfidenceRouter` evaluates all publication gates.
9. Product is written to PostgreSQL with `PUBLISHED` status.

### 13.2 Test Case 2 — Adversarial Physics Violation & Retry Exhaustion

**Input:**

Vendor PDF containing:

```text
Body Material: PVC
Max Temp: 300 C
```

**Expected trajectory:**

1. `ExtractorAgent` extracts material and temperature.
2. `NormalizerAgent` converts temperature to `300.0 Celsius`.
3. `ValidatorAgent` detects the PVC temperature constraint violation → `CRITICAL`.
4. `CriticAgent` requests evidence re-verification.
5. Extraction is retried.
6. Validation fails again.
7. Retry continues until `MAX_RETRIES = 3`.
8. `CriticAgent` emits `ESCALATE_HUMAN`.
9. `ConfidenceRouter` fails publication gate #1.
10. Product enters Review Workbench with:

```text
CRITICAL_PHYSICS_ANOMALY
```

Under no circumstances may a high confidence score override this critical failure.

---

## 14. Success Metrics

The system will be evaluated using:

### Data Quality

* **Provenance coverage:** Target `100%` for published attributes.
* **Orphan-value rate:** Target `0%` for published attributes.
* **Unit conversion accuracy:** Target `100%` for deterministic benchmark cases.
* **Bounding-box precision:** Target ≥95% IoU on benchmark overlays.
* **Semantic interpretation precision:** Target ≥95% on human-reviewed benchmark cases.

### Operational Efficiency

* Reduction in manual catalog-processing time.
* Reduction in manual review time.
* Percentage of attributes auto-approved.
* Percentage routed to human review.
* Time required to onboard a vendor catalog.
* Bulk processing throughput.

### Safety & Validation

* Number of critical physical inconsistencies detected.
* Percentage of critical violations blocked before publication.
* False-negative rate on validation benchmark cases.

### Human Review

* Reviewer accept rate.
* Average review time per SKU.
* Percentage of records requiring manual modification.
* Percentage of human corrections successfully converted into regression cases.

### Cross-Reference

* Percentage of eligible searches producing usable candidates.
* Average spec-parity score of accepted substitutes.
* Cross-reference adoption in out-of-stock scenarios.

---

## 15. Risks & Mitigations

| Risk                                     | Mitigation                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| **LLM hallucination**                    | Zero-orphan-value policy, deterministic-first processing, evidence verification, Critic gate |
| **Incorrect normalization**              | Pint/regex/dictionary first; LLM only for residual ambiguity                                 |
| **Incomplete physics rules**             | Category-specific constraint matrices required before production rollout                     |
| **Poor document scans**                  | Vision fallback and explicit unreadable-region flags                                         |
| **Reviewer bottleneck**                  | Confidence routing and progressively improved evaluation datasets                            |
| **Schema drift**                         | Versioned schema adapters and target-schema validation                                       |
| **Qdrant outage**                        | Cross-reference becomes degraded but does not block catalog ingestion                        |
| **Prompt injection in vendor documents** | Strict data/instruction separation and bounded tool permissions                              |
| **Human edits being overwritten**        | Immutable `LOCKED` attributes                                                                |
| **State corruption during retries**      | Explicit LangGraph state transitions and bounded retry counts                                |
| **Unexplained AI-derived enrichment**    | Deterministic rule requirement and mandatory rule evidence                                   |
| **Publication despite critical failure** | Hard publication invariant independent of confidence score                                   |

---

## 16. Rollout Plan

### Phase 1 — Core Extraction

Implement:

```text
Parser
→ Category
→ Extractor
→ Normalizer
```

Initial scope:

* One industrial vertical.
* Manual review of output.
* Full provenance capture.
* Core evidence model.

### Phase 2 — Validation & Enrichment

Add:

```text
Validator
→ Critic
→ Enrichment
→ Re-validation
→ Confidence Router
```

Introduce:

* Physics constraints.
* Deterministic enrichment.
* Confidence scoring.
* Review Workbench.
* Publication gates.

### Phase 3 — Scale & Audit

Add:

* Asynchronous bulk processing.
* Job progress.
* Full audit history.
* Human correction feedback.
* Large-catalog benchmark evaluation.

### Phase 4 — Cross-Referencing & Schema Adapter

Add:

* Qdrant integration.
* Functional equivalent matching.
* Spec-parity matrices.
* CX1 schema adapter.
* Additional target schemas.

### Phase 5 — Multi-Vertical Expansion

Expand to:

* Plumbing/PVF.
* HVAC/HVACR.
* Electrical.
* Industrial Supply.

Each vertical requires its own:

* Taxonomy.
* Required attributes.
* Constraint matrices.
* Enrichment rules.
* Evaluation benchmarks.

---

## 17. Open Questions

The following decisions remain configurable rather than being silently assumed:

1. What is the production SLA for single-document processing?
2. What benchmark catalog size should `[X,000]` represent?
3. Which target schemas beyond CX1, ETIM, and UNSPSC are required at launch?
4. Should confidence thresholds be globally fixed or configurable per category/client?
5. What retention period applies to source documents, agent traces, and audit logs?
6. What access-control model is required for vendor documents and reviewer actions?
7. Who owns and approves category-specific constraint matrices?
8. What constitutes sufficient evidence for each supported document format?
9. Which categories will be included in the initial production/hackathon benchmark?
10. What benchmark dataset will be used to measure extraction, normalization, validation, and trajectory quality?

---

## 18. Final Product Invariants

The following rules are **non-negotiable system invariants**:

1. **No orphan value may be published.**
2. **No critical validation failure may be published.**
3. **LLM inference cannot override deterministic validation.**
4. **LLM inference cannot manufacture source evidence.**
5. **Enrichment requires deterministic rule provenance.**
6. **Enriched attributes must be re-validated.**
7. **Human-locked attributes cannot be overwritten automatically.**
8. **Qdrant is never the authoritative catalog store.**
9. **Vendor document content is always treated as untrusted data.**
10. **All publication decisions must be explainable from persisted state, evidence, validation, and confidence information.**
11. **Bounded retries are mandatory; agents cannot enter unbounded self-correction loops.**
12. **Cross-reference failure must not block core catalog ingestion.**

These invariants define the trust boundary of the Unilog Catalog Engine and take precedence over individual agent behavior or model output.
