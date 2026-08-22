SpecForge: AI-Powered Product Intelligence for Industrial Commerce
> Evidence-First Multi-Agent Catalog Engine with Zero-Trust Physics Validation, Parametric WebGL 3D CAD Generation, and Real-Time Stress Simulation.
> 
Next.js

FastAPI

React Three Fiber

LangGraph

License: MIT
📌 Executive Overview
Industrial commerce relies on legacy vendor datasheets, blurry scanned PDFs, and dense engineering diagrams. Standard generative AI parsers present a major operational hazard: they hallucinate context, alter decimal places, and invent non-existent specifications. In B2B engineering, a single hallucinated pressure or temperature rating causes catastrophic equipment failure, costly returns, and life-safety risks.
SpecForge solves this with a Zero-Trust Hybrid Architecture. Large Language Models (LLMs) act strictly as semantic text parsers, while deterministic Python code, unit-normalization engines (Pint), and physical material matrices own all arithmetic, safety boundaries, and validation. Every extracted attribute is anchored to its source PDF bounding box and procedurally rendered as an interactive, rotatable WebGL 3D CAD asset.
✨ Key Features
1. 🔍 Layout-Aware Ingestion & 2D Spatial Provenance
 * Docling & PDFium Engine: Parses multi-column tables, rotated technical text, and unstructured spec sheets without static template rules.
 * 1-Click Spatial Bounding Box Link: Binds every extracted specification key-value pair directly to its source 2D coordinates [page, x1, y1, x2, y2]. Clicking an attribute auto-scrolls and highlights the exact PDF cell.
2. 🛡️ 8-Gate Deterministic Physics Validation
 * Zero-Trust Rule Execution: Extracted parameters (operating temperature, pressure, flow rate) pass through independent physical material constraint matrices.
 * Non-Invasive Anomaly Alerts: Flags physical impossibilities (e.g., a PVC pipe assigned a 450°F rating) instantly in ValidationAlerts.tsx. The raw extracted spec remains uncorrupted for auditability.
3. 🧊 Parametric WebGL 3D CAD Viewport
 * Procedural Three.js Generation: Maps parsed dimensional attributes (Outer Diameter, Inner Diameter, Length, Port Size) directly into rotatable 3D CAD geometry using @react-three/fiber—no pre-existing CAD files required.
4. 🔥 Real-Time Physics Stress & Thermal Failure Simulator
 * Dynamic WebGL Shaders: Interpolates surface heat-map gradients from Emerald (Safe) to Amber (Warning) to Rose Wireframe (Rupture).
 * Vertex Displacement Animations: Simulates structural fracture and vibration in real time when operating pressure or temperature sliders cross material yield thresholds.
5. 🔀 Vector-Based Competitor Cross-Referencing
 * Qdrant Similarity Search: Vectorizes normalized spec arrays to match equivalent SKUs across competitor catalogs.
 * Spec-Parity Scoring: Generates side-by-side comparison tables highlighting exact dimension matches versus parameter discrepancies.
6. 📤 Multi-Schema PIM Exporter
 * Enterprise PIM Transformation: Exports verified catalog data directly into Akeneo, Pimcore, InRiver, or Standard JSON formats.
 * Embedded Spatial Provenance: Every exported JSON attribute carries bounding-box origin metadata for 100% audit compliance.
🏗️ System Architecture & Execution Pipeline
[ Raw Legacy PDF / Datasheet ]
             │
             ▼
[ Stage 1: Layout-Aware Parsing ]
  ├── Docling / PDFium ────────► Spatial Coordinate Extraction [x1, y1, x2, y2, page]
  ├── Groq Llama-3 API ─────────► Raw Key-Value Spec Extraction
  └── Pint Engine ──────────────► Base Unit Normalizer (Metric / Imperial)
             │
             ▼
[ Stage 2: Zero-Trust Physics Gate ]
  ├── Evaluates specs against MaterialLimits DB (e.g., PVC max = 140°F)
  └── Decision Gate: Physical anomaly detected?
        ├── YES ──► Raise Critical ValidationAlert + Highlight PDF Source Cell
        └── NO  ──► Mark Spec Status as Verified ('SAFE')
             │
             ▼
[ Stage 3: Parametric CAD Mapping ]
  ├── cadMapper.ts parses dimensions (OD, ID, Length, Flange)
  └── R3F Canvas renders procedural WebGL 3D Mesh
             │
             ▼
[ Stage 4: Real-Time Stress Runtime ]
  ├── stressSimulator.ts calculates Stress Index (Operating / Yield Limit)
  └── Decision Gate: Stress Index >= 1.0 (Rupture Threshold)?
        ├── YES ──► Activate Vertex Displacement Shader & Red Wireframe
        └── NO  ──► Render Emerald-to-Amber Heat-Map Gradient
             │
             ├──► [ Stage 5: Qdrant Vector Cross-Reference Engine ]
             └──► [ Stage 6: Multi-Schema PIM Exporter (Akeneo / Pimcore) ]

🛠️ Technology Stack
| Component / Layer | Technologies Used | Purpose |
|---|---|---|
| Frontend Framework | Next.js 14 (App Router), React, TypeScript | Client dashboard shell & UI state management |
| Styling & UI Shell | Tailwind CSS, shadcn/ui, Lucide Icons | Responsive dark-mode interface system |
| 3D CAD & Graphics | @react-three/fiber, @react-three/drei, Three.js | Procedural 3D WebGL rendering & custom shaders |
| Backend API Core | FastAPI, Python 3.11+, uv package manager | High-performance asynchronous REST endpoints |
| Agent Orchestration | LangGraph, Pydantic v2 | Stateful multi-agent loops & strict data contracts |
| Document OCR & Parsing | Docling, PDFium | Layout-aware table extraction & spatial bounding boxes |
| LLM Inference | Groq API (Llama 3 70B) | High-speed semantic text and attribute proposal |
| Physics & Math Engine | Pint (Python), Regex Rules | Deterministic unit conversion & material limit gates |
| Database & Vector Index | PostgreSQL, Qdrant, SQLite (Local Dev) | Relational evidence store & SKU vector matching |
📁 Project Structure
specforge/
├── apps/
│   ├── web/                         # Next.js Frontend Application
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── UploadZone.tsx           # Drag-and-drop document intake
│   │   │   │   ├── Parametric3DViewer.tsx   # React Three Fiber WebGL viewport
│   │   │   │   ├── StressOverlayMesh.tsx    # Failure shader & vertex displacement
│   │   │   │   ├── StressAnalysisPanel.tsx  # Interactive PSI / Temp sliders
│   │   │   │   ├── ValidationAlerts.tsx     # Physics anomaly warning banner
│   │   │   │   ├── CrossRefDrawer.tsx       # Competitor parity slide-over
│   │   │   │   └── PimExportModal.tsx       # Akeneo / Pimcore JSON exporter
│   │   │   ├── utils/
│   │   │   │   ├── cadMapper.ts             # Maps JSON specs to 3D dimensions
│   │   │   │   └── stressSimulator.ts       # Material yield & stress ratio logic
│   │   │   └── types/
│   │   │       ├── cad.ts                   # CAD parameters & material definitions
│   │   │       └── alerts.ts                # Physics anomaly interface schemas
│   └── api/                         # FastAPI Backend Core
│       ├── routers/
│       │   ├── ingest.py            # PDF upload & Docling spatial parser
│       │   ├── physics.py           # Deterministic 8-Gate validation engine
│       │   ├── crossref.py          # Qdrant SKU similarity match
│       │   └── export.py            # PIM schema adapter endpoints
│       ├── agents/
│       │   └── graph.py             # LangGraph stateful agent workflow
│       └── main.py                  # FastAPI application entrypoint
├── docker-compose.yml               # Local Postgres & Qdrant setup
└── README.md

🚀 Getting Started
Prerequisites
 * Node.js: v18.x or higher
 * Python: v3.11 or higher
 * Package Managers: pnpm / npm and uv (Fast Python package manager)
 * API Keys: Groq API Key (for Llama-3 inference)
Step 1: Environment Configuration
Create a .env file in the root directory:
# AI & LLM Inference
GROQ_API_KEY=your_groq_api_key_here

# Database Configurations
DATABASE_URL=postgresql://specforge:specforge@localhost:5432/specforge_db
QDRANT_HOST=localhost
QDRANT_PORT=6333

# App Ports
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

Step 2: Backend Setup (FastAPI)
# Navigate to API directory
cd apps/api

# Install dependencies using uv
uv sync

# Run database migrations
uv run alembic upgrade head

# Start FastAPI development server
uv run uvicorn main:app --reload --port 8000

The API documentation will be available at http://localhost:8000/docs.
Step 3: Frontend Setup (Next.js)
# Navigate to web application directory
cd apps/web

# Install dependencies
pnpm install

# Start Next.js development server
pnpm dev

Open http://localhost:3000 in your browser to launch the SpecForge Workbench.
🔌 Core API Reference
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/ingest/parse | Accepts raw PDF upload; returns extracted key-value specs with spatial bounding boxes. |
| POST | /api/v1/physics/validate | Runs 8-gate material limit check against extracted specs; returns violation array. |
| GET | /api/v1/parts/{id}/cad-specs | Returns normalized geometric CAD parameters (OD, ID, Length, Port). |
| POST | /api/v1/cross-ref/match | Queries Qdrant vector store for equivalent competitor SKUs and parity scores. |
| GET | /api/v1/export/pim | Generates schema-transformed PIM JSON (Akeneo, Pimcore, InRiver) with provenance logs. |
📄 License
Distributed under the MIT License. See LICENSE for more information.
