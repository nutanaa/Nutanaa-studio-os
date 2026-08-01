# Deployment

## Purpose

This document defines how NUTANAA Studio OS is deployed, released, and operated across environments, and how the environment-specific security enforcement deferred from `09-Security.md` (network security, secrets management) is handled in practice. It replaces the earlier placeholder content generated before the real architecture existed.

## Scope

Covers deployment environments, release process, rollback, and environment-level security. Does not redefine the security *model* itself (roles, authentication, plugin permissions — see `09-Security.md`) — only how that model is enforced per environment.

## Deployment Environments

1. **Local Development** — A single developer's machine running Studio Kernel and modules directly against local AI Providers (e.g. Ollama). No network exposure beyond localhost by default.
2. **Staging** — A shared environment mirroring production configuration, used to validate a release candidate before it reaches real users. Uses non-production credentials and, where possible, non-production AI Provider endpoints.
3. **Production** — The live environment serving real users. Subject to the full security enforcement defined below.

Each environment is configured, not code-branched — the same module code runs in all three; only configuration (credentials, provider endpoints, resource limits) differs, consistent with Engineering Principle #17 ("Every configuration is externalized").

## Release Process

1. A release candidate is built from a specific, tagged commit — never from an untagged working branch.
2. The candidate is deployed to Staging first. QA Engine's automated testing (per `01-System-Modules.md`) must pass against Staging before promotion.
3. Promotion to Production is a deliberate, logged action (per Engineering Principle #11) — not an automatic consequence of Staging tests passing.
4. Independently deployable components (per Engineering Principle #18) may be released on separate schedules — a Plugin Manager update does not require redeploying Render Engine, provided both remain within their declared compatible version ranges (per `07-Plugin-System.md`'s versioning rules).

## Rollback

- Every deployment is versioned and the previous version remains available for immediate rollback — consistent with the "never overwrite, version instead" principle already applied to assets and state (Engineering Principle #16, `06-State-Management.md`).
- Rollback of a module does not implicitly roll back Persistent State in Memory. If a rolled-back module version is incompatible with state written by the newer version, that incompatibility must be handled explicitly (state migration), not assumed away.
- A rollback decision follows the same logging requirement as a promotion — both are deliberate, auditable actions.

## Environment-Specific Security Enforcement

Per the boundary set in `09-Security.md`, this section defines how the security model is enforced per environment:

- **Secrets management**: AI Provider credentials and other sensitive configuration are never committed to source control, in any environment. Local Development uses local environment files excluded from version control; Staging and Production use a centralized secrets store.
- **Network security**: Local Development is not exposed beyond localhost by default. Staging and Production sit behind network-level access controls appropriate to each — Staging restricted to internal/authorized access, Production exposed only through the REST API and Editor's defined entry points, never direct module access from outside Studio Kernel's boundary.
- **Credential rotation**: Production credentials are rotated on a defined schedule; Staging and Local Development are not required to follow the same schedule but must never share actual Production credentials.

## Scaling Considerations

- Local Development is inherently single-user and does not need to consider concurrent load.
- Staging and Production must account for concurrent workflows and agents (per `03-Agent-LifeCycle.md` and `05-Workflow-LifeCycle.md`) competing for AI Provider resources — the UPI's fallback/retry behavior (per `04-Provider-Interfaces.md`) is what absorbs provider-level rate limits under load, not a deployment-level workaround.
- Memory's persistence layer must be sized for the expected volume of versioned state (per `06-State-Management.md`) in each environment — Production requires materially more capacity planning than Staging or Local Development.

## Monitoring in Deployment

- Each environment emits the same event types (per `08-Event-System.md`) and logs (per Engineering Principle #11); only the destination and retention policy differ by environment.
- Production monitoring feeds the security anomaly detection described in `09-Security.md`; Staging and Local Development are not required to have the same alerting thresholds active, since they are not serving real users.

## Responsibilities Boundary

**Deployment architecture is responsible for:**
- Defining environment configuration boundaries and how they differ
- Defining release, promotion, and rollback process
- Defining environment-specific enforcement of the security model from `09-Security.md`

**Deployment architecture is NOT responsible for:**
- Defining the security model itself (`09-Security.md`)
- Defining module boundaries or communication rules (`01-System-Modules.md`)
- Defining specific infrastructure tooling choices (CI/CD platform, container orchestration) — those are implementation decisions made under this architecture, not part of it

## Future Work

- Define state migration strategy for rollback scenarios where Persistent State is incompatible across module versions.
- Define specific capacity planning numbers once real usage patterns from early Production deployment are available.