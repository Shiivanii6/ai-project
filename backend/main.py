import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import json
from typing import List
from google import genai
from google.genai import types
from pypdf import PdfReader
from urllib.parse import quote_plus
import re

app = FastAPI()

# This tells the server it is safe to talk to your web browser interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. We define the clean template structure we want back from the AI
class StudyResource(BaseModel):
    title: str = Field(description="Title of the study resource")
    url: Optional[str] = Field(None, description="Optional link to the study resource")

class Topic(BaseModel):
    title: str = Field(description="Name of the topic or concept")
    difficulty: str = Field(description="Difficulty level: Beginner, Intermediate, or Advanced")
    hours: int = Field(description="Estimated hours to complete")
    sequence: Optional[int] = Field(None, description="Recommended order position within the roadmap")
    description: Optional[str] = Field(None, description="Optional longer description of the topic")
    resources: List[StudyResource] = Field(default_factory=list, description="Recommended study materials for this topic")

class CourseModule(BaseModel):
    module_name: str = Field(description="Title of the unit or chapter")
    description: Optional[str] = Field(None, description="Optional module-level description")
    topics: List[Topic] = Field(description="Core sub-topics inside this module")

class StructuredSyllabus(BaseModel):
    course_name: str = Field(description="The official title of the course")
    roadmap: List[CourseModule] = Field(description="Chronological study roadmap")

API_KEY = os.getenv("GOOGLE_GENAI_API_KEY")
if API_KEY:
    # Connect to the modern native Gemini AI client
    ai_client = genai.Client(api_key=API_KEY)
else:
    # No API key — run in local dev fallback mode (returns sample data)
    ai_client = None


@app.post("/api/parse-syllabus")
async def parse_syllabus(file: UploadFile = File(...)):
    print("parse_syllabus handler file=", __file__)
    raw_text = ""
    
    # Check file type and extract text accordingly
    if file.content_type == "application/pdf":
        try:
            from pypdf import PdfReader
            pdf_reader = PdfReader(file.file)
            for page in pdf_reader.pages:
                raw_text += page.extract_text() or ""
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unable to read PDF: {exc}") from exc
    elif file.content_type and file.content_type.startswith("image/"):
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(file.file)
            raw_text = pytesseract.image_to_string(img)
        except ImportError:
            print("OCR libraries not available, using filename-based fallback")
            raw_text = f"Image: {file.filename}"
        except Exception as exc:
            print(f"OCR error: {exc}, using filename-based fallback")
            raw_text = f"Image: {file.filename}"
    else:
        raise HTTPException(status_code=400, detail="File must be a PDF or image (PNG, JPG)")

    # Check if extracted text is sufficient (not a scanned image with no text)
    if len(raw_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="This PDF looks like a scanned image. Please upload a text-based PDF.")

    # If no AI client configured, generate a development roadmap based on the uploaded content
    if ai_client is None:
        sample = generate_dev_roadmap(raw_text, file.filename)
        return sample

def generate_dev_roadmap(raw_text: str, filename: str) -> dict:
    def normalize_heading(line: str) -> str:
        return re.sub(r"[^A-Za-z0-9 ]+", " ", line).strip().title()

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    headings = []
    for line in lines:
        if re.match(r"^(Module|Week|Topic|Section)\b", line, re.I):
            headings.append(normalize_heading(line))
        elif len(headings) < 6 and len(line) < 60 and line.isupper():
            headings.append(normalize_heading(line))
        if len(headings) >= 6:
            break

    if not headings:
        snippet = raw_text.replace("\n", " ")[:120]
        headings = [f"Introduction to {filename.replace('.pdf','').replace('_',' ').title()}", "Core Concepts", "Advanced Practice"]
        if snippet:
            headings[0] = f"Introduction to {snippet.split(' ')[0]}"

    topics = []
    for idx, heading in enumerate(headings[:5], start=1):
        topic_title = heading if heading else f"Topic {idx}"
        difficulty = "Beginner" if idx == 1 else "Intermediate" if idx == 2 else "Advanced" if idx >= 4 else "Intermediate"
        resources = [
            {
                "title": f"Search for {topic_title}",
                "url": f"https://www.google.com/search?q={quote_plus(topic_title + ' tutorial')}"
            },
            {
                "title": f"Wikipedia: {topic_title}",
                "url": f"https://en.wikipedia.org/wiki/{quote_plus(topic_title).replace('+', '_')}"
            }
        ]
        topics.append(
            {
                "title": topic_title,
                "difficulty": difficulty,
                "hours": max(1, 2 + (idx - 1) * 1),
                "sequence": idx,
                "description": f"A focused study topic based on the syllabus content for {topic_title}.",
                "resources": resources,
            }
        )

    roadmap = [
        {
            "module_name": "Foundations",
            "description": "Key topics to begin your learning journey.",
            "topics": topics[:2],
        },
        {
            "module_name": "Intermediate Practice",
            "description": "Build experience with practical application.",
            "topics": topics[2:4] or topics[2:],
        },
        {
            "module_name": "Advanced Mastery",
            "description": "Finish with deeper, high-impact topics.",
            "topics": topics[4:] or [],
        },
    ]

    if not roadmap[2]["topics"]:
        roadmap = roadmap[:2]

    return {
        "course_name": f"{filename.replace('.pdf', '').replace('_', ' ').title()} Study Plan",
        "roadmap": roadmap,
    }

    # Send the raw text to Gemini 2.5 Flash and force it to fill out our template layout
    prompt = f"Convert this raw syllabus text cleanly into the requested structured JSON template layout:\n\n{raw_text}"

    try:
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=StructuredSyllabus,
                temperature=0.1
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc

    try:
        parsed = json.loads(response.text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Backend returned invalid JSON") from exc

    return parsed


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
