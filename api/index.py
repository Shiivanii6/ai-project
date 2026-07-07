import json
import os
import re
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    import google.genai as genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

from pydantic import BaseModel
from pypdf import PdfReader

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SubTopic(BaseModel):
    title: str
    description: str
    estimated_minutes: int


class LearningStep(BaseModel):
    step_number: int
    step_title: str
    difficulty: str
    sub_topics: List[SubTopic]


class StructuredSyllabus(BaseModel):
    course_name: str
    target_learning_flow: List[LearningStep]


class TopicStudyMaterialRequest(BaseModel):
    topic_title: str
    topic_description: str = ""
    raw_text: str = ""


class TopicStudyMaterialResponse(BaseModel):
    topic_title: str
    high_yield_summary: str
    must_know_definition: str
    common_student_trap: str
    active_recall_questions: List[str]
    active_recall_answers: List[str]
    practical_application: str


class TopicQuizRequest(BaseModel):
    topic_title: str
    topic_description: str = ""
    raw_text: str = ""
    difficulty: str = "Intermediate"
    ai_style: str = "Gemini"


class QuizQuestionItem(BaseModel):
    difficulty_level: str
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    ai_style: str


class TopicQuizResponse(BaseModel):
    topic_title: str
    quiz: List[QuizQuestionItem]


def _api_key() -> str | None:
    for name in ("GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        value = os.getenv(name, "").strip()
        if value:
            return value
    return None


API_KEY = _api_key()
ai_client = None
if API_KEY:
    try:
        ai_client = genai.Client(api_key=API_KEY)
    except Exception as exc:
        print(f"WARNING: Gemini client failed to initialize: {exc}")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "ai_enabled": ai_client is not None,
        "ai_mode": "gemini" if ai_client is not None else "local_fallback",
    }


@app.get("/")
async def root():
    return {"message": "Smart Syllabus Tutor API"}


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9:,\- ]+", " ", text)).strip()


def _extract_ordered_topics(raw_text: str) -> List[str]:
    ordered: List[str] = []
    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = re.match(
            r"^(Module|Week|Unit|Chapter|Topic|Section)\s*[\dA-Za-z\-]*\s*[:\-]\s*(.+)$",
            line,
            re.I,
        )
        if not match:
            continue
        payload = match.group(2)
        for part in re.split(r"[-,;/]", payload):
            topic = _clean_text(part).title()
            if len(topic) >= 4 and topic.lower() not in {"ltpc", "credits"}:
                ordered.append(topic)
    if ordered:
        return ordered
    words = raw_text.split()
    topics = []
    i = 0
    while i < len(words):
        if len(topics) >= 8:
            break
        phrase = _clean_text(" ".join(words[i : i + 3])).title()
        if len(phrase) >= 4:
            topics.append(phrase)
        i += 1
    return topics


@app.post("/api/parse-syllabus", response_model=StructuredSyllabus)
async def parse_syllabus(file: UploadFile = File(...)):
    """Parse syllabus PDF and extract structured topics."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    contents = await file.read()
    try:
        reader = PdfReader(contents)
        raw_text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="PDF contains no extractable text")

    course_name_match = re.search(r"(CS|MATH|ENG|PHYS|CHEM|BIO)\s*\d{3,4}[A-Z]?", raw_text)
    course_name = course_name_match.group(0) if course_name_match else "Course"

    topics = _extract_ordered_topics(raw_text)

    learning_steps = [
        LearningStep(
            step_number=i + 1,
            step_title=topic,
            difficulty="Intermediate",
            sub_topics=[
                SubTopic(
                    title=f"{topic} Fundamentals",
                    description=f"Basic concepts of {topic}",
                    estimated_minutes=30,
                ),
                SubTopic(
                    title=f"{topic} Advanced Topics",
                    description=f"Advanced concepts of {topic}",
                    estimated_minutes=45,
                ),
            ],
        )
        for i, topic in enumerate(topics)
    ]

    return StructuredSyllabus(course_name=course_name, target_learning_flow=learning_steps)


@app.post("/api/topic-quiz", response_model=TopicQuizResponse)
async def generate_quiz(request: TopicQuizRequest):
    """Generate quiz questions for a topic using Gemini."""
    if not ai_client:
        raise HTTPException(
            status_code=503,
            detail="AI service not available. Please configure GOOGLE_GENAI_API_KEY.",
        )

    prompt = f"""Generate {3} multiple-choice quiz questions for {request.difficulty} level about "{request.topic_title}".
    
    Format each question as JSON with: difficulty_level, question, options (4), correct_answer, explanation, ai_style.
    Return valid JSON array."""

    try:
        response = ai_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=2000,
            ),
        )

        response_text = response.text
        json_match = re.search(r"\[.*\]", response_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON array found in response")

        questions = json.loads(json_match.group())
        return TopicQuizResponse(topic_title=request.topic_title, quiz=questions)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")


@app.post("/api/topic-study-material", response_model=TopicStudyMaterialResponse)
async def generate_study_material(request: TopicStudyMaterialRequest):
    """Generate study materials for a topic using Gemini."""
    if not ai_client:
        raise HTTPException(
            status_code=503,
            detail="AI service not available. Please configure GOOGLE_GENAI_API_KEY.",
        )

    prompt = f"""Create comprehensive study material for "{request.topic_title}".
    Provide: high_yield_summary, must_know_definition, common_student_trap, active_recall_questions (3), active_recall_answers (3), practical_application.
    Return as valid JSON."""

    try:
        response = ai_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=2000,
            ),
        )

        response_text = response.text
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON object found in response")

        material_data = json.loads(json_match.group())
        material_data["topic_title"] = request.topic_title
        return TopicStudyMaterialResponse(**material_data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate study material: {str(e)}")
