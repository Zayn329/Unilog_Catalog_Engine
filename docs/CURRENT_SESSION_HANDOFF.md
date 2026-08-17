# Current Session Handoff

Date: 2026-08-16
Project: Unilog_Catalog_Engine

## Scope

This is a factual transfer document. No feature implementation, refactor, rollback, or cleanup was performed for this handoff. The next agent must respect AGENTS.md, the PRD, architecture specifications, BDD features/tests, existing Git history, and the existing application/test harness.

## Git state

- Branch: main
- Latest commit: 18b888a feat(cross-reference): add qdrant search and comparison API
- Other relevant recent commits: 733f5da feat(ui): connect review workbench actions; 3336efb 8.1 completed; 7399a5a feat(phase6): assemble full LangGraph pipeline; caf1699 feat(phase5): add enrichment, critic, and Gate 8 security.
- No commit was created for this handoff.

The working tree was already dirty. Modified tracked files reported by git status were: app/api/v1/jobs.py, app/api/v1/review.py, app/nodes/category_node.py, app/nodes/extractor_node.py, app/nodes/normalizer_node.py, app/security/gate8.py, app/security/hasher.py, catalog_engine.db, data/taxonomy/unilog_taxonomy.yaml, pyproject.toml, pytest.ini, tests/unit/test_api.py, tests/unit/test_category_extractor.py, tests/unit/test_enricher_critic_security.py, tests/unit/test_parser_node.py, uv.lock, and web/src/app/review/[jobId]/page.tsx.

Untracked items included tests/unit/test_job_processing.py, sample_catalog.pdf, many uploaded PDFs under data/uploads/, and pytest temporary/cache directories with Windows permission warnings. Do not delete or reset these without explicit review. Their original ownership/history is mixed and was not reconstructed here.

## Implemented code present

The repository contains implementations for FastAPI PDF upload/polling/background LangGraph execution/job persistence; a Docling adapter with percentage bounding boxes; a PDFium fallback; deterministic taxonomy classification; regex extraction with evidence; Pint scalar/temperature normalization; deterministic physics validation and enrichment; a bounded critic loop with MAX_RETRIES = 3; deterministic eight publication gates; Gate 8 SHA-256 lock protection; SQLite-backed records; review queue/submission APIs; a Next.js review workbench; Qdrant cross-reference; and deterministic feature-hash vectors rather than model-generated embeddings.

These are code-level facts, not proof that every production dependency path has been exercised.

## Docling and PyTorch facts

The session recorded this verified CUDA setup:

- Initial PyTorch: 2.13.0+cpu
- GPU: NVIDIA GeForce GTX 1650 4GB
- Driver: 560.94, CUDA 12.6
- Current PyTorch: 2.13.0+cu126
- torch.cuda.is_available() == True
- torch.version.cuda == 12.6

Do not revert the CUDA setup. Do not switch from uv to pip unless a concrete dependency issue requires it. Do not install Visual Studio/MSVC or Triton merely as a workaround without proving necessity.

Docling uses DOCLING_INFERENCE_COMPILE_TORCH_MODELS. The session ran $env:DOCLING_INFERENCE_COMPILE_TORCH_MODELS="false" and verified settings.inference.compile_torch_models == False. The repository root currently has a .env containing DOCLING_INFERENCE_COMPILE_TORCH_MODELS=false. The PowerShell assignment is session-only. A previous os.getenv() check returned None because os.getenv() does not load .env automatically.

The original Docling failure was TorchInductor C++ compilation: InvalidCxxCompiler: Compiler: cl is not found. Another run showed a Triton-related failure. These occurred in the Torch compilation path. The working hackathon decision was to disable model compilation if ordinary Docling inference works rather than immediately installing a full C++/Triton toolchain.

## Real uploaded PDF result

Uploaded file: data/uploads/1fa0cc22-da59-41ac-9ea7-0b4ee76523b3_sample_catalog.pdf
Job ID: 1fa0cc22-da59-41ac-9ea7-0b4ee76523b3

Observed API result:
- status = UNCLASSIFIED_HUMAN_REVIEW
- total_pages = 1
- skus_found = 1
- parse_status = SUCCESS
- terminal_status = UNCLASSIFIED_HUMAN_REVIEW

Markdown:
UNILOG CATALOG SPEC SHEET
SKU: MOT-2026-X
Voltage: 480V AC
Power Rating: 15 HP
Weight: 42.5 kg

page_layout_map and bounding boxes were produced. The product state nevertheless showed sku = UNKNOWN, category_id = UNCLASSIFIED, category_confidence = 0.0, and attributes = [].

