# Database Architecture

## Purpose
Describes how NUTANAA Studio OS organizes persistent storage across projects, metadata, assets, and operational data.

## Scope
Storage categories and their relationships. Storage ownership rules (which module writes what) are defined in `docs/architecture/06-State-Management.md` and are not repeated here.

## Audience
Backend engineers, DBAs, contributors implementing Memory's storage layer.

## Project Storage
Each project is a top-level persisted entity holding references to its scenes, characters, assets, and workflow history, per `docs/specifications/05-Project-State.md`.

## Metadata Storage
Structured relational storage for project, user, workflow, and plugin registry metadata — data with well-defined schema and relationships.

## Assets
Binary asset data (video, image, audio) stored in object storage, referenced by metadata records; versioned per Engineering Principle #16, detailed in `docs/specifications/06-Asset-Management.md`.

## Characters
Character state (attributes, consistency data) stored as Shared State per `docs/architecture/06-State-Management.md`, detailed in `docs/specifications/07-Character-Management.md`.

## Scenes
Scene composition and metadata stored per project, detailed in `docs/specifications/08-Scene-Management.md`.

## Workflows
Workflow definitions and execution history persisted per `docs/architecture/05-Workflow-LifeCycle.md`'s state persistence requirement.

## Providers
Provider configuration (excluding credentials, which are managed separately per `13-Security.md`) and capability manifests are persisted for routing decisions.

## Configuration
System and per-environment configuration is externalized per Engineering Principle #17 and stored outside application code, per `14-Deployment.md`.

## Logs
Structured logs are stored separately from primary application data, with retention policy set at the operational level.

## Audit
Audit trails covering approval decisions, permission changes, and sensitive data access are stored immutably, consistent with Engineering Principle #11 and `13-Security.md`.

## Caching
A cache layer accelerates frequently accessed Shared State reads without becoming the authoritative store — Memory's persisted data remains the source of truth.

## Backup
Regular backups of relational and object storage per `14-Deployment.md`'s backup strategy.

## Recovery
Recovery procedures restore both structured metadata and referenced binary assets consistently, avoiding orphaned references.

## Relationship with Other Documents
Implements the storage-layer requirements of `docs/architecture/06-State-Management.md`.

## References to Architecture
`docs/architecture/06-State-Management.md`, `09-Security.md`.

## References to Specifications
`docs/specifications/05-Project-State.md`, `06-Asset-Management.md`, `07-Character-Management.md`, `08-Scene-Management.md`.

## Future Evolution
Specific schema design is tracked separately as implementation proceeds; this document covers storage categories, not table-level schema.

## Document Ownership
Backend/Database Architecture Owner.

## Version Information
Version 1.0.

## Change Management
Schema-affecting changes require review against `docs/architecture/06-State-Management.md`'s ownership rules.
