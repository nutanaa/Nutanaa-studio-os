# Contributing

## Purpose
Provides a professional guide for contributing to NUTANAA Studio OS.

## Scope
Contribution process, standards, and expectations. Detailed coding conventions are in `07-Coding-Standards.md`; repository mechanics are in `08-Repository-Standards.md`.

## Audience
New and existing contributors, including AI coding agents operating on the repository.

## Welcome
NUTANAA Studio OS welcomes contributions that respect its modular, contract-driven architecture. Read `00-Project-Overview.md` and `docs/architecture/01-System-Modules.md` before your first contribution.

## Project Philosophy
Contributions should honor the Engineering Principles in `docs/ENGINEERING_PRINCIPLES.md` — particularly modularity, contract-based communication, and documentation-alongside-code.

## Repository Structure
See `08-Repository-Standards.md` for folder layout and naming conventions.

## Development Environment
See `14-Deployment.md`'s Development Environment section for Windows, Linux, and macOS setup instructions.

## Required Software
Python 3.11+, Git, an IDE with Python support, and Ollama for local AI provider testing.

## Coding Standards
See `07-Coding-Standards.md` for naming, formatting, typing, and testing conventions.

## Documentation Standards
Every feature requires documentation per Engineering Principle #7, updated in the same pull request as the code change.

## Branching Strategy
See `08-Repository-Standards.md` — trunk-based development with short-lived feature branches.

## Commit Convention
Conventional Commits format, per `08-Repository-Standards.md`.

## Pull Requests
Scoped to a single logical change, referencing the relevant Requirement ID (`03-Functional-Requirements.md`) or ADR (`16-Decisions.md`) where applicable.

## Issue Reporting
Issues should specify the affected module (per `docs/architecture/01-System-Modules.md`'s boundaries), expected vs. actual behavior, and reproduction steps.

## Feature Requests
New feature requests are evaluated against `01-Vision.md` and `15-Roadmap.md` before acceptance into the backlog.

## Bug Reports
Bug reports affecting a module's documented contract (per `docs/architecture/`) are prioritized as contract violations, distinct from cosmetic issues.

## Architecture Review
Changes affecting module boundaries, contracts, or repository structure require architecture review before merge, per Engineering Principle #19.

## Testing Requirements
New functionality must include tests per Engineering Principle #6 and `18-Testing-Strategy.md`.

## Code Review
At least one reviewer approval required; reviewers check adherence to `07-Coding-Standards.md` and relevant architecture documents.

## Documentation Review
Documentation changes are reviewed for consistency with `17-Glossary.md` terminology and cross-references to `docs/architecture/` and `docs/specifications/`.

## Contribution Workflow
1. Open or claim an issue.
2. Create a feature branch.
3. Implement with tests and documentation.
4. Open a pull request referencing the issue/requirement.
5. Address review feedback.
6. Merge after approval and passing CI.

## Security Reporting
Security concerns should be reported through a private channel rather than a public issue, consistent with responsible disclosure practice; specific reporting contact is maintained in the repository's security policy.

## Communication Guidelines
Discussions should stay technical and respectful, focused on the architecture and requirements rather than personal preference where a documented standard already exists.

## Community Standards
Contributors are expected to engage constructively and respect the project's modular, contract-first philosophy even when proposing changes to it.

## License Requirements
Contributions are made under the project's open-source license, per `02-Business-Goals.md`'s licensing strategy; contributors retain authorship attribution per standard open-source practice.

## Relationship with Other Documents
Operational guide tying together `07-Coding-Standards.md`, `08-Repository-Standards.md`, `18-Testing-Strategy.md`, and `16-Decisions.md`.

## References to Architecture
`docs/architecture/01-System-Modules.md` and all other architecture documents relevant to a given contribution's scope.

## References to Specifications
`docs/specifications/00-Specification-Overview.md`.

## Future Evolution
Updated as the contribution process matures with community growth, per `02-Business-Goals.md`.

## Document Ownership
Community/Contribution Owner.

## Version Information
Version 1.0.

## Change Management
Changes to this document follow standard PR review.
