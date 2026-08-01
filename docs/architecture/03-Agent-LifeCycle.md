# Agent Lifecycle

## Purpose

This document defines how an agent is created, executed, monitored, and terminated within Agent Runtime. It is the reference for every module that spawns, observes, or depends on agent state — primarily Workflow Engine, Memory, and QA Engine.

## Scope

Applies to all agents running inside Agent Runtime, regardless of which AI Provider backs them. Does not define agent *behavior* or *reasoning* (that is provider-specific, governed by the Universal Provider Interface) — only the lifecycle states and transitions that Agent Runtime itself is responsible for managing.

## Lifecycle States

An agent exists in exactly one of the following states at any time:

1. **Created** — Agent instance has been registered with Agent Runtime but has not yet started. Configuration and parameters are set; no resources have been allocated for execution.
2. **Initializing** — Agent Runtime is allocating resources (memory, provider connections) required for the agent to run. No agent logic executes yet.
3. **Running** — Agent is actively executing, processing input, and may be calling AI Providers via the UPI.
4. **Waiting** — Agent is paused, awaiting external input — either a human approval step (per Engineering Principle #13) or a dependency from another module (e.g. Workflow Engine, Memory).
5. **Suspended** — Agent execution has been paused by the system (not by the agent itself), typically for resource reallocation or priority handling. State is preserved; execution can resume later.
6. **Completed** — Agent finished its task successfully. Final output has been produced and handed off.
7. **Failed** — Agent terminated due to an unrecoverable error. Failure reason is logged (per Engineering Principle #11).
8. **Terminated** — Agent was explicitly stopped before completion, either by a human, a workflow cancellation, or a system shutdown.

## State Transitions

```
Created → Initializing → Running
Running → Waiting → Running          (resumes after input/approval received)
Running → Suspended → Running        (resumes after system reallocation)
Running → Completed                  (success)
Running → Failed                     (unrecoverable error)
Any state (except Completed/Failed) → Terminated  (explicit stop)
```

Rules:
- An agent cannot skip **Initializing** — resource allocation always happens before execution, even if it completes instantly.
- **Completed** and **Failed** are terminal states. An agent cannot re-enter **Running** from either; a new agent instance must be created to retry.
- **Terminated** can be reached from any non-terminal state, but never from **Completed** or **Failed** (they are already terminal).
- Transition into **Waiting** must always specify what it is waiting for (an approval gate, a workflow signal, or a data dependency), so Workflow Engine and any monitoring tooling can display accurate status.

## Human Approval Integration

Per Engineering Principle #13 ("Human approval can be inserted at any workflow stage"), any transition out of **Running** into **Waiting** may represent a human approval gate. Agent Runtime does not decide when approval is required — that is defined by the workflow configuration in Workflow Engine. Agent Runtime's responsibility is only to correctly pause, preserve state, and resume once Workflow Engine signals the gate has been cleared.

## State Persistence

Agent state must be persisted to Memory at every transition, not only at terminal states. This ensures:
- A **Suspended** or **Waiting** agent can be resumed correctly even after a system restart.
- QA Engine and monitoring tools can reconstruct an accurate history of any agent's lifecycle for debugging.
- Failure diagnostics have a full transition trail leading up to a **Failed** state, not just the final error.

## Responsibilities Boundary

**Agent Runtime is responsible for:**
- Enforcing valid state transitions (rejecting invalid ones, e.g. Completed → Running)
- Allocating and releasing resources at Initializing and terminal states
- Persisting state transitions to Memory
- Emitting lifecycle events for other modules to observe

**Agent Runtime is NOT responsible for:**
- Deciding *when* an agent should pause for approval (Workflow Engine's job)
- Interpreting *why* an agent failed at a business-logic level (QA Engine's job, using the logged transition trail)
- Storing the agent's actual working data/context long-term (Memory's job — Agent Runtime only triggers the persistence, it doesn't own the storage)

## Future Work

- Define timeout behavior for agents stuck in **Waiting** beyond a configurable threshold.
- Define priority rules for which agents get suspended first under resource pressure.