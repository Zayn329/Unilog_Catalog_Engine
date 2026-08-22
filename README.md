# SpecForge

**Evidence-First Zero-Trust Product Intelligence & Parametric 3D Catalog Engine**

---

## 📌 Links & Live Deployment

* **Deployed Application:** [https://specforge.up.railway.app/](https://specforge.up.railway.app/) *(Hosted on Railway)*
* **Interactive API Documentation (Swagger UI):** [https://backend-production-3449.up.railway.app/docs](https://www.google.com/url?sa=E&source=gmail&q=https://backend-production-3449.up.railway.app/docs)
* **3-Minute Video Demo:** [Watch on Google Drive](https://drive.google.com/file/d/1Eh3I0zl6ffqAmQZfE_4mHoCJ5djtjPpY/view?usp=drivesdk)

---

## ⚡ Brief Feature Overview

* **2D Spatial Evidence Bounding Canvas:** Automatically parses multi-page legacy PDFs and binds every extracted key-value attribute directly to an exact spatial coordinate box `[page, x1, y1, x2, y2]` on the source document canvas for 1-click human verification.
* **Deterministic 8-Gate Physics Validation:** Intercepts LLM extraction candidates and routes them through a deterministic Python unit engine (`Pint`) and thermodynamic rule matrix to catch impossible physical parameters (e.g., PVC rated for 450°F) before database insertion.
* **Parametric WebGL 3D CAD Viewport:** Procedurally builds interactive 360° 3D geometry (`@react-three/fiber`) directly from tabular dimension parameters without requiring pre-loaded CAD files.
* **Real-Time Physics Failure & Stress Simulator:** Runs custom WebGL fragment shaders to visualize real-time thermal degradation and structural wireframe deformation when operating conditions exceed material yield thresholds.
* **Competitor Cross-Referencing Engine:** Vectorizes normalized specifications and queries a Qdrant index using cosine similarity to generate 0–100% spec-parity equivalence scores across alternative vendor SKUs.
* **Multi-Schema PIM Exporter:** Transforms verified attributes into production-ready Akeneo, Pimcore, or InRiver enterprise JSON schemas embedded with spatial provenance metadata.

---

## 💡 The Core Problem & Architectural Paradigm

In B2B industrial commerce, legacy datasheets are noisy, multi-column, and non-standardized. Traditional AI parsers fail because they **hallucinate context**: an LLM might misread a table cell or invent a 500 PSI pressure rating that was never in the document. In consumer software, an AI hallucination is an inconvenience; in industrial engineering, a single wrong number leads to structural failure, equipment loss, and safety hazards.

**SpecForge enforces a Zero-Trust Hybrid Paradigm:**

* **LLMs handle language semantics and contextual extraction proposal.**
* **Deterministic code owns unit conversions, dimensional analysis, and physics validation.**

The LLM is strictly forbidden from altering numbers, performing arithmetic, or declaring a specification physically valid. Code has the final say.

---

## 🛠️ Complete Technology Stack

| Layer | Technologies & Frameworks | Role / Functionality |
| --- | --- | --- |
| **Frontend UI Shell** | Next.js (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui | Reactive split-pane dashboard, state synchronization, and glassmorphic UI components. |
| **3D & Graphics Engine** | Three.js, `@react-three/fiber`, `@react-three/drei`, WebGL Shaders | Procedural CAD geometry generation, orbit controls, contact shadows, and vertex displacement shaders. |
| **Backend Service Layer** | FastAPI (Python), `uv` package runtime, AsyncIO background queues | High-throughput REST contracts, streaming parsing jobs, and non-blocking job dispatch. |
| **Document Parsing & OCR** | Docling, PDFium (fallback indexer), Vision LLMs | Layout-aware table extraction, spatial coordinate tokenization, and multi-column document parsing. |
| **Agent Orchestration** | LangGraph, Pydantic v2 | Stateful multi-agent workflow execution, agent-to-agent state transitions, and human-in-the-loop escalation queues. |
| **LLM Inference Core** | Groq API (Llama 3 models) | Sub-second token inference for structured JSON extraction and semantic tool routing. |
| **Physics & Math Engine** | `Pint` (Python Unit Engine), Regex Engine, Constraint Matrices | Deterministic unit conversion (Imperial/Metric), dimensional analysis, and material safety boundary validation. |
| **Storage & Vector Index** | PostgreSQL, Qdrant Vector Database, SQLite (Local Dev) | PostgreSQL serves as the authoritative truth for job/product states; Qdrant handles SKU embedding similarity search. |
| **Deployment Infrastructure** | Railway App Platform | Automated CI/CD deployment for both Next.js frontend and FastAPI backend containers. |

---

## 🔬 Architectural Deep-Dive

### 1. Spatial Evidence Provenance (`Docling` + `PDFium`)

When a document is uploaded, Docling parses structural elements (tables, headers, text blocks) and returns token bounding boxes. If a document is scanned or degraded, PDFium acts as a fallback rendering layer. When a user clicks an extracted specification key in the UI, the canvas auto-scrolls to the exact page and lights up the bounding coordinates `[x1, y1, x2, y2]`.

### 2. Zero-Trust Physics Gate (`Pint` + Rule Engine)

Candidate parameters pass into an 8-gate validation pipeline:

1. **Syntax Validation:** Regex checks for numerical formats and range structures.
2. **Unit Standardisation:** `Pint` parses unit strings (e.g., `120 bar`, `1740 PSI`, `1.2 MPa`) and normalizes them into base SI units (`Pascals`).
3. **Material Limit Evaluation:** Compares normalized operating conditions against the `MaterialLimits` lookup table (e.g., PVC max temperature = 140°F, Stainless Steel = 1500°F).
4. **Boundary Interception:** If a parameter violates safety thresholds, the engine flags a `CRITICAL` anomaly. The raw text remains untouched for auditing, but the record is blocked from auto-publishing.

### 3. Procedural 3D WebGL Mesh & Stress Shader Overlay

Extracted geometric attributes (Outer Diameter, Inner Diameter, Flange Size, Length) are passed to `cadMapper.ts`. Rather than serving static `.gltf` files, `@react-three/fiber` procedurally instantiates Three.js geometry primitives. When entering **Physics Stress Mode**, custom WebGL fragment and vertex shaders calculate the stress load ratio (`Stress Index = Operating Load / Material Threshold`):

* `Stress Index < 0.7`: Emerald green surface.
* `0.7 <= Stress Index < 1.0`: Amber thermal heat-map gradient.
* `Stress Index >= 1.0`: Pulsing red wireframe shader overlay with real-time vertex displacement vibration to visually demonstrate structural rupture.

### 4. Vector Cross-Referencing (`Qdrant`)

Target specification key-value pairs are converted into normalized spec vectors. These vectors are queried against a Qdrant index using cosine similarity to identify equivalent competitor parts (e.g., Parker vs. Swagelok vs. Norgren) and produce a 0–100% attribute parity matrix.

---

## 🌐 API Gateway Endpoints (FastAPI)

Below are the primary REST contracts served by the backend API at `[https://backend-production-3449.up.railway.app/docs](https://backend-production-3449.up.railway.app/docs)`:

```text
POST /api/v1/ingest/parse
├── Accepts: multipart/form-data (PDF File)
└── Returns: Job ID, Structured Specs JSON, Spatial Bounding Box Coordinates

POST /api/v1/physics/validate
├── Accepts: Extracted Spec Key-Value Dictionary
└── Returns: Anomaly Alerts Array (Severity, Violation Rule, Target Spec)

GET  /api/v1/parts/{id}/cad-specs
├── Accepts: Part ID Parameter
└── Returns: Normalized CAD Parameters (OD, ID, Flange, Length, Material)

POST /api/v1/cross-ref/match
├── Accepts: Target Part Number / Spec Vector
└── Returns: Competitor Matches Array (Parity Score, Spec Comparison Matrix)

GET  /api/v1/export/pim
├── Accepts: Part ID, Target Schema Format (akeneo | pimcore | inriver | standard)
└── Returns: Transformed PIM JSON Payload with Origin Provenance Metadata

```

---

## 🏃 Local Setup & Development

### Prerequisites

* **Node.js** >= 18.x
* **Python** >= 3.11
* **`uv`** (Python package installer) or `pip`

### 1. Backend Setup

```bash
# Clone repository
git clone https://github.com/your-org/specforge.git
cd specforge/backend

# Install dependencies using uv
uv sync

# Set environment variables
cp .env.example .env
# Configure GROQ_API_KEY, DATABASE_URL, QDRANT_URL

# Run FastAPI development server
uvicorn main:app --reload --port 8000

```

### 2. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Set environment variables
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local

# Run Next.js development server
npm run dev

```

Open [http://localhost:3000](http://localhost:3000) in your browser.
