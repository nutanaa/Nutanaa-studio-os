# Plugin Architecture

## Purpose
Provides a high-level overview of the plugin system's role in NUTANAA Studio OS. Detailed manifest schema, registration flow, and isolation model are defined in `docs/architecture/07-Plugin-System.md` and `docs/specifications/04-Plugin-Specification.md` — this document does not repeat that detail.

## Scope
Conceptual overview of plugin categories, lifecycle, security posture, marketplace relationship, and versioning, at a level suitable for product and business stakeholders as well as engineers.

## Audience
Contributors, plugin developers, product stakeholders.

## Purpose of the Plugin System
Per Engineering Principle #2 ("everything is plugin based"), most capability beyond the Studio Kernel is intended to be implemented or replaceable as a plugin — from AI provider integrations to Editor tool extensions.

## Plugin Categories
- **Provider plugins** — implement the Universal Provider Interface (`docs/architecture/04-Provider-Interfaces.md`).
- **Engine extension plugins** — extend or customize behavior of a domain engine (Movie, Character, Asset, Render, QA).
- **Editor tool plugins** — add tools or panels to the Editor.
- **Workflow step plugins** — add new step types usable in the Workflow Builder.

## Lifecycle
Plugins progress through Discovered → Validated → Loaded → Active/Disabled/Failed → Unloaded. Full state definitions: `docs/architecture/07-Plugin-System.md`.

## Security
Plugins run in an isolated execution context with explicit, declared permissions reviewed at registration time. Full detail: `docs/architecture/09-Security.md` and `13-Security.md`.

## Marketplace
Plugins are distributed through the Marketplace module, which handles discovery, versioning, and reviews, separate from the Plugin Manager's runtime concerns. See `02-Business-Goals.md` for marketplace strategy.

## Versioning
Plugins declare compatibility with a specific range of UPI and Studio OS versions in their manifest; the Plugin Manager refuses activation outside the declared range. Never-overwrite versioning (Engineering Principle #16) applies to plugin updates.

## Distribution
Plugins may be distributed locally (development), or through the Marketplace (production), with code provenance verification required for Marketplace-listed plugins.

## Relationship with Other Documents
Summarizes `docs/architecture/07-Plugin-System.md`; refer there and to `docs/specifications/04-Plugin-Specification.md` for implementation-level detail.

## References to Architecture
`docs/architecture/07-Plugin-System.md`, `04-Provider-Interfaces.md`, `09-Security.md`.

## References to Specifications
`docs/specifications/04-Plugin-Specification.md`.

## Future Evolution
Plugin category taxonomy may expand as new engine types are introduced.

## Document Ownership
Chief Architect / Plugin Ecosystem Owner.

## Version Information
Version 1.0.

## Change Management
Changes to plugin categories or marketplace policy tracked as ADRs in `16-Decisions.md`.
