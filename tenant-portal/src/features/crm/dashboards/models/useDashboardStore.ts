import { create } from "zustand";
import type { CrmDashboardPlacement, CrmDashboardFilters } from "./dashboard-types";

interface DashboardState {
  // Mode
  editMode: boolean;
  setEditMode: (mode: boolean) => void;

  // Layouts
  draftPlacements: CrmDashboardPlacement[];
  isDirty: boolean;
  filters: Record<string, string>;
  updatePlacement: (widgetId: string, x: number, y: number, w: number, h: number) => void;
  removePlacement: (widgetId: string) => void;
  initDashboard: (dashboard: any) => void;
  setDateRange: (range: any) => void;
  setFilters: (filters: Record<string, string>) => void;
  resetDraftLayout: (originalPlacements: CrmDashboardPlacement[]) => void;

  // Global Filters
  globalFilters: CrmDashboardFilters;
  updateGlobalFilters: (filters: Partial<CrmDashboardFilters>) => void;
  resetGlobalFilters: () => void;
  
  // Tracking if layout is dirty (changed from original)
  isLayoutDirty: boolean;
  setIsLayoutDirty: (isDirty: boolean) => void;
}

const defaultFilters: CrmDashboardFilters = {
  datePreset: "CURRENT_MONTH",
  compare: "PREVIOUS_PERIOD",
};

export const useDashboardStore = create<DashboardState>((set) => ({
  // Mode
  editMode: false,
  setEditMode: (mode) => set({ editMode: mode, isDirty: false }),

  // Layouts
  draftPlacements: [],
  isDirty: false,
  filters: {},
  updatePlacement: (widgetId, x, y, w, h) => set((state) => ({
    isDirty: true,
    draftPlacements: state.draftPlacements.map(p => 
      p.widgetId === widgetId ? { ...p, x, y, width: w, height: h } : p
    ),
    isLayoutDirty: true,
  })),
  removePlacement: (widgetId) => set((state) => ({
    isDirty: true,
    draftPlacements: state.draftPlacements.filter(p => p.widgetId !== widgetId)
  })),
  initDashboard: (dashboard) => set({ draftPlacements: dashboard.placements || [], isDirty: false, editMode: false }),
  setDateRange: () => {},
  setFilters: (filters) => set({ filters }),
  resetDraftLayout: (originalPlacements) => set({ 
    draftPlacements: [...originalPlacements],
    isLayoutDirty: false,
  }),

  // Global Filters
  globalFilters: { ...defaultFilters },
  updateGlobalFilters: (filters) => set((state) => ({
    globalFilters: { ...state.globalFilters, ...filters }
  })),
  resetGlobalFilters: () => set({ globalFilters: { ...defaultFilters } }),

  // Dirty State
  isLayoutDirty: false,
  setIsLayoutDirty: (isDirty) => set({ isLayoutDirty: isDirty }),
}));
