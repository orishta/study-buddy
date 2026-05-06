"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, openCourseForm } = useUI();
  const pathname = usePathname();

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: api.courses.list,
  });

  const collapsed = sidebarCollapsed;

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex h-screen flex-col border-r border-border bg-surface shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-border shrink-0">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              key="logo-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-semibold text-text-primary tracking-tight text-sm"
            >
              StudyBuddy
            </motion.span>
          )}
        </AnimatePresence>
        {collapsed && <span className="text-lg">📖</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <NavItem
          href="/"
          icon={<LayoutDashboard size={16} />}
          label="Dashboard"
          active={pathname === "/"}
          collapsed={collapsed}
        />

        {/* Courses section */}
        <div className="pt-3">
          {!collapsed && (
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Courses
              </span>
              <button
                onClick={() => openCourseForm()}
                className="p-0.5 rounded hover:bg-sage-light text-text-muted hover:text-sage transition-base"
                title="Add course"
              >
                <Plus size={13} />
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {courses.map((course) => (
              <CourseNavItem
                key={course.id}
                course={course}
                active={pathname === `/courses/${course.id}`}
                collapsed={collapsed}
              />
            ))}
            {courses.length === 0 && !collapsed && (
              <button
                onClick={() => openCourseForm()}
                className="w-full text-left px-3 py-2 text-xs text-text-muted hover:text-sage rounded-lg hover:bg-sage-light transition-base"
              >
                + Add your first course
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-border px-2 py-2 shrink-0 space-y-0.5">
        <NavItem
          href="/settings"
          icon={<Settings size={16} />}
          label="Settings"
          active={pathname === "/settings"}
          collapsed={collapsed}
        />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface shadow-card hover:bg-sage-light transition-base"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-base",
        active
          ? "bg-sage-light text-sage font-medium"
          : "text-text-muted hover:bg-gray-50 hover:text-text-primary"
      )}
      title={collapsed ? label : undefined}
    >
      <span className="shrink-0">{icon}</span>
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            key={label}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function CourseNavItem({
  course,
  active,
  collapsed,
}: {
  course: Course;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-base group",
        active
          ? "bg-sage-light text-sage font-medium"
          : "text-text-muted hover:bg-gray-50 hover:text-text-primary"
      )}
      title={collapsed ? course.title : undefined}
    >
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: course.color_code }}
      />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            key={course.id}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap flex-1"
          >
            {course.emoji} {course.title}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
