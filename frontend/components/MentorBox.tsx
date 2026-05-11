"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ClipboardCopy, ExternalLink, Loader2, MessageCircleQuestion, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import type { ClassSlot, Task } from "@/lib/types";

// ── Context prompt builder ────────────────────────────────────────────────────

function buildPrompt(tasks: Task[], schedule: ClassSlot[]): string {
  const today = new Date();
  const dow = (today.getDay() + 1) % 7; // 0=Sun … 5=Fri same as backend
  const todaySlots = schedule.filter((s) => s.day_of_week === dow && s.is_active);
  const activeTasks = tasks.filter((t) => t.status !== "Done" && !t.parent_task_id).slice(0, 15);

  const dateStr = today.toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const classLines = todaySlots.length
    ? todaySlots.map((s) => `  • ${s.start_time}–${s.end_time}: ${s.subject_name}${s.room ? ` (${s.room})` : ""}`).join("\n")
    : "  • No classes today";

  const taskLines = activeTasks.length
    ? activeTasks.map((t) => {
        const due = t.due_date ? ` — due ${new Date(t.due_date).toLocaleDateString("he-IL")}` : "";
        return `  • [${t.status}] ${t.title}${due}`;
      }).join("\n")
    : "  • No active tasks";

  return [
    `You are my academic study assistant. Today is ${dateStr}.`,
    "",
    "My schedule today:",
    classLines,
    "",
    "My active tasks:",
    taskLines,
    "",
    "I'm feeling a bit lost. Please:",
    "1. Acknowledge how I'm feeling briefly",
    "2. Identify the ONE most important thing I should do right now",
    "3. Break it into 2–3 small concrete steps I can start immediately",
    "4. End with a short encouraging sentence",
    "",
    "Be concise, warm, and practical.",
  ].join("\n");
}

// ── AI tool options ───────────────────────────────────────────────────────────

const AI_TOOLS = [
  { name: "Claude",   url: "https://claude.ai/new",         emoji: "🤖" },
  { name: "ChatGPT",  url: "https://chat.openai.com/",      emoji: "💬" },
  { name: "Gemini",   url: "https://gemini.google.com/app", emoji: "✨" },
];

// ── Main component ────────────────────────────────────────────────────────────

export function MentorBox() {
  const [open, setOpen] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.tasks.list(),
    enabled: open,
  });

  const { data: schedule = [] } = useQuery({
    queryKey: ["schedule"],
    queryFn: api.schedule.list,
    enabled: open,
  });

  const mentorMutation = useMutation({
    mutationFn: api.ai.mentor,
    onSuccess: (data) => setAdvice(data.advice),
  });

  function handleOpen() {
    setOpen(true);
    if (!advice) mentorMutation.mutate();
  }

  async function handleCopyPrompt() {
    const prompt = buildPrompt(tasks, schedule);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleOpenTool(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setToolOpen(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="trigger"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={handleOpen}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-sage px-4 py-2.5 text-sm font-medium text-white shadow-modal hover:bg-sage-dark transition-base"
          >
            <MessageCircleQuestion size={16} />
            אבוד? תשאל אותי
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => { setOpen(false); setToolOpen(false); }}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-border bg-surface shadow-modal p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧑‍🏫</span>
                  <p className="text-sm font-semibold text-text-primary">מה לעשות עכשיו?</p>
                </div>
                <button
                  onClick={() => { setOpen(false); setToolOpen(false); }}
                  className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
                >
                  <X size={15} />
                </button>
              </div>

              {/* AI advice content */}
              <div className="min-h-[80px]">
                {mentorMutation.isPending && (
                  <div className="flex flex-col items-center justify-center gap-2 py-6 text-text-muted">
                    <Loader2 size={20} className="animate-spin text-sage" />
                    <p className="text-xs">חושב…</p>
                  </div>
                )}

                {mentorMutation.isError && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
                    <p className="text-xs text-amber-800">
                      ה-AI המקומי לא זמין. העתק את ההקשר ופתח כלי AI:
                    </p>
                  </div>
                )}

                {advice && !mentorMutation.isPending && (
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap text-right" dir="rtl">
                    {advice}
                  </p>
                )}
              </div>

              {/* Actions row */}
              <div className="mt-3 flex items-center gap-2">
                {/* Refresh */}
                {(advice || mentorMutation.isError) && !mentorMutation.isPending && (
                  <button
                    onClick={() => { setAdvice(null); mentorMutation.mutate(); }}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-sage transition-base"
                  >
                    <RefreshCw size={11} />
                    רענן
                  </button>
                )}

                <div className="flex-1" />

                {/* Copy prompt */}
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-sage transition-base"
                  title="Copy structured context prompt to clipboard"
                >
                  {copied ? <Check size={11} className="text-sage" /> : <ClipboardCopy size={11} />}
                  {copied ? "הועתק!" : "העתק הקשר"}
                </button>

                {/* Open in AI tool dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setToolOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-lg bg-sage-light border border-sage/30 px-2 py-1 text-xs font-medium text-sage hover:bg-sage hover:text-white transition-base"
                  >
                    <ExternalLink size={11} />
                    פתח ב-AI
                    <ChevronDown size={10} className={toolOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>

                  <AnimatePresence>
                    {toolOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.1 }}
                        className="absolute bottom-full right-0 mb-1.5 rounded-xl border border-border bg-surface shadow-modal overflow-hidden min-w-[130px]"
                      >
                        {AI_TOOLS.map((tool) => (
                          <button
                            key={tool.name}
                            onClick={() => handleOpenTool(tool.url)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-sage-light hover:text-sage transition-base"
                          >
                            <span>{tool.emoji}</span>
                            {tool.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
