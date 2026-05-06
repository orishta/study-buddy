"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BookOpen, Loader2, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Step = "input" | "preview";

interface SyllabusDialogProps {
  courseId: number;
  open: boolean;
  onClose: () => void;
}

export function SyllabusDialog({ courseId, open, onClose }: SyllabusDialogProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    // Reset after animation finishes
    setTimeout(() => {
      setStep("input");
      setText("");
      setTopics([]);
      setSelected(new Set());
      setError(null);
    }, 200);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  const extractMutation = useMutation({
    mutationFn: () => api.ai.extractTopics(courseId, text),
    onSuccess: (data) => {
      setTopics(data.topics);
      setSelected(new Set(data.topics.map((_, i) => i)));
      setStep("preview");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message.includes("503")
        ? "Ollama is not running. Start it with: ollama serve"
        : err.message.includes("502")
        ? "Could not extract topics. Try pasting cleaner text."
        : "Something went wrong. Please try again.");
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const chosen = topics.filter((_, i) => selected.has(i));
      for (const topic of chosen) {
        await api.materials.create(courseId, { topic_name: topic });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", courseId] });
      handleClose();
    },
    onError: () => setError("Failed to add topics. Please try again."),
  });

  function toggleAll() {
    if (selected.size === topics.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(topics.map((_, i) => i)));
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface shadow-modal border border-border p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {step === "preview" && (
                  <button
                    onClick={() => { setStep("input"); setError(null); }}
                    className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-sage" />
                  <h2 className="font-semibold text-text-primary">
                    {step === "input" ? "Import from syllabus" : "Review topics"}
                  </h2>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted mb-5">
              {step === "input"
                ? "Paste your course syllabus and the AI will extract study topics automatically."
                : `${topics.length} topics found — select which ones to add to your tracker.`}
            </p>

            {/* Step: input */}
            {step === "input" && (
              <div className="space-y-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your syllabus here..."
                  rows={8}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base resize-none"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-text-muted border border-border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-base"
                  >
                    <BookOpen size={12} />
                    Upload .txt file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="text-xs text-text-muted">or paste text above</span>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => extractMutation.mutate()}
                    disabled={!text.trim() || extractMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                  >
                    {extractMutation.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Extracting…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Extract topics
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step: preview */}
            {step === "preview" && (
              <div className="space-y-3">
                {/* Select all toggle */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-text-muted">
                    {selected.size} of {topics.length} selected
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-sage hover:underline transition-base"
                  >
                    {selected.size === topics.length ? "Deselect all" : "Select all"}
                  </button>
                </div>

                {/* Topic list */}
                <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {topics.map((topic, i) => (
                    <label
                      key={i}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-base",
                        selected.has(i) ? "bg-sage-light" : "hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            next.has(i) ? next.delete(i) : next.add(i);
                            return next;
                          });
                        }}
                        className="accent-sage w-3.5 h-3.5 shrink-0"
                      />
                      <span className="text-sm text-text-primary">{topic}</span>
                    </label>
                  ))}
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => addMutation.mutate()}
                    disabled={selected.size === 0 || addMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                  >
                    {addMutation.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Adding…
                      </>
                    ) : (
                      `Add ${selected.size} topic${selected.size !== 1 ? "s" : ""}`
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
