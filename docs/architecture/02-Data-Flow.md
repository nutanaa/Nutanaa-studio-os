# Data Flow

## Purpose

This document describes how data actually moves through NUTANAA Studio OS — from a user request, through Workflow Engine and Agent Runtime, into engines and AI Providers, and out to persisted state. It ties together the module boundaries (`01-System-Modules.md`), agent and workflow lifecycles (`03`, `05`), state categories (`06`), and the plugin contract (`07`) into a single coherent picture, and is where any mismatch between those documents should surface.

## Scope

Describes data movement patterns, not transport implementation (network protocols, serialization formats — see `12-Database-Architecture.md` and `09-Plugin-Architecture.md` for those). Focuses on which module hands data to which, and through what kind of interface, consistent with the Module Communication Rule (all communication via contracts, never direct calls).

## Core Data Flow: Request to Output

A representative end-to-end flow, e.g. "generate a movie scene":

1. **Editor** captures the user's request and passes it to **Workflow Engine** as a workflow trigger.
2. **Workflow Engine** transitions the workflow from Defined → Queued → Running (per `05-Workflow-LifeCycle.md`), and for each step, spawns or signals an **Agent Runtime** instance.
3. **Agent Runtime** initializes an agent (Created → Initializing → Running, per `03-Agent-LifeCycle.md`), which calls out to **AI Providers** via the Universal Provider Interface (per `04-Provider-Interfaces.md`) for generation tasks (e.g. `GenerateVideo`, `GenerateText`).
4. Generated output flows to the relevant engine — **Character Engine**, **Asset Engine**, **Movie Engine**, or **Render Engine** — for domain-specific processing (e.g. Movie Engine assembling generated clips into a timeline).
5. Any data that must survive beyond this operation (character state, generated assets, workflow progress) is written to **Memory** as Persistent or Shared State (per `06-State-Management.md`), never held only in an engine's working memory.
6. If a step is configured to require sign-off, Workflow Engine transitions to Awaiting Approval, signaling the agent into Waiting, and data flow pauses until a human resumes it.
7. On completion, output flows back through Workflow Engine to Editor for presentation, with the underlying data already persisted in Memory rather than passed as the sole copy through the return path.

## Data Flow Principles

- **No module reads another module's internal state directly.** All data crossing a module boundary does so through a declared contract/interface (per the Module Communication Rule in `01-System-Modules.md`), even if that means an extra hop through Memory rather than a shortcut.
- **State-bearing data always lands in Memory before it is considered durable.** An engine's working copy during active processing is Runtime State (per `06`) and is not authoritative — the version in Memory is.
- **Shared data (e.g. character attributes) flows through its owning module, not around it.** Movie Engine reads character state from Memory but does not write it directly; updates flow back through Character Engine, consistent with the Shared State rule in `06-State-Management.md`.
- **Plugin-originated data follows the same rules as core module data.** A plugin registered via Plugin Manager (per `07-Plugin-System.md`) that contributes data to a workflow does so through the same contract interfaces — it does not get a privileged shortcut into Memory or another engine.

## Data Flow Across Approval Gates

When a workflow pauses at an approval gate (per `05-Workflow-LifeCycle.md`), any data produced up to that point is persisted to Memory before the pause — not held in the agent's transient Runtime State. This ensures that if the system restarts while awaiting approval, no in-flight data is lost; the workflow resumes by reading its last persisted state rather than recomputing.

## Error and Failure Data Flow

- When a step fails (per `05`'s error handling), the failure reason and the data available at the point of failure are persisted to Memory, not discarded — this is what QA Engine consumes for diagnostics (per `01-System-Modules.md`'s QA Engine responsibilities).
- A Failed agent or workflow does not silently drop partial output; partial results remain in Memory, versioned, so a retry or manual recovery can reference what was already produced (per Engineering Principle #16).

## Cross-Cutting Data: Logging and Events

- Every data-flow transition described above is logged (per Engineering Principle #11), independent of whether the operation succeeds. Logging is a cross-cutting concern that observes data flow without participating in it — modules do not modify their behavior based on what is logged.
- Event emission (e.g. "workflow entered Awaiting Approval," "agent failed") is a separate, lighter-weight channel from the primary data flow described above, allowing other modules (Editor, QA Engine) to react without being in the direct data path. The event contract itself is defined in `08-Event-System.md`.

## Responsibilities Boundary

This document does not assign new responsibilities to any module — it only describes the sequencing and direction of data already defined by each module's boundaries in `01-System-Modules.md`. If a data flow described here appears to require a module to do something outside its "Does NOT do" boundary from `01`, that is a conflict to resolve in `01`, not an exception to carve out here.

## Future Work

- Define data flow for multi-agent parallel branches within a single workflow (referenced as open in `05-Workflow-LifeCycle.md`'s Future Work).
- Define data flow for real-time/streaming outputs (e.g. live preview in Editor) versus the batch-style flow described above.