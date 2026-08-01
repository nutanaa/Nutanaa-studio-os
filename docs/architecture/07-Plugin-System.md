# Plugin System

## Purpose

This document defines how a plugin is packaged, registered, isolated, and run within NUTANAA Studio OS, and the contract every plugin must satisfy to be loaded by Plugin Manager. It gives concrete shape to the Plugin Manager role already defined in `01-System-Modules.md`.

## Scope

Applies to any third-party or first-party extension loaded through Plugin Manager — including provider integrations, custom engine extensions, and Editor tool add-ons. Does not define the Marketplace distribution mechanism (see `09-Plugin-Architecture.md`'s sibling doc, `Marketplace` in `01-System-Modules.md`) — only the plugin's internal structure and runtime contract.

## Plugin Manifest

Every plugin must ship with a manifest declaring, at minimum:

- **id** — globally unique plugin identifier
- **version** — semantic version of the plugin itself
- **compatible_upi_version** — which UPI contract version(s) it targets, if it registers as a provider (see `04-Provider-Interfaces.md`)
- **capabilities** — which interfaces/contracts the plugin implements (e.g. it may implement a provider contract, an Editor tool contract, or a custom workflow-step contract)
- **dependencies** — other plugins this plugin requires to function, with version constraints
- **permissions** — what system resources the plugin requests access to (file system, network, specific module interfaces)

Plugin Manager rejects any plugin that omits required manifest fields, or whose `compatible_upi_version` (if applicable) does not match a version Studio Kernel currently supports.

## Registration Flow

1. **Discovery** — Plugin Manager locates a plugin (local directory or Marketplace-installed package).
2. **Manifest Validation** — Manifest is parsed and checked for completeness and version compatibility.
3. **Permission Review** — Requested permissions are checked against system policy; a plugin requesting more than it's allowed is rejected at this stage, not silently restricted.
4. **Loading** — Plugin code is loaded into an isolated execution context (see Isolation below).
5. **Registration** — Plugin declares its capabilities to Studio Kernel's contract registry, making it discoverable by other modules through the Module Communication Rule — never by direct reference.
6. **Activation** — Plugin becomes available for use. Activation and deactivation can happen independently of loading, allowing a plugin to be temporarily disabled without full unload.

## Isolation

- Plugins run in a sandboxed execution context, separate from core module code. A plugin crash must not crash Studio Kernel or any core module.
- Plugins only interact with the rest of the system through declared contract interfaces — never by importing or directly calling core module internals.
- Resource limits (memory, execution time) are enforced per plugin, consistent with Studio Kernel's resource allocation responsibilities defined in `01-System-Modules.md`.

## Plugin Lifecycle States

1. **Discovered** — Found by Plugin Manager, not yet validated.
2. **Validated** — Manifest and permissions checked and approved.
3. **Loaded** — Code loaded into an isolated context, not yet active.
4. **Active** — Registered and available for use by other modules.
5. **Disabled** — Loaded but deliberately deactivated; can return to Active without reloading.
6. **Failed** — Validation or loading failed; plugin is not usable until the underlying issue is resolved.
7. **Unloaded** — Removed from the execution context entirely.

## Versioning & Compatibility

- Plugins declare compatibility with a specific range of Studio OS and UPI versions in their manifest.
- Plugin Manager refuses to activate a plugin outside its declared compatible range, rather than attempting to run it and risk undefined behavior.
- Plugin updates follow the same "never overwrite, version instead" rule as assets and state (Engineering Principle #16) — installing a new plugin version does not delete the previous one until explicitly removed, allowing rollback.

## Security

- Plugin permissions are explicit and reviewable — a plugin cannot request access implicitly by using it at runtime; every access point must be declared in the manifest upfront.
- Security review of a plugin's requested permissions happens at Registration time, not deferred to first use.
- Full security policy details (authentication of plugin sources, code signing, sandboxing implementation) are defined in `13-Security.md`.

## Responsibilities Boundary

**Plugin Manager is responsible for:**
- Manifest validation and permission enforcement
- Registration and lifecycle state tracking for all plugins
- Providing the isolated execution context

**Plugin Manager is NOT responsible for:**
- Executing the plugin's actual business logic (the plugin does that, within its sandbox)
- Distributing or discovering plugins from external sources (Marketplace's job)
- Defining what a valid AI Provider contract looks like (that's `04-Provider-Interfaces.md`) — Plugin Manager only checks that a plugin *declares* conformance, not the contract's content

## Future Work

- Define the exact permission taxonomy (what specific resource-access categories exist).
- Define automated compatibility testing for plugins against new Studio OS releases before they reach Marketplace.