"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock, GripVertical, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useUI } from "@/lib/store";
import { api } from "@/lib/api";
import { cn, formatRelativeDate, PRIORITY_COLORS } from "@/lib/utils";
import type { Course, Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  courses: Course[];
  onComplete?: () => void;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, courses, onComplete, isDragOverlay }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const qc = useQueryClient();
  const { openTaskDialog } = useUI();

  const course = courses.find((c) => c.id === task.course_id);
  const due = formatRelativeDate(task.due_date);

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.tasks.setStatus(task.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.tasks.delete(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  function toggleDone() {
    const next = task.status === "Done" ? "Todo" : "Done";
    statusMutation.mutate(next);
    if (next === "Done" && onComplete) onComplete();
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border bg-surface shadow-card transition-base",
        isDragging ? "opacity-40 scale-[0.98]" : "hover:shadow-card-hover",
        isDragOverlay && "shadow-modal rotate-1 scale-105",
        task.status === "Done" && "opacity-70"
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-border hover:text-text-muted transition-base touch-none"
          >
            <GripVertical size={14} />
          </button>

          {/* Done toggle */}
          <button
            onClick={toggleDone}
            className={cn(
              "mt-0.5 shrink-0 transition-base",
              task.status === "Done"
                ? "text-sage"
                : "text-border hover:text-sage"
            )}
          >
            {task.status === "Done" ? (
              <CheckCircle2 size={16} />
            ) : (
              <Circle size={16} />
            )}
          </button>

          {/* Content */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => openTaskDialog({ taskId: task.id })}
          >
            <p
              className={cn(
                "text-sm font-medium text-text-primary leading-snug",
                task.status === "Done" && "line-through text-text-muted"
              )}
            >
              {task.title}
            </p>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Course dot */}
              {course && (
                <span className="flex items-center gap-1 text-[11px] text-text-muted">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: course.color_code }}
                  />
                  {course.title}
                </span>
              )}

              {/* Priority */}
              {task.priority !== "Medium" && (
                <span
                  className={cn(
                    "text-[11px] font-medium px-1.5 py-0.5 rounded-md",
                    PRIORITY_COLORS[task.priority]
                  )}
                >
                  {task.priority}
                </span>
              )}

              {/* Due date */}
              {task.due_date && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px]",
                    due.color === "danger" && "text-red-500",
                    due.color === "warning" && "text-amber-600",
                    due.color === "muted" && "text-text-muted",
                    due.color === "default" && "text-text-muted"
                  )}
                >
                  <Clock size={10} />
                  {due.label}
                </span>
              )}

              {/* Time estimate */}
              {task.estimated_minutes && (
                <span className="text-[11px] font-mono text-text-muted">
                  ~{task.estimated_minutes}m
                </span>
              )}

              {/* Subtask count */}
              {(task.subtasks?.length ?? 0) > 0 && (
                <span className="text-[11px] text-text-muted">
                  {task.subtasks!.filter((s) => s.status === "Done").length}/
                  {task.subtasks!.length} subtasks
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-base">
        <button
          onClick={() => openTaskDialog({ taskId: task.id })}
          className="p-1 rounded-md text-text-muted hover:bg-gray-50 hover:text-text-primary transition-base"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          className="p-1 rounded-md text-text-muted hover:bg-red-50 hover:text-red-500 transition-base"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
