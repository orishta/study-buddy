"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn, STATUS_COLUMN_BG } from "@/lib/utils";
import { useUI } from "@/lib/store";
import { TaskCard } from "./TaskCard";
import type { Course, Task, TaskStatus } from "@/lib/types";

const COLUMN_LABELS: Record<TaskStatus, string> = {
  Todo: "To Do",
  "In Progress": "In Progress",
  Done: "Done",
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  courses: Course[];
  courseId?: number;
  onComplete?: () => void;
  isOver?: boolean;
}

export function KanbanColumn({ status, tasks, courses, courseId, onComplete, isOver }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });
  const { openTaskDialog } = useUI();

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-border transition-base",
        STATUS_COLUMN_BG[status],
        isOver && "ring-2 ring-sage ring-offset-1"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {COLUMN_LABELS[status]}
          </span>
          <span className="text-xs font-medium text-text-muted bg-white border border-border rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => openTaskDialog({ status, courseId })}
          className="p-1 rounded-lg text-text-muted hover:bg-white hover:text-sage transition-base"
          title={`Add task to ${COLUMN_LABELS[status]}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Cards */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-3 space-y-2 min-h-[120px]">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              courses={courses}
              onComplete={status !== "Done" ? onComplete : undefined}
            />
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-xs text-text-muted py-6 select-none">
              {status === "Done" ? "Nothing done yet" : "Drop tasks here"}
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
