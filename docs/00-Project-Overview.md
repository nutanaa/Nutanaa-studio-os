# Project Overview

## Purpose
This document provides the single entry point for understanding NUTANAA Studio OS: what it is, what it does, how the repository is organized, and how the documentation set fits together. It is the recommended first read for any new contributor or AI coding agent.

## Scope
Covers the executive summary, project goals, product scope, target users, and a map of the repository and documentation hierarchy. Does not contain implementation detail — see docs/architecture/ and docs/specifications/ for that.

## Audience
Contributors, maintainers, AI coding agents, technical stakeholders, and prospective adopters evaluating the project.

## Executive Summary
NUTANAA Studio OS is an enterprise-grade, modular, AI-native Creative Operating System capable of autonomously producing movies, web series, TV shows, anime, advertisements, games, music videos, podcasts, educational content, reels, shorts, and future digital media formats. It is built around a strict contract-based architecture in which every AI provider, agent, and workflow is replaceable, and every module communicates through defined interfaces rather than direct calls.

## Vision Summary
NUTANAA Studio OS aims to be the operating system layer for AI-driven creative production — local-first, provider-agnostic, and equally usable by an individual creator on a laptop or an enterprise studio running distributed rendering at scale. Full detail is in `01-Vision.md`.

## Project Goals
- Deliver a modular runtime where any module, agent, or provider can be replaced without touching the rest of the system.
- Support the full spectrum from fully local, offline operation to distributed, cloud-scale enterprise deployment.
- Provide a plugin marketplace and SDK that let third parties extend the platform safely.
- Keep human approval available at any workflow stage, without requiring it.

## Product Scope
NUTANAA Studio OS covers the full creative production lifecycle: ideation, scripting, character and asset management, scene generation, rendering, review, and export/distribution. It includes a Studio (orchestration layer), Editor (user interface), Workflow Builder, and a set of specialized engines (Movie, Character, Asset, Render, QA). Out of scope: distribution/publishing to third-party platforms beyond export, and content ownership/rights management beyond basic licensing metadata (see `02-Business-Goals.md` for licensing strategy).

## Target Users
- Independent creators producing short-form and long-form content
- Small studios needing a local-first, cost-controlled production pipeline
- Enterprises requiring distributed, auditable, compliant production infrastructure
- Plugin and provider developers extending the platform through the SDK

## Repository Overview
The repository is organized around top-level functional folders (`agents/`, `backend/`, `editor/`, `frontend/`, `movie-engine/`, `plugins/`, `sdk/`, `workflow/`, `database/`, `tests/`, `tools/`, `scripts/`, `packages/`, `assets/`), each aligned to a module boundary defined in `docs/architecture/01-System-Modules.md`. Documentation lives under `docs/`, split into project-level documents (this file and its siblings), `docs/architecture/` (system design), and `docs/specifications/` (detailed runtime behavior of specific subsystems: agents, providers, workflows, plugins, project state, assets, characters, scenes, rendering, and review).

## Documentation Hierarchy
1. **Project documents** (`docs/00` through `docs/20`) — the "why" and "how we work": vision, goals, requirements, standards, process.
2. **Architecture documents** (`docs/architecture/`) — the "what": module boundaries, contracts, lifecycles, state, events, security, deployment model.
3. **Specification documents** (`docs/specifications/`) — the "exact behavior": detailed runtime specification for Agents, Providers, Workflows, Plugins, Project State, Assets, Characters, Scenes, Rendering, and Review.

Project documents reference architecture and specification documents rather than duplicating their content.

## Architecture Hierarchy
See `docs/architecture/01-System-Modules.md` for the full module tree and dependency graph. In summary: Studio Kernel (foundation) → Agent Runtime / Plugin Manager → Workflow Engine / AI Providers / Memory → domain engines (Character, Asset, Movie, Render, QA) → user-facing and integration layers (Editor, Marketplace, SDK, REST API).

## Development Lifecycle
Local Development → Staging → Production, as defined in `docs/architecture/10-Deployment.md` and expanded operationally in `14-Deployment.md`. Features move through this lifecycle behind version control and code review defined in `08-Repository-Standards.md` and `19-Contributing.md`.

## Module Overview
| Module | Responsibility Summary | Reference |
|---|---|---|
| Studio Kernel | Foundational runtime services | `architecture/01-System-Modules.md` |
| Agent Runtime | Agent execution and lifecycle | `architecture/03-Agent-LifeCycle.md` |
| Workflow Engine | Multi-step process orchestration | `architecture/05-Workflow-LifeCycle.md` |
| Plugin Manager | Plugin registration and isolation | `architecture/07-Plugin-System.md` |
| AI Providers | Provider-agnostic AI access (UPI) | `architecture/04-Provider-Interfaces.md` |
| Memory | State storage and versioning | `architecture/06-State-Management.md` |
| Movie / Character / Asset / Render / QA Engines | Domain-specific production logic | `architecture/01-System-Modules.md` |
| Editor / Marketplace / SDK / REST API | User-facing and integration surfaces | `architecture/01-System-Modules.md` |

## Folder Overview
| Folder | Purpose |
|---|---|
| `agents/` | Agent implementations |
| `backend/` | Core services (Studio Kernel, Workflow Engine, Memory, etc.) |
| `editor/` | Editor application code |
| `frontend/` | Shared frontend components |
| `movie-engine/` | Movie Engine implementation |
| `plugins/` | First-party and reference plugins |
| `sdk/` | Plugin/provider development kit |
| `workflow/` | Workflow Engine implementation |
| `database/` | Database schemas and migrations |
| `tests/` | Automated test suites |
| `tools/`, `scripts/` | Development and operational tooling |
| `packages/` | Shared internal packages |
| `assets/` | Static and reference assets |

## Technology Overview
Primary implementation language is Python, with TypeScript for frontend/Editor surfaces. Full stack detail is in `06-Technology-Stack.md`.

## Implementation Roadmap
See `15-Roadmap.md` for the phased roadmap from Foundation through Enterprise Platform.

## Relationship with Other Documents
This document is the index; every other project document expands one section of it in depth.

## References to Architecture
`docs/architecture/01-System-Modules.md`, and all other architecture documents as noted above.

## References to Specifications
`docs/specifications/00-Specification-Overview.md` for the index of detailed runtime specifications.

## Future Evolution
As new modules or major subsystems are added, this document's Module Overview and Folder Overview tables must be updated in the same change.

## Document Ownership
Chief Architect role, per `docs/ENGINEERING_PRINCIPLES.md`.

## Version Information
Version 1.0 — initial enterprise documentation pass.

## Change Management
Changes to this document follow the standard pull request and architecture review process defined in `19-Contributing.md` and `08-Repository-Standards.md`.
