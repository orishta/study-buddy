import type {
  ClassSlot, ClassSlotCreate, ClassSlotUpdate,
  Course, CourseCreate, CourseUpdate,
  Material, MaterialCreate, MaterialUpdate,
  Settings,
  Task, TaskCreate, TaskUpdate,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Settings ──────────────────────────────────────────────────────────────────

export const api = {
  settings: {
    get: () => request<Settings>("/settings"),
    update: (data: Partial<Settings>) =>
      request<Settings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  },

  // ── Courses ─────────────────────────────────────────────────────────────────

  courses: {
    list: () => request<Course[]>("/courses"),
    get: (id: number) => request<Course>(`/courses/${id}`),
    create: (data: CourseCreate) =>
      request<Course>("/courses", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: CourseUpdate) =>
      request<Course>(`/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/courses/${id}`, { method: "DELETE" }),
  },

  // ── Materials ────────────────────────────────────────────────────────────────

  materials: {
    list: (courseId: number) => request<Material[]>(`/courses/${courseId}/materials`),
    create: (courseId: number, data: MaterialCreate) =>
      request<Material>(`/courses/${courseId}/materials`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: MaterialUpdate) =>
      request<Material>(`/materials/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/materials/${id}`, { method: "DELETE" }),
  },

  // ── Tasks ────────────────────────────────────────────────────────────────────

  tasks: {
    list: (params?: { status?: string; course_id?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.course_id !== undefined) qs.set("course_id", String(params.course_id));
      return request<Task[]>(`/tasks${qs.toString() ? `?${qs}` : ""}`);
    },
    get: (id: number) => request<Task>(`/tasks/${id}`),
    create: (data: TaskCreate) =>
      request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: TaskUpdate) =>
      request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    setStatus: (id: number, status: string) =>
      request<Task>(`/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    reorder: (tasks: { id: number; position: number; status: string }[]) =>
      request<Task[]>("/tasks/reorder", { method: "PATCH", body: JSON.stringify({ tasks }) }),
    delete: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  },

  // ── AI ───────────────────────────────────────────────────────────────────────

  ai: {
    extractTopics: (courseId: number, data: { text?: string; pdfBase64?: string }) =>
      request<{ topics: string[] }>("/ai/extract-topics", {
        method: "POST",
        body: JSON.stringify({
          course_id: courseId,
          text: data.text || undefined,
          pdf_base64: data.pdfBase64 || undefined,
        }),
      }),
  },

  // ── Schedule ─────────────────────────────────────────────────────────────────

  schedule: {
    list: () => request<ClassSlot[]>("/schedule"),
    create: (data: ClassSlotCreate) =>
      request<ClassSlot>("/schedule", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: ClassSlotUpdate) =>
      request<ClassSlot>(`/schedule/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/schedule/${id}`, { method: "DELETE" }),
  },
};
