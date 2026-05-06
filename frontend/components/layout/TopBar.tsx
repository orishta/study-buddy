"use client";

import { Plus } from "lucide-react";
import { useUI } from "@/lib/store";

export function TopBar({ title, courseId }: { title?: string; courseId?: number }) {
  const { openTaskDialog } = useUI();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <h1 className="font-semibold text-text-primary tracking-tight">
        {title ?? "Dashboard"}
      </h1>

      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-xs text-text-muted bg-gray-50 px-2 py-1 rounded-md border border-border">
          Press <kbd className="font-mono font-semibold">N</kbd> to add a task
        </span>
        <button
          onClick={() => openTaskDialog(courseId ? { courseId } : undefined)}
          className="flex items-center gap-1.5 rounded-lg bg-sage px-3 py-1.5 text-sm font-medium text-white hover:bg-sage-dark transition-base"
        >
          <Plus size={15} />
          New task
        </button>
      </div>
    </header>
  );
}
