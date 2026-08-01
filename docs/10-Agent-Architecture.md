# Agent Architecture

## Purpose
Provides a high-level overview of agents within NUTANAA Studio OS. Detailed lifecycle states and transitions are defined in `docs/architecture/03-Agent-LifeCycle.md` and `docs/specifications/01-Agent-Specification.md` — this document does not repeat that detail.

## Scope
Conceptual overview of agent types, responsibilities, communication, execution, lifecycle, and monitoring.

## Audience
Contributors, agent developers, product stakeholders.

## Agent Types
Agents are categorized by the task domain they operate in — e.g. scene-generation agents, character-behavior agents, review/QA agents — but all share the same lifecycle contract managed by Agent Runtime regardless of type.

## Responsibilities
An agent executes a bounded unit of work assigned by Workflow Engine, calling AI Providers via the UPI as needed, and reporting its outcome back through the defined lifecycle states.

## Communication
Agents never call other modules directly; all communication occurs through Agent Runtime and the contract interfaces defined in `docs/architecture/01-System-Modules.md`'s Module Communication Rule.

## Execution
Per `docs/architecture/03-Agent-LifeCycle.md`, an agent moves Created → Initializing → Running, optionally pausing at Waiting (for approval or a dependency) or Suspended (system-driven), before reaching a terminal state (Completed, Failed) or being explicitly Terminated.

## Lifecycle
Every lifecycle transition is persisted to Memory and emitted as an event, per `docs/architecture/06-State-Management.md` and `08-Event-System.md`, enabling full reconstruction of an agent's history for debugging and audit.

## Monitoring
QA Engine and Editor consume agent lifecycle events to surface status and diagnose failures without being on the agent's execution path, per `docs/architecture/08-Event-System.md`.

## Relationship with Other Documents
Summarizes `docs/architecture/03-Agent-LifeCycle.md`; refer there and to `docs/specifications/01-Agent-Specification.md` for implementation-level detail.

## References to Architecture
`docs/architecture/03-Agent-LifeCycle.md`, `05-Workflow-LifeCycle.md`, `08-Event-System.md`.

## References to Specifications
`docs/specifications/01-Agent-Specification.md`.

## Future Evolution
New agent types are added without changing the core lifecycle contract.

## Document Ownership
Chief Architect / Agent Runtime Owner.

## Version Information
Version 1.0.

## Change Management
Lifecycle changes require an ADR per `16-Decisions.md` given downstream dependencies in Workflow Engine and QA Engine.
