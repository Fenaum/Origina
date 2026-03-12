# Logging module configuration
# logging is a built-in Python module that provides a flexible framework for emitting log messages from Python programs.
import logging
from app.core.config import LOG_LEVEL

def setup_logger() -> logging.Logger:
# Create a custom logger and name it "origina_backend"
    logger = logging.getLogger("origina_backend")
    logger.setLevel(LOG_LEVEL) # Set the logging level based on configuration

    if logger.handlers: #if handlers already exist,
        return logger  # Prevent duplicate handlers

    handler = logging.StreamHandler() # Create a console handler to output logs to the console

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s" # Define log message format
    )
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    logger.propagate = False

    return logger

logger = setup_logger()

# Example usage:
# logger.debug("This is a debug message")   '# Log a debug message
# logger.info("This is an info message")     '# Log an info message
# logger.warning("This is a warning message") '# Log a warning message
# logger.error("This is an error message")   '# Log an error message
# logger.critical("This is a critical message") '# Log a critical message   