import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  differenceInDays,
  format,
  isAfter,
  isSameDay,
  startOfDay,
  addDays,
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(dateStr: string | null | undefined): {
  label: string;
  color: "default" | "warning" | "danger" | "muted";
} {
  if (!dateStr) return { label: "No due date", color: "muted" };

  const date = new Date(dateStr);
  const now = new Date();
  const today = startOfDay(now);
  const target = startOfDay(date);

  if (isAfter(today, target)) {
    return { label: "Overdue", color: "danger" };
  }

  if (isSameDay(today, target)) {
    return { label: "Today", color: "warning" };
  }

  if (isSameDay(addDays(today, 1), target)) {
    return { label: "Tomorrow", color: "warning" };
  }

  const days = differenceInDays(target, today);
  if (days <= 6) {
    return { label: `in ${days} days`, color: "default" };
  }

  return { label: format(date, "d MMM"), color: "muted" };
}

export const PRIORITY_ORDER: Record<string, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "text-red-500 bg-red-50",
  High: "text-orange-500 bg-orange-50",
  Medium: "text-amber-600 bg-amber-50",
  Low: "text-text-muted bg-gray-50",
};

export const STATUS_COLUMN_BG: Record<string, string> = {
  Todo: "bg-column-todo",
  "In Progress": "bg-column-progress",
  Done: "bg-column-done",
};

const PRESET_COLORS = [
  "#6B7C5E", // Sage
  "#9C7153", // Oak
  "#5B7B99", // Slate blue
  "#8B6F9E", // Lavender
  "#C4756A", // Terracotta
  "#4A8B7F", // Teal
  "#B5834A", // Amber
  "#6B7FA8", // Steel blue
];

export function getPresetColors() {
  return PRESET_COLORS;
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
