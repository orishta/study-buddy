"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { useUI } from "@/lib/store";
import { cn, PRIORITY_COLORS } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/lib/types";

const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Urgent"];
const STATUSES: TaskStatus[] = ["Todo", "In Progress", "Done"];

export function TaskDialog() {
  const { taskDialogOpen, taskDialogDefaults, closeTaskDialog } = useUI();
  const qc = useQueryClient();

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: api.courses.list,
    enabled: taskDialogOpen,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [status, setStatus] = useState<TaskStatus>("Todo");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedMin, setEstimatedMin] = useState("");

  useEffect(() => {
    if (taskDialogOpen) {
      setTitle("");
      setDescription("");
      setCourseId(taskDialogDefaults?.courseId ?? null);
      setStatus((taskDialogDefaults?.status as TaskStatus) ?? "Todo");
      setPriority("Medium");
      setDueDate("");
      setEstimatedMin("");
    }
  }, [taskDialogOpen, taskDialogDefaults]);

  const createMutation = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      closeTaskDialog();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      course_id: courseId,
      status,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      estimated_minutes: estimatedMin ? parseInt(estimatedMin) : undefined,
    });
  }

  return (
    <AnimatePresence>
      {taskDialogOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={closeTaskDialog}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface shadow-modal border border-border p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">New task</h2>
              <button
                onClick={closeTaskDialog}
                className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
              />

              {/* Description */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes (optional)"
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base resize-none"
              />

              {/* Row: course + status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-text-muted block mb-1">
                    Course
                  </label>
                  <select
                    value={courseId ?? ""}
                    onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  >
                    <option value="">No course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted block mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: priority + due date + time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-text-muted block mb-1">
                    Priority
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={cn(
                          "text-[11px] font-medium px-2 py-1 rounded-md border transition-base",
                          priority === p
                            ? cn(PRIORITY_COLORS[p], "border-current")
                            : "border-border text-text-muted hover:bg-gray-50"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted block mb-1">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted block mb-1">
                    Est. (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={estimatedMin}
                    onChange={(e) => setEstimatedMin(e.target.value)}
                    placeholder="25"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeTaskDialog}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || createMutation.isPending}
                  className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                >
                  {createMutation.isPending ? "Adding..." : "Add task"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
