import { NextResponse } from "next/server";
import { generateTopicQuiz } from "@/lib/generateQuiz";
import { normalizeQuizList } from "@/lib/normalizeQuiz";

const BACKEND_URL = process.env.BACKEND_URL || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000"}`;

export const dynamic = "force-dynamic";

type QuizBody = {
  topic_title?: string;
  topic_description?: string;
  raw_text?: string;
  difficulty?: string;
};

export async function POST(request: Request) {
  let body: QuizBody;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const topicTitle = body.topic_title?.trim() || "Topic";
  const topicDescription = body.topic_description ?? "";
  const difficulty = body.difficulty ?? "Intermediate";
  const rawText = body.raw_text ?? "";

  try {
    const response = await fetch(`${BACKEND_URL}/api/topic-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (response.ok) {
      const data = await response.json();
      const quiz = normalizeQuizList(data.quiz);
      if (quiz.length > 0) {
        return NextResponse.json({
          topic_title: data.topic_title ?? topicTitle,
          quiz,
        });
      }
    }
  } catch {
    /* backend offline — use local fallback */
  }

  return NextResponse.json({
    topic_title: topicTitle,
    quiz: generateTopicQuiz(topicTitle, topicDescription, difficulty, rawText),
  });
}
