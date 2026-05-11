"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { WeeklyTimetable } from "@/components/schedule/WeeklyTimetable";
import { ImportDialog } from "@/components/schedule/ImportDialog";
import { TaskDialog } from "@/components/tasks/TaskDialog";

export default function SchedulePage() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <TopBar title="Schedule" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Click any class to edit · Click{" "}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">+</span>{" "}
            in a column to add
          </p>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-sage-light hover:text-sage hover:border-sage transition-base"
          >
            <Upload size={14} />
            Import CSV / Excel
          </button>
        </div>

        <WeeklyTimetable />
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <TaskDialog />
    </>
  );
}
