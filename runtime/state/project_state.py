from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from threading import RLock
from typing import Any, Mapping
from uuid import uuid4


class ProjectStateError(RuntimeError):
    """Base error for project state operations."""


class ProjectStateConflictError(ProjectStateError):
    """Raised when a write conflicts with the expected state version."""


class ProjectStateSnapshotError(ProjectStateError):
    """Raised when a snapshot cannot be restored or validated."""


class StateCategory(str, Enum):
    """State categories supported by the runtime."""

    RUNTIME = "runtime"
    PERSISTENT = "persistent"
    SESSION = "session"
    SHARED = "shared"


@dataclass(frozen=True, slots=True)
class ProjectStateSnapshot:
    """Immutable snapshot of a project state."""

    name: str
    category: StateCategory
    version: int
    revision: str
    data: dict[str, Any]
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class ProjectState:
    """Thread-safe in-memory project state with basic versioning hooks."""

    def __init__(
        self,
        name: str,
        category: StateCategory = StateCategory.RUNTIME,
        initial_data: Mapping[str, Any] | None = None,
        version: int = 0,
        revision: str | None = None,
    ) -> None:
        if not name.strip():
            raise ValueError("Project state name must not be empty.")

        self._name = name
        self._category = category
        self._data: dict[str, Any] = dict(initial_data or {})
        self._version = version
        self._revision = revision or uuid4().hex
        self._created_at = datetime.now(UTC)
        self._updated_at = self._created_at
        self._lock = RLock()

    @property
    def name(self) -> str:
        return self._name

    @property
    def category(self) -> StateCategory:
        return self._category

    @property
    def version(self) -> int:
        return self._version

    @property
    def revision(self) -> str:
        return self._revision

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def updated_at(self) -> datetime:
        return self._updated_at

    @property
    def data(self) -> dict[str, Any]:
        """Return a deep copy of the current state payload."""
        with self._lock:
            return deepcopy(self._data)

    def detect_conflict(
        self,
        expected_version: int | None = None,
        expected_revision: str | None = None,
    ) -> bool:
        """Return True when the provided version or revision is stale."""
        with self._lock:
            if expected_version is not None and self._version != expected_version:
                return True
            if expected_revision is not None and self._revision != expected_revision:
                return True
            return False

    def _ensure_no_conflict(
        self,
        expected_version: int | None = None,
        expected_revision: str | None = None,
    ) -> None:
        if self.detect_conflict(expected_version, expected_revision):
            raise ProjectStateConflictError(
                "Project state write conflict detected.",
            )

    def get(self, key: str, default: Any = None) -> Any:
        """Get a value from the state."""
        with self._lock:
            return self._data.get(key, default)

    def set(
        self,
        key: str,
        value: Any,
        *,
        expected_version: int | None = None,
        expected_revision: str | None = None,
    ) -> None:
        """Set a value in the state with conflict detection."""
        with self._lock:
            self._ensure_no_conflict(expected_version, expected_revision)
            self._data[key] = value
            self._version += 1
            self._revision = uuid4().hex
            self._updated_at = datetime.now(UTC)

    def update(
        self,
        values: Mapping[str, Any],
        *,
        expected_version: int | None = None,
        expected_revision: str | None = None,
    ) -> None:
        """Update multiple values in the state with conflict detection."""
        with self._lock:
            self._ensure_no_conflict(expected_version, expected_revision)
            self._data.update(dict(values))
            self._version += 1
            self._revision = uuid4().hex
            self._updated_at = datetime.now(UTC)

    def delete(
        self,
        key: str,
        *,
        expected_version: int | None = None,
        expected_revision: str | None = None,
    ) -> None:
        """Delete a value from the state with conflict detection."""
        with self._lock:
            self._ensure_no_conflict(expected_version, expected_revision)
            self._data.pop(key, None)
            self._version += 1
            self._revision = uuid4().hex
            self._updated_at = datetime.now(UTC)

    def snapshot(self) -> ProjectStateSnapshot:
        """Create an immutable snapshot of the current state."""
        with self._lock:
            return ProjectStateSnapshot(
                name=self._name,
                category=self._category,
                version=self._version,
                revision=self._revision,
                data=deepcopy(self._data),
            )

    def restore(
        self,
        snapshot: ProjectStateSnapshot,
        *,
        expected_version: int | None = None,
        expected_revision: str | None = None,
    ) -> None:
        """Restore the state from a snapshot."""
        if not isinstance(snapshot, ProjectStateSnapshot):
            raise ProjectStateSnapshotError(
                "restore() requires a ProjectStateSnapshot instance.",
            )

        with self._lock:
            self._ensure_no_conflict(expected_version, expected_revision)
            self._name = snapshot.name
            self._category = snapshot.category
            self._data = deepcopy(snapshot.data)
            self._version = snapshot.version
            self._revision = snapshot.revision
            self._updated_at = datetime.now(UTC)

    def as_dict(self) -> dict[str, Any]:
        """Return a serialized view of the project state."""
        with self._lock:
            return {
                "name": self._name,
                "category": self._category.value,
                "version": self._version,
                "revision": self._revision,
                "data": deepcopy(self._data),
                "created_at": self._created_at.isoformat(),
                "updated_at": self._updated_at.isoformat(),
            }

    def clone(self, *, name: str | None = None) -> ProjectState:
        """Clone the state into a new ProjectState instance."""
        with self._lock:
            return ProjectState(
                name=name or self._name,
                category=self._category,
                initial_data=deepcopy(self._data),
                version=self._version,
                revision=self._revision,
            )
