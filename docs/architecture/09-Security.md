# Security

## Purpose

This document defines the security model for NUTANAA Studio OS: authentication, authorization, plugin security enforcement (referenced but deferred from `07-Plugin-System.md`), and data protection. It is the architecture-level security reference — distinct from any product-level security or compliance documentation that may exist under `docs/13-Security.md`, if that file is used for policy rather than architecture.

## Scope

Covers how the system verifies identity, controls access to modules and data, and enforces the plugin permission model already introduced in `07-Plugin-System.md`. Does not cover deployment-level security (network security, secrets management in production) — that belongs in `10-Deployment.md`.

## Authentication

- Every human user interacting with the system (via Editor or REST API) authenticates through a single identity mechanism, regardless of entry point — Editor and REST API do not maintain separate identity systems.
- Agents and plugins do not authenticate as themselves to external systems; they act under the authorization of the workflow or user that triggered them, per the Authorization model below.
- AI Provider credentials (API keys for external providers like OpenAI, Anthropic, ElevenLabs) are managed centrally and never exposed to Editor, plugins, or agents directly — providers are invoked through the UPI (per `04-Provider-Interfaces.md`), which handles credential injection internally.

## Authorization

- Authorization is role-based. A role determines which modules, actions, and approval gates (per `05-Workflow-LifeCycle.md`) a user or workflow can access.
- Approval gate authorization (who can approve a given gated step) is defined per-role, per-step — Workflow Engine checks authorization at the moment of approval, not only at workflow trigger time, so a role change mid-workflow takes effect immediately.
- Plugin permissions (declared in the plugin manifest per `07-Plugin-System.md`) are a separate authorization layer from user roles: a plugin's permissions define what it *can* request, while the invoking user/workflow's role determines whether that specific invocation is *allowed* to happen.

## Data Protection

- Data classified as sensitive (credentials, personal data, unpublished creative work) is encrypted at rest wherever Memory persists it (per `06-State-Management.md`), and in transit between modules where the transport crosses a process or network boundary.
- Shared State (per `06`) that includes sensitive data follows the same encryption rules as any other persisted data — being "shared" does not reduce its protection requirements.
- Access to sensitive data is logged with the same rigor as any other action (per Engineering Principle #11), including read access, not only writes.

## Plugin Security Enforcement

This section fulfills the forward reference from `07-Plugin-System.md`:
- Permission review (Step 3 of the Registration Flow in `07`) checks each requested permission against the invoking user or organization's security policy, not just a hardcoded system default.
- Plugins are sandboxed at runtime (per `07`'s Isolation section); this document adds that sandbox boundaries must prevent a plugin from accessing another plugin's data or the core module internals, even if both plugins are active simultaneously.
- Plugin code provenance (where a plugin came from, whether it's signed) is verified before a plugin reaches the Validated state in its lifecycle — an unsigned or unverifiable plugin may still be loaded in a development environment but must be flagged, and Marketplace-distributed plugins require verification before listing.

## Security Monitoring

- QA Engine (per `01-System-Modules.md`) consumes security-relevant events (failed authentication attempts, permission denials, anomalous plugin behavior) through the Event System (per `08-Event-System.md`) to support monitoring and alerting, rather than security monitoring being a separate bolted-on system.
- Anomaly patterns (e.g. repeated authorization failures) trigger events that Editor can surface to administrators; this document does not define the specific alerting thresholds, which are operational configuration, not architecture.

## Responsibilities Boundary

**This document (Security architecture) is responsible for:**
- Defining the authentication and authorization model
- Defining data protection requirements for state at rest and in transit
- Defining plugin security enforcement points

**This document is NOT responsible for:**
- Deployment-level network security, firewalls, or secrets management in specific environments (`10-Deployment.md`)
- Defining specific alerting thresholds or incident response procedures (operational, not architectural)
- Implementing the encryption or authentication mechanisms themselves — this defines the requirement, not the algorithm or library choice

## Future Work

- Define the exact role taxonomy and how roles map to approval-gate authorization in practice.
- Define key rotation and credential management policy for centrally-managed AI Provider credentials.