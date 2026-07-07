import os
import sys
from pathlib import Path

# Ensure backend folder is importable when Vercel runs this file from the project root.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from backend.main import app
except ImportError as e:
    # Fallback: import from current directory if backend import fails
    import json
    from typing import List
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/api/health")
    async def health():
        return {"status": "ok", "error": f"Backend import failed: {str(e)}"}

# Export the FastAPI app for Vercel's Python runtime
__all__ = ['app']
