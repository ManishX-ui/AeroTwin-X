import React, { useState } from 'react';
import {
  Cog,
  Compass,
  Layers,
  Activity,
  GraduationCap,
  HelpCircle,
  Maximize,
  Minimize,
  RotateCcw,
  Sparkles,
  Search,
  FileCode
} from 'lucide-react';
import { useEngineStore, ActiveTab } from '../../store/useEngineStore';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    triggerCameraReset,
    resetAllVisibility,
    setIsHelpOpen,
    setIsDiagnosticsOpen,
    modelSource,
    setModelSource
  } = useEngineStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'explore', label: 'Explore', icon: <Compass className="w-4 h-4" /> },
    { id: 'components', label: 'Components', icon: <Layers className="w-4 h-4" /> },
    { id: 'operation', label: 'Engine Operation', icon: <Activity className="w-4 h-4" /> },
    { id: 'tour', label: 'Guided Tour', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'quiz', label: 'Quiz', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'inspector', label: 'Model Inspector', icon: <FileCode className="w-4 h-4" /> }
  ];

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between shadow-xs select-none z-30 flex-shrink-0">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-sm shadow-sky-600/30">
          <Cog className="w-5 h-5 animate-spin-slow" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 tracking-tight">
              EngineVerse 3D
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200/60 font-semibold">
              v1.0 CAD LAB
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Inline-4 Spark-Ignition Engine Explorer & Mechanical Simulator
          </p>
        </div>
      </div>

      {/* Center Mode Switcher Tabs */}
      <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls & Actions */}
      <div className="flex items-center gap-2">
        {/* Model Source Badge & Toggle */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{modelSource === 'PROCEDURAL' ? 'Procedural 3D Prototype' : 'Custom GLB'}</span>
          <button
            onClick={() => setModelSource(modelSource === 'PROCEDURAL' ? 'GLB' : 'PROCEDURAL')}
            className="ml-1 text-[10px] text-sky-600 hover:text-sky-800 underline cursor-pointer"
            title="Switch model source"
          >
            Toggle
          </button>
        </div>

        {/* Camera Reset */}
        <button
          onClick={() => {
            triggerCameraReset();
            resetAllVisibility();
          }}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          title="Reset Camera & View (Home)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Diagnostics Modal */}
        <button
          onClick={() => setIsDiagnosticsOpen(true)}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          title="Open Model Inspection & Diagnostics"
        >
          <FileCode className="w-4 h-4" />
        </button>

        {/* Help Modal */}
        <button
          onClick={() => setIsHelpOpen(true)}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          title="Keyboard & Mouse Controls Guide"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
