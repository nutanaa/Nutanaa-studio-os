# Technology Stack

## Purpose
Documents the chosen technology stack for NUTANAA Studio OS and the rationale for each major choice.

## Scope
Languages, frameworks, storage, AI tooling, frontend/desktop, containerization, and supporting infrastructure. Coding conventions within these technologies are in `07-Coding-Standards.md`.

## Audience
Engineering contributors, DevOps, plugin/provider developers.

## Languages
- **Python** (3.11+) — primary language for backend, Studio Kernel, Agent Runtime, Workflow Engine, Memory, and domain engines.
- **TypeScript** — Editor, frontend components, and any Node-based tooling.

## Frameworks
Backend services use an async-first Python web framework suited to the async I/O pattern required by AI Provider calls (per `docs/architecture/04-Provider-Interfaces.md`). Editor and frontend use a modern component-based TypeScript framework.

## Databases
A relational database for structured metadata (projects, workflows, users, plugin registry) and a document/object store for large binary assets (rendered video, generated images/audio), consistent with the storage categories in `12-Database-Architecture.md`.

## Caching
An in-memory cache layer (e.g. Redis-class technology) supports frequently accessed Shared State reads and session data, consistent with the caching responsibilities of Memory in `docs/architecture/06-State-Management.md`.

## Storage
Object storage for versioned assets, satisfying the "never overwrite, version instead" requirement (Engineering Principle #16).

## Message Queue
An event/message queue backs the Event System (`docs/architecture/08-Event-System.md`), providing at-least-once delivery for lifecycle events across modules and, where deployed distributedly, across nodes.

## AI Frameworks
Local inference via Ollama for on-device models; provider adapters for commercial APIs (OpenAI, Anthropic, ElevenLabs, etc.) implemented against the Universal Provider Interface, per `docs/architecture/04-Provider-Interfaces.md`.

## Vector Database
A vector store supports the `Embedding()` UPI method and semantic search/retrieval use cases (e.g. prompt library, asset search).

## Frontend
TypeScript-based component framework for the Editor's web/desktop surfaces, styled and structured consistent with accessibility requirements in `04-NonFunctional-Requirements.md`.

## Desktop
The Editor may be packaged as a desktop application for local-first usage, wrapping the same frontend codebase.

## Containerization
Docker for Staging/Production packaging of services; container images built per module boundary to preserve independent deployability (Engineering Principle #18). Detailed deployment topology: `14-Deployment.md`.

## CI/CD
Automated pipelines run linting, formatting checks, and the test suite (per `07-Coding-Standards.md` and `18-Testing-Strategy.md`) on every pull request, and handle build/release automation per `20-Release-Strategy.md`.

## Testing
pytest for Python; a corresponding TypeScript test framework for frontend/Editor code. Full strategy: `18-Testing-Strategy.md`.

## Monitoring
Metrics and health data derived from the Event System and structured logs, feeding operational dashboards per `14-Deployment.md`.

## Logging
Structured logging across all modules, consistent with Engineering Principle #11 (every action is logged).

## Relationship with Other Documents
Implements the technology choices referenced generically throughout `docs/architecture/`; detailed coding conventions in `07-Coding-Standards.md`.

## References to Architecture
`docs/architecture/04-Provider-Interfaces.md`, `06-State-Management.md`, `08-Event-System.md`, `10-Deployment.md`.

## References to Specifications
`docs/specifications/02-Provider-Specification.md` for provider integration detail.

## Future Evolution
Stack additions (e.g. new provider frameworks) are tracked as ADRs in `16-Decisions.md`.

## Document Ownership
Chief Architect / Technology Lead.

## Version Information
Version 1.0.

## Change Management
Material stack changes require an ADR and architecture review.
