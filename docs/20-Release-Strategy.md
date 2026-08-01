# Release Strategy

## Purpose
Defines the enterprise release strategy for NUTANAA Studio OS, from versioning through publishing.

## Scope
Release process, versioning, compatibility, and publishing. Deployment mechanics are in `14-Deployment.md`; testing gates are in `18-Testing-Strategy.md`.

## Audience
Release management, engineering leadership, contributors preparing a release.

## Release Philosophy
Releases are predictable, tested, and reversible. Per Engineering Principle #16, a release is never a destructive overwrite of the previous version — rollback must always be possible.

## Semantic Versioning
`MAJOR.MINOR.PATCH`, per `08-Repository-Standards.md`. MAJOR versions may include breaking contract changes (e.g. UPI breaking changes per `docs/architecture/04-Provider-Interfaces.md`'s Versioning section).

## Version Numbering
Independently deployable components (Engineering Principle #18) may carry their own version numbers, tracked against the compatible ranges declared in their manifests (`docs/architecture/07-Plugin-System.md`).

## Alpha Releases
Early, potentially unstable builds for internal testing; not covered by compatibility guarantees.

## Beta Releases
Feature-complete builds for wider testing; compatibility guarantees are best-effort, not committed.

## Release Candidates
Builds considered production-ready pending final validation; promoted to Stable if release gates in `18-Testing-Strategy.md` pass without regression.

## Stable Releases
Fully supported releases meeting all release gates; the only releases recommended for Production deployment.

## Long-Term Support
Designated Stable releases may be marked for extended support and backport-only maintenance, for enterprise deployments requiring longer upgrade cycles.

## Nightly Builds
Automated builds from the latest `main` branch, unstable by definition, for early integration testing.

## Feature Flags
New functionality may be shipped behind a feature flag, allowing gradual rollout without a full release cycle, particularly for features affecting workflow or provider behavior.

## Migration Strategy
Breaking changes to Persistent State schema or the UPI contract require a documented migration path; the previous version's data must remain readable during a defined transition window, per `docs/architecture/10-Deployment.md`'s rollback compatibility requirement.

## Backward Compatibility
MINOR and PATCH releases must not break existing plugin, provider, or workflow configurations; only MAJOR releases may introduce breaking changes, with advance notice.

## Deprecation Policy
Deprecated functionality is marked and documented (via `16-Decisions.md`) at least one MINOR release before removal in a MAJOR release.

## Upgrade Strategy
Upgrades follow the same environment progression as new deployments — validated in Staging before Production — per `14-Deployment.md`.

## Rollback Strategy
Every release retains the previous version for immediate rollback, per `docs/architecture/10-Deployment.md`.

## Release Checklist
1. All release gates in `18-Testing-Strategy.md` pass in Staging.
2. Changelog generated and reviewed.
3. Documentation updated to reflect the release (per Engineering Principle #7).
4. Security review complete for any security-relevant change.
5. Release approved and promoted to Production as a deliberate, logged action.

## Release Approval
Requires sign-off from Release Manager; MAJOR releases additionally require Chief Architect sign-off given likely breaking-change scope.

## Changelog Generation
Generated from Conventional Commit history (`08-Repository-Standards.md`), grouped by type (feat, fix, docs, etc.).

## Documentation Requirements
No release ships with documentation gaps for the functionality it introduces, per Engineering Principle #7.

## Testing Requirements
See `18-Testing-Strategy.md`'s Release Gates section.

## CI/CD Pipeline
Automated build, test, and packaging pipeline per `06-Technology-Stack.md`; manual approval gate before Production promotion.

## Publishing Process
Stable releases are published to the appropriate distribution channel (package registry, container registry) with matching version tags.

## Marketplace Publishing
Plugin and provider releases to the Marketplace follow the versioning and provenance verification requirements in `docs/architecture/07-Plugin-System.md` and `09-Plugin-Architecture.md`, independent of core platform release cycles.

## Future Release Automation
Increased automation of the release checklist (automated changelog, automated security scanning) is planned as CI/CD tooling matures, per `15-Roadmap.md`.

## Relationship with Other Documents
Coordinates `14-Deployment.md` (how a release is deployed) and `18-Testing-Strategy.md` (what gates a release).

## References to Architecture
`docs/architecture/04-Provider-Interfaces.md`, `07-Plugin-System.md`, `10-Deployment.md`.

## References to Specifications
`docs/specifications/00-Specification-Overview.md`.

## Future Evolution
Release cadence and LTS policy will be formalized as the project reaches its first Stable release.

## Document Ownership
Release Manager.

## Version Information
Version 1.0.

## Change Management
Changes to release policy require sign-off from Release Manager and Chief Architect.
