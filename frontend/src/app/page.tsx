"use client";
import React, { useEffect, useMemo, useState } from "react";
import TopicQuiz from "@/components/TopicQuiz";
import {
  computeQuizStats,
  flattenRoadmapTopics,
  loadQuizPerformance,
} from "@/lib/quizPerformance";
import {
  LayoutDashboard,
  BookOpen,
  Bookmark,
  Activity,
  UploadCloud,
  FileText,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader,
  Calendar,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Study Roadmap", icon: BookOpen },
  { label: "Flashcards", icon: Bookmark },
  { label: "Performance Analytics", icon: Activity },
];

const defaultTasks = [
  { title: "Upload your syllabus", subtitle: "Get a custom plan", badge: "Start" },
  { title: "Review today's topics", subtitle: "See your learning path", badge: "Focus" },
  { title: "Set exam goals", subtitle: "Track weekly progress", badge: "Plan" },
  { title: "Access flashcards", subtitle: "Boost retention", badge: "Learn" },
];

const tabs = ["Dashboard", "Study Roadmap", "Flashcards", "Performance Analytics"];

export default function StudentDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [selectedTopic, setSelectedTopic] = useState<{ moduleIndex: number; topicIndex: number } | null>(null);
  const [rawText, setRawText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiTopicMaterial, setAiTopicMaterial] = useState<any>(null);
  const [aiMaterialLoading, setAiMaterialLoading] = useState(false);
  const [perfVersion, setPerfVersion] = useState(0);

  const roadmapData = React.useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.target_learning_flow)) {
      return data.target_learning_flow.map((step: any) => ({
        module_name: `Step ${step.step_number}: ${step.step_title}`,
        description: `Follow this learning step in order. Difficulty: ${step.difficulty}.`,
        topics: (step.sub_topics ?? []).map((sub: any, idx: number) => ({
          title: sub.title,
          sequence: idx + 1,
          difficulty: step.difficulty,
          hours: Math.max(1, Math.ceil((sub.estimated_minutes ?? 45) / 60)),
          description: sub.description,
          quiz: sub.quiz ?? [],
          resources: [{ title: sub.description, url: null }],
        })),
      }));
    }
    return data.roadmap ?? [];
  }, [data]);

  const topicRefs = useMemo(() => flattenRoadmapTopics(roadmapData), [roadmapData]);

  const quizStats = useMemo(() => {
    void perfVersion;
    return computeQuizStats(topicRefs);
  }, [topicRefs, perfVersion]);

  const overallQuizPercent = quizStats.overallQuizPercent;

  useEffect(() => {
    setPerfVersion((v) => v + 1);
  }, []);

  const openTopicQuiz = (moduleIndex: number, topicIndex: number) => {
    setSelectedTopic({ moduleIndex, topicIndex });
    setActiveTab("Study Roadmap");
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse-syllabus", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          if (typeof errorJson.detail === "string") detail = errorJson.detail;
        } catch {
          /* plain-text error from proxy */
        }
        throw new Error(detail || "Upload failed. Please try again.");
      }

      const result = await response.json();

      setData(result);
      setRawText(result?.raw_text || "");
      setActiveTab("Study Roadmap");
      setExpandedModules(new Set([0]));
      setExpandedTopics(new Set());
      
      // Keep structural compatibility for the selected initial topic focus
      const safetyRoadmap = Array.isArray(result?.target_learning_flow)
        ? result.target_learning_flow
        : result?.roadmap ?? [];
        
      const firstStep = safetyRoadmap?.[0];
      const hasTopics =
        (firstStep?.sub_topics?.length ?? 0) > 0 || (firstStep?.topics?.length ?? 0) > 0;
      setSelectedTopic(hasTopics ? { moduleIndex: 0, topicIndex: 0 } : null);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed. Please try again.";
      setError(errorMessage);
      console.error("Error uploading syllabus:", error);
    } finally {
      setLoading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.type.startsWith("image/"))) {
      setFile(droppedFile);
      setError(null);
    }
  };

  const downloadRoadmapAsImage = async () => {
    if (!roadmapData.length) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1400;
    canvas.height = Math.max(800, roadmapData.length * 250);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let yPos = 40;
    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(data.course_name, 40, yPos);
    yPos += 60;

    roadmapData.forEach((module: any, modIdx: number) => {
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(30, yPos - 20, 1340, 40);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(module.module_name, 50, yPos + 10);
      yPos += 50;

      module.topics?.forEach((topic: any) => {
        ctx.font = "16px Arial";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(`• ${topic.title}`, 60, yPos);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px Arial";
        ctx.fillText(`(${topic.difficulty} - ${topic.hours}h)`, 400, yPos);
        yPos += 30;
      });
      yPos += 20;
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${data.course_name.replace(/\s+/g, "_")}_roadmap.png`;
    link.click();
  };

  const toggleModule = (index: number) => {
    const next = new Set(expandedModules);
    next.has(index) ? next.delete(index) : next.add(index);
    setExpandedModules(next);
  };

  const toggleTopic = (mIdx: number, tIdx: number) => {
    const key = `${mIdx}:${tIdx}`;
    const next = new Set(expandedTopics);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedTopics(next);
  };

  const totalTopics = roadmapData.flatMap((module: any) => module.topics ?? []).length ?? 0;
  const completion = data ? Math.min(100, Math.max(18, totalTopics * 17)) : 18;
  const progressStyle = {
    background: `conic-gradient(#4f46e5 ${completion * 3.6}deg, rgba(148, 163, 184, 0.18) 0deg)`,
  };

  const tasks = data
    ? (roadmapData || []).flatMap((module: any, moduleIndex: number) =>
        (module.topics ?? []).map((topic: any, topicIndex: number) => {
          const topicKey = `${moduleIndex}-${topicIndex}`;
          const score = loadQuizPerformance()[topicKey];
          return {
            title: topic.title,
            subtitle: topic.description || `Study this topic in ${module.module_name || "Modules"}`,
            badge: topic.difficulty || "Medium",
            moduleIndex,
            topicIndex,
            topicKey,
            quizScore: score?.percent ?? null,
            hasQuiz: true,
          };
        })
      )
    : defaultTasks;

  const flashcards: Array<{ question: string; answer: string }> = data
    ? (roadmapData || []).flatMap((module: any) =>
        (module.topics ?? []).map((topic: any) => ({
          question: `What is ${topic.title}?`,
          answer: topic.description || `Study the topic ${topic.title} using the linked resources.`,
        }))
      )
    : [];

  const selectedTopicData = selectedTopic && roadmapData?.[selectedTopic.moduleIndex]?.topics?.[selectedTopic.topicIndex]
    ? roadmapData[selectedTopic.moduleIndex].topics[selectedTopic.topicIndex]
    : null;

  const generateAiTopicMaterial = async () => {
    if (!selectedTopicData) return;
    setAiMaterialLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/topic-study-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_title: selectedTopicData.title,
          topic_description: selectedTopicData.description ?? "",
          raw_text: rawText || data?.raw_text || "",
        }),
      });
      
      if (!response.ok) {
        const msg = await response.text();
        let detail = msg;
        try {
          const parsed = JSON.parse(msg);
          if (typeof parsed.detail === "string") detail = parsed.detail;
        } catch {
          /* response was plain text */
        }
        throw new Error(detail || "Failed to generate AI topic material.");
      }
      
      const result = await response.json();
      setAiTopicMaterial(result);
      
    } catch (error) {
      console.error("Error generating topic material:", error);
      let message = "Failed to generate notes.";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          message = parsed.detail || error.message;
        } catch {
          message = error.message;
        }
      }
      setError(message);
    } finally {
      setAiMaterialLoading(false);
    }
  }; // <--- Cleans out all the bracket errors downstream!

  const buildAiStudyLinks = (topicTitle?: string, topicDescription?: string) => {
    if (!topicTitle) return [];
    const prompt = `Teach me ${topicTitle} for exams. Give a concise concept explanation, key formulas/definitions, common mistakes, and 5 practice questions with answers. Context: ${topicDescription ?? "No extra context."}`;
    const encodedPrompt = encodeURIComponent(prompt);
    const encodedTopic = encodeURIComponent(topicTitle);
    return [
      {
        label: "Open in ChatGPT",
        url: `https://chat.openai.com/?q=${encodedPrompt}`,
      },
      {
        label: "Open in Perplexity",
        url: `https://www.perplexity.ai/search/new?q=${encodedPrompt}`,
      },
      {
        label: "Google AI Search",
        url: `https://www.google.com/search?q=${encodedTopic}+study+notes+exam+prep`,
      },
    ];
  };

  const generateCalendarLink = (title: string, hours: number, moduleName?: string) => {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0].replace(/-/g, '');
    const startTime = now.toISOString().split('T')[1].substring(0, 5).replace(/:/g, '');
    const endDate = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '');
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString().split('T')[1].substring(0, 5).replace(/:/g, '');
    
    const eventTitle = `Study: ${title}`;
    const description = moduleName ? `Module: ${moduleName}\nTopic: ${title}\nEstimated duration: ${hours}h` : `Study topic: ${title}\nEstimated duration: ${hours}h`;
    
    const params = new URLSearchParams({
      text: eventTitle,
      dates: `${startDate}T${startTime}00/${endDate}T${endTime}00`,
      details: description,
    });
    
    return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
  };

  const answerSyllabusQuestion = (question: string) => {
    const sourceText = rawText || data?.raw_text || "";
    if (!sourceText.trim()) {
      return "Upload a syllabus first so I can answer questions from it.";
    }

    const normalizedQuestion = question.toLowerCase();
    const sentences = sourceText
      .replace(/\r/g, "")
      .split(/(?<=[.?!])\s+/)
      .map((sentence: string) => sentence.trim())
      .filter(Boolean);

    const keyTerms = normalizedQuestion.match(/\w+/g) || [];
    const matches = sentences.filter((sentence: string) =>
      keyTerms.some((term) => sentence.toLowerCase().includes(term)) && sentence.length > 30
    );

    if (matches.length) {
      return matches.slice(0, 3).join(" ");
    }

    const topicTerms = ["midterm", "mid-term", "exam", "grading", "assignment", "deadline", "policy", "project"];
    const fallback = sentences.find((sentence: string) =>
      topicTerms.some((term) => sentence.toLowerCase().includes(term))
    );

    return fallback || "I couldn't find a clear answer in the saved syllabus text. Try asking about midterms, grading, or assignment deadlines.";
  };

  const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    const answer = answerSyllabusQuestion(userText);

    setChatMessages((current) => [
      ...current,
      { role: "user", text: userText },
      { role: "assistant", text: answer },
    ]);
    setChatInput("");
    setChatOpen(true);
  };

  useEffect(() => {
    if (activeTab === "Study Roadmap" && !selectedTopic && roadmapData?.[0]?.topics?.[0]) {
      setSelectedTopic({ moduleIndex: 0, topicIndex: 0 });
    }
  }, [activeTab, roadmapData, selectedTopic]);

  const renderTabContent = () => {
    if (activeTab === "Performance Analytics") {
      return (
        <section className="grid gap-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Performance Analytics</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Quiz results by topic</h3>
                <p className="mt-2 text-sm text-slate-400">
                  All quizzes are taken on this website — no external links.
                </p>
              </div>
              {overallQuizPercent !== null ? (
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-emerald-300">Overall quiz score</p>
                  <p className="text-3xl font-bold text-white">{overallQuizPercent}%</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {quizStats.completedCount}/{quizStats.totalTopics} topics completed
                  </p>
                  {quizStats.averageOnCompleted !== null ? (
                    <p className="mt-1 text-xs text-emerald-200/80">
                      Avg. on completed: {quizStats.averageOnCompleted}%
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-950/80 px-4 py-2 text-sm text-slate-400">
                  No quizzes completed yet — take a quiz in Study Roadmap
                </div>
              )}
            </div>
            <div className="mt-8 space-y-3">
              {topicRefs.length ? (
                topicRefs.map((ref) => {
                  const record = loadQuizPerformance()[ref.key];
                  return (
                  <div
                    key={ref.key}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-4"
                  >
                    <div>
                      <p className="font-semibold text-white">{ref.title}</p>
                      {record ? (
                        <p className="text-xs text-slate-500">
                          {record.attempts} attempt{record.attempts !== 1 ? "s" : ""} · Last:{" "}
                          {new Date(record.lastAttempt).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Not taken yet</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500"
                          style={{ width: `${record?.percent ?? 0}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-emerald-300">
                        {record ? `${record.percent}%` : "—"}
                      </span>
                      {record ? (
                        <span className="text-sm text-slate-400">
                          {record.correct}/{record.total}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openTopicQuiz(ref.moduleIndex, ref.topicIndex)}
                          className="text-xs font-semibold text-indigo-300 underline"
                        >
                          Take quiz
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/80 p-8 text-center text-sm text-slate-500">
                  Upload a syllabus, open Study Roadmap, select a topic, and submit a quiz to see your performance.
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (activeTab === "Flashcards") {
      return (
        <section className="grid gap-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Flashcards</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Memory boosters from your syllabus</h3>
              </div>
              <div className="rounded-3xl bg-slate-950/80 px-4 py-2 text-sm text-slate-300">{flashcards.length} cards</div>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {flashcards.map((card, index) => (
                <div key={index} className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
                  <p className="text-base font-semibold text-white">{card.question}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{card.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (activeTab === "Study Roadmap") {
      return (
        <section className="grid gap-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Study Roadmap</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Topic-by-topic learning path</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-slate-300">Click a topic to open its resources</div>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-5">
                {roadmapData?.map((module: any, mIdx: number) => (
                  <div key={mIdx} className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{module.module_name}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{module.description || "Module overview not available."}</p>
                    <div className="mt-5 space-y-3">
                      {module.topics?.map((topic: any, tIdx: number) => {
                        const isSelected = selectedTopic?.moduleIndex === mIdx && selectedTopic?.topicIndex === tIdx;
                        const topicScore = loadQuizPerformance()[`${mIdx}-${tIdx}`];
                        return (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() => setSelectedTopic({ moduleIndex: mIdx, topicIndex: tIdx })}
                            className={`w-full text-left rounded-3xl border px-4 py-4 transition ${
                              isSelected
                                ? "border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                                : "border-white/10 bg-slate-900/80 hover:border-indigo-500/30 hover:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold text-white">{topic.title}</p>
                                <p className="text-sm text-slate-400">{topic.sequence ? `Order ${topic.sequence}` : `Topic ${tIdx + 1}`}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                                  {topic.difficulty}
                                </span>
                                {topicScore ? (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                    Quiz {topicScore.percent}%
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-400 line-clamp-2">{topic.description || "Tap to open study resources for this topic."}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Topic resources</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {selectedTopicData?.title ?? "Select a topic to view study material"}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedTopicData ? "Resources for the selected topic are shown below." : "Tap any topic card to open that topic's study materials."}
                    </p>
                  </div>
                  <span className="rounded-3xl bg-slate-900/90 px-4 py-2 text-sm text-slate-300">
                    {selectedTopicData ? selectedTopicData.difficulty : "Ready"}
                  </span>
                </div>
                <div className="mt-6 text-sm leading-6 text-slate-300">
                  {selectedTopicData ? selectedTopicData.description : "Choose a topic card on the left to reveal its focused study resources and links."}
                </div>
                {selectedTopicData ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={generateAiTopicMaterial}
                      disabled={aiMaterialLoading}
                      className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
                    >
                      {aiMaterialLoading ? "Generating AI notes..." : "Generate AI Notes for this Topic"}
                    </button>
                  </div>
                ) : null}
                {selectedTopicData ? (
                  <div className="mt-6 rounded-[24px] border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <p className="text-sm font-semibold text-indigo-200">AI study assistant links</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {buildAiStudyLinks(selectedTopicData.title, selectedTopicData.description).map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedTopicData && selectedTopic ? (
                  <TopicQuiz
                    topicKey={`${selectedTopic.moduleIndex}-${selectedTopic.topicIndex}`}
                    topicTitle={selectedTopicData.title}
                    topicDescription={selectedTopicData.description ?? ""}
                    difficulty={selectedTopicData.difficulty}
                    rawText={rawText || data?.raw_text || ""}
                    onPerformanceUpdate={() => setPerfVersion((v) => v + 1)}
                  />
                ) : null}
                {aiTopicMaterial && selectedTopicData ? (
                  <div className="mt-6 rounded-[28px] border border-violet-500/30 bg-violet-500/5 p-5">
                    <p className="text-sm font-semibold text-violet-200">AI-generated study notes</p>
                    <p className="mt-3 text-sm text-slate-200"><span className="font-semibold">High-yield summary:</span> {aiTopicMaterial.high_yield_summary}</p>
                    <p className="mt-2 text-sm text-slate-200"><span className="font-semibold">Must-know definition:</span> {aiTopicMaterial.must_know_definition}</p>
                    <p className="mt-2 text-sm text-slate-200"><span className="font-semibold">Common student trap:</span> {aiTopicMaterial.common_student_trap}</p>
                    <div className="mt-3 space-y-2">
                      {(aiTopicMaterial.active_recall_questions ?? []).map((q: string, idx: number) => (
                        <div key={idx} className="rounded-2xl border border-violet-300/20 bg-slate-950/70 p-3">
                          <p className="text-sm text-white"><span className="font-semibold">Q{idx + 1}:</span> {q}</p>
                          <p className="mt-1 text-sm text-slate-300"><span className="font-semibold">A:</span> {(aiTopicMaterial.active_recall_answers ?? [])[idx] ?? ""}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-slate-200"><span className="font-semibold">Practical application:</span> {aiTopicMaterial.practical_application}</p>
                  </div>
                ) : null}
                <div className="mt-8 rounded-[28px] border border-white/10 bg-slate-900/90 p-5">
                  <p className="text-sm font-semibold text-slate-100">Study materials</p>
                  <div className="mt-4 space-y-3">
                    {selectedTopicData?.resources?.length ? (
                      selectedTopicData.resources.map((resource: any, idx: number) =>
                        resource.url ? (
                          <a
                            key={idx}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4 transition hover:border-indigo-500/40 hover:bg-slate-900"
                          >
                            <p className="font-semibold text-white">{resource.title}</p>
                            <p className="mt-1 text-sm text-slate-400">{resource.url}</p>
                          </a>
                        ) : (
                          <div
                            key={idx}
                            className="rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4"
                          >
                            <p className="font-semibold text-white whitespace-pre-wrap leading-6">{resource.title}</p>
                          </div>
                        )
                      )
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/80 p-6 text-sm text-slate-500">
                        Select a topic to load its study materials.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="grid gap-6">
        <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Overview and quick actions</h3>
            </div>
            {overallQuizPercent !== null ? (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-100">
                Overall quiz score: <strong>{overallQuizPercent}%</strong> ·{" "}
                {quizStats.completedCount}/{quizStats.totalTopics} topics quizzed
              </div>
            ) : null}
            <div className="rounded-3xl bg-slate-950/80 px-4 py-2 text-sm text-slate-300">Smart study insights</div>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {tasks.slice(0, 4).map((task: any, index: number) => (
              <div key={index} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 transition hover:border-indigo-500/40 hover:bg-slate-900/90">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{task.title}</p>
                    <p className="mt-2 text-sm text-slate-400">{task.subtitle}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
                    {task.badge}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {"moduleIndex" in task ? (
                    <button
                      type="button"
                      onClick={() => openTopicQuiz(task.moduleIndex, task.topicIndex)}
                      className="inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Take quiz on site
                    </button>
                  ) : null}
                  {"quizScore" in task && task.quizScore !== null ? (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Score: {task.quizScore}%
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[320px_1fr] lg:px-10">
        <aside className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-transparent to-slate-950/0" />
          <div className="relative z-10 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">AI Study Planner</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Student Dashboard</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">Your intelligent learning hub with roadmap, tasks, and progress at a glance.</p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(item.label)}
                    className={`flex w-full items-center gap-3 rounded-3xl border px-4 py-3 text-left text-sm font-medium transition ${
                      activeTab === item.label
                        ? "border-indigo-500/70 bg-indigo-500/10 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-indigo-500/40 hover:bg-indigo-500/10"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-indigo-300" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Progress overview</p>
              <div className="mt-5 flex items-center gap-4">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-slate-900/90" style={progressStyle}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-center">
                    <span className="text-2xl font-semibold text-white">{completion}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Syllabus mapped</p>
                  <p className="mt-2 text-xl font-semibold text-white">{totalTopics} topics</p>
                  <p className="text-sm text-slate-500">Learning path from your upload.</p>
                </div>
              </div>
              {data && quizStats.totalTopics > 0 ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-emerald-300">Overall quiz score</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {overallQuizPercent !== null ? `${overallQuizPercent}%` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {quizStats.completedCount}/{quizStats.totalTopics} topics quizzed on this site
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Upload syllabus</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">Drag & drop your file</h2>
                  <p className="mt-2 text-sm text-slate-400">PDF or image (PNG, JPG)</p>
                </div>
                <div className="flex flex-col gap-2">
                  <UploadCloud className="h-10 w-10 text-indigo-300" />
                  {data ? (
                    <button
                      type="button"
                      onClick={downloadRoadmapAsImage}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <Download className="h-4 w-4" />
                      Download Roadmap
                    </button>
                  ) : null}
                </div>
              </div>

              <form onSubmit={handleUpload} className="mt-8">
                <label
                  htmlFor="syllabus-upload"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`group block rounded-[28px] border-2 p-8 transition ${
                    isDragging ? "border-indigo-400 bg-indigo-500/10" : "border-slate-700 bg-slate-950/80"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-300 transition group-hover:bg-indigo-500/15">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">Drop your file here</p>
                      <p className="mt-1 text-sm text-slate-400">PDF or image (PNG, JPG) — upload to generate a personalized study roadmap.</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 sm:flex-row">
                      <span className="overflow-hidden rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-300">{file?.name ?? "No file selected"}</span>
                      <input
                        id="syllabus-upload"
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        onChange={(event) => {
                          setFile(event.target.files?.[0] || null);
                          setError(null);
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById("syllabus-upload")?.click()}
                        className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                      >
                        Browse files
                      </button>
                    </div>
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Generating study plan…
                    </>
                  ) : (
                    "Generate AI Study Plan"
                  )}
                </button>
                {loading && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader className="h-5 w-5 animate-spin text-indigo-400" />
                      <span className="text-sm font-semibold text-slate-300">Processing your syllabus...</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse"></div>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="mt-6 rounded-[24px] border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm font-semibold text-red-300">⚠️ Error</p>
                    <p className="mt-2 text-sm text-red-200">{error}</p>
                  </div>
                )}
              </form>
            </div>

            <div className="space-y-6 rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Navigation</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Choose a view</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`w-full rounded-[28px] px-4 py-3 text-sm font-semibold transition ${
                        activeTab === tab
                          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                          : "bg-slate-950/80 text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {renderTabContent()}
        </main>
      </div>
      <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[95vw]">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Syllabus Chat</p>
              <h3 className="text-sm font-semibold text-white">Ask your syllabus</h3>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen((open) => !open)}
              className="rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {chatOpen ? "Hide" : "Open"}
            </button>
          </div>
          {chatOpen && (
            <div className="mt-4 flex max-h-[420px] flex-col gap-3 overflow-hidden">
              <div className="min-h-[160px] overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900/90 p-3 text-sm text-slate-300">
                {chatMessages.length ? (
                  chatMessages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`mb-3 rounded-3xl p-3 ${
                        message.role === "user"
                          ? "bg-slate-800 text-slate-100"
                          : "bg-slate-950/80 text-slate-200"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                        {message.role === "user" ? "You" : "Syllabus AI"}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    Ask questions like “When is the mid-term exam?” or “What is the grading policy?”
                  </div>
                )}
              </div>
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={data ? "Ask about your uploaded syllabus..." : "Upload a syllabus first"}
                  disabled={!data}
                  className="flex-1 rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || !data}
                  className="rounded-3xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
