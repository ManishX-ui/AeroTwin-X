"""Vercel Serverless Function Entry Point for AeroTwin-X FastAPI Backend.

Provides standard ASGI 'app' callable for Vercel Python runtime.
Ensures correct system path resolution for the 'backend' package.
"""
import sys
import os

# Ensure the root project directory is on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app

# Vercel looks for 'app' as the ASGI application entry point
__all__ = ["app"]
