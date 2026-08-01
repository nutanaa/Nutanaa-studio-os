# Repository Standards

## Purpose
Defines repository layout, naming, and Git workflow conventions for NUTANAA Studio OS.

## Scope
Repository structure and version control process. Language-level coding conventions are in `07-Coding-Standards.md`.

## Audience
All contributors and AI coding agents making repository changes.

## Folder Layout
Top-level folders map to module boundaries defined in `docs/architecture/01-System-Modules.md`: `agents/`, `backend/`, `editor/`, `frontend/`, `movie-engine/`, `plugins/`, `sdk/`, `workflow/`, `database/`, plus supporting folders `tests/`, `tools/`, `scripts/`, `packages/`, `assets/`, and documentation under `docs/`. Per Engineering Principle #19, changes to this top-level structure require architectural approval.

## Naming
Folders: `kebab-case`. Python files/modules: `snake_case`. Markdown documentation files: `NN-Title-Case.md` numeric prefix matching existing convention.

## Git Flow
Trunk-based development: short-lived feature branches merged frequently into `main`. No long-lived divergent branches.

## Commits
Conventional Commits format: `type(scope): description` (e.g. `feat(agent-runtime): add suspend transition`, `docs(architecture): fix module dependency cycles`). Types include `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

## Pull Requests
Every change to `main` goes through a pull request. PRs should be scoped to a single logical change and include a description referencing the relevant requirement ID (`03-Functional-Requirements.md`) or ADR (`16-Decisions.md`) where applicable.

## Reviews
At least one reviewer approval required before merge. Changes touching `docs/architecture/` require review from someone in the architecture owner role.

## Branch Strategy
`main` is always releasable. Feature branches are named `type/short-description` (e.g. `feat/agent-suspend-state`).

## Release Strategy
See `20-Release-Strategy.md` for full release process; repository tagging follows Semantic Versioning below.

## Semantic Versioning
`MAJOR.MINOR.PATCH`. MAJOR for breaking contract changes (e.g. UPI breaking changes per `docs/architecture/04-Provider-Interfaces.md`), MINOR for backward-compatible feature additions, PATCH for fixes.

## Relationship with Other Documents
Operationalizes the development lifecycle described in `00-Project-Overview.md`; feeds into `19-Contributing.md` for contributor-facing detail.

## References to Architecture
`docs/architecture/01-System-Modules.md` (folder-to-module mapping), `04-Provider-Interfaces.md` (versioning rationale).

## References to Specifications
Not directly applicable; repository structure is project-level, not runtime behavior.

## Future Evolution
Folder layout changes require an ADR per `16-Decisions.md` given Engineering Principle #19.

## Document Ownership
Chief Architect / Repository Maintainer.

## Version Information
Version 1.0.

## Change Management
Changes to this document follow standard PR review; structural folder changes additionally require architecture review.
