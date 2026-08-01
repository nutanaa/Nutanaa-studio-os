# Decisions

## Purpose
Establishes the Architectural Decision Record (ADR) system used to track significant decisions across NUTANAA Studio OS.

## Scope
Decision process, template, lifecycle, and categorization. Individual decisions are recorded as entries within this document or as linked ADR files, per project convention.

## Audience
Contributors and reviewers proposing or evaluating significant architectural, technology, or process changes.

## Decision Process
A significant decision (one affecting architecture, technology choice, repository structure, security posture, deployment topology, provider strategy, workflow semantics, plugin contract, or performance trade-offs) is proposed as an ADR before implementation, reviewed, and recorded regardless of outcome.

## Decision Lifecycle
Proposed → Under Review → Accepted / Rejected → (later) Deprecated / Superseded.

## Decision Template
```
## ADR-NNN: <Title>
Status: Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-XXX
Date: YYYY-MM-DD
Context: <what problem or question prompted this decision>
Decision: <what was decided>
Consequences: <what this enables, what it constrains, trade-offs accepted>
```

## Status Tracking
Each ADR's status is updated in place as it moves through its lifecycle; superseded ADRs remain in the record with a pointer to the superseding decision, never deleted.

## Decision Categories
- Architecture Decisions
- Technology Decisions
- Repository Decisions
- Security Decisions
- Deployment Decisions
- AI Provider Decisions
- Workflow Decisions
- Plugin Decisions
- Performance Decisions

## Rejected Decisions
Rejected proposals remain recorded with their context and reasoning, to avoid re-litigating the same question without new information.

## Deprecated Decisions
A decision superseded by a later one is marked Deprecated/Superseded, with a reference to the new ADR, preserving history per Engineering Principle #16's "never overwrite" philosophy applied to decision records.

## Decision Review Process
Proposed ADRs are reviewed by the relevant owner (Chief Architect for architecture/technology; Security Owner for security decisions; etc.) before acceptance.

## Decision Approval Process
Acceptance requires explicit sign-off recorded in the ADR's Status field; significant decisions affecting Engineering Principle #19 (repository structure) require the same architectural approval process referenced there.

## Relationship with Other Documents
Referenced from every other project document wherever a change requires justification and traceability (e.g. licensing choice in `02-Business-Goals.md`, folder structure change in `08-Repository-Standards.md`).

## References to Architecture
Any `docs/architecture/` document may be the subject of an ADR when a structural change is proposed.

## References to Specifications
Any `docs/specifications/` document may be the subject of an ADR when detailed runtime behavior changes materially.

## Future Evolution
As the ADR log grows, individual ADRs may be moved to dedicated files under a `docs/decisions/` folder while retaining the index and template here.

## Document Ownership
Chief Architect.

## Version Information
Version 1.0.

## Change Management
This document's process itself is subject to the same ADR process it defines, for any change to the process.
