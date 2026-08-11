# Meta-Tool: STRIDE Threat Modeling for Unilog Catalog Engine

## Purpose
This tool/specification guides threat modeling for ingestion pipeline updates, file upload endpoints, and state mutation boundaries, using the STRIDE framework.

## Threat Analysis Matrix for Catalog Engine

| Threat Category | System Component | Potential Attack Vector | Mitigating Safeguard / Invariant |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Review Workbench API | Forging human review session tokens to bypass manual queue. | Strict JWT authentication and role-based access control (RBAC) on FastAPI routes. |
| **Tampering** | Gate 8 Human Lock | Modifying locked attribute state directly in PostgreSQL storage. | SHA-256 canonical state hashing (`locked_state_hash`) verified prior to any graph write. |
| **Repudiation** | Human Audit Logs | Denying responsibility for manual attribute edits or overrides. | Immutable `AuditLog` table capturing `user_id`, timestamp, previous/new values, and mandatory reason codes. |
| **Information Disclosure** | Vector Database (Qdrant) | Exposing internal competitor similarity embeddings via public API endpoints. | Isolate Qdrant queries to internal microservice boundary; never expose raw vector indices directly to frontend. |
| **Denial of Service** | Parser Agent | Uploading a maliciously crafted, deeply nested, or infinite-loop PDF bomb. | Strict per-page execution timeout ($< 30\text{ seconds}$) and isolated container sandboxing for `Docling`. |
| **Elevation of Privilege** | Agent Tool Execution | Injecting malicious instructions via vendor PDF text to force tools to run arbitrary code. | **Instruction & Data Separation:** Untrusted PDF text is treated purely as data arrays; system prompts and tool bindings cannot be altered by input text. |