# Sprint Status & Execution Tracker: Unilog Catalog Engine

## Sprint Overview
* **Sprint Goal:** Build and validate the core evidence-first multi-agent pipeline, satisfying all 8 publication gates and passing the BDD test suite.
* **Current Status:** Phase 1 (Foundation & Spec Alignment) $\rightarrow$ **COMPLETED**. Moving into Phase 2 (Backend Core Nodes).

---

## Phase Roadmap & Checklist

### Phase 1: Foundation, Specifications & Ground-Truth Seed Data (Completed)
- [x] Lock Product Requirements Document (`specs/01_prd.md`)
- [x] Lock Architecture & Node State Graph (`specs/02_architecture.yaml`)
- [x] Lock BDD Feature Scenarios (`specs/bdd/*.feature`)
- [x] Lock Evaluation & Gate Specifications (`04_evaluation.yaml`)
- [x] Initialize Runtime Data & Schemas (`data/taxonomy/`, `data/rules/`, `data/seed/`, `data/schemas/`)
- [x] Define Agent Skills & Governance (`.agents/skills/`)
- [x] Define Agent Core Context (`AGENTS.md`)

### Phase 2: Ingestion & Parsing Services (Next Action)
- [ ] Implement FastAPI file upload endpoint with asynchronous streaming (`data/jobs/`)
- [ ] Integrate `Docling` parser wrapper with page percentage coordinate mapping (Feature 1)
- [ ] Build Fallback Vision LLM parser for scanned image PDFs
- [ ] Write Pytest tests for Gate 1 parsing success validation (`specs/bdd/ingestion.feature`)

### Phase 3: Extraction, Normalization & Taxonomy Nodes
- [ ] Implement `category_agent` with taxonomy classification lookup (Feature 10)
- [ ] Implement `extractor_agent` enforcing zero-orphan attribute extraction (Feature 2)
- [ ] Implement `normalizer_agent` using deterministic `Pint` unit math and regex cleanup (Feature 3)
- [ ] Bind evaluation fixtures (`benchmark_skus.json`) to extraction test runners

### Phase 4: Physics Validation, Enrichment & Critic Loop
- [ ] Implement `validator_agent` ("Digital Physicist") using `physics_constraints.json` (Feature 4)
- [ ] Implement `enricher_agent` for high-confidence categorical rule injection (Feature 5)
- [ ] Implement `critic_agent` bounding retry loops up to `MAX_RETRIES = 3`
- [ ] Verify Gate 5provenance coverage and verification requirements

### Phase 5: Publication, Gate 8 Immutability & Review Workbench
- [ ] Implement `ConfidenceRouter` and the 8 mandatory publication gate checks
- [ ] Implement Gate 8 SHA-256 canonical hashing lock protection (`security.md`)
- [ ] Build Next.js / shadcn review workbench for human overrides (`REVIEW_REQUIRED`, `UNCLASSIFIED_HUMAN_REVIEW`)
- [ ] Run full BDD regression test suite and verify coverage metrics