import type { QuizPerformanceRecord } from "@/components/TopicQuiz";

export type { QuizPerformanceRecord };

export const QUIZ_STORAGE_KEY = "syllabus-quiz-performance";

export function loadQuizPerformance(): Record<string, QuizPerformanceRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveQuizPerformance(record: QuizPerformanceRecord) {
  const all = loadQuizPerformance();
  all[record.topicKey] = record;
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(all));
}

export type TopicRef = { key: string; title: string; moduleIndex: number; topicIndex: number };

export function flattenRoadmapTopics(
  roadmapData: Array<{ topics?: Array<{ title: string }> }>
): TopicRef[] {
  const list: TopicRef[] = [];
  roadmapData.forEach((module, mIdx) => {
    (module.topics ?? []).forEach((topic, tIdx) => {
      list.push({
        key: `${mIdx}-${tIdx}`,
        title: topic.title,
        moduleIndex: mIdx,
        topicIndex: tIdx,
      });
    });
  });
  return list;
}

export function computeQuizStats(topicRefs: TopicRef[]) {
  const perf = loadQuizPerformance();
  const total = topicRefs.length;
  if (!total) {
    return {
      overallQuizPercent: null as number | null,
      completedCount: 0,
      totalTopics: 0,
      averageOnCompleted: null as number | null,
    };
  }

  let sumAllTopics = 0;
  let sumCompleted = 0;
  let completedCount = 0;

  topicRefs.forEach((ref) => {
    const record = perf[ref.key];
    if (record) {
      sumAllTopics += record.percent;
      sumCompleted += record.percent;
      completedCount += 1;
    }
  });

  if (completedCount === 0) {
    return {
      overallQuizPercent: null,
      completedCount: 0,
      totalTopics: total,
      averageOnCompleted: null,
    };
  }

  return {
    overallQuizPercent: Math.round(sumAllTopics / total),
    completedCount,
    totalTopics: total,
    averageOnCompleted: Math.round(sumCompleted / completedCount),
  };
}
