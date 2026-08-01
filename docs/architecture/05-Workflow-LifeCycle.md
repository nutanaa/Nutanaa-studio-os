# Workflow Lifecycle

## Purpose

This document defines how a workflow — a defined sequence of steps that may spawn, coordinate, and wait on multiple agents — moves through its own lifecycle within Workflow Engine. It also defines how a workflow decides when to trigger an agent-level approval gate (referenced in `03-Agent-LifeCycle.md`).

## Scope

Applies to all workflows executed by Workflow Engine, regardless of which modules or agents they coordinate. Does not define individual agent states (see `03-Agent-LifeCycle.md`) — only the orchestration layer above them.

## Relationship to Agent Lifecycle

A single workflow step may spawn one or more agents. The workflow does not micromanage an agent's internal state transitions — it only:
1. Starts an agent for a given step
2. Waits for that agent to reach a terminal-for-the-step outcome (Completed, Failed, or a defined checkpoint)
3. Decides what happens next based on that outcome

When a workflow determines a step requires human sign-off before continuing, it is Workflow Engine — not the agent itself — that issues the signal causing the agent to transition into **Waiting** (per Engineering Principle #13).

## Lifecycle States

1. **Defined** — Workflow configuration has been registered but not yet triggered.
2. **Queued** — Workflow has been triggered and is waiting for Workflow Engine to allocate execution resources.
3. **Running** — Workflow is actively executing its steps in sequence (or in parallel, where the definition allows).
4. **Awaiting Approval** — Workflow has reached a step configured to require human sign-off. Execution of this branch is paused; any agent tied to this step is signaled into **Waiting**.
5. **Awaiting Dependency** — Workflow is paused waiting on output from another module (e.g. an asset not yet available from Asset Engine) rather than a human decision.
6. **Completed** — All steps finished successfully.
7. **Failed** — A step failed in a way the workflow's error handling could not recover from.
8. **Cancelled** — Workflow was explicitly stopped before completion, by a human or a system-level shutdown.

## State Transitions

```
Defined → Queued → Running
Running → Awaiting Approval → Running     (resumes once approval granted)
Running → Awaiting Dependency → Running   (resumes once dependency resolved)
Running → Completed                       (all steps succeeded)
Running → Failed                          (unrecoverable step failure)
Any state (except Completed/Failed) → Cancelled
```

Rules:
- **Completed** and **Failed** are terminal. A workflow cannot resume from either; it must be re-triggered as a new run.
- A workflow may contain multiple parallel branches; the overall workflow state reflects the least-advanced branch (e.g. if one branch is Running and another is Awaiting Approval, the workflow as a whole is considered **Awaiting Approval** until that branch clears).
- **Cancelled** propagates to all agents currently running under that workflow — they must be signaled to transition to **Terminated** per their own lifecycle rules.

## Approval Gate Mechanics

Per Engineering Principle #13, approval gates are defined per-step in the workflow configuration, not hardcoded into any engine. A step's configuration specifies:
- Whether it requires approval at all
- Who is authorized to approve (a role, not a specific individual)
- What happens on rejection (retry the step, skip it, or fail the workflow)

When Workflow Engine reaches a gated step:
1. It transitions the workflow to **Awaiting Approval**.
2. It signals any agent tied to that step to transition to **Waiting**, specifying the approval gate as the wait reason (per `03-Agent-LifeCycle.md`).
3. On approval, it resumes the workflow and signals the agent back to **Running**.
4. On rejection, it follows the step's configured rejection behavior.

## Error Handling & Recovery

- Each step may define its own retry policy (max attempts, backoff) independent of the AI Provider-level retry/fallback defined in `04-Provider-Interfaces.md`. These are separate concerns: provider retry handles transient AI service failures; workflow-step retry handles failures in the broader step logic (e.g. a downstream module rejecting output).
- If a step exhausts its retries, the workflow transitions to **Failed** unless the step is explicitly marked as non-critical, in which case the workflow may continue past it.

## State Persistence

Workflow state, including which branch is at which step and why (approval pending, dependency pending, etc.), must be persisted to Memory at every transition — consistent with the persistence requirement in `03-Agent-LifeCycle.md`. This allows a workflow paused on approval to survive a system restart and resume exactly where it left off.

## Responsibilities Boundary

**Workflow Engine is responsible for:**
- Sequencing and branching logic between steps
- Deciding when a step requires human approval, based on configuration
- Signaling Agent Runtime to pause/resume agents at the right points
- Step-level retry and failure handling

**Workflow Engine is NOT responsible for:**
- Managing an agent's internal state machine (Agent Runtime's job)
- Executing AI inference directly (AI Providers' job, via UPI)
- Deciding *who* is authorized to approve a given role (that's an Authorization concern, defined in Security architecture)

## Future Work

- Define behavior for workflows with steps that fan out to many agents in parallel and must reconcile partial failures.
- Define a standard format for the "wait reason" signal referenced above, shared with Agent Runtime.