import { create } from "zustand";

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  taskDialogOpen: boolean;
  taskDialogDefaults: { courseId?: number; status?: string } | null;
  openTaskDialog: (defaults?: { courseId?: number; status?: string }) => void;
  closeTaskDialog: () => void;

  courseFormOpen: boolean;
  courseFormId: number | null;
  openCourseForm: (id?: number) => void;
  closeCourseForm: () => void;

  activeCourseId: number | null;
  setActiveCourseId: (id: number | null) => void;
}

export const useUI = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  taskDialogOpen: false,
  taskDialogDefaults: null,
  openTaskDialog: (defaults) => set({ taskDialogOpen: true, taskDialogDefaults: defaults ?? null }),
  closeTaskDialog: () => set({ taskDialogOpen: false, taskDialogDefaults: null }),

  courseFormOpen: false,
  courseFormId: null,
  openCourseForm: (id) => set({ courseFormOpen: true, courseFormId: id ?? null }),
  closeCourseForm: () => set({ courseFormOpen: false, courseFormId: null }),

  activeCourseId: null,
  setActiveCourseId: (id) => set({ activeCourseId: id }),
}));
