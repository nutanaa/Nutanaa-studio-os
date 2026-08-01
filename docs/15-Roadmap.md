# Roadmap

## Purpose
Provides the long-term, phased roadmap for NUTANAA Studio OS from foundational runtime through enterprise platform maturity.

## Scope
Time-phased feature groups and milestones. Does not commit to specific dates — see `20-Release-Strategy.md` for release cadence mechanics.

## Audience
Contributors, product stakeholders, prospective adopters evaluating project maturity and direction.

## Vision Timeline
Execution of the long-term vision defined in `01-Vision.md`, organized into sequential development phases.

## Development Phases

### Foundation Phase
Core architecture (`docs/architecture/`), Engineering Principles, repository scaffolding, and project documentation — largely complete as of this writing.

### Runtime Phase
Implementation of Studio Kernel, Agent Runtime, Workflow Engine, and Memory against the contracts defined in `docs/architecture/01`, `03`, `05`, `06`.

### Provider Phase
Implementation of the Universal Provider Interface and at least one local (Ollama) and one commercial provider adapter, per `docs/architecture/04-Provider-Interfaces.md`.

### Workflow Phase
Workflow Builder UI and Workflow Engine execution, including approval-gate mechanics, per `docs/architecture/05-Workflow-LifeCycle.md`.

### Project State Phase
Memory's persistence layer, versioning, and Shared State conflict handling, per `docs/architecture/06-State-Management.md` and `docs/specifications/05-Project-State.md`.

### Feature Groups (subsequent phases, roughly sequential but may overlap)
| Group | Scope |
|---|---|
| Asset Manager | Asset Engine implementation, per `docs/specifications/06-Asset-Management.md` |
| Character Manager | Character Engine and consistency-as-state, per `docs/specifications/07-Character-Management.md` |
| Scene Manager | Scene composition, per `docs/specifications/08-Scene-Management.md` |
| Creative Engine | Movie Engine assembly and timeline logic |
| Rendering Engine | Render Engine, per `docs/specifications/09-Rendering-Pipeline.md` |
| Review Engine | QA Engine and review pipeline, per `docs/specifications/10-Review-Pipeline.md` |
| Editor | Full timeline-based creative UI |
| Studio IDE | Integrated workspace tying Editor, Workflow Builder, and engines together |
| Plugin Marketplace | Discovery, distribution, and review infrastructure |
| Cloud Platform | Managed hosting and distributed rendering |
| Enterprise Platform | Compliance, SLAs, enterprise deployment tooling |
| SDK | Plugin and provider development kit |
| API | Public REST API surface |
| Automation | CLI and scripting support |
| Distributed Rendering | Multi-node render worker pool |
| Future AI Providers | Expansion of the provider ecosystem |
| Future Technologies | Adjacent creative domains (interactive/game content, live production) |

## Priority Matrix
Foundation and Runtime phases are P0; Provider and Workflow phases are P0/P1; feature-group phases are prioritized per the business strategy in `02-Business-Goals.md` and current market feedback.

## Milestones / Epics
Tracked operationally outside this document (issue tracker); this document defines the phase structure epics are organized under.

## 5-Year Vision
See `01-Vision.md`.

## 10-Year Vision
See `01-Vision.md`.

## Relationship with Other Documents
Execution plan for `01-Vision.md` and `02-Business-Goals.md`; coordinated with `20-Release-Strategy.md`.

## References to Architecture
All `docs/architecture/` documents, mapped to the phases above.

## References to Specifications
All `docs/specifications/` documents, mapped to the feature groups above.

## Future Evolution
Reviewed quarterly; phase completion criteria refined as implementation proceeds.

## Document Ownership
Chief Architect / Product Owner.

## Version Information
Version 1.0.

## Change Management
Roadmap changes follow standard PR review; major phase reordering is tracked as an ADR in `16-Decisions.md`.
