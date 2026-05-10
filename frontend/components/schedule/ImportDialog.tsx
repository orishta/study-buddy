"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Link2, Loader2, Trash2, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import type { SlotPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = "upload" | "preview" | "done";
type ImportMode = "file" | "url";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

function parseApiError(err: Error): string {
  const msg = err.message;
  try {
    const body = msg.replace(/^API \d+: /, "");
    return JSON.parse(body).detail ?? msg;
  } catch {
    return msg.toLowerCase().includes("failed to fetch")
      ? "Cannot reach the backend. Is it running on port 8000?"
      : msg;
  }
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [mode, setMode] = useState<ImportMode>("url");
  const [file, setFile] = useState<File | null>(null);
  const [calUrl, setCalUrl] = useState("");
  const [rows, setRows] = useState<SlotPreview[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep("upload");
      setFile(null);
      setCalUrl("");
      setRows([]);
      setError(null);
    }, 200);
  }

  // Step 1a: parse file → preview table
  const previewMutation = useMutation({
    mutationFn: () => api.schedule.preview(file!),
    onSuccess: (data) => {
      setRows(data);
      setStep("preview");
      setError(null);
    },
    onError: (err: Error) => setError(parseApiError(err)),
  });

  // Step 1b: fetch iCal URL → preview table
  const previewUrlMutation = useMutation({
    mutationFn: () => api.schedule.previewUrl(calUrl),
    onSuccess: (data) => {
      setRows(data);
      setStep("preview");
      setError(null);
    },
    onError: (err: Error) => setError(parseApiError(err)),
  });

  // Step 2: save edited rows
  const saveMutation = useMutation({
    mutationFn: () => api.schedule.bulkCreate(rows.map((r) => ({
      subject_name: r.subject_name,
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      instructor: r.instructor ?? undefined,
      room: r.room ?? undefined,
      color_code: r.color_code,
    }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      setStep("done");
      setError(null);
    },
    onError: (err: Error) => setError(parseApiError(err)),
  });

  function updateRow(i: number, field: keyof SlotPreview, value: string | number) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function deleteRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
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
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface shadow-modal border border-border p-6",
              step === "preview" ? "max-w-2xl" : "max-w-lg",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {step === "preview" && (
                  <button
                    onClick={() => { setStep("upload"); setError(null); }}
                    className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
                  >
                    ←
                  </button>
                )}
                <FileSpreadsheet size={16} className="text-sage" />
                <h2 className="font-semibold text-text-primary">
                  {step === "upload" ? "Import schedule" : step === "preview" ? "Review & edit" : "Done"}
                </h2>
              </div>
              <button onClick={handleClose} className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base">
                <X size={18} />
              </button>
            </div>

            {/* ── Upload step ── */}
            {step === "upload" && (
              <div className="space-y-4">
                {/* Mode tabs */}
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => { setMode("url"); setError(null); }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-base",
                      mode === "url"
                        ? "bg-sage text-white"
                        : "bg-background text-text-muted hover:bg-sage-light hover:text-sage",
                    )}
                  >
                    <Link2 size={13} />
                    Calendar URL
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("file"); setError(null); }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-base border-l border-border",
                      mode === "file"
                        ? "bg-sage text-white"
                        : "bg-background text-text-muted hover:bg-sage-light hover:text-sage",
                    )}
                  >
                    <FileSpreadsheet size={13} />
                    CSV / Excel
                  </button>
                </div>

                {/* URL mode */}
                {mode === "url" && (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted leading-relaxed">
                      הדבק את כתובת היומן מ-<strong>מתחנת המידע</strong> (יאדיון).
                      היומן יסרק אוטומטית ויציג לך את השיעורים לפני השמירה.
                    </p>
                    <div className="rounded-lg bg-background border border-border px-3 py-2 text-xs text-text-muted leading-relaxed">
                      <strong>איך מוצאים את הקישור?</strong>{" "}
                      כנס ליאדיון ← לוח שעות אישי ← &quot;ייצוא ליומן Google / iCal&quot; ← העתק את הכתובת.
                    </div>
                    <input
                      type="url"
                      value={calUrl}
                      onChange={(e) => { setCalUrl(e.target.value); setError(null); }}
                      placeholder="https://mtamn.mta.ac.il/yedion/fireflyweb.aspx?prgname=PublicHours&..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                    />
                  </div>
                )}

                {/* File mode */}
                {mode === "file" && (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted">
                      Upload a <strong>CSV or Excel</strong> file. The app will read it and show
                      you what it found before saving anything.
                    </p>

                    {file ? (
                      <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage-light px-4 py-3">
                        <FileSpreadsheet size={20} className="text-sage shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                          <p className="text-xs text-text-muted">Ready to read</p>
                        </div>
                        <button onClick={() => setFile(null)} className="text-text-muted hover:text-text-primary transition-base">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-border hover:border-sage hover:bg-sage-light/50 px-4 py-10 text-center transition-base group"
                      >
                        <Upload size={28} className="mx-auto mb-3 text-text-muted group-hover:text-sage transition-base" />
                        <p className="text-sm font-medium text-text-muted group-hover:text-sage transition-base">
                          Click to choose a file
                        </p>
                        <p className="text-xs text-text-muted mt-1">.csv or .xlsx · any column order</p>
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setFile(f); setError(null); }
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 whitespace-pre-wrap">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={handleClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base">
                    Cancel
                  </button>
                  {mode === "url" ? (
                    <button
                      onClick={() => previewUrlMutation.mutate()}
                      disabled={!calUrl.trim() || previewUrlMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                    >
                      {previewUrlMutation.isPending
                        ? <><Loader2 size={14} className="animate-spin" />טוען…</>
                        : "טען יומן →"}
                    </button>
                  ) : (
                    <button
                      onClick={() => previewMutation.mutate()}
                      disabled={!file || previewMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                    >
                      {previewMutation.isPending
                        ? <><Loader2 size={14} className="animate-spin" />Reading…</>
                        : "Read file →"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Preview / edit step ── */}
            {step === "preview" && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Found <strong>{rows.length}</strong> classes. Edit any row or delete it, then confirm.
                </p>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-background border-b border-border">
                        <th className="text-left px-3 py-2 text-text-muted font-medium w-48">Subject</th>
                        <th className="text-left px-3 py-2 text-text-muted font-medium">Day</th>
                        <th className="text-left px-3 py-2 text-text-muted font-medium">Start</th>
                        <th className="text-left px-3 py-2 text-text-muted font-medium">End</th>
                        <th className="text-left px-3 py-2 text-text-muted font-medium">Room</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-background/50">
                          <td className="px-2 py-1.5">
                            <input
                              value={row.subject_name}
                              onChange={(e) => updateRow(i, "subject_name", e.target.value)}
                              className="w-full rounded border border-transparent hover:border-border focus:border-sage bg-transparent px-1 py-0.5 focus:outline-none focus:bg-white transition-base"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.day_of_week}
                              onChange={(e) => updateRow(i, "day_of_week", Number(e.target.value))}
                              className="rounded border border-transparent hover:border-border focus:border-sage bg-transparent px-1 py-0.5 focus:outline-none focus:bg-white transition-base"
                            >
                              {DAY_NAMES.map((d, n) => (
                                <option key={n} value={n}>{d}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="time"
                              value={row.start_time}
                              onChange={(e) => updateRow(i, "start_time", e.target.value)}
                              className="rounded border border-transparent hover:border-border focus:border-sage bg-transparent px-1 py-0.5 focus:outline-none focus:bg-white transition-base"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="time"
                              value={row.end_time}
                              onChange={(e) => updateRow(i, "end_time", e.target.value)}
                              className="rounded border border-transparent hover:border-border focus:border-sage bg-transparent px-1 py-0.5 focus:outline-none focus:bg-white transition-base"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={row.room ?? ""}
                              onChange={(e) => updateRow(i, "room", e.target.value)}
                              placeholder="—"
                              className="w-20 rounded border border-transparent hover:border-border focus:border-sage bg-transparent px-1 py-0.5 focus:outline-none focus:bg-white transition-base"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => deleteRow(i)}
                              className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-50 transition-base"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={handleClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base">
                    Cancel
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={rows.length === 0 || saveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                  >
                    {saveMutation.isPending
                      ? <><Loader2 size={14} className="animate-spin" />Saving…</>
                      : `Add ${rows.length} class${rows.length !== 1 ? "es" : ""}`}
                  </button>
                </div>
              </div>
            )}

            {/* ── Done step ── */}
            {step === "done" && (
              <div className="space-y-4 text-center py-2">
                <CheckCircle2 size={40} className="mx-auto text-sage" />
                <div>
                  <p className="font-semibold text-text-primary">Schedule updated!</p>
                  <p className="text-xs text-text-muted mt-1">
                    Your classes are now visible in the weekly timetable.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage-dark transition-base"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
