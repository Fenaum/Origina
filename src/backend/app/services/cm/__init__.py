"""Capital Markets (CM) PoC services.

All CM business logic lives under this package. Routers in api/v1/cm.py stay
thin (parse + authorize); every calc lives here. Per ADR "Calculation
Ownership Map", these services are the single source of truth — UI never
re-derives economics from raw loan data, it reads persisted snapshots.

Naming convention (CLAUDE.md): services are suffixed `_repo.py` even though
they hold business logic.
"""
