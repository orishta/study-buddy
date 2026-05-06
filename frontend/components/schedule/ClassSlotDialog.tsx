"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { cn, getPresetColors } from "@/lib/utils";
import type { ClassSlot } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface Props {
  open: boolean;
  slot?: ClassSlot | null;
  defaultDay?: number;
  onClose: () => void;
}

export function ClassSlotDialog({ open, slot, defaultDay, onClose }: Props) {
  const qc = useQueryClient();
  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: api.courses.list,
    enabled: open,
  });

  const [name, setName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:30");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState("#6B7C5E");
  const [courseId, setCourseId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      if (slot) {
        setName(slot.subject_name);
        setInstructor(slot.instructor ?? "");
        setDay(slot.day_of_week);
        setStart(slot.start_time);
        setEnd(slot.end_time);
        setRoom(slot.room ?? "");
        setColor(slot.color_code);
        setCourseId(slot.course_id);
      } else {
        setName("");
        setInstructor("");
        setDay(defaultDay ?? 1);
        setStart("09:00");
        setEnd("10:30");
        setRoom("");
        setColor("#6B7C5E");
        setCourseId(null);
      }
    }
  }, [open, slot, defaultDay]);

  const createMut = useMutation({
    mutationFn: api.schedule.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); onClose(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.schedule.update>[1] }) =>
      api.schedule.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); onClose(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.schedule.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); onClose(); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const data = {
      subject_name: name.trim(),
      instructor: instructor.trim() || undefined,
      day_of_week: day,
      start_time: start,
      end_time: end,
      room: room.trim() || undefined,
      color_code: color,
      course_id: courseId,
    };
    if (slot) {
      updateMut.mutate({ id: slot.id, data });
    } else {
      createMut.mutate(data);
    }
  }

  const loading = createMut.isPending || updateMut.isPending;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface shadow-modal border border-border p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">
                {slot ? "Edit class" : "Add class"}
              </h2>
              <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Course name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. אלגוריתמים"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">Day</label>
                  <select
                    value={day}
                    onChange={(e) => setDay(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">Link to course</label>
                  <select
                    value={courseId ?? ""}
                    onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  >
                    <option value="">None</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">Start</label>
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">End</label>
                  <input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">Instructor</label>
                  <input
                    value={instructor}
                    onChange={(e) => setInstructor(e.target.value)}
                    placeholder="Dr. ..."
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">Room</label>
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="ווסטון 007"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {getPresetColors().map((c) => (
                    <button
                      key={c} type="button" onClick={() => setColor(c)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-base",
                        color === c ? "border-text-primary scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {slot && (
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(slot.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-base"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button" onClick={onClose}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={!name.trim() || loading}
                  className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
                >
                  {loading ? "Saving..." : slot ? "Save" : "Add class"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
