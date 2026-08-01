from __future__ import annotations

import pytest

from runtime.dependency.container import DependencyContainer
from runtime.dependency.exceptions import CircularDependencyError


class Database:
    pass


class Repository:
    def __init__(self, database: Database) -> None:
        self.database = database


class Service:
    def __init__(self, repository: Repository) -> None:
        self.repository = repository


class NodeA:
    def __init__(self, node_b: "NodeB") -> None:
        self.node_b = node_b


class NodeB:
    def __init__(self, node_a: NodeA) -> None:
        self.node_a = node_a


def test_recursive_dependency_resolution() -> None:
    container = DependencyContainer()
    container.register(Database)
    container.register(Repository)
    container.register(Service)

    service = container.resolve(Service)

    assert isinstance(service.repository, Repository)
    assert isinstance(service.repository.database, Database)


def test_circular_dependency_detection() -> None:
    container = DependencyContainer()
    container.register(NodeA)
    container.register(NodeB)

    with pytest.raises(CircularDependencyError):
        container.resolve(NodeA)
