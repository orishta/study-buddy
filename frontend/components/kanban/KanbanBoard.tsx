"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useSound from "use-sound";
import { api } from "@/lib/api";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/lib/types";

const STATUSES: TaskStatus[] = ["Todo", "In Progress", "Done"];

export function KanbanBoard({ courseId }: { courseId?: number }) {
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);

  const [playComplete] = useSound("/sounds/complete.mp3", { volume: 0.6 });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", courseId],
    queryFn: () => api.tasks.list(courseId ? { course_id: courseId } : undefined),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: api.courses.list,
  });

  const reorderMutation = useMutation({
    mutationFn: api.tasks.reorder,
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function getColumnTasks(status: TaskStatus) {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragStart({ active }: DragStartEvent) {
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const overId = over.id as string | number;
    const overStatus = STATUSES.includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : tasks.find((t) => t.id === overId)?.status;
    setOverColumn(overStatus ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    setOverColumn(null);

    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string | number;
    const targetStatus = STATUSES.includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : tasks.find((t) => t.id === overId)?.status ?? activeTask.status;

    const wasInDone = activeTask.status === "Done";
    const movingToDone = targetStatus === "Done" && !wasInDone;

    // Build updated task list for the target column
    let columnTasks = tasks.filter((t) => t.status === targetStatus);

    if (activeTask.status !== targetStatus) {
      // Moving between columns — just append
      columnTasks = [...columnTasks, { ...activeTask, status: targetStatus }];
    } else {
      // Reordering within same column
      const oldIndex = columnTasks.findIndex((t) => t.id === active.id);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        columnTasks = arrayMove(columnTasks, oldIndex, newIndex);
      }
    }

    const updates = columnTasks.map((t, i) => ({
      id: t.id,
      position: i,
      status: targetStatus,
    }));

    // Optimistic update
    qc.setQueryData<Task[]>(["tasks", courseId], (prev = []) =>
      prev.map((t) => {
        const update = updates.find((u) => u.id === t.id);
        return update ? { ...t, ...update } : t;
      })
    );

    reorderMutation.mutate(updates);

    if (movingToDone) {
      playComplete();
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {STATUSES.map((s) => (
          <div key={s} className="h-64 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getColumnTasks(status)}
            courses={courses}
            courseId={courseId}
            onComplete={playComplete}
            isOver={overColumn === status}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} courses={courses} isDragOverlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}
