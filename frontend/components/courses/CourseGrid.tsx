"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useUI } from "@/lib/store";
import { CourseCard } from "./CourseCard";

export function CourseGrid() {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: api.courses.list,
  });

  const { openCourseForm } = useUI();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Your courses</h2>
        <button
          onClick={() => openCourseForm()}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-sage transition-base"
        >
          <Plus size={13} />
          Add course
        </button>
      </div>

      {courses.length === 0 ? (
        <button
          onClick={() => openCourseForm()}
          className="w-full rounded-xl border-2 border-dashed border-border py-10 text-center hover:border-sage hover:bg-sage-light transition-base group"
        >
          <span className="text-2xl block mb-2">📚</span>
          <span className="text-sm text-text-muted group-hover:text-sage transition-base">
            Add your first course to get started
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
