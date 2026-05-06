"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { MaterialTracker } from "@/components/courses/MaterialTracker";
import { CourseForm } from "@/components/courses/CourseForm";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { api } from "@/lib/api";

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const courseId = parseInt(id);

  const { data: course, isLoading } = useQuery({
    queryKey: ["courses", courseId],
    queryFn: () => api.courses.get(courseId),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sage border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-text-muted">Course not found.</p>
        <Link href="/" className="text-sage text-sm hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      <TopBar title={`${course.emoji} ${course.title}`} />

      <div className="flex-1 overflow-y-auto">
        {/* Course hero */}
        <div
          className="px-6 py-5 border-b border-border"
          style={{ borderTopColor: course.color_code, borderTopWidth: 3 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-text-muted hover:text-text-primary transition-base"
            >
              <ArrowLeft size={16} />
            </Link>
            <span className="text-2xl">{course.emoji}</span>
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
              {course.title}
            </h1>
          </div>

          <div className="flex items-center gap-4 ml-8">
            <span className="text-sm text-text-muted">
              {course.done_count}/{course.total_count} tasks done
            </span>
            {course.notebooklm_link && (
              <a
                href={course.notebooklm_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-sage hover:text-sage-dark transition-base"
              >
                <ExternalLink size={13} />
                Open in NotebookLM
              </a>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Tasks for this course */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Tasks</h2>
            <div className="h-[400px]">
              <KanbanBoard courseId={courseId} />
            </div>
          </div>

          {/* Material tracker */}
          <div>
            <MaterialTracker courseId={courseId} />
          </div>

          {/* NotebookLM sticky CTA */}
          {course.notebooklm_link && (
            <div className="sticky bottom-0 bg-background border-t border-border -mx-6 px-6 py-3">
              <a
                href={course.notebooklm_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-sage py-2.5 text-sm font-medium text-white hover:bg-sage-dark transition-base"
              >
                <ExternalLink size={15} />
                Go to NotebookLM Practice
              </a>
            </div>
          )}
        </div>
      </div>

      <CourseForm />
      <TaskDialog />
    </>
  );
}
