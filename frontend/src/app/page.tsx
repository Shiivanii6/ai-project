"use client";
import React, { useEffect, useState } from "react";
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
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiTopicMaterial, setAiTopicMaterial] = useState<any>(null);
  const [aiMaterialLoading, setAiMaterialLoading] = useState(false);
  const [topicQuizzes, setTopicQuizzes] = useState<Map<string, any>>(new Map());
  const [quizLoading, setQuizLoading] = useState(false);

  const roadmapData = React.useMemo(() => {
    if (!data) return [];
    const targetFlow = data.target_learning_flow || data.roadmap || [];
    if (Array.isArray(targetFlow)) {
      return targetFlow.map((step: any, sIdx: number) => {
        const rawTopics = step.sub_topics || step.topics || [];
        return {
          module_name: step.module_name || `Step ${step.step_number || sIdx + 1}: ${step.step_title || 'Learning Step'}`,
          description: step.description || `Follow this learning step in order. Difficulty: ${step.difficulty || 'Medium'}.`,
          topics: Array.isArray(rawTopics) ? rawTopics.map((sub: any, idx: number) => ({
            title: sub.title || sub.topic_name || "Untitled Topic",
            sequence: sub.sequence || idx + 1,
            difficulty: sub.difficulty || step.difficulty || "Medium",
            hours: Math.max(1, Math.ceil((sub.estimated_minutes ?? 45) / 60)),
            description: sub.description || "No description provided.",
            resources: Array.isArray(sub.resources) ? sub.resources : [{ title: sub.description || "Reference Details", url: null }],
            ai_study_prompt: sub.ai_study_prompt || "",
            quiz: Array.isArray(sub.quiz) ? sub.quiz : []
          })) : []
        };
      });
    }
    return [];
  }, [data]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log("🚀 Starting file upload...", { fileName: file.name, fileSize: file.size });
      const response = await fetch("/api/parse-syllabus", {
        method: "POST",
        body: formData,
      });

      console.log("📥 Response received:", { status: response.status, statusText: response.statusText });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const text = await response.text();
      console.log("📝 Response text length:", text.length);
      
      const result = JSON.parse(text);
      console.log("✅ Upload successful! Data parsed:", {
        courseN: result?.course_name,
        steps: result?.target_learning_flow?.length,
        rawTextLength: result?.raw_text?.length,
      });
      
      console.log("🔄 Setting state...");
      setData(result);
      setRawText(result?.raw_text || "");
      setActiveTab("Study Roadmap");
      setExpandedModules(new Set([0]));
      setExpandedTopics(new Set());

      const safetyFlow = result?.target_learning_flow || result?.roadmap || [];
      const firstTopicList = safetyFlow?.[0]?.sub_topics || safetyFlow?.[0]?.topics;
      setSelectedTopic(Array.isArray(firstTopicList) && firstTopicList.length > 0 ? { moduleIndex: 0, topicIndex: 0 } : null);
      console.log("✅ State updated!");

    } catch (err: any) {
      const errorMsg = `❌ Upload error: ${err.message}`;
      console.error(errorMsg, err);
      setError("An error occurred while connecting to the backend server. Please make sure your python backend is running.");
    } finally {
      console.log("🏁 Upload finished");
      setLoading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
    }
  };

  const generateAiTopicMaterial = async () => {
    if (!selectedTopicData) return;
    setAiMaterialLoading(true);
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
      if (!response.ok) throw new Error("Failed to generate AI topic material.");
      const result = await response.json();
      setAiTopicMaterial(result);
    } catch (error) {
      console.error(error);
    } finally {
      setAiMaterialLoading(false);
    }
  };

  const generateQuiz = async () => {
    if (!selectedTopicData) return;
    const quizKey = `${selectedTopic?.moduleIndex}-${selectedTopic?.topicIndex}`;
    if (topicQuizzes.has(quizKey)) return; // Already generated

    setQuizLoading(true);
    try {
      const response = await fetch("/api/topic-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_title: selectedTopicData.title,
          topic_description: selectedTopicData.description ?? "",
          raw_text: rawText || data?.raw_text || "",
          difficulty: selectedTopicData.difficulty || "Intermediate",
          ai_style: "Gemini",
        }),
      });
      if (!response.ok) throw new Error("Failed to generate quiz.");
      const result = await response.json();
      setTopicQuizzes(new Map(topicQuizzes).set(quizKey, result));
    } catch (error) {
      console.error("Quiz generation error:", error);
      setError("Failed to generate quiz. Please try again.");
    } finally {
      setQuizLoading(false);
    }
  };

  const totalTopics = roadmapData.flatMap((module: any) => module.topics ?? []).length ?? 0;
  const completion = data ? Math.min(100, Math.max(18, totalTopics * 17)) : 18;
  const progressStyle = {
    background: `conic-gradient(#4f46e5 ${completion * 3.6}deg, rgba(148, 163, 184, 0.18) 0deg)`,
  };

  const tasks = data
    ? roadmapData.flatMap((module: any) =>
        module.topics.map((topic: any) => ({
          title: topic.title,
          subtitle: topic.description || `Study this topic in ${module.module_name}`,
          badge: topic.difficulty || "Medium",
          ai_study_prompt: topic.ai_study_prompt || `Explain the foundational core details of ${topic.title}`,
          quiz: topic.quiz || []
        }))
      )
    : defaultTasks;

  const flashcards = data
    ? roadmapData.flatMap((module: any) =>
        module.topics.map((topic: any) => ({
          question: `What is ${topic.title}?`,
          answer: topic.description || `Study the topic ${topic.title} using the linked resources.`,
        }))
      )
    : [];

  const selectedTopicData = selectedTopic && roadmapData?.[selectedTopic.moduleIndex]?.topics?.[selectedTopic.topicIndex]
    ? roadmapData[selectedTopic.moduleIndex].topics[selectedTopic.topicIndex]
    : null;

  const quizKey = selectedTopic ? `${selectedTopic.moduleIndex}-${selectedTopic.topicIndex}` : null;
  const currentQuiz = quizKey ? topicQuizzes.get(quizKey) : null;

  const buildAiStudyLinks = (topicTitle?: string, topicDescription?: string) => {
    if (!topicTitle) return [];
    const prompt = `Teach me ${topicTitle} for exams. Give a concise concept explanation, key formulas/definitions, common mistakes, and 5 practice questions with answers. Context: ${topicDescription ?? "No extra context."}`;
    return [
      { label: "Open in ChatGPT", url: `https://chat.openai.com/?q=${encodeURIComponent(prompt)}` },
      { label: "Open in Perplexity", url: `https://www.perplexity.ai/search/new?q=${encodeURIComponent(prompt)}` },
      { label: "Google AI Search", url: `https://www.google.com/search?q=${encodeURIComponent(topicTitle)}+study+notes+exam+prep` },
    ];
  };

  const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    const sourceText = rawText || data?.raw_text || "";
    
    let answer = "Upload a syllabus first so I can answer questions from it.";
    if (sourceText) {
      const match = sourceText.split(/[.!?]/).find((s: string) => s.toLowerCase().includes(userText.toLowerCase()));
      answer = match ? match.trim() : "I couldn't find a clear answer in the syllabus. Try asking about midterms, grading, or assignments.";
    }

    setChatMessages((current) => [
      ...current,
      { role: "user", text: userText },
      { role: "assistant", text: answer },
    ]);
    setChatInput("");
  };

  useEffect(() => {
    if (activeTab === "Study Roadmap" && !selectedTopic && roadmapData?.[0]?.topics?.[0]) {
      setSelectedTopic({ moduleIndex: 0, topicIndex: 0 });
    }
  }, [activeTab, roadmapData, selectedTopic]);

  const renderTabContent = () => {
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
                    <p className="mt-3 text-sm leading-6 text-slate-300">{module.description}</p>
                    <div className="mt-5 space-y-3">
                      {module.topics?.map((topic: any, tIdx: number) => {
                        const isSelected = selectedTopic?.moduleIndex === mIdx && selectedTopic?.topicIndex === tIdx;
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
                                <p className="text-sm text-slate-400">{`Order ${topic.sequence}`}</p>
                              </div>
                              <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                                {topic.difficulty}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-slate-400 line-clamp-2">{topic.description}</p>
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
                  </div>
                  <span className="rounded-3xl bg-slate-900/90 px-4 py-2 text-sm text-slate-300">
                    {selectedTopicData ? selectedTopicData.difficulty : "Ready"}
                  </span>
                </div>
                <div className="mt-6 text-sm leading-6 text-slate-300">
                  {selectedTopicData ? selectedTopicData.description : "Choose a topic card on the left to reveal its focused study resources."}
                </div>
                {selectedTopicData && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={generateAiTopicMaterial}
                      disabled={aiMaterialLoading}
                      className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                    >
                      {aiMaterialLoading ? "Generating AI notes..." : "Generate AI Notes for this Topic"}
                    </button>
                    <button
                      type="button"
                      onClick={generateQuiz}
                      disabled={quizLoading || (quizKey ? topicQuizzes.has(quizKey) : false)}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                    >
                      {quizLoading ? "Generating Quiz..." : quizKey && topicQuizzes.has(quizKey) ? "Quiz Ready" : "Generate Quiz"}
                    </button>
                  </div>
                )}
                {selectedTopicData && (
                  <div className="mt-6 rounded-[24px] border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <p className="text-sm font-semibold text-indigo-200">AI study assistant links</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {buildAiStudyLinks(selectedTopicData.title, selectedTopicData.description).map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-8 rounded-[28px] border border-white/10 bg-slate-900/90 p-5">
                  <p className="text-sm font-semibold text-slate-100">Study materials</p>
                  <div className="mt-4 space-y-3">
                    {selectedTopicData?.resources?.length ? (
                      selectedTopicData.resources.map((resource: any, idx: number) => (
                        <div key={idx} className="rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4">
                          <p className="font-semibold text-white whitespace-pre-wrap leading-6">{resource.title}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/80 p-6 text-sm text-slate-500">
                        Select a topic to load its study materials.
                      </div>
                    )}
                  </div>
                </div>

                {currentQuiz && currentQuiz.quiz && currentQuiz.quiz.length > 0 && (
                  <div className="mt-8 rounded-[28px] border border-teal-500/30 bg-teal-500/5 p-5">
                    <p className="text-sm font-semibold text-teal-100">📊 Topic Quiz - {currentQuiz.quiz.length} Questions</p>
                    <div className="mt-4 space-y-4">
                      {currentQuiz.quiz.map((question: any, qIdx: number) => (
                        <div key={qIdx} className="rounded-[20px] border border-teal-400/30 bg-teal-950/40 p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <p className="text-sm font-semibold text-teal-100">Q{qIdx + 1}: {question.question}</p>
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-500/20 text-teal-300">
                              {question.difficulty_level}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {question.options?.map((option: string, oIdx: number) => {
                              const isCorrect = option === question.correct_answer;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => {
                                    if (isCorrect) {
                                      alert(`✅ CORRECT!\n\n${question.explanation}`);
                                    } else {
                                      alert(`❌ Not quite.\n\nCorrect answer: ${question.correct_answer}\n\n${question.explanation}`);
                                    }
                                  }}
                                  className="w-full text-left text-xs bg-slate-900/50 hover:bg-teal-900/30 border border-teal-400/20 p-3 rounded-lg text-slate-300 hover:text-teal-100 transition-all"
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            <div className="rounded-3xl bg-slate-950/80 px-4 py-2 text-sm text-slate-300">Smart study insights</div>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {tasks.slice(0, 4).map((task, index) => (
              <div key={index} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 hover:bg-slate-900/90 transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{task.title}</p>
                    <p className="mt-2 text-sm text-slate-400">{task.subtitle}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <a
                    href={`https://www.perplexity.ai/?q=${encodeURIComponent(task.ai_study_prompt || `Explain the concept of ${task.title}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-2xl text-indigo-400 bg-indigo-950/40 border border-indigo-500/30 hover:bg-indigo-900/50 transition-all duration-150"
                  >
                    ✨ Deep Dive with AI
                  </a>
                </div>
                {task.quiz && task.quiz.length > 0 && (
                  <div className="mt-5 border-t pt-4 border-white/10">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">📊 Target Practice Quiz</h4>
                    <div className="space-y-3">
                      {task.quiz.map((q: any, qIdx: number) => (
                        <div key={qIdx} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                          <p className="text-xs font-medium text-slate-200">{q.question}</p>
                          <div className="grid grid-cols-1 gap-2 mt-2">
                            {q.options?.map((opt: string, oIdx: number) => (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => alert(opt === q.correct_answer ? `🎉 CORRECT!\n\n${q.explanation}` : "❌ TRY AGAIN!")}
                                className="text-left text-xs bg-slate-900/40 hover:bg-indigo-950/30 border border-white/5 p-2.5 rounded-xl text-slate-300 transition-all"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <span className="mt-4 inline-block rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase text-indigo-300">{task.badge}</span>
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
        <aside className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-transparent to-slate-950/0" />
          <div className="relative z-10 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">AI Study Planner</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Student Dashboard</h1>
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950">
                    <span className="text-2xl font-semibold text-white">{completion}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Overall Course Progress</p>
                  <p className="mt-2 text-xl font-semibold text-white">{totalTopics} topics mapped</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 p-8 text-center bg-slate-950/40">
                <form onSubmit={handleUpload} className="w-full max-w-md flex flex-col items-center">
                  <label onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="w-full cursor-pointer flex flex-col items-center p-6">
                    <UploadCloud className="h-12 w-12 text-indigo-400" />
                    <span className="mt-4 text-sm text-slate-300 font-medium">Drag or upload your files here</span>
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                  {file && <p className="text-xs text-indigo-300 my-2">File: {file.name}</p>}
                  <button type="submit" disabled={loading} className="mt-4 px-6 py-2.5 rounded-full bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50">
                    {loading ? "Processing Document..." : "Generate Study Material"}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl flex flex-col justify-between min-h-[300px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Syllabus AI Assistant</p>
                <div className="mt-4 max-h-[200px] overflow-y-auto space-y-3 pr-2">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Ask me anything about exam weightage, grading rules, or assignment timelines.</p>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className={`p-3 rounded-2xl text-xs max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 ml-auto text-white' : 'bg-slate-950 text-slate-300'}`}>
                        {msg.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <form onSubmit={handleChatSubmit} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about midterms, grading format..."
                  className="w-full text-xs bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-2xl px-4 transition">Ask</button>
              </form>
            </div>
          </section>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-sm">{error}</div>}
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}