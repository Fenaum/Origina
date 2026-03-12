# The purpose of this file is to set up a contract with the environment.
# It defines how the application is configured in any environment (development, testing, production).
# It does this by reading settings from environment variables and providing defaults where necessary.

from dotenv import load_dotenv  # Load environment variables from a .env file if present
import os  # Import os to read environment variables because Python's built-in os module provides a way to interact with the operating system

# Load environment variables from .env file if it exists
load_dotenv()

APP_NAME = "Origina Backend Service"
VERSION = "1.0.0"

APP_ENV = os.getenv("APP_ENV", "local")
LOG_LEVEL = os.getenv("LOG_LEVEL", "debug")

DEBUG = APP_ENV in ["local", "development"]

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

