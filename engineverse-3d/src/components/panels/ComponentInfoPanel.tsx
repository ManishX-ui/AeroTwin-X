import React from 'react';
import {
  X,
  Target,
  Maximize2,
  EyeOff,
  Flame,
  Info,
  AlertTriangle,
  Link as LinkIcon,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { ENGINE_COMPONENTS } from '../../data/engineComponents';

export const ComponentInfoPanel: React.FC = () => {
  const {
    selectedComponentId,
    setSelectedComponentId,
    isolateComponent,
    isolatedComponentId,
    toggleComponentVisibility,
    setFocusTarget
  } = useEngineStore();

  if (!selectedComponentId) return null;

  const comp = ENGINE_COMPONENTS.find((c) => c.id === selectedComponentId);
  if (!comp) return null;

  const isIsolated = isolatedComponentId === comp.id;

  const handleFocus = () => {
    // Focus target coordinates for parts
    setFocusTarget([0, 0, 0]);
  };

  return (
    <aside className="w-96 h-full bg-white border-l border-slate-200/80 flex flex-col shadow-lg z-20 flex-shrink-0 animate-in slide-in-from-right-4 duration-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
              {comp.categoryName}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
            {comp.displayName}
          </h2>
          <span className="text-xs text-slate-500 font-mono block mt-0.5">
            {comp.subsystem}
          </span>
        </div>

        <button
          onClick={() => setSelectedComponentId(null)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons Bar */}
      <div className="p-3 border-b border-slate-200/60 bg-white flex items-center gap-2 text-xs">
        <button
          onClick={() => isolateComponent(isIsolated ? null : comp.id)}
          className={`flex-1 py-1.5 px-2 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
            isIsolated
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
          title={isIsolated ? 'Restore full engine assembly' : 'Isolate this component only'}
        >
          <Target className="w-3.5 h-3.5" />
          <span>{isIsolated ? 'Exit Isolate' : 'Isolate Part'}</span>
        </button>

        <button
          onClick={handleFocus}
          className="py-1.5 px-2.5 rounded-md font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer flex items-center gap-1 transition-colors"
          title="Center 3D camera on this part"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Focus</span>
        </button>

        <button
          onClick={() => toggleComponentVisibility(comp.id)}
          className="py-1.5 px-2.5 rounded-md font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer flex items-center gap-1 transition-colors"
          title="Hide component from 3D scene"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Hide</span>
        </button>
      </div>

      {/* Scrollable Information Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans text-slate-700 divide-y divide-slate-100">
        {/* 1. Primary Function */}
        <div className="space-y-1.5">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
            Primary Engineering Function
          </span>
          <p className="leading-relaxed text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            {comp.function}
          </p>
        </div>

        {/* 2. Working Principle */}
        <div className="pt-3 space-y-1.5">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
            Mechanical Working Principle
          </span>
          <p className="leading-relaxed text-slate-700">{comp.workingPrinciple}</p>
        </div>

        {/* 3. Materials & Operating Specifications */}
        <div className="pt-3 space-y-2">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
            Technical Specifications
          </span>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-400 block text-[10px]">MATERIAL</span>
              <span className="font-semibold text-slate-800">{comp.material}</span>
            </div>
            {comp.operatingTemp && (
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">OPERATING TEMP</span>
                <span className="font-semibold text-amber-700">{comp.operatingTemp}</span>
              </div>
            )}
            {comp.tolerance && (
              <div className="p-2 bg-slate-50 rounded border border-slate-200 col-span-2">
                <span className="text-slate-400 block text-[10px]">MACHINING TOLERANCE</span>
                <span className="font-semibold text-slate-800">{comp.tolerance}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Role in Four Strokes */}
        <div className="pt-3 space-y-2">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
            Role Across Four-Stroke Cycle
          </span>
          <div className="space-y-1.5 font-sans">
            <div className="p-2 rounded bg-sky-50/60 border border-sky-100">
              <strong className="text-sky-900 font-mono text-[11px] block">INTAKE:</strong>
              <p className="text-slate-600 mt-0.5">{comp.roleInCycle.INTAKE}</p>
            </div>
            <div className="p-2 rounded bg-amber-50/60 border border-amber-100">
              <strong className="text-amber-900 font-mono text-[11px] block">COMPRESSION:</strong>
              <p className="text-slate-600 mt-0.5">{comp.roleInCycle.COMPRESSION}</p>
            </div>
            <div className="p-2 rounded bg-rose-50/60 border border-rose-100">
              <strong className="text-rose-900 font-mono text-[11px] block">POWER:</strong>
              <p className="text-slate-600 mt-0.5">{comp.roleInCycle.POWER}</p>
            </div>
            <div className="p-2 rounded bg-slate-100/60 border border-slate-200">
              <strong className="text-slate-900 font-mono text-[11px] block">EXHAUST:</strong>
              <p className="text-slate-600 mt-0.5">{comp.roleInCycle.EXHAUST}</p>
            </div>
          </div>
        </div>

        {/* 5. Educational Facts & Engineering Trivia */}
        <div className="pt-3 space-y-1.5">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-600" />
            <span>Engineering Insights</span>
          </span>
          <ul className="space-y-1.5 list-disc list-inside text-slate-600 leading-relaxed">
            {comp.educationalFacts.map((fact, idx) => (
              <li key={idx} className="pl-1">
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* 6. Failure Symptoms */}
        <div className="pt-3 space-y-1.5">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Common Failure Symptoms</span>
          </span>
          <ul className="space-y-1.5 list-disc list-inside text-slate-600 leading-relaxed">
            {comp.failureSymptoms.map((sym, idx) => (
              <li key={idx} className="pl-1">
                {sym}
              </li>
            ))}
          </ul>
        </div>

        {/* 7. Related Components Navigation */}
        <div className="pt-3 space-y-2 pb-6">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-sky-600" />
            <span>Connected Assembly Components</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {comp.relatedComponentIds.map((relId) => {
              const relComp = ENGINE_COMPONENTS.find((c) => c.id === relId);
              if (!relComp) return null;
              return (
                <button
                  key={relId}
                  onClick={() => setSelectedComponentId(relId)}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{relComp.displayName.split('(')[0].trim()}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
