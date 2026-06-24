"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeQuizList } from "@/lib/normalizeQuiz";
import { loadQuizPerformance, saveQuizPerformance } from "@/lib/quizPerformance";

export type QuizQuestion = {
  difficulty_level: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

export type QuizPerformanceRecord = {
  topicKey: string;
  topicTitle: string;
  correct: number;
  total: number;
  percent: number;
  lastAttempt: string;
  attempts: number;
};

type TopicQuizProps = {
  topicKey: string;
  topicTitle: string;
  topicDescription?: string;
  difficulty?: string;
  rawText?: string;
  onPerformanceUpdate?: () => void;
};

async function fetchTopicQuiz(
  topicTitle: string,
  topicDescription: string,
  difficulty: string,
  rawText: string
): Promise<QuizQuestion[]> {
  const response = await fetch("/api/topic-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_title: topicTitle,
      topic_description: topicDescription,
      difficulty,
      raw_text: rawText,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Could not load quiz questions.");
  }

  const data = await response.json();
  const quiz = normalizeQuizList(data.quiz);
  if (!quiz.length) throw new Error("Quiz response was empty.");
  return quiz;
}

export default function TopicQuiz({
  topicKey,
  topicTitle,
  topicDescription = "",
  difficulty = "Intermediate",
  rawText = "",
  onPerformanceUpdate,
}: TopicQuizProps) {
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const loadQuiz = (generation: number) => {
    setLoading(true);
    setLoadError(null);
    setAnswers({});
    setSubmitted(false);
    setScore(null);

    fetchTopicQuiz(topicTitle, topicDescription, difficulty, rawText)
      .then((questions) => {
        if (loadGenerationRef.current !== generation) return;
        setQuiz(questions);
      })
      .catch((err: unknown) => {
        if (loadGenerationRef.current !== generation) return;
        setQuiz([]);
        setLoadError(err instanceof Error ? err.message : "Could not load quiz.");
      })
      .finally(() => {
        if (loadGenerationRef.current !== generation) return;
        setLoading(false);
      });
  };

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    loadQuiz(generation);
  }, [topicKey, topicTitle, topicDescription, difficulty, rawText]);

  const handleSubmit = () => {
    if (!quiz.length || submitted) return;
    let correct = 0;
    quiz.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) correct += 1;
    });
    const total = quiz.length;
    const percent = Math.round((correct / total) * 100);
    const existing = loadQuizPerformance()[topicKey];
    const record: QuizPerformanceRecord = {
      topicKey,
      topicTitle,
      correct,
      total,
      percent,
      lastAttempt: new Date().toISOString(),
      attempts: (existing?.attempts ?? 0) + 1,
    };
    saveQuizPerformance(record);
    setScore({ correct, total });
    setSubmitted(true);
    onPerformanceUpdate?.();
  };

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const saved = loadQuizPerformance()[topicKey];

  const refreshQuestions = () => {
    const generation = ++loadGenerationRef.current;
    loadQuiz(generation);
  };

  const pickAnswer = (questionIndex: number, option: string) => {
    if (submitted || loading) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: option }));
  };

  return (
    <div className="relative z-20 mt-6 rounded-[28px] border border-emerald-500/30 bg-emerald-500/5 p-5 pointer-events-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-200">AI practice quiz</p>
          <p className="mt-1 text-xs text-slate-400">
            Gemini-generated questions for this topic — select one answer per question, then submit.
          </p>
        </div>
        {saved ? (
          <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-emerald-300">
            Last score: {saved.percent}% ({saved.correct}/{saved.total})
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Generating quiz questions…</p>
      ) : null}

      {loadError ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {loadError}
          <button
            type="button"
            onClick={refreshQuestions}
            className="mt-2 block text-xs font-semibold text-indigo-300 underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <div className="mt-4 space-y-4">
          {quiz.map((q, qIdx) => (
            <fieldset
              key={`${topicKey}-q-${qIdx}`}
              disabled={submitted}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
            >
              <legend className="mb-3 flex w-full items-start gap-2 px-1">
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                    q.difficulty_level === "Easy"
                      ? "border-green-500/20 bg-green-500/10 text-green-400"
                      : q.difficulty_level === "Moderate"
                        ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                        : "border-red-500/20 bg-red-500/10 text-red-400"
                  }`}
                >
                  {q.difficulty_level}
                </span>
                <span className="text-sm font-medium text-white">
                  {qIdx + 1}. {q.question}
                </span>
              </legend>

              <div className="space-y-2">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[qIdx] === opt;
                  const showResult = submitted;
                  const isCorrect = opt === q.correct_answer;
                  let optionClass =
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left text-sm transition ";
                  if (showResult && selected && isCorrect) {
                    optionClass += "border-green-500/50 bg-green-500/15 text-green-100";
                  } else if (showResult && selected && !isCorrect) {
                    optionClass += "border-red-500/50 bg-red-500/15 text-red-100";
                  } else if (showResult && isCorrect) {
                    optionClass += "border-green-500/30 bg-green-500/10 text-green-200";
                  } else if (selected) {
                    optionClass += "border-indigo-500/50 bg-indigo-500/15 text-white";
                  } else {
                    optionClass +=
                      "border-white/10 bg-slate-900/50 text-slate-300 hover:border-indigo-500/30";
                  }

                  return (
                    <label key={`${qIdx}-${optIdx}`} className={optionClass}>
                      <input
                        type="radio"
                        name={`quiz-${topicKey}-${qIdx}`}
                        value={opt}
                        checked={selected}
                        onChange={() => pickAnswer(qIdx, opt)}
                        className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>

              {submitted ? <p className="mt-2 text-xs text-slate-400">{q.explanation}</p> : null}
            </fieldset>
          ))}
        </div>
      ) : null}

      {!loading && !loadError && !submitted ? (
        <button
          type="button"
          disabled={answeredCount < quiz.length}
          onClick={handleSubmit}
          className="mt-4 w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit quiz ({answeredCount}/{quiz.length} answered)
        </button>
      ) : null}

      {!loading && !loadError && submitted && score ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-white">
            {score.correct} / {score.total} correct
          </p>
          <p className="mt-1 text-sm text-emerald-200">
            {Math.round((score.correct / score.total) * 100)}% — saved to your performance report
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setScore(null);
              setAnswers({});
            }}
            className="mt-3 text-xs font-semibold text-indigo-300 underline"
          >
            Try again (same questions)
          </button>
        </div>
      ) : null}

      {!loading ? (
        <button
          type="button"
          onClick={refreshQuestions}
          className="mt-3 text-xs font-semibold text-slate-400 underline hover:text-slate-200"
        >
          Generate new AI questions
        </button>
      ) : null}
    </div>
  );
}
