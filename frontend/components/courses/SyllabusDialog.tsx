"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, FileText, Loader2, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Step = "input" | "preview";
type InputMode = "pdf" | "text";

interface SyllabusDialogProps {
  courseId: number;
  open: boolean;
  onClose: () => void;
}

export function SyllabusDialog({ courseId, open, onClose }: SyllabusDialogProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("input");
  const [mode, setMode] = useState<InputMode>("pdf");
  const [text, setText] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep("input");
      setMode("pdf");
      setText("");
      setPdfBase64(null);
      setPdfName(null);
      setTopics([]);
      setSelected(new Set());
      setError(null);
    }, 200);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        // Strip "data:application/pdf;base64," prefix
        setPdfBase64(result.split(",")[1]);
        setPdfName(file.name);
        setText("");
        setMode("pdf");
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setText((ev.target?.result as string) ?? "");
        setPdfBase64(null);
        setPdfName(null);
        setMode("text");
      };
      reader.readAsText(file, "utf-8");
    }
    e.target.value = "";
  }

  const canExtract = mode === "pdf" ? !!pdfBase64 : !!text.trim();

  const extractMutation = useMutation({
    mutationFn: () =>
      api.ai.extractTopics(courseId, mode === "pdf"
        ? { pdfBase64: pdfBase64! }
        : { text }),
    onSuccess: (data) => {
      setTopics(data.topics);
      setSelected(new Set(data.topics.map((_, i) => i)));
      setStep("preview");
      setError(null);
    },
    onError: (err: Error) => {
      const msg = err.message;
      if (msg.includes("GEMINI_API_KEY") || msg.includes("503")) {
        setError("Gemini API key is missing. Get a free key at aistudio.google.com/app/apikey and add GEMINI_API_KEY=... to your .env file, then restart the backend.");
      } else if (msg.includes("502")) {
        setError("Could not extract topics. Try a different file or cleaner text.");
      } else if (msg.includes("404")) {
        setError("Endpoint not found — restart the backend.");
      } else if (msg.toLowerCase().includes("failed to fetch")) {
        setError("Cannot reach the backend. Is it running on port 8000?");
      } else {
        setError(`Error: ${msg}`);
      }
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const chosen = topics.filter((_, i) => selected.has(i));
      for (const topic of chosen) {
        await api.materials.create(courseId, { topic_name: topic });
      }
      if (mode === "text" && text.trim()) {
        await api.courses.update(courseId, { syllabus_text: text });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", courseId] });
      handleClose();
    },
    onError: () => setError("Failed to add topics. Please try again."),
  });

  function toggleAll() {
    setSelected(selected.size === topics.length
      ? new Set()
      : new Set(topics.map((_, i) => i)));
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
                <Sparkles size={16} className="text-sage" />
                <h2 className="font-semibold text-text-primary">
                  {step === "input" ? "Import from syllabus" : "Review topics"}
                </h2>
              </div>
              <button onClick={handleClose} className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted mb-5">
              {step === "input"
                ? "Upload a PDF or paste text — topics will be extracted automatically in the original language."
                : `${topics.length} topics found — choose which to add to your tracker.`}
            </p>

            {/* ── Input step ── */}
            {step === "input" && (
              <div className="space-y-3">
                {/* Mode tabs */}
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  <button
                    onClick={() => setMode("pdf")}
                    className={cn(
                      "flex-1 py-2 font-medium transition-base",
                      mode === "pdf" ? "bg-sage text-white" : "text-text-muted hover:bg-gray-50"
                    )}
                  >
                    Upload PDF
                  </button>
                  <button
                    onClick={() => setMode("text")}
                    className={cn(
                      "flex-1 py-2 font-medium transition-base border-l border-border",
                      mode === "text" ? "bg-sage text-white" : "text-text-muted hover:bg-gray-50"
                    )}
                  >
                    Paste text
                  </button>
                </div>

                {/* PDF mode */}
                {mode === "pdf" && (
                  <div>
                    {pdfBase64 ? (
                      <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage-light px-4 py-3">
                        <FileText size={20} className="text-sage shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{pdfName}</p>
                          <p className="text-xs text-text-muted">Ready to extract</p>
                        </div>
                        <button
                          onClick={() => { setPdfBase64(null); setPdfName(null); }}
                          className="text-text-muted hover:text-text-primary transition-base"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-border hover:border-sage hover:bg-sage-light/50 px-4 py-8 text-center transition-base group"
                      >
                        <FileText size={24} className="mx-auto mb-2 text-text-muted group-hover:text-sage transition-base" />
                        <p className="text-sm font-medium text-text-muted group-hover:text-sage transition-base">
                          Click to upload PDF
                        </p>
                        <p className="text-xs text-text-muted mt-1">or .txt / .md files</p>
                      </button>
                    )}
                  </div>
                )}

                {/* Text mode */}
                {mode === "text" && (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your syllabus here..."
                    rows={8}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base resize-none"
                  />
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => extractMutation.mutate()}
                    disabled={!canExtract || extractMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                  >
                    {extractMutation.isPending ? (
                      <><Loader2 size={14} className="animate-spin" />Extracting…</>
                    ) : (
                      <><Sparkles size={14} />Extract topics</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Preview step ── */}
            {step === "preview" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-text-muted">
                    {selected.size} of {topics.length} selected
                  </span>
                  <button onClick={toggleAll} className="text-xs text-sage hover:underline transition-base">
                    {selected.size === topics.length ? "Deselect all" : "Select all"}
                  </button>
                </div>

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
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addMutation.mutate()}
                    disabled={selected.size === 0 || addMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                  >
                    {addMutation.isPending
                      ? <><Loader2 size={14} className="animate-spin" />Adding…</>
                      : `Add ${selected.size} topic${selected.size !== 1 ? "s" : ""}`}
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
