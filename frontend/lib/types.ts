export type TaskStatus = "Todo" | "In Progress" | "Done";

export interface UserProfile {
  initiation_difficulty: number;
  sustained_attention: number;
  reading_load: number;
  time_blindness: number;
  overwhelm_sensitivity: number;
  motivation_style: "intrinsic" | "social" | "deadline" | "gamified";
  peak_time: "morning" | "midday" | "afternoon" | "evening";
  break_style: "pomodoro" | "deep_work" | "flow" | "micro";
  block_minutes: number;
  warmup: boolean;
  format_style: "bullets" | "paragraph";
  show_timer: boolean;
  max_visible_tasks: number;
  framing_prefix: string;
  onboarding_done: boolean;
}

export interface AiProviderStatus {
  active_provider: "ollama" | "anthropic" | "openai";
  anthropic_key_set: boolean;
  openai_key_set: boolean;
}
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Settings {
  id: number;
  display_name: string;
  learning_style_profile: unknown | null;
  whatsapp_number: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  daily_summary_time: string;
  peak_focus_start: string;
  peak_focus_end: string;
  pomodoro_duration: number;
  gmail_client_id: string | null;
  gmail_client_secret: string | null;
  gmail_refresh_token: string | null;
}

export interface SlotPreview {
  subject_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  instructor: string | null;
  room: string | null;
  color_code: string;
}

export interface Course {
  id: number;
  title: string;
  color_code: string;
  emoji: string;
  notebooklm_link: string | null;
  syllabus_text?: string | null;
  is_active: boolean;
  created_at: string;
  todo_count: number;
  in_progress_count: number;
  done_count: number;
  total_count: number;
}

export interface Material {
  id: number;
  course_id: number;
  topic_name: string;
  understanding_level: number;
  notes: string | null;
  last_reviewed: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  course_id: number | null;
  parent_task_id: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_minutes: number | null;
  position: number;
  is_notified: boolean;
  completed_at: string | null;
  created_at: string;
  subtasks?: Task[];
}

export interface CourseCreate {
  title: string;
  color_code?: string;
  emoji?: string;
  notebooklm_link?: string;
}

export interface CourseUpdate {
  title?: string;
  color_code?: string;
  emoji?: string;
  notebooklm_link?: string | null;
  syllabus_text?: string | null;
  is_active?: boolean;
}

export interface TaskCreate {
  title: string;
  description?: string;
  course_id?: number | null;
  parent_task_id?: number | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  position?: number;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  course_id?: number | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  position?: number;
}

export interface MaterialCreate {
  topic_name: string;
  understanding_level?: number;
  notes?: string;
}

export interface MaterialUpdate {
  topic_name?: string;
  understanding_level?: number;
  notes?: string | null;
}

export interface ClassSlot {
  id: number;
  subject_name: string;
  instructor: string | null;
  day_of_week: number;    // 0=Sun … 5=Fri
  start_time: string;     // "HH:MM"
  end_time: string;
  room: string | null;
  color_code: string;
  course_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ClassSlotCreate {
  subject_name: string;
  instructor?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
  color_code?: string;
  course_id?: number | null;
}

export interface ClassSlotUpdate {
  subject_name?: string;
  instructor?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  room?: string;
  color_code?: string;
  course_id?: number | null;
  is_active?: boolean;
}
