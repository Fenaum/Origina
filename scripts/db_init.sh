#!/usr/bin/env bash

export PYTHONPATH="$(pwd)/src/backend"
python scripts/init_db.py

# run chmod +x scripts/db_init.sh to make it executable, then run ./scripts/db_init.sh to initialize the database.