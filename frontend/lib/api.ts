import type {
  ClassSlot, ClassSlotCreate, ClassSlotUpdate,
  Course, CourseCreate, CourseUpdate,
  Material, MaterialCreate, MaterialUpdate,
  Settings, SlotPreview,
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
    generateTelegramStart: () =>
      request<{ start_url: string; tg_url: string; bot_username: string }>(
        "/ai/telegram/generate-start",
        { method: "POST" },
      ),
    telegramStatus: () =>
      request<{ connected: boolean; chat_id?: string }>("/ai/telegram/status"),
    testTelegramBrief: () =>
      request<{ sent: boolean }>("/ai/telegram/test", { method: "POST" }),
    mentor: () =>
      request<{ advice: string }>("/ai/mentor", { method: "POST" }),
  },

  // ── Schedule ─────────────────────────────────────────────────────────────────

  schedule: {
    list: () => request<ClassSlot[]>("/schedule"),
    create: (data: ClassSlotCreate) =>
      request<ClassSlot>("/schedule", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: ClassSlotUpdate) =>
      request<ClassSlot>(`/schedule/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/schedule/${id}`, { method: "DELETE" }),
    import: async (file: File): Promise<ClassSlot[]> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/schedule/import`, { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${text}`);
      }
      return res.json();
    },
    preview: async (file: File): Promise<SlotPreview[]> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/schedule/preview`, { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${text}`);
      }
      return res.json();
    },
    previewUrl: (url: string): Promise<SlotPreview[]> =>
      request<SlotPreview[]>("/schedule/preview-url", { method: "POST", body: JSON.stringify({ url }) }),
    bulkCreate: (slots: ClassSlotCreate[]) =>
      request<ClassSlot[]>("/schedule/bulk", { method: "POST", body: JSON.stringify(slots) }),
  },
};
