"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ClassSlotDialog } from "./ClassSlotDialog";
import type { ClassSlot } from "@/lib/types";

// 0=Sun…5=Fri (same as app convention)
const HEBREW_DAY  = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
const SHORT_DAY   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const GRID_START  = 8 * 60;    // 08:00
const GRID_END    = 21 * 60;   // 21:00
const PX_PER_MIN  = 1.5;       // px per minute → total ≈ 1170 px

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hourLabels() {
  const labels: string[] = [];
  for (let h = 8; h <= 21; h++) labels.push(`${String(h).padStart(2, "0")}:00`);
  return labels;
}

function todayDow(): number {
  const d = new Date().getDay(); // JS: 0=Sun…6=Sat — same as our convention
  return d <= 5 ? d : -1;       // -1 on Saturday (no class)
}

function SlotBlock({ slot, onClick }: { slot: ClassSlot; onClick: () => void }) {
  const top    = (toMin(slot.start_time) - GRID_START) * PX_PER_MIN;
  const height = (toMin(slot.end_time)   - toMin(slot.start_time)) * PX_PER_MIN;

  return (
    <button
      onClick={onClick}
      className="absolute inset-x-1 rounded-lg text-right overflow-hidden transition-all hover:brightness-95 active:scale-[0.98] shadow-sm"
      style={{
        top,
        height,
        backgroundColor: slot.color_code + "28",
        borderRight: `3px solid ${slot.color_code}`,
      }}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-start">
        <p
          className="text-[11px] font-semibold leading-tight line-clamp-2"
          style={{ color: slot.color_code }}
        >
          {slot.subject_name}
        </p>
        {height > 32 && (
          <p className="text-[10px] text-text-muted mt-0.5 leading-tight">
            {slot.start_time}–{slot.end_time}
          </p>
        )}
        {height > 54 && slot.room && (
          <p className="text-[10px] text-text-muted truncate">{slot.room}</p>
        )}
        {height > 74 && slot.instructor && (
          <p className="text-[10px] text-text-muted truncate opacity-80">{slot.instructor}</p>
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
  const [editing,    setEditing]    = useState<ClassSlot | null>(null);
  const [defaultDay, setDefaultDay] = useState<number>(1);

  // Show Sun–Thu by default; add Fri only if a slot exists there
  const days = [0, 1, 2, 3, 4, ...(slots.some((s) => s.day_of_week === 5) ? [5] : [])];

  const gridHeight = (GRID_END - GRID_START) * PX_PER_MIN;
  const today      = todayDow();

  function openNew(day: number) {
    setEditing(null);
    setDefaultDay(day);
    setDialogOpen(true);
  }

  if (isLoading) return <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />;

  return (
    <>
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">

        {/* ── Day headers ── */}
        <div
          className="grid border-b border-border bg-background"
          style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}
        >
          <div className="border-r border-border" /> {/* gutter spacer */}
          {days.map((d) => {
            const isToday = d === today;
            return (
              <div
                key={d}
                className={cn(
                  "border-r border-border last:border-r-0 px-2 py-2",
                  isToday && "bg-sage/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-xs font-semibold", isToday ? "text-sage" : "text-text-primary")}>
                      {HEBREW_DAY[d]}
                    </p>
                    <p className="text-[10px] text-text-muted">{SHORT_DAY[d]}</p>
                  </div>
                  <button
                    onClick={() => openNew(d)}
                    className="p-0.5 rounded text-text-muted hover:text-sage hover:bg-sage-light transition-base"
                    title={`Add class on ${HEBREW_DAY[d]}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Grid body ── */}
        <div className="flex overflow-x-auto">

          {/* Time gutter */}
          <div className="w-[52px] shrink-0 relative border-r border-border" style={{ height: gridHeight }}>
            {hourLabels().map((label) => (
              <div
                key={label}
                className="absolute right-1 text-[10px] text-text-muted font-mono -translate-y-2 select-none"
                style={{ top: (toMin(label) - GRID_START) * PX_PER_MIN }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const isToday  = d === today;
            const daySlots = slots.filter((s) => s.day_of_week === d);

            return (
              <div
                key={d}
                className={cn(
                  "flex-1 relative border-r border-border last:border-r-0",
                  isToday && "bg-sage/5",
                )}
                style={{ height: gridHeight, minWidth: 110 }}
              >
                {/* Full-hour grid lines */}
                {hourLabels().map((label) => (
                  <div
                    key={label}
                    className="absolute inset-x-0 border-t border-border/50"
                    style={{ top: (toMin(label) - GRID_START) * PX_PER_MIN }}
                  />
                ))}
                {/* Half-hour grid lines (dimmer) */}
                {hourLabels().slice(0, -1).map((label) => {
                  const min = toMin(label) + 30 - GRID_START;
                  return (
                    <div
                      key={label + ":30"}
                      className="absolute inset-x-0 border-t border-border/20"
                      style={{ top: min * PX_PER_MIN }}
                    />
                  );
                })}

                {/* Class blocks */}
                {daySlots.map((slot) => (
                  <SlotBlock key={slot.id} slot={slot} onClick={() => { setEditing(slot); setDialogOpen(true); }} />
                ))}

                {/* Empty column tap zone */}
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
