"""Graph validation and dependency management service."""

from typing import List, Tuple, Set, Dict, Optional


class GraphValidationError(Exception):
    """Raised when an edge or node structure violates graph constraints."""
    pass


def detect_cycle_with_new_edge(
    existing_edges: List[Tuple[str, str]],
    new_source: str,
    new_target: str,
) -> bool:
    """
    Detect whether adding an edge (new_source -> new_target) creates a directed cycle.
    An edge (u -> v) means task v depends on task u.
    Adding (u -> v) creates a cycle if there is already a path from v to u.
    """
    if new_source == new_target:
        return True

    # Build adjacency list: node -> set of successor nodes
    adj: Dict[str, Set[str]] = {}
    for src, tgt in existing_edges:
        if src not in adj:
            adj[src] = set()
        adj[src].add(tgt)

    # Search for any path from new_target to new_source using BFS
    visited: Set[str] = set()
    queue = [new_target]

    while queue:
        curr = queue.pop(0)
        if curr == new_source:
            return True

        if curr not in visited:
            visited.add(curr)
            for neighbor in adj.get(curr, set()):
                if neighbor not in visited:
                    queue.append(neighbor)

    return False


def validate_dag(tasks: List[str], edges: List[Tuple[str, str]]) -> Optional[str]:
    """
    Validate that an entire set of edges form a valid DAG over existing tasks.
    Returns None if valid, or an error message if invalid.
    """
    task_set = set(tasks)
    for src, tgt in edges:
        if src not in task_set:
            return f"Source task '{src}' does not exist."
        if tgt not in task_set:
            return f"Target task '{tgt}' does not exist."
        if src == tgt:
            return f"Self-loop dependency detected on task '{src}'."

    # Topological sort via Kahn's algorithm
    in_degree: Dict[str, int] = {t: 0 for t in tasks}
    adj: Dict[str, List[str]] = {t: [] for t in tasks}

    for src, tgt in edges:
        adj[src].append(tgt)
        in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue = [t for t in tasks if in_degree[t] == 0]
    visited_count = 0

    while queue:
        curr = queue.pop(0)
        visited_count += 1
        for neighbor in adj.get(curr, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if visited_count != len(tasks):
        return "Cycle detected: The workflow contains circular dependencies."

    return None
