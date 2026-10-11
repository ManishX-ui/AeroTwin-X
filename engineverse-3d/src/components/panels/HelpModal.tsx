import React from 'react';
import {
  X,
  MousePointer,
  Rotate3d,
  ZoomIn,
  Move,
  Keyboard,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

export const HelpModal: React.FC = () => {
  const { isHelpOpen, setIsHelpOpen } = useEngineStore();

  if (!isHelpOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">
              3D Navigation & Interaction Guide
            </h3>
          </div>
          <button
            onClick={() => setIsHelpOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs font-sans text-slate-700">
          {/* Mouse & Touch */}
          <div className="space-y-2">
            <span className="font-mono font-bold text-slate-700 text-xs uppercase tracking-wider block">
              3D Mouse & Touch Controls
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Rotate3d className="w-4 h-4 text-sky-600" />
                  <span>360° Orbit</span>
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  Left-Click + Drag (or 1-finger drag on mobile) to rotate freely around the engine.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ZoomIn className="w-4 h-4 text-sky-600" />
                  <span>Smooth Zoom</span>
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  Mouse Scroll Wheel (or pinch-to-zoom on mobile) to zoom in and out.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Move className="w-4 h-4 text-sky-600" />
                  <span>Pan Camera</span>
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  Right-Click + Drag or Shift + Left-Click (or 2-finger drag) to pan.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <MousePointer className="w-4 h-4 text-sky-600" />
                  <span>Select Parts</span>
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  Click any 3D component or label to view engineering specs & isolate.
                </p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="p-3.5 bg-sky-50 rounded-lg border border-sky-200 space-y-1.5">
            <span className="font-bold text-sky-950 font-mono text-[11px] uppercase tracking-wider block">
              Key Interactive Tools
            </span>
            <ul className="space-y-1 text-sky-900">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span><strong>Exploded Assembly Slider:</strong> Smoothly separates components.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span><strong>Ghost Block Transparency:</strong> Reveals pistons, rods, and valves.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span><strong>Kinematics Scrubber:</strong> Drag crank angle from 0° to 720°.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={() => setIsHelpOpen(false)}
            className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
