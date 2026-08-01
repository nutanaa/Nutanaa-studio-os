# Glossary

## Purpose
Provides authoritative definitions for terms used across NUTANAA Studio OS documentation, ensuring consistent terminology.

## Scope
Alphabetical definitions. Where a term is defined in detail elsewhere, this entry summarizes and cites that source.

## Audience
All contributors, AI coding agents, and stakeholders.

## Definitions

**Agent** — A unit of autonomous execution managed by Agent Runtime, following the lifecycle defined in `docs/architecture/03-Agent-LifeCycle.md`.

**API** — The REST API module exposing system functionality to external systems, per `docs/architecture/01-System-Modules.md`.

**Asset** — A digital resource (image, video, audio, model) managed by Asset Engine and versioned per Engineering Principle #16.

**Asset State** — The persisted, versioned representation of an asset's current and historical form, per `docs/architecture/06-State-Management.md`.

**Autonomous Mode** — A workflow execution mode with no mandatory human approval gates configured, as opposed to Human-in-the-loop mode.

**Character** — A defined creative entity with consistent visual and behavioral identity across scenes, managed by Character Engine.

**Character DNA** — The core set of defining attributes that establish a character's consistent identity, treated as Shared State per Engineering Principle #15.

**Checkpoint** — A persisted point in a workflow or agent's execution from which it can be resumed or rolled back.

**Creative Engine** — Collective term for the domain engines (Movie, Character, Asset, Render, QA) that perform creative production work.

**Emotion** — A character behavioral parameter influencing expression and animation output.

**Episode** — A single installment within a Series.

**Event Bus** — The mechanism underlying the Event System (`docs/architecture/08-Event-System.md`) that delivers lifecycle events to subscribers.

**Expression** — A character's facial/emotional state at a given point in a scene.

**Human Approval** — A workflow mechanism, per Engineering Principle #13, allowing a human to review and approve a step before execution continues.

**Lip Sync** — The alignment of character mouth movement to an audio track, a Universal Provider Interface capability (`LipSync()`).

**Marketplace** — The module responsible for plugin/asset discovery, distribution, and review, per `docs/architecture/01-System-Modules.md`.

**Metadata** — Structured descriptive data about a project, asset, character, or scene, distinct from the binary content itself.

**Movie** — A completed long-form creative output assembled by Movie Engine.

**Pose** — A character's physical positioning at a point in time, used in animation.

**Project** — The top-level container for a creative work, holding scenes, characters, assets, and workflow history.

**Project State** — The complete persisted state of a project, per `docs/architecture/06-State-Management.md` and `docs/specifications/05-Project-State.md`.

**Prompt** — A text or structured input provided to an AI Provider to generate content.

**Provider** — An AI service implementing the Universal Provider Interface, per `docs/architecture/04-Provider-Interfaces.md`.

**Provider Adapter** — The implementation layer translating a specific AI vendor's API into the UPI contract.

**Render Queue** — The ordered set of pending rendering jobs processed by Render Engine.

**Review Pipeline** — The workflow stage(s) where generated output is reviewed, either by QA Engine automated checks or human approval.

**Rollback** — Reverting a module, deployment, or state change to a previous version, per Engineering Principle #16.

**Runtime** — The executing environment provided by Studio Kernel and Agent Runtime in which agents and workflows operate.

**Scene** — A discrete creative unit within a project, composed of characters, assets, and generated content, managed via Scene Manager.

**Scene State** — The persisted state of a scene's composition and generation history.

**SDK** — The Software Development Kit enabling third-party plugin and provider development.

**Sequence** — An ordered group of scenes within a movie or episode.

**Series** — A multi-episode creative work.

**Shot** — A single continuous camera take within a scene.

**Story** — The narrative content underlying a creative work, prior to scene breakdown.

**Storyboard** — A visual/textual pre-production plan for a scene or sequence.

**Task** — A discrete unit of work assigned to an agent within a workflow step.

**Timeline** — The ordered arrangement of scenes/clips within the Editor, per Functional Requirement `FR-EDT-01`.

**Version** — A specific, immutable snapshot of an asset, state, plugin, or provider, per the versioning requirements in Engineering Principle #16.

**Workflow** — A defined, orchestrated sequence of steps executed by Workflow Engine, per `docs/architecture/05-Workflow-LifeCycle.md`.

**Workflow Graph** — The structural representation of a workflow's steps, dependencies, and branches, authored in Workflow Builder.

## Relationship with Other Documents
Terms here should match usage exactly across `docs/architecture/`, `docs/specifications/`, and all project documents; discrepancies should be corrected here or in the source document, not left inconsistent.

## References to Architecture
All `docs/architecture/` documents.

## References to Specifications
All `docs/specifications/` documents.

## Future Evolution
New terms are added as they are introduced in any other document; this document should be updated in the same change that introduces a new term.

## Document Ownership
Chief Architect / Documentation Owner.

## Version Information
Version 1.0.

## Change Management
Additions follow standard PR review; redefinition of an existing term requires checking all documents using it for consistency.
