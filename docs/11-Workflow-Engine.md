# Workflow Engine

## Purpose
Provides a high-level overview of the Workflow Engine's role. Detailed lifecycle states, transitions, and approval-gate mechanics are defined in `docs/architecture/05-Workflow-LifeCycle.md` and `docs/specifications/03-Workflow-Specification.md` — this document does not repeat that detail.

## Scope
Conceptual overview of workflow concepts, graph structure, execution, parallelism, human approval, and recovery.

## Audience
Contributors, workflow authors, product stakeholders.

## Workflow Concepts
A workflow is a defined sequence of steps, potentially spanning multiple agents and modules, that accomplishes a creative production task end to end (e.g. "generate and assemble a scene").

## Workflow Graph
Workflows are authored as a graph of steps with dependencies and optional branches, validated for structural correctness (e.g. no cycles) before execution, per the Workflow Builder requirement `FR-WFB-02` in `03-Functional-Requirements.md`.

## Execution
Workflow Engine sequences step execution, spawning or signaling agents via Agent Runtime for each step, per `docs/architecture/05-Workflow-LifeCycle.md`.

## Parallelism
A workflow may contain parallel branches; the overall workflow state reflects the least-advanced branch. Detailed rules: `docs/architecture/05-Workflow-LifeCycle.md`.

## Human Approval
Per Engineering Principle #13, any step may be configured to require human approval. Workflow Engine — not the agent — decides when a gate is triggered and signals Agent Runtime accordingly.

## Recovery
Failed steps follow a configurable retry policy; if retries are exhausted, the workflow transitions to Failed unless the step is marked non-critical. Full detail: `docs/architecture/05-Workflow-LifeCycle.md`.

## Relationship with Other Documents
Summarizes `docs/architecture/05-Workflow-LifeCycle.md`; refer there and to `docs/specifications/03-Workflow-Specification.md` for implementation-level detail.

## References to Architecture
`docs/architecture/05-Workflow-LifeCycle.md`, `03-Agent-LifeCycle.md`, `08-Event-System.md`.

## References to Specifications
`docs/specifications/03-Workflow-Specification.md`.

## Future Evolution
Support for fan-out parallel agent branches with partial-failure reconciliation is tracked as future work in `docs/architecture/05-Workflow-LifeCycle.md`.

## Document Ownership
Chief Architect / Workflow Engine Owner.

## Version Information
Version 1.0.

## Change Management
Changes to approval-gate semantics require ADR per `16-Decisions.md` given Security implications in `13-Security.md`.
