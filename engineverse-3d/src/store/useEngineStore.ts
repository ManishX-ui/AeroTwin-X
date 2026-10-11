import { create } from 'zustand';
import { ComponentCategory, RenderMode, StrokePhase, ViewPreset } from '../types/engine';
import { ENGINE_COMPONENTS } from '../data/engineComponents';

export type ActiveTab = 'explore' | 'components' | 'operation' | 'tour' | 'quiz' | 'inspector';

interface EngineState {
  // Navigation & Active View
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Selected & Hovered Component
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;

  // Search & Explorer Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;

  // Visibility & Isolation
  hiddenComponentIds: Set<string>;
  toggleComponentVisibility: (id: string) => void;
  isolatedComponentId: string | null;
  isolateComponent: (id: string | null) => void;
  resetAllVisibility: () => void;
  isCategoryVisible: (category: ComponentCategory) => boolean;
  toggleCategoryVisibility: (category: ComponentCategory) => void;

  // Exploded View
  explodedProgress: number; // 0.0 to 1.0
  setExplodedProgress: (progress: number) => void;

  // Inspection Visual Modes
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  outerBlockTransparency: number; // 0.0 to 1.0
  setOuterBlockTransparency: (val: number) => void;
  sectionPlanePosition: number; // -2.0 to 2.0
  setSectionPlanePosition: (val: number) => void;
  showSectionPlane: boolean;
  setShowSectionPlane: (show: boolean) => void;

  // Labels & Annotations
  labelDisplayMode: 'ALL' | 'SELECTED' | 'NONE';
  setLabelDisplayMode: (mode: 'ALL' | 'SELECTED' | 'NONE') => void;

  // Mechanical Operation & 4-Stroke Simulation
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  simulationSpeed: number; // 0.25x to 3.0x
  setSimulationSpeed: (speed: number) => void;
  crankAngle: number; // 0 to 720 degrees
  setCrankAngle: (angle: number) => void;
  activeStroke: StrokePhase;

  // Guided Learning Tour
  currentTourStep: number;
  setCurrentTourStep: (step: number) => void;
  isTourActive: boolean;
  setIsTourActive: (active: boolean) => void;

  // Camera Controls
  activeViewPreset: ViewPreset;
  setActiveViewPreset: (preset: ViewPreset) => void;
  isOrthographic: boolean;
  setIsOrthographic: (ortho: boolean) => void;
  cameraResetTrigger: number;
  triggerCameraReset: () => void;
  focusTarget: [number, number, number] | null;
  setFocusTarget: (target: [number, number, number] | null) => void;

  // Modals
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  isDiagnosticsOpen: boolean;
  setIsDiagnosticsOpen: (open: boolean) => void;

  // Model Source
  modelSource: 'PROCEDURAL' | 'GLB';
  setModelSource: (source: 'PROCEDURAL' | 'GLB') => void;
  customGlbUrl: string | null;
  setCustomGlbUrl: (url: string | null) => void;
}

export const useEngineStore = create<EngineState>((set, get) => ({
  activeTab: 'explore',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedComponentId: null,
  hoveredComponentId: null,
  setSelectedComponentId: (id) => {
    set({ selectedComponentId: id });
  },
  setHoveredComponentId: (id) => set({ hoveredComponentId: id }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedCategory: 'all',
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),

  hiddenComponentIds: new Set<string>(),
  toggleComponentVisibility: (id) => {
    set((state) => {
      const next = new Set(state.hiddenComponentIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { hiddenComponentIds: next };
    });
  },
  isolatedComponentId: null,
  isolateComponent: (id) => {
    set({ isolatedComponentId: id });
  },
  resetAllVisibility: () => {
    set({ hiddenComponentIds: new Set(), isolatedComponentId: null });
  },
  isCategoryVisible: (category) => {
    const hidden = get().hiddenComponentIds;
    const comps = ENGINE_COMPONENTS.filter((c) => c.category === category);
    return comps.some((c) => !hidden.has(c.id));
  },
  toggleCategoryVisibility: (category) => {
    const comps = ENGINE_COMPONENTS.filter((c) => c.category === category);
    const hidden = new Set(get().hiddenComponentIds);
    const allHidden = comps.every((c) => hidden.has(c.id));

    comps.forEach((c) => {
      if (allHidden) {
        hidden.delete(c.id);
      } else {
        hidden.add(c.id);
      }
    });
    set({ hiddenComponentIds: hidden });
  },

  explodedProgress: 0,
  setExplodedProgress: (progress) => set({ explodedProgress: Math.max(0, Math.min(1, progress)) }),

  renderMode: 'METALLIC',
  setRenderMode: (mode) => set({ renderMode: mode }),
  outerBlockTransparency: 0.35,
  setOuterBlockTransparency: (val) => set({ outerBlockTransparency: val }),
  sectionPlanePosition: 0,
  setSectionPlanePosition: (val) => set({ sectionPlanePosition: val }),
  showSectionPlane: false,
  setShowSectionPlane: (show) => set({ showSectionPlane: show }),

  labelDisplayMode: 'SELECTED',
  setLabelDisplayMode: (mode) => set({ labelDisplayMode: mode }),

  isPlaying: true,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  simulationSpeed: 1.0,
  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
  crankAngle: 0,
  setCrankAngle: (angle) => {
    const normalized = ((angle % 720) + 720) % 720;
    let stroke: StrokePhase = 'INTAKE';
    // For Cylinder #1:
    // 0°-180°: Power
    // 180°-360°: Exhaust
    // 360°-540°: Intake
    // 540°-720°: Compression
    if (normalized < 180) stroke = 'POWER';
    else if (normalized < 360) stroke = 'EXHAUST';
    else if (normalized < 540) stroke = 'INTAKE';
    else stroke = 'COMPRESSION';

    set({ crankAngle: normalized, activeStroke: stroke });
  },
  activeStroke: 'POWER',

  currentTourStep: 1,
  setCurrentTourStep: (step) => set({ currentTourStep: step }),
  isTourActive: false,
  setIsTourActive: (active) => set({ isTourActive: active }),

  activeViewPreset: 'ISOMETRIC',
  setActiveViewPreset: (preset) => set({ activeViewPreset: preset }),
  isOrthographic: false,
  setIsOrthographic: (ortho) => set({ isOrthographic: ortho }),
  cameraResetTrigger: 0,
  triggerCameraReset: () => set((state) => ({ cameraResetTrigger: state.cameraResetTrigger + 1, focusTarget: null })),
  focusTarget: null,
  setFocusTarget: (target) => set({ focusTarget: target }),

  isHelpOpen: false,
  setIsHelpOpen: (open) => set({ isHelpOpen: open }),
  isDiagnosticsOpen: false,
  setIsDiagnosticsOpen: (open) => set({ isDiagnosticsOpen: open }),

  modelSource: 'PROCEDURAL',
  setModelSource: (source) => set({ modelSource: source }),
  customGlbUrl: null,
  setCustomGlbUrl: (url) => set({ customGlbUrl: url })
}));
