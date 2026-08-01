# Event System

## Purpose

This document defines the event channel referenced by `05-Workflow-LifeCycle.md` and `02-Data-Flow.md` as the lightweight mechanism for modules to observe what's happening elsewhere in the system without being in the primary data path. It gives Editor, QA Engine, and other observers a way to react to state changes (e.g. "workflow entered Awaiting Approval," "agent failed") without polling or being directly coupled to the module that raised them.

## Scope

Covers event emission, subscription, and delivery semantics. Does not cover the primary data flow between modules (see `02-Data-Flow.md`) — events are for *observation*, not for passing the actual working data a module depends on to do its job. A module must never rely on an event alone to receive data it needs to function; it must go through the proper contract interface for that.

## Why Events Are Separate From Data Flow

Per `02-Data-Flow.md`: "Event emission is a separate, lighter-weight channel from the primary data flow... allowing other modules to react without being in the direct data path." This separation matters because:
- Observers (Editor showing a progress indicator, QA Engine logging a failure) should not be able to block or slow down the module doing the actual work by being on its critical path.
- A module emitting an event does not need to know who, if anyone, is listening — this keeps modules decoupled per Engineering Principle #1 and #9 (modular, with public interfaces).

## Event Structure

Every event carries:
- **type** — a namespaced identifier (e.g. `workflow.awaiting_approval`, `agent.failed`, `asset.created`)
- **source** — which module emitted it
- **timestamp** — when it occurred
- **subject_id** — the identifier of the entity the event concerns (workflow id, agent id, asset id)
- **payload** — a small amount of context relevant to the event (e.g. the failure reason for `agent.failed`); not the full working data

## Emission Rules

- A module may only emit events for state transitions it owns (per the Responsibilities Boundary in `01-System-Modules.md`). Workflow Engine emits `workflow.*` events; Agent Runtime emits `agent.*` events; Plugin Manager emits `plugin.*` events, and so on.
- Every lifecycle state transition defined in `03-Agent-LifeCycle.md` and `05-Workflow-LifeCycle.md` corresponds to an event emission — the event system does not define new states, only surfaces the ones already defined there.
- Emitting an event is fire-and-forget from the emitting module's perspective — it does not wait for or depend on subscriber acknowledgment, preserving the "lighter-weight channel" property.

## Subscription Rules

- Modules subscribe to event types they care about, not to specific source modules — this keeps subscribers decoupled from which module happens to emit a given event type today.
- A subscriber failing to process an event must never affect the emitting module or any other subscriber. Subscriber failures are isolated and logged (per Engineering Principle #11), not propagated upstream.
- Plugins (per `07-Plugin-System.md`) may subscribe to events as one of their declared capabilities, but may not emit events on behalf of a core module — only events under their own plugin-scoped namespace.

## Delivery Guarantees

- Events are delivered at-least-once. Subscribers must be able to handle receiving the same event more than once without incorrect behavior (idempotent handling).
- Event delivery is not guaranteed to be strictly ordered across different subject_ids, but is ordered for events sharing the same subject_id (e.g. a given workflow's events arrive in the order they were emitted).
- The event system does not persist long-term event history itself — anything that needs to be queryable later (e.g. full agent lifecycle trail for QA Engine) is written to Memory as Persistent State per `06-State-Management.md`; the event system only handles live delivery.

## Responsibilities Boundary

**Event System is responsible for:**
- Reliable at-least-once delivery of events from emitters to subscribers
- Isolating subscriber failures from emitters and other subscribers
- Providing the subscription mechanism modules and plugins use to register interest

**Event System is NOT responsible for:**
- Persisting event history long-term (Memory's job, per `06-State-Management.md`)
- Carrying the actual working data a module needs to function (that's the primary data flow, per `02-Data-Flow.md`)
- Defining what lifecycle states exist (Agent Runtime and Workflow Engine own that, per `03` and `05`) — it only surfaces their transitions as events

## Future Work

- Define the exact namespacing convention for plugin-emitted event types to avoid collisions with core event types.
- Define whether a replay/catch-up mechanism is needed for subscribers that were offline when an event was emitted, or whether Memory-backed state queries are sufficient for that case.