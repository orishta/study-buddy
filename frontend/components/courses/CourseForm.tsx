"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { cn, getPresetColors } from "@/lib/utils";
import { useUI } from "@/lib/store";
import type { Course } from "@/lib/types";

const EMOJI_OPTIONS = ["📚", "📐", "💻", "🔬", "📊", "🧮", "📝", "🧪", "🌐", "📖", "⚡", "🎯"];

export function CourseForm() {
  const { courseFormOpen, courseFormId, closeCourseForm } = useUI();
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["courses", courseFormId],
    queryFn: () => api.courses.get(courseFormId!),
    enabled: !!courseFormId,
  });

  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#6B7C5E");
  const [emoji, setEmoji] = useState("📚");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setColor(existing.color_code);
      setEmoji(existing.emoji);
      setLink(existing.notebooklm_link ?? "");
    } else {
      setTitle("");
      setColor("#6B7C5E");
      setEmoji("📚");
      setLink("");
    }
  }, [existing, courseFormOpen]);

  const createMutation = useMutation({
    mutationFn: api.courses.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      closeCourseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Course> }) =>
      api.courses.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      closeCourseForm();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const data = {
      title: title.trim(),
      color_code: color,
      emoji,
      notebooklm_link: link.trim() || undefined,
    };
    if (courseFormId) {
      updateMutation.mutate({ id: courseFormId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <AnimatePresence>
      {courseFormOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={closeCourseForm}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface shadow-modal border border-border p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">
                {courseFormId ? "Edit course" : "Add course"}
              </h2>
              <button
                onClick={closeCourseForm}
                className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Course name
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Linear Algebra 2"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {getPresetColors().map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-base",
                        color === c ? "border-text-primary scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Emoji
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-base flex items-center justify-center transition-base",
                        emoji === e
                          ? "bg-sage-light ring-2 ring-sage"
                          : "hover:bg-gray-50"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  NotebookLM link{" "}
                  <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://notebooklm.google.com/..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCourseForm}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || loading}
                  className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                >
                  {loading ? "Saving..." : courseFormId ? "Save changes" : "Add course"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
