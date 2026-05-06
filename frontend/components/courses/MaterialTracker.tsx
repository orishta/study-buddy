"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Plus, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Material } from "@/lib/types";

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="transition-base"
          title={`Understanding: ${n}/5`}
        >
          <Star
            size={14}
            className={cn(
              (hovered || value) >= n
                ? "fill-amber-400 text-amber-400"
                : "text-border",
              "transition-base"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function MaterialRow({
  material,
  courseId,
}: {
  material: Material;
  courseId: number;
}) {
  const qc = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(material.notes ?? "");

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Material>) => api.materials.update(material.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials", courseId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.materials.delete(material.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials", courseId] }),
  });

  const level = material.understanding_level;
  const needsReview = level <= 2;
  const mastered = level === 5;

  return (
    <div className="group px-4 py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <span className="shrink-0">
          {mastered ? (
            <CheckCircle2 size={14} className="text-sage" />
          ) : needsReview ? (
            <AlertCircle size={14} className="text-amber-500" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-border inline-block" />
          )}
        </span>

        {/* Topic name */}
        <span className="flex-1 text-sm text-text-primary min-w-0 truncate">
          {material.topic_name}
        </span>

        {/* Star rating */}
        <StarRating
          value={material.understanding_level}
          onChange={(v) => updateMutation.mutate({ understanding_level: v })}
        />

        {/* Delete */}
        <button
          onClick={() => deleteMutation.mutate()}
          className="p-1 rounded-md text-text-muted hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-base"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Notes (optional) */}
      {editingNotes ? (
        <div className="mt-2 ml-6">
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              updateMutation.mutate({ notes: notes.trim() || undefined });
              setEditingNotes(false);
            }}
            rows={2}
            className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-sage transition-base resize-none"
          />
        </div>
      ) : (
        material.notes && (
          <p
            className="mt-1.5 ml-6 text-xs text-text-muted cursor-pointer hover:text-text-primary transition-base"
            onClick={() => setEditingNotes(true)}
          >
            {material.notes}
          </p>
        )
      )}
    </div>
  );
}

export function MaterialTracker({ courseId }: { courseId: number }) {
  const qc = useQueryClient();
  const [addingTopic, setAddingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState("");

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", courseId],
    queryFn: () => api.materials.list(courseId),
  });

  const createMutation = useMutation({
    mutationFn: (topic_name: string) =>
      api.materials.create(courseId, { topic_name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", courseId] });
      setNewTopic("");
      setAddingTopic(false);
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newTopic.trim()) createMutation.mutate(newTopic.trim());
  }

  if (isLoading) {
    return <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">
          Material tracker
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {materials.filter((m) => m.understanding_level >= 4).length}/{materials.length} solid
          </span>
          <button
            onClick={() => setAddingTopic(true)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-sage transition-base"
          >
            <Plus size={13} />
            Add topic
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 border-b border-border bg-gray-50/50">
        <span className="flex items-center gap-1 text-[11px] text-text-muted">
          <AlertCircle size={11} className="text-amber-500" />
          Needs review (1–2 ★)
        </span>
        <span className="flex items-center gap-1 text-[11px] text-text-muted">
          <CheckCircle2 size={11} className="text-sage" />
          Mastered (5 ★)
        </span>
      </div>

      {/* Topics */}
      <div className="divide-y divide-border">
        {materials.map((m) => (
          <MaterialRow key={m.id} material={m} courseId={courseId} />
        ))}
      </div>

      {/* Add topic inline */}
      {addingTopic ? (
        <form onSubmit={handleAdd} className="flex gap-2 p-3 border-t border-border">
          <input
            autoFocus
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Topic name..."
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
            onKeyDown={(e) => e.key === "Escape" && setAddingTopic(false)}
          />
          <button
            type="submit"
            disabled={!newTopic.trim()}
            className="rounded-lg bg-sage px-3 py-1.5 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingTopic(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-gray-50 transition-base"
          >
            Cancel
          </button>
        </form>
      ) : materials.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-text-muted mb-2">No topics yet</p>
          <button
            onClick={() => setAddingTopic(true)}
            className="text-sm text-sage hover:underline transition-base"
          >
            + Add your first topic
          </button>
        </div>
      ) : null}
    </div>
  );
}
