"use client";

import { useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { CourseGrid } from "@/components/courses/CourseGrid";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useUI } from "@/lib/store";

export default function DashboardPage() {
  const { openTaskDialog } = useUI();

  // N shortcut — open task dialog from anywhere on the dashboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "n" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openTaskDialog();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openTaskDialog]);

  return (
    <>
      <TopBar title="Dashboard" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Course overview */}
        <CourseGrid />

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Kanban */}
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">All tasks</h2>
          <div className="h-[calc(100vh-420px)] min-h-[320px]">
            <KanbanBoard />
          </div>
        </div>
      </div>

      {/* Global modals */}
      <TaskDialog />
    </>
  );
}
