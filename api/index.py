import os
import sys
from pathlib import Path

# Ensure backend folder is importable when Vercel runs this file from the project root.
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

from backend.main import app
