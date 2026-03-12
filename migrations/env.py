# ============================================================================
# ALEMBIC MIGRATION CONFIGURATION (env.py)
# ============================================================================
# 
# PURPOSE: This file is the main configuration script for Alembic, which is a 
# database migration tool for SQLAlchemy. Alembic runs this script every time 
# you execute a migration command (e.g., `alembic upgrade head`).
#
# KEY FEATURES:
# - Reads the database URL from an environment variable (DATABASE_URL) - An environment variable is a dynamic value set outside the application, often used for configuration settings like database connections.
# - Supports both "online" mode (connected to DB) and "offline" mode (SQL generation)
# - Ensures all pending database migrations are applied in the correct order
# - Useful for containerized deployments where the DB URL is provided at runtime

# Import logging configuration to set up logging for Alembic migrations
from logging.config import fileConfig
# Import 'os' to read environment variables (like DATABASE_URL)
import os

# Import SQLAlchemy utilities for creating database engines and connection pools
from sqlalchemy import engine_from_config, pool
# Import Alembic context to manage migration configuration and execution
from alembic import context
from app.db.base import Base
from app.models import *  # ensures models are imported so Base.metadata is complete

target_metadata = Base.metadata


# ============================================================================
# LOAD ALEMBIC CONFIGURATION
# ============================================================================
# Get the Alembic configuration object from the current context
# This object contains settings from alembic.ini (the main config file)
config = context.config

# If an alembic.ini file exists, use it to configure Python logging
# This helps you see debug messages and warnings during migrations
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ============================================================================
# METADATA CONFIGURATION
# ============================================================================
# target_metadata = None means we're using "tracking-only" mode
# This means Alembic won't auto-generate migrations from your SQLAlchemy models
# Instead, you manually write SQL scripts in the migrations/ folder
# This gives you full control over exactly what changes happen to the database
target_metadata = None

# ============================================================================
# HELPER FUNCTION: Get Database URL from Environment
# ============================================================================
def get_database_url() -> str:
    """
    Reads the database connection URL from the DATABASE_URL environment variable.
    
    Returns:
        str: The database URL (e.g., "postgresql://user:password@localhost:5432/dbname")
    
    Raises:
        RuntimeError: If DATABASE_URL environment variable is not set
    """
    # Try to read the DATABASE_URL environment variable
    # This variable should contain the full database connection string
    url = os.getenv("DATABASE_URL")
    
    # If DATABASE_URL is not set, raise an error with a helpful message
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    
    # Return the database URL for use in creating the database connection
    return url

# ============================================================================
# MIGRATION FUNCTION: Online Mode (Connected to Database)
# ============================================================================
def run_migrations_online() -> None:
    """
    Execute migrations while directly connected to the database (online mode).
    
    This function:
    1. Gets the database URL from the environment variable
    2. Creates a connection to the database
    3. Runs all pending migrations
    
    Use this mode in production or when you have direct database access.
    """
    # Get the Alembic configuration section as a dictionary
    # This contains SQLAlchemy connection settings from alembic.ini
    configuration = config.get_section(config.config_ini_section) or {}
    
    # Override the SQLAlchemy URL in the configuration with the one from the environment
    # This ensures we connect to the correct database at runtime
    configuration["sqlalchemy.url"] = get_database_url()

    # Create a database engine (connection pool) using the configuration
    # prefix="sqlalchemy." tells it to read only config keys starting with "sqlalchemy."
    # poolclass=pool.NullPool disables connection pooling (good for migrations)
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # Establish an actual connection to the database
    with connectable.connect() as connection:
        # Tell Alembic how to run migrations on this connection
        context.configure(
            connection=connection,  # Use this database connection
            target_metadata=target_metadata,  # No auto-generation (tracking-only mode)
        )

        # Start a database transaction and run all pending migrations
        with context.begin_transaction():
            # Execute all migration scripts that haven't been run yet
            context.run_migrations()

# ============================================================================
# MIGRATION FUNCTION: Offline Mode (Generate SQL Without Connecting)
# ============================================================================
def run_migrations_offline() -> None:
    """
    Execute migrations in offline mode, generating SQL without connecting to the database.
    
    This function:
    1. Gets the database URL from the environment variable
    2. Generates SQL migration scripts without executing them
    3. Outputs the SQL that would be run
    
    Use this mode to:
    - Review the SQL before applying it
    - Generate migration scripts for database administrators
    - Run migrations in restricted environments without direct DB access
    """
    # Get the database URL from the environment variable
    url = get_database_url()
    
    # Configure Alembic for offline mode (no actual database connection)
    context.configure(
        url=url,  # Tell Alembic the database URL (for SQL dialect detection)
        target_metadata=target_metadata,  # No auto-generation (tracking-only mode)
        literal_binds=True,  # Replace SQL parameters with literal values in output
        dialect_opts={"paramstyle": "named"},  # Use named parameters in SQL (e.g., :param_name)
    )

    # Start a database transaction context (even in offline mode)
    with context.begin_transaction():
        # Generate and output all pending migration scripts as SQL
        context.run_migrations()

# ============================================================================
# DETERMINE WHICH MODE TO RUN AND EXECUTE
# ============================================================================

# Check if Alembic is running in offline mode (usually set via command-line flag)
# Example: alembic upgrade head --sql (generates SQL without applying it)
if context.is_offline_mode():
    # If offline mode is enabled, generate SQL scripts without connecting to the database
    run_migrations_offline()
else:
    # If offline mode is not enabled, connect to the database and apply migrations directly
    run_migrations_online()
