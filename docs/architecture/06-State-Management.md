# State Management

## Purpose

The last three documents (`03-Agent-LifeCycle.md`, `04-Provider-Interfaces.md`, `05-Workflow-LifeCycle.md`) each referred to "state" loosely — agent state, workflow state, system state. This document defines what state actually means across NUTANAA Studio OS, who owns each category, and how it is persisted, so no two modules independently reinvent state handling.

## Scope

Applies to every module that holds data which must survive beyond a single operation — i.e. anything that isn't purely computed fresh each time. Does not define the storage mechanism itself (databases, file formats) — that belongs in `12-Database-Architecture.md`. This document defines the conceptual model of state ownership and boundaries.

## State Categories

1. **Runtime State** — Transient, in-memory data needed only while a process is actively executing (e.g. an agent's current step, a workflow's current branch pointer). Lost on crash unless explicitly persisted.
2. **Persistent State** — Data that must survive restarts: agent lifecycle history, workflow progress, completed outputs, configuration. Always written through Memory.
3. **Session State** — Data scoped to a single user session (editor preferences, active project context). Not shared across sessions, but may still be persisted to resume later.
4. **Shared State** — Data accessible across multiple modules or agents simultaneously (e.g. character consistency data referenced by both Character Engine and Movie Engine, per Engineering Principle #15). Requires explicit synchronization rules to avoid conflicting writes.

## Ownership Rules

- **Studio Kernel** coordinates runtime state access between modules (mediating reads/writes through contracts, per the Module Communication Rule) but does not own or store state itself.
- **Memory** is the sole owner of persistent, session, and shared state storage. No other module writes state directly to a backing store — all persistence flows through Memory's interface.
- **Agent Runtime** and **Workflow Engine** own the *meaning* of their respective state machines (defined in `03` and `05`) but delegate actual storage to Memory.
- Engines (Movie, Character, Asset, Render, QA) treat their working data as Runtime State during active processing, and hand off to Memory for anything that must persist past the operation (e.g. a rendered asset, a character's evolved traits).

## Character Consistency as State

Per Engineering Principle #15 ("Character consistency is treated as project state"), a character's defining attributes are Shared State, not owned by any single engine. Character Engine is the authority that *updates* this state, but Movie Engine, QA Engine, and any other consumer read it through Memory rather than caching their own copy — preventing two engines from holding diverging versions of the same character.

## Shared State Synchronization

Because Shared State can be written by more than one consumer path, the following rules apply:
- Writes to Shared State must go through the owning module's interface (e.g. character attribute changes go through Character Engine, not written directly by Movie Engine even though Movie Engine reads them).
- Memory is responsible for surfacing write conflicts (e.g. two workflows attempting to update the same character simultaneously) rather than silently overwriting — per Engineering Principle #16, assets and state are versioned, not overwritten.
- Readers of Shared State should treat it as eventually consistent unless a module explicitly requests a strongly consistent read for a critical operation (e.g. before final render).

## State and Versioning

Per Engineering Principle #16 ("Assets are never overwritten; version them instead"), the same rule applies to Persistent and Shared State: state changes are recorded as new versions, not in-place mutations. This gives:
- Full history for QA Engine to trace how a workflow or agent reached a given outcome.
- Rollback capability if a state change produces an unwanted result.
- Auditability, consistent with Engineering Principle #11 ("Every action is logged").

## Responsibilities Boundary

**Memory is responsible for:**
- Storing and versioning all Persistent, Session, and Shared State
- Surfacing write conflicts on Shared State
- Providing retrieval and query interfaces for state history

**Memory is NOT responsible for:**
- Deciding what counts as a valid state transition (that belongs to the owning module — Agent Runtime, Workflow Engine, or Character Engine)
- Interpreting the meaning of state data (Memory stores and retrieves; it does not reason about content)

**Studio Kernel is responsible for:**
- Mediating access requests to state on behalf of modules, according to communication contracts

**Studio Kernel is NOT responsible for:**
- Storing state itself
- Resolving Shared State conflicts (Memory's job)

## Future Work

- Define the exact conflict-resolution strategy for simultaneous Shared State writes (last-write-wins vs. merge vs. reject).
- Define retention/pruning policy for versioned state history so it doesn't grow unbounded.