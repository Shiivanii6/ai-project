import type { QuizQuestion } from "@/components/TopicQuiz";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function asOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const options = value.map(asString).filter(Boolean);
  return Array.from(new Set(options)).slice(0, 4);
}

export function normalizeQuizQuestion(raw: unknown, index: number): QuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const question = asString(item.question);
  let options = asOptions(item.options);
  let correct = asString(item.correct_answer ?? item.correctAnswer ?? item.answer);

  if (options.length < 2) return null;

  if (correct && !options.includes(correct)) {
    const match = options.find((o) => o.toLowerCase() === correct.toLowerCase());
    if (match) correct = match;
    else options = [correct, ...options].slice(0, 4);
  }

  if (!correct) correct = options[0];

  const level = asString(item.difficulty_level ?? item.difficulty) || "Moderate";
  const difficulty_level =
    level === "Easy" || level === "Tough" || level === "Moderate" ? level : "Moderate";

  return {
    difficulty_level,
    question: question || `Question ${index + 1}`,
    options,
    correct_answer: correct,
    explanation: asString(item.explanation) || "Review the topic notes and try again.",
  };
}

export function normalizeQuizList(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => normalizeQuizQuestion(item, idx))
    .filter((q): q is QuizQuestion => q !== null);
}