UNCERTAIN: the successful result has not been conclusively attributed to Docling. It may have come from _parse_with_pdfium(). Do not claim Docling was proven or definitely failed until the actual path is traced. After proving the parser path, investigate why SKU/data did not propagate downstream.

## Parser architecture and test caveat

Docling is intended as the primary parser; PDFium is intended only as fallback. In app/tools/docling_parser.py, DoclingParser constructs DocumentConverter and calls Docling first, then calls _parse_with_pdfium() for conversion/parse exceptions. However, parse_pdf() constructs DoclingParser before the parser try block, so initialization errors can occur before PDFium fallback is reachable.

tests/unit/test_parser_node.py has an autouse fixture replacing DoclingParser.parse with _parse_with_pdfium() for every parser unit test. Parser unit tests therefore prove PDFium behavior, not the Docling primary path.

A direct Docling smoke test with compilation disabled failed during import before parsing with ValueError: A distribution name is required. The traceback passed through transformers/Torch package metadata while constructing DoclingParser. This conflicts with the successful application job and remains unresolved; environment/process differences are UNCERTAIN.

## Seed/bypass test caveat

tests/integration/test_full_pipeline.py uses data/seed/benchmark_skus.json. In app/graph.py, _seed_record() detects records with prebuilt attributes. The seeded path supplies markdown, category/confidence, attributes, and evidence through _seed_attributes() instead of proving real PDF classification and extraction.

The benchmark tests are useful for deterministic gate/regression behavior, but must not be presented as proof of the uploaded-PDF path.

## Infrastructure state

The only current .env setting is the Docling compilation flag. These are not configured: PostgreSQL DATABASE_URL, persistent QDRANT_URL, QDRANT_API_KEY, Groq/LLM API keys, and Vision LLM configuration.

Consequences:
- app/db/session.py defaults to sqlite+aiosqlite:///./catalog_engine.db.
- app/api/v1/products.py uses Qdrant :memory: when QDRANT_URL is absent.
- No active Groq/OpenAI/vision LLM integration was found.
- The current pipeline is deterministic-only; specification-described LLM fallback behavior is not active.

## Tests

Latest results:
- Focused category tests: 14 passed, 1 warning
- Full suite: 71 passed, 3 warnings

The full suite required elevated read access because the environment initially denied access to an installed SQLAlchemy file. Warnings included FastAPI deprecation and local Qdrant payload-index warnings.

Passing tests do not prove Docling primary-path execution, PostgreSQL, persistent Qdrant, LLM/Vision LLM behavior, real model embeddings, or complete CSV-driven taxonomy coverage. Parser tests force PDFium and integration tests use seed records.

## Taxonomy changes

The working tree includes CAT_MOTOR_001 with aliases including motor, electric motor, horsepower, hp, 1ph, and 3ph; and CAT_DISHWASHER_001 based on the available delivery CSV classpath. The delivery CSV contained only two rows, both dishwashers. The raw input CSV did not contain canonical classpaths, so an all-category taxonomy cannot safely be generated from those two files alone.

## Server/frontend notes

FastAPI successfully started with uvicorn app.main:app --reload --port 8000. The Next.js frontend starts from web/. The earlier npm run dev error happened because it was run from the repository root instead of web/. Frontend hydration warnings were associated with browser-extension-injected attributes and should be ignored unless they affect actual workbench behavior.

## Reproduction commands

    $env:DOCLING_INFERENCE_COMPILE_TORCH_MODELS="false"
    .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

    .venv\Scripts\python -m pytest tests/unit/test_category_extractor.py -q
    .venv\Scripts\python -m pytest -q

Direct smoke test used:

    $env:DOCLING_INFERENCE_COMPILE_TORCH_MODELS="false"
    .venv\Scripts\python -c "from app.tools.docling_parser import DoclingParser; r=DoclingParser().parse('sample_catalog.pdf'); print(r.parse_status)"

It currently fails during DoclingParser() construction with ValueError: A distribution name is required.

## NEXT AGENT: FIRST ACTION

Do not implement a feature first. Prove the real parser path for job 1fa0cc22-da59-41ac-9ea7-0b4ee76523b3:

1. Inspect its persisted graph_state_json and job record.
2. Add temporary read-only instrumentation or use a debugger/logging method distinguishing DocumentConverter.convert() success from _parse_with_pdfium() invocation.
3. Re-run one real upload with DOCLING_INFERENCE_COMPILE_TORCH_MODELS=false in the same backend process.
4. Record whether Docling or PDFium produced the markdown and boxes.
5. Reconcile that result with the direct ValueError: A distribution name is required smoke-test failure.
6. Only then investigate SKU propagation and downstream category/extraction.

Do not broaden the architecture, configure external services, or remove fallbacks until this investigation is complete.

