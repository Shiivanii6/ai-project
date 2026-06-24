import type { QuizQuestion } from "@/components/TopicQuiz";

/** Local fallback when Gemini backend is offline. */
export function generateTopicQuiz(
  topicTitle: string,
  description: string,
  difficulty: string,
  _rawText = ""
): QuizQuestion[] {
  const title = topicTitle.trim() || "this topic";
  const desc = (description || title).trim();

  return [
    {
      difficulty_level: "Easy",
      question: `Which statement best describes the core idea of ${title}?`,
      options: [
        desc.length > 25 ? desc.slice(0, 200) : `Key concepts of ${title} applied to course problems`,
        `${title} is unrelated to the syllabus and never appears on assessments`,
        "The only requirement is to memorize the unit number",
        "Understanding definitions is unnecessary if you guess on exams",
      ],
      correct_answer:
        desc.length > 25 ? desc.slice(0, 200) : `Key concepts of ${title} applied to course problems`,
      explanation: `This matches how ${title} is framed in your learning path.`,
    },
    {
      difficulty_level: "Moderate",
      question: `You are given an applied problem involving ${title}. What is the best first step?`,
      options: [
        "Identify givens, recall the governing principle, then solve step by step",
        "Pick an answer at random without writing reasoning",
        "Use a formula from a different unit because it looks familiar",
        "Skip the question because the title was not repeated in the prompt",
      ],
      correct_answer: "Identify givens, recall the governing principle, then solve step by step",
      explanation: "Exam-style items reward structured reasoning, not guessing.",
    },
    {
      difficulty_level: "Moderate",
      question: `Which study approach most improves retention of ${title}?`,
      options: [
        "Active recall with varied practice problems after reviewing one worked example",
        "Passive highlighting without practice",
        "Cramming only the night before with no retrieval practice",
        "Avoiding all practice because the topic seems easy",
      ],
      correct_answer: "Active recall with varied practice problems after reviewing one worked example",
      explanation: "Retrieval practice plus examples beats passive review.",
    },
    {
      difficulty_level: "Tough",
      question: `A solution about ${title} gives the right final value but wrong units/logic. What does that suggest?`,
      options: [
        "You may be using a memorized template without understanding constraints",
        "You fully mastered the topic and need no review",
        "Units never matter in this subject",
        "Any answer with a number is automatically correct",
      ],
      correct_answer: "You may be using a memorized template without understanding constraints",
      explanation: "Correct reasoning must match both result and justification.",
    },
    {
      difficulty_level: "Tough",
      question: `At ${difficulty} level, how should you demonstrate mastery of ${title}?`,
      options: [
        "Explain the concept, justify each step, and solve a novel scenario",
        "Recite the title from memory only",
        "List unrelated facts from other modules",
        "Repeat one memorized answer without adaptation",
      ],
      correct_answer: "Explain the concept, justify each step, and solve a novel scenario",
      explanation: "Mastery is shown by explanation and transfer to new problems.",
    },
  ];
}
