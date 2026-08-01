# Deployment

## Purpose
Provides the complete operational deployment strategy for NUTANAA Studio OS across local, staging, production, and distributed environments. Architecture-level environment model and security enforcement boundaries are defined in `docs/architecture/10-Deployment.md` and `docs/architecture/09-Security.md`; this document is the operational execution of that model.

## Scope
Development, staging, and production deployment procedures, infrastructure choices, and operational runbooks.

## Audience
DevOps engineers, contributors setting up local environments, release managers.

## Development Environment

### Local Development
Runs Studio Kernel and modules directly against local AI providers (e.g. Ollama), with no mandatory network exposure beyond localhost, per `docs/architecture/10-Deployment.md`.

### Windows Setup
VSCodium or equivalent IDE, Python 3.11+, Ollama for local models, Git. Project-specific setup scripts are provided under `scripts/`.

### Linux Setup
Equivalent toolchain via native package managers; Ollama supports native Linux installation.

### macOS Setup
Equivalent toolchain; GPU acceleration availability depends on hardware (Apple Silicon vs. Intel).

## GPU Deployment
Local GPU inference (e.g. consumer GPUs in the 8GB+ VRAM class) is supported for smaller/quantized local models; larger models may require CPU/GPU split execution, with corresponding latency trade-offs.

## CPU Deployment
CPU-only execution is supported as a fallback for environments without a compatible GPU, at reduced performance for local model inference.

## Docker Deployment
Each independently deployable component (per Engineering Principle #18) is packaged as its own container image, aligned to module boundaries in `docs/architecture/01-System-Modules.md`.

## Docker Compose
Staging and local multi-service testing use Docker Compose to orchestrate Studio Kernel, Workflow Engine, Memory, and dependent services together.

## Kubernetes Deployment
Production deployments at scale use Kubernetes for orchestration, scaling, and health management of containerized services.

## Cloud Deployment
Supported cloud deployment targets follow the same containerized artifacts as Kubernetes deployment; specific cloud provider guidance is maintained as operational runbooks outside this document's scope.

## Hybrid Deployment
Supports local AI providers for latency/cost-sensitive workloads alongside cloud providers for capability not available locally, both accessed uniformly through the UPI per `docs/architecture/04-Provider-Interfaces.md`.

## Distributed Rendering Nodes
Render Engine instances may be deployed as a distributed pool of worker nodes, consuming render jobs from the Workflow Engine's execution queue.

## AI Provider Deployment
Providers are registered via configuration, per Functional Requirement `FR-PVM-01`; local and remote providers can coexist within the same deployment.

## Model Management
Local model versions are managed through the underlying inference runtime (e.g. Ollama's model registry); provider capability manifests declare which UPI version and methods a given model/provider combination supports.

## Environment Variables
All environment-specific configuration is externalized as environment variables or configuration files, never hardcoded, per Engineering Principle #17.

## Configuration Management
Configuration differs by environment (Local/Staging/Production) without code branching, per `docs/architecture/10-Deployment.md`.

## Secrets Management
Local Development uses local environment files excluded from version control; Staging and Production use a centralized secrets store, per `docs/architecture/09-Security.md`.

## SSL
Staging and Production endpoints are served over TLS; Local Development is not required to use TLS given localhost-only exposure by default.

## Networking
Local Development is not exposed beyond localhost by default. Staging is restricted to authorized internal access. Production is exposed only through the REST API and Editor's defined entry points.

## Load Balancing
Production deployments distribute load across replicated stateless services (Render Engine, Character Engine, Asset Engine) behind a load balancer.

## Scaling
Stateless engines scale horizontally; Memory's persistence layer scales per the capacity planning considerations in `docs/architecture/10-Deployment.md`.

## Monitoring
Each environment emits the same event types and logs, differing only in destination and retention policy, per `docs/architecture/10-Deployment.md`.

## Logging
Structured logs are aggregated centrally in Staging/Production; Local Development logs to local files/console.

## Backup Strategy
Regular automated backups of relational metadata and object storage, with backup frequency scaled to environment criticality.

## Recovery Strategy
Recovery procedures restore metadata and assets consistently, verified through periodic recovery drills for Production.

## Disaster Recovery
Production maintains documented recovery point and recovery time objectives, reviewed periodically as part of operational readiness.

## High Availability
Critical orchestration services (Studio Kernel, Workflow Engine) run with redundancy in Production to avoid single points of failure.

## Health Checks
Each service exposes a health endpoint consumed by the orchestration layer (Kubernetes liveness/readiness probes or equivalent).

## Deployment Checklist
1. Release candidate built from a tagged commit.
2. Automated tests pass in Staging.
3. Security and configuration review complete.
4. Promotion to Production is a deliberate, logged action.

## Rollback Procedure
Previous deployment versions remain available for immediate rollback; state migration compatibility is verified before rollback where Persistent State has changed shape, per `docs/architecture/10-Deployment.md`.

## Upgrade Strategy
Independently deployable components may be upgraded on separate schedules, provided compatible version ranges are maintained per `docs/architecture/07-Plugin-System.md` and `04-Provider-Interfaces.md`.

## Future Cloud Architecture
Long-term direction includes managed hosting offerings and expanded distributed rendering capacity, aligned with the Enterprise Strategy in `02-Business-Goals.md`.

## Relationship with Other Documents
Operational execution of `docs/architecture/10-Deployment.md`; informs `20-Release-Strategy.md`'s release process.

## References to Architecture
`docs/architecture/10-Deployment.md`, `09-Security.md`.

## References to Specifications
`docs/specifications/00-Specification-Overview.md`.

## Future Evolution
Cloud-specific runbooks will be added as specific cloud provider partnerships are established.

## Document Ownership
DevOps Architect / Release Manager.

## Version Information
Version 1.0.

## Change Management
Operational procedure changes follow standard PR review; environment topology changes require architecture review.
