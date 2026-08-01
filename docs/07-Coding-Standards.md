# Coding Standards

## Overview

This document defines the coding conventions and best practices to be followed across NUTANAA Studio OS. The primary language is Python across backend services and core modules.

## General Principles

- Write clear, readable, and maintainable code.
- Prefer simplicity over cleverness.
- Keep functions and modules focused on a single responsibility.
- Follow Engineering Principle #1 (everything is modular) — code structure should mirror module boundaries defined in `docs/architecture/01-System-Modules.md`, not cut across them.

## Naming Conventions

- **Variables and functions**: `snake_case` (e.g. `agent_runtime`, `generate_text`)
- **Classes**: `PascalCase` (e.g. `WorkflowEngine`, `AgentLifecycle`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g. `MAX_RETRY_ATTEMPTS`)
- **Private/internal members**: prefix with a single underscore (`_internal_state`), not double underscore, unless name-mangling is specifically needed.
- **Files and modules**: `snake_case.py`, matching the module they implement (e.g. `agent_runtime.py`, `workflow_engine.py`).
- **Interfaces/Protocols**: prefix with `I` only where it aids clarity against a concrete implementation in the same scope (e.g. `IProvider` vs. `OllamaProvider`); otherwise prefer descriptive names without the prefix.
- Boolean variables and functions should read as a predicate: `is_active`, `has_permission`, `can_retry`.

## Formatting

- **Formatter**: [Black](https://black.readthedocs.io/), default line length (88 characters), run as a pre-commit hook and in CI — not manually applied.
- **Linter**: [Ruff](https://docs.astral.sh/ruff/), configured to cover style, unused imports, and common bug patterns in one tool rather than stacking multiple linters.
- **Import sorting**: Ruff's built-in import sorting (isort-compatible), imports grouped as: standard library, third-party, local/module-internal — each group alphabetized.
- **Type hints**: Required on all public function signatures and class attributes. Internal/private helper functions should also be typed unless triviality makes it clearly unnecessary.
- Formatting and linting run automatically pre-commit; a commit that fails either should not be pushed.

## Version Control

- Use descriptive commit messages following Conventional Commits (`docs(scope): message`, `feat(scope): message`, `fix(scope): message`), consistent with commits already used across `docs/architecture/`.
- Follow trunk-based development: short-lived feature branches merged frequently into `main`, rather than long-lived divergent branches.
- Open pull requests for code review before merging into `main` — no direct pushes to `main` once the project moves past solo bootstrap work.
- Per Engineering Principle #19, changes to repository structure itself require architectural approval, not just code review.

## Testing

- **Framework**: [pytest](https://docs.pytest.org/), used for all unit, integration, and module-boundary tests.
- **Minimum coverage**: New code must include tests covering its primary logic paths; a hard percentage threshold is deferred until the codebase has enough real code to set a realistic baseline (tracked as an open item below).
- **Test types**:
  - *Unit tests*: test a single function/class in isolation, mocking dependencies across module boundaries.
  - *Contract tests*: verify a module's implementation actually satisfies the interface contracts defined in `docs/architecture/` (e.g. a provider implementation genuinely conforms to the UPI in `04-Provider-Interfaces.md`).
  - *Integration tests*: verify data flow across module boundaries matches `docs/architecture/02-Data-Flow.md`.
- Per Engineering Principle #6, every feature must have tests — a PR introducing new functionality without corresponding tests should not be merged.

## Documentation

- Document public APIs and modules using docstrings (Google-style or NumPy-style, chosen consistently project-wide — Google-style recommended for readability).
- Every module's public interface (per Engineering Principle #9) must have a module-level docstring explaining its purpose, consistent with the Purpose section already established for that module in `docs/architecture/01-System-Modules.md`.
- Keep README files up to date within each directory that represents a distinct module or package.
- Per Engineering Principle #7, every feature requires documentation — code and docs are updated in the same PR, not as a follow-up task.

## Language-Specific Guidelines (Python)

- **Minimum Python version**: 3.11+, to allow modern typing syntax (`X | Y` unions, `TypeAlias`) without compatibility shims.
- **Async**: Use `async`/`await` for any I/O-bound operation crossing a module boundary (AI Provider calls, Memory reads/writes) — per `04-Provider-Interfaces.md`, provider calls should never block synchronously given retry/fallback behavior.
- **Data classes**: Prefer `dataclasses` or `pydantic` models for structured data crossing module boundaries (contract payloads, event structures per `08-Event-System.md`) over plain dictionaries, so payload shape is enforced and typed.
- **Error handling**: Custom exceptions should be defined per module and inherit from a shared base exception, making it possible to catch module-specific vs. system-wide errors distinctly (relevant to the error states defined per-method in `04-Provider-Interfaces.md`).
- **Dependency management**: Use `pyproject.toml` (PEP 621) as the single source of dependency and project metadata, not a mix of `setup.py`/`requirements.txt`.

## Open Items

- Set a concrete minimum test coverage percentage once enough real modules exist to establish a realistic baseline.
- Decide on Google-style vs. NumPy-style docstrings explicitly (currently recommending Google-style as default).