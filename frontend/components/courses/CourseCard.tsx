"use client";

import Link from "next/link";
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Course } from "@/lib/types";

function ProgressRing({
  done,
  total,
  color,
}: {
  done: number;
  total: number;
  color: string;
}) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const pct = total === 0 ? 0 : done / total;
  const dash = pct * circ;

  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#E5E4E2" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <span className="absolute text-[11px] font-mono font-semibold text-text-primary">
        {total === 0 ? "—" : Math.round(pct * 100)}
      </span>
    </div>
  );
}

export function CourseCard({ course }: { course: Course }) {
  const qc = useQueryClient();
  const { openCourseForm } = useUI();
  const [menuOpen, setMenuOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.courses.delete(course.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });

  return (
    <div className="relative group rounded-xl border border-border bg-surface shadow-card hover:shadow-card-hover transition-base">
      {/* Color strip */}
      <div
        className="h-1.5 rounded-t-xl"
        style={{ backgroundColor: course.color_code }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/courses/${course.id}`}
              className="flex items-center gap-1.5 group/link"
            >
              <span className="text-lg">{course.emoji}</span>
              <span className="font-semibold text-text-primary text-sm truncate group-hover/link:text-sage transition-base">
                {course.title}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <ProgressRing
              done={course.done_count}
              total={course.total_count}
              color={course.color_code}
            />

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1 rounded-lg text-text-muted hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-base"
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-border bg-surface shadow-modal py-1">
                    <button
                      onClick={() => {
                        openCourseForm(course.id);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-gray-50 transition-base"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    {course.notebooklm_link && (
                      <a
                        href={course.notebooklm_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-gray-50 transition-base"
                        onClick={() => setMenuOpen(false)}
                      >
                        <ExternalLink size={13} />
                        NotebookLM
                      </a>
                    )}
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => {
                        deleteMutation.mutate();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-base"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Task count pills */}
        <div className="flex gap-1.5 mt-3">
          <Pill label="To do" count={course.todo_count} />
          <Pill label="In progress" count={course.in_progress_count} color="text-amber-600 bg-amber-50" />
          <Pill label="Done" count={course.done_count} color="text-sage bg-sage-light" />
        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  count,
  color = "text-text-muted bg-gray-50",
}: {
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", color)}>
      {count} {label}
    </span>
  );
}
