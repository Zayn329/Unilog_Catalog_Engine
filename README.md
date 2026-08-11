# Unilog Catalog Engine

AI-assisted industrial catalog extraction, validation, enrichment, and
human-in-the-loop review system.

## Project Goal

Transform vendor product documents into structured, validated, evidence-backed
catalog data while maintaining provenance, deterministic validation, and
human review controls.

## Architecture

The system is built around an evidence-first LangGraph pipeline:

Parser
→ Category Agent
→ Extractor Agent
→ Normalizer Agent
→ Validator Agent
→ Enricher Agent
→ Critic Agent
→ Confidence Router
→ Publication / Review

Human reviewers interact with the Review Workbench for products requiring
manual validation or correction.

## Repository Structure

```text
specs/          Product, architecture, UI, evaluation, and BDD specifications
data/           Taxonomy, deterministic rules, units, schemas, and benchmarks
.agents/        Agent skills and development guardrails
app/            Backend implementation
frontend/       Review Workbench implementation
tests/          Unit and integration tests
docs/           Sprint status and project documentation