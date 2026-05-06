"use client";

import { TopBar } from "@/components/layout/TopBar";
import { WeeklyTimetable } from "@/components/schedule/WeeklyTimetable";
import { CourseForm } from "@/components/courses/CourseForm";
import { TaskDialog } from "@/components/tasks/TaskDialog";

export default function SchedulePage() {
  return (
    <>
      <TopBar title="Schedule" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted">
              Click any class to edit · Click <span className="font-mono text-xs bg-gray-100 px-1 rounded">+</span> in a column to add
            </p>
          </div>
        </div>

        <WeeklyTimetable />
      </div>

      <CourseForm />
      <TaskDialog />
    </>
  );
}
