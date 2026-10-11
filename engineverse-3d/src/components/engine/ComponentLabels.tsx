import React from 'react';
import { Html } from '@react-three/drei';
import { useEngineStore } from '../../store/useEngineStore';
import { ENGINE_COMPONENTS } from '../../data/engineComponents';

// Anchors for component labels
const COMPONENT_ANCHORS: Record<string, [number, number, number]> = {
  engine_block: [0.85, -0.4, 0],
  cylinder_head: [0.85, 0.75, 0],
  cylinder_1: [0.45, 0.2, 1.05],
  piston_1: [0.42, 0.45, 1.05],
  piston_2: [0.42, 0.15, 0.35],
  piston_3: [0.42, 0.15, -0.35],
  piston_4: [0.42, 0.45, -1.05],
  connecting_rod_1: [0.35, -0.25, 1.05],
  crankshaft: [0, -0.9, 0],
  camshaft: [0, 1.45, 0.5],
  intake_valve_1: [-0.35, 1.05, 1.05],
  exhaust_valve_1: [0.35, 1.05, 1.05],
  spark_plug_1: [0, 1.6, 1.05],
  fuel_injector: [-0.85, 1.05, 0.35],
  ignition_region: [0, 0.55, 1.05],
  cooling_fan: [0, 0.4, 1.85],
  alternator: [1.15, -0.15, 1.25],
  oil_filter: [1.1, -0.85, 0.35],
  intake_manifold: [-1.2, 0.85, 0],
  exhaust_manifold: [1.2, 0.65, 0],
  flywheel: [0, -0.65, -1.85],
  oil_sump: [0, -1.55, 0],
  timing_drive: [0, 0.4, 1.65]
};

export const ComponentLabels: React.FC = () => {
  const {
    labelDisplayMode,
    selectedComponentId,
    setSelectedComponentId,
    hiddenComponentIds,
    isolatedComponentId
  } = useEngineStore();

  if (labelDisplayMode === 'NONE') return null;

  const componentsToDisplay = ENGINE_COMPONENTS.filter((comp) => {
    if (hiddenComponentIds.has(comp.id)) return false;
    if (isolatedComponentId && isolatedComponentId !== comp.id) return false;

    if (labelDisplayMode === 'SELECTED') {
      return selectedComponentId === comp.id;
    }
    return true; // 'ALL' mode
  });

  return (
    <group name="ComponentLabelsGroup">
      {componentsToDisplay.map((comp) => {
        const anchor = COMPONENT_ANCHORS[comp.id] || [0, 0, 0];
        const isSelected = selectedComponentId === comp.id;

        return (
          <group key={comp.id} position={anchor}>
            <Html
              center
              distanceFactor={8}
              zIndexRange={[100, 0]}
              style={{
                pointerEvents: 'auto',
                transition: 'all 0.15s ease-out'
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedComponentId(comp.id);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold shadow-md whitespace-nowrap cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-300 scale-110 shadow-sky-500/30'
                    : 'bg-white/95 hover:bg-slate-50 text-slate-700 border-slate-300/80 hover:border-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? 'bg-white animate-pulse' : 'bg-sky-500'
                  }`}
                />
                <span>{comp.displayName.split('(')[0].trim()}</span>
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
