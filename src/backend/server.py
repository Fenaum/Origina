#!/usr/bin/env python3
"""Basic development server for the Origina backend.

Provides a minimal Flask app with a health check and an echo endpoint.

Usage:
  1. Install dependencies: `pip install -r requirements.txt`
  2. Run: `python src/backend/server.py`
  3. Environment variables:
	 - `HOST` (default `127.0.0.1`)
	 - `PORT` (default `8000`)
	 - `DEBUG` (set to `1`/`true` to enable Flask debug)
"""
from __future__ import annotations

import logging
import os
import sys
from typing import Any, Dict

try:
	from flask import Flask, jsonify, request
except Exception:  # pragma: no cover - handled at runtime
	Flask = None  # type: ignore

logger = logging.getLogger("origina.server")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def create_app() -> Any:
	"""Create and configure the Flask application.

	Raises RuntimeError if Flask is not installed with a helpful message.
	"""
	if Flask is None:
		raise RuntimeError(
			"Flask is not installed. Install dependencies with: pip install -r requirements.txt"
		)

	app = Flask(__name__)

	@app.route("/", methods=["GET"])
	def index() -> Any:
		return jsonify({"message": "Origina backend", "status": "ok"})

	@app.route("/health", methods=["GET"])
	def health() -> Any:
		return jsonify({"status": "ok"})

	@app.route("/echo", methods=["POST"])
	def echo() -> Any:
		data = request.get_json(silent=True)
		if data is None:
			return jsonify({"error": "invalid or missing JSON body"}), 400
		return jsonify({"echo": data})

	return app


def main() -> None:
	host = os.getenv("HOST", "127.0.0.1")
	port = int(os.getenv("PORT", "8000"))
	debug = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

	try:
		app = create_app()
	except RuntimeError as exc:
		logger.error(str(exc))
		sys.exit(1)

	logger.info("Starting Origina server on %s:%s (debug=%s)", host, port, debug)
	app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
	main()

