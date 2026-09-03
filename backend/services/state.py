"""
CreditPulse AI — Centralized State Management Service v8.0.0

Replaces scattered global dicts with a thread-safe singleton.
Designed for drop-in replacement with Redis/PostgreSQL in production.

Architecture:
    AppState (in-memory, thread-safe)
        └── Can be swapped for RedisState / PostgresState via ABC
"""

from __future__ import annotations

import threading
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class StateBackend(ABC):
    """Abstract state backend — implement for Redis/Postgres."""

    @abstractmethod
    def get(self, key: str, default: Any = None) -> Any: ...

    @abstractmethod
    def set(self, key: str, value: Any) -> None: ...

    @abstractmethod
    def increment(self, key: str, amount: int = 1) -> int: ...


class InMemoryState(StateBackend):
    """Thread-safe in-memory state with locking.
    
    Production replacement: RedisState or PostgresState implementing StateBackend.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = value

    def increment(self, key: str, amount: int = 1) -> int:
        with self._lock:
            current = self._data.get(key, 0)
            new_val = current + amount
            self._data[key] = new_val
            return new_val

    def get_all(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._data)


class AppStateManager:
    """Singleton state manager for the entire application.
    
    Centralizes:
    - stats counters (total_analyses, total_records)
    - autonomous keeper state
    - server metadata
    
    Thread-safe by design. Ready for Redis/Postgres swap.
    """

    _instance: Optional[AppStateManager] = None
    _init_lock = threading.Lock()

    def __new__(cls) -> AppStateManager:
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._backend = InMemoryState()
        self._server_start_time = time.time()

        # Initialize default counters
        self._backend.set("total_analyses", 0)
        self._backend.set("total_records", 0)

        # Initialize autonomous keeper state
        self._backend.set("autonomous_state", {
            "enabled": False,
            "last_cycle_time": None,
            "last_cycle_result": None,
            "total_cycles": 0,
            "total_auto_broadcasts": 0,
            "monitored_assets": [],
            "cycle_errors": 0,
        })

        self._initialized = True

    @property
    def server_start_time(self) -> float:
        return self._server_start_time

    # --- Stats ---
    def increment_analyses(self) -> int:
        return self._backend.increment("total_analyses")

    def increment_records(self) -> int:
        return self._backend.increment("total_records")

    @property
    def stats(self) -> Dict[str, int]:
        return {
            "total_analyses": self._backend.get("total_analyses", 0),
            "total_records": self._backend.get("total_records", 0),
        }

    # --- Autonomous State ---
    def get_autonomous_state(self) -> Dict[str, Any]:
        return self._backend.get("autonomous_state", {})

    def update_autonomous_state(self, **kwargs) -> None:
        state = self.get_autonomous_state()
        state.update(kwargs)
        self._backend.set("autonomous_state", state)

    def increment_autonomous_counter(self, key: str) -> None:
        state = self.get_autonomous_state()
        state[key] = state.get(key, 0) + 1
        self._backend.set("autonomous_state", state)


# Module-level singleton
app_state = AppStateManager()
