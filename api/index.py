import os
import sys
from pathlib import Path

# Ensure backend folder is importable when Vercel runs this file from the project root.
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.main import app

# Export the FastAPI app for Vercel's Python runtime
__all__ = ['app']
