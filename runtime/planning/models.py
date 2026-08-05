from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from runtime.providers.provider_capability import ProviderCapability


class IntentCategory(str, Enum):
    CHAT = "chat"
    CODING = "coding"
    DEBUGGING = "debugging"
    REFACTORING = "refactoring"
    ARCHITECTURE = "architecture"
    RESEARCH = "research"
    PLANNING = "planning"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    WORKFLOW = "workflow"
    AUTOMATION = "automation"
    PROJECT_ANALYSIS = "project_analysis"
    KNOWLEDGE_QUERY = "knowledge_query"
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"
    AUDIO = "audio"
    MIXED_MODAL = "mixed_modal"


class ComplexityLevel(str, Enum):
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"
    MULTI_AGENT = "multi_agent"
    LONG_RUNNING = "long_running"


class ToolType(str, Enum):
    WORKSPACE_INDEXING = "workspace_indexing"
    SEMANTIC_SEARCH = "semantic_search"
    MEMORY_RETRIEVAL = "memory_retrieval"
    TERMINAL = "terminal"
    PYTHON = "python"
    FILESYSTEM = "filesystem"
    GIT = "git"
    BROWSER = "browser"
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"
    AUDIO = "audio"
    FUTURE_PLUGIN = "future_plugin"


class AgentType(str, Enum):
    CHAT_AGENT = "Chat Agent"
    CODING_AGENT = "Coding Agent"
    RESEARCH_AGENT = "Research Agent"
    PLANNING_AGENT = "Planning Agent"
    REVIEWER_AGENT = "Reviewer Agent"
    DOCUMENTATION_AGENT = "Documentation Agent"
    TESTING_AGENT = "Testing Agent"
    WORKFLOW_AGENT = "Workflow Agent"
    MEMORY_AGENT = "Memory Agent"
    KNOWLEDGE_AGENT = "Knowledge Agent"


class PlanningEventType(str, Enum):
    INTENT_DETECTED = "planning.intent_detected"
    PLAN_CREATED = "planning.plan_created"
    TASK_SPLIT = "planning.task_split"
    AGENT_ASSIGNED = "planning.agent_assigned"
    PROVIDER_ASSIGNED = "planning.provider_assigned"
    EXECUTION_PLAN_READY = "planning.execution_plan_ready"
    PLAN_OPTIMIZED = "planning.plan_optimized"


@dataclass(slots=True)
class ToolRecommendation:
    tool: ToolType
    reason: str


@dataclass(slots=True)
class ProviderRecommendation:
    provider_name: str
    capability: ProviderCapability | None = None
    reason: str | None = None


@dataclass(slots=True)
class ExecutionSubtask:
    subtask_id: str = field(default_factory=lambda: uuid4().hex)
    title: str = ""
    description: str = ""
    intent_category: IntentCategory = IntentCategory.CHAT
    complexity: ComplexityLevel = ComplexityLevel.SIMPLE
    dependencies: list[str] = field(default_factory=list)
    parallelizable: bool = False
    optional: bool = False
    retryable: bool = True
    estimated_duration_seconds: float = 0.0
    required_tools: list[ToolType] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExecutionPlan:
    plan_id: str = field(default_factory=lambda: uuid4().hex)
    goal: str = ""
    request_id: str | None = None
    task_id: str | None = None
    task_type: str = "generic"
    source_text: str = ""
    intent: IntentCategory = IntentCategory.CHAT
    complexity: ComplexityLevel = ComplexityLevel.SIMPLE
    subtasks: list[ExecutionSubtask] = field(default_factory=list)
    execution_order: list[str] = field(default_factory=list)
    selected_agents: list[str] = field(default_factory=list)
    selected_providers: list[str] = field(default_factory=list)
    selected_models: list[str] = field(default_factory=list)
    estimated_duration_seconds: float = 0.0
    required_memory: str | None = None
    required_workspace_context: list[str] = field(default_factory=list)
    required_knowledge: list[str] = field(default_factory=list)
    required_tools: list[ToolRecommendation] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
