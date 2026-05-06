"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ClassSlotDialog } from "./ClassSlotDialog";
import type { ClassSlot } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Grid from 08:00 to 21:00, one row per 15 min → 52 rows
const GRID_START = 8 * 60;   // 480 min
const GRID_END   = 21 * 60;  // 1260 min
const SLOT_HEIGHT = 4;        // px per minute (css px)

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hourLabels() {
  const labels = [];
  for (let h = 8; h <= 21; h++) {
    labels.push(`${String(h).padStart(2, "0")}:00`);
  }
  return labels;
}

function SlotBlock({
  slot,
  onClick,
}: {
  slot: ClassSlot;
  onClick: () => void;
}) {
  const startMin = timeToMin(slot.start_time) - GRID_START;
  const duration = timeToMin(slot.end_time) - timeToMin(slot.start_time);
  const top = startMin * SLOT_HEIGHT;
  const height = duration * SLOT_HEIGHT;

  return (
    <button
      onClick={onClick}
      className="absolute inset-x-1 rounded-lg text-left overflow-hidden group transition-base hover:brightness-95 active:scale-[0.98]"
      style={{ top, height, backgroundColor: slot.color_code + "22", borderLeft: `3px solid ${slot.color_code}` }}
    >
      <div className="p-1.5 h-full flex flex-col justify-start">
        <p
          className="text-[11px] font-semibold leading-tight truncate"
          style={{ color: slot.color_code }}
        >
          {slot.subject_name}
        </p>
        {height > 40 && (
          <p className="text-[10px] text-text-muted mt-0.5 leading-tight truncate">
            {slot.start_time}–{slot.end_time}
          </p>
        )}
        {height > 58 && slot.room && (
          <p className="text-[10px] text-text-muted truncate">{slot.room}</p>
        )}
        {height > 72 && slot.instructor && (
          <p className="text-[10px] text-text-muted truncate">{slot.instructor}</p>
        )}
      </div>
    </button>
  );
}

export function WeeklyTimetable() {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: api.schedule.list,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassSlot | null>(null);
  const [defaultDay, setDefaultDay] = useState<number>(1);

  const gridHeight = (GRID_END - GRID_START) * SLOT_HEIGHT;

  function openNew(day: number) {
    setEditing(null);
    setDefaultDay(day);
    setDialogOpen(true);
  }

  function openEdit(slot: ClassSlot) {
    setEditing(slot);
    setDialogOpen(true);
  }

  const activeDays = [0, 1, 2, 3, 4, 5].filter(
    (d) => d > 0 || slots.some((s) => s.day_of_week === 0)
  );
  // Always show Sun–Thu (Israeli week), hide Friday if empty
  const displayDays = [1, 2, 3, 4].filter(() => true).concat(
    slots.some((s) => s.day_of_week === 0) ? [0] : [],
    slots.some((s) => s.day_of_week === 5) ? [5] : []
  );
  const days = [0, 1, 2, 3, 4]; // Sun–Thu always shown

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />;
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {/* Column headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: "48px repeat(5, 1fr)" }}>
          <div className="border-r border-border" /> {/* time gutter */}
          {days.map((d) => (
            <div key={d} className="border-r border-border last:border-r-0">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-xs font-semibold text-text-primary">{DAY_FULL[d]}</span>
                <button
                  onClick={() => openNew(d)}
                  className="p-0.5 rounded text-text-muted hover:text-sage hover:bg-sage-light transition-base"
                  title={`Add class on ${DAY_FULL[d]}`}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex overflow-x-auto">
          {/* Time gutter */}
          <div className="w-12 shrink-0 relative border-r border-border" style={{ height: gridHeight }}>
            {hourLabels().map((label) => {
              const min = timeToMin(label) - GRID_START;
              return (
                <div
                  key={label}
                  className="absolute right-1 text-[10px] text-text-muted font-mono -translate-y-2"
                  style={{ top: min * SLOT_HEIGHT }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const daySlots = slots.filter((s) => s.day_of_week === d);
            return (
              <div
                key={d}
                className="flex-1 relative border-r border-border last:border-r-0"
                style={{ height: gridHeight, minWidth: 120 }}
              >
                {/* Hour grid lines */}
                {hourLabels().map((label) => {
                  const min = timeToMin(label) - GRID_START;
                  return (
                    <div
                      key={label}
                      className="absolute inset-x-0 border-t border-border/50"
                      style={{ top: min * SLOT_HEIGHT }}
                    />
                  );
                })}

                {/* Class blocks */}
                {daySlots.map((slot) => (
                  <SlotBlock key={slot.id} slot={slot} onClick={() => openEdit(slot)} />
                ))}

                {/* Empty state tap zone */}
                {daySlots.length === 0 && (
                  <button
                    onClick={() => openNew(d)}
                    className="absolute inset-2 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-text-muted hover:border-sage hover:text-sage hover:bg-sage-light transition-base group"
                  >
                    <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-base" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ClassSlotDialog
        open={dialogOpen}
        slot={editing}
        defaultDay={defaultDay}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
      />
    </>
  );
}
