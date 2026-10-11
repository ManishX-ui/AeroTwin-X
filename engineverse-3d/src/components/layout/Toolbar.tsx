import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Box,
  Eye,
  Sliders,
  Sparkles,
  Maximize2,
  Tag,
  Grid3X3,
  Flame,
  Gauge
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { ViewPreset, RenderMode, StrokePhase } from '../../types/engine';

export const Toolbar: React.FC = () => {
  const {
    activeViewPreset,
    setActiveViewPreset,
    explodedProgress,
    setExplodedProgress,
    renderMode,
    setRenderMode,
    labelDisplayMode,
    setLabelDisplayMode,
    isPlaying,
    togglePlay,
    simulationSpeed,
    setSimulationSpeed,
    crankAngle,
    setCrankAngle,
    activeStroke,
    triggerCameraReset,
    resetAllVisibility,
    isolatedComponentId,
    isolateComponent
  } = useEngineStore();

  const presets: { id: ViewPreset; label: string }[] = [
    { id: 'ISOMETRIC', label: 'Iso' },
    { id: 'FRONT', label: 'Front' },
    { id: 'REAR', label: 'Rear' },
    { id: 'LEFT', label: 'Left' },
    { id: 'RIGHT', label: 'Right' },
    { id: 'TOP', label: 'Top' }
  ];

  const strokeColors: Record<StrokePhase, string> = {
    INTAKE: 'bg-sky-100 text-sky-800 border-sky-300',
    COMPRESSION: 'bg-amber-100 text-amber-800 border-amber-300',
    POWER: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
    EXHAUST: 'bg-slate-100 text-slate-800 border-slate-300'
  };

  return (
    <div className="bg-white/95 backdrop-blur-xs border-t border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md z-20 flex-shrink-0">
      {/* 1. Operation & Kinematics Control Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs cursor-pointer transition-all ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          title={isPlaying ? 'Pause Mechanical Cycle' : 'Play Mechanical Cycle'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Pause' : 'Run Cycle'}</span>
        </button>

        {/* Speed Selector */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-mono">
          {[0.25, 0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => setSimulationSpeed(s)}
              className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                simulationSpeed === s
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Crank Angle Scrubber */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono">
          <Gauge className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-700 font-bold w-12 text-right">
            {Math.round(crankAngle)}°
          </span>
          <input
            type="range"
            min={0}
            max={720}
            step={1}
            value={Math.round(crankAngle)}
            onChange={(e) => setCrankAngle(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-sky-600"
            title="Drag to inspect cycle at any crankshaft angle (0°-720°)"
          />
        </div>

        {/* Current Stroke Phase Badge */}
        <div
          className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border flex items-center gap-1.5 ${
            strokeColors[activeStroke]
          }`}
        >
          {activeStroke === 'POWER' && <Flame className="w-3.5 h-3.5 text-rose-600" />}
          <span>STROKE: {activeStroke}</span>
        </div>
      </div>

      {/* 2. Exploded Assembly View Slider */}
      <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono">
        <Sliders className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-600">Exploded View:</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={explodedProgress}
          onChange={(e) => setExplodedProgress(parseFloat(e.target.value))}
          className="w-24 sm:w-28 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-sky-600"
        />
        <span className="text-slate-900 font-bold w-10 text-right">
          {Math.round(explodedProgress * 100)}%
        </span>
        {explodedProgress > 0 && (
          <button
            onClick={() => setExplodedProgress(0)}
            className="text-[10px] text-sky-600 hover:text-sky-800 underline ml-1 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* 3. Inspection Modes (Shaded, Transparent, Wireframe) */}
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
        <button
          onClick={() => setRenderMode('METALLIC')}
          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
            renderMode === 'METALLIC'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Full Metallic Shaded View"
        >
          Solid
        </button>
        <button
          onClick={() => setRenderMode('TRANSPARENT')}
          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
            renderMode === 'TRANSPARENT'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Transparent Engine Block (Inspect Internal Geometry)"
        >
          Ghost Block
        </button>
        <button
          onClick={() => setRenderMode('WIREFRAME')}
          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
            renderMode === 'WIREFRAME'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="CAD Wireframe Mode"
        >
          Wireframe
        </button>
      </div>

      {/* 4. Labels Toggle */}
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
        <span className="text-[11px] font-mono text-slate-500 pl-1.5 pr-1 flex items-center gap-1">
          <Tag className="w-3 h-3" /> Labels:
        </span>
        {(['SELECTED', 'ALL', 'NONE'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setLabelDisplayMode(m)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
              labelDisplayMode === m
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* 5. Camera View Presets */}
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-mono">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveViewPreset(p.id)}
            className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
              activeViewPreset === p.id
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title={`View ${p.label}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Restore Isolation Button */}
      {isolatedComponentId && (
        <button
          onClick={() => isolateComponent(null)}
          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Exit Isolation</span>
        </button>
      )}
    </div>
  );
};
