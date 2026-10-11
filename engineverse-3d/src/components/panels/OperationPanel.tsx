import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Flame,
  Wind,
  Layers,
  LogOut,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { StrokePhase } from '../../types/engine';

export const OperationPanel: React.FC = () => {
  const {
    crankAngle,
    setCrankAngle,
    isPlaying,
    togglePlay,
    activeStroke
  } = useEngineStore();

  const strokes: {
    id: StrokePhase;
    name: string;
    range: string;
    icon: React.ReactNode;
    color: string;
    badgeBg: string;
    description: string;
    pistonDirection: string;
    intakeValve: string;
    exhaustValve: string;
    sparkStatus: string;
  }[] = [
    {
      id: 'POWER' as StrokePhase,
      name: 'Power Stroke (Combustion)',
      range: '0° – 180°',
      icon: <Flame className="w-4 h-4 text-rose-600" />,
      color: 'border-rose-400 bg-rose-50/70 text-rose-950',
      badgeBg: 'bg-rose-600 text-white',
      description:
        'The air-fuel charge is ignited by the spark plug. Rapid chemical deflagration spikes cylinder pressure up to 80-120 bar, forcing the piston downward and generating torque on the crankshaft.',
      pistonDirection: 'Moves Downward (TDC → BDC)',
      intakeValve: 'Closed (Hermetically sealed)',
      exhaustValve: 'Closed (Cracks open near BDC)',
      sparkStatus: 'Fired at ~15° BTDC'
    },
    {
      id: 'EXHAUST' as StrokePhase,
      name: 'Exhaust Stroke (Scavenging)',
      range: '180° – 360°',
      icon: <LogOut className="w-4 h-4 text-slate-600" />,
      color: 'border-slate-300 bg-slate-50 text-slate-900',
      badgeBg: 'bg-slate-700 text-white',
      description:
        'The exhaust valve opens fully. The rising piston sweeps burnt combustion gases out of the cylinder into the exhaust header at supersonic velocity, clearing the chamber for the next charge.',
      pistonDirection: 'Moves Upward (BDC → TDC)',
      intakeValve: 'Closed (Opens during overlap)',
      exhaustValve: 'Open (Max lift 8-10 mm)',
      sparkStatus: 'Off'
    },
    {
      id: 'INTAKE' as StrokePhase,
      name: 'Intake Stroke (Induction)',
      range: '360° – 540°',
      icon: <Wind className="w-4 h-4 text-sky-600" />,
      color: 'border-sky-300 bg-sky-50/70 text-sky-950',
      badgeBg: 'bg-sky-600 text-white',
      description:
        'The intake valve opens as the piston descends from TDC to BDC. The expanding chamber volume creates low-pressure depression, ingesting fresh atmospheric or boosted air-fuel mixture.',
      pistonDirection: 'Moves Downward (TDC → BDC)',
      intakeValve: 'Open (Admitting fresh charge)',
      exhaustValve: 'Closed',
      sparkStatus: 'Off'
    },
    {
      id: 'COMPRESSION' as StrokePhase,
      name: 'Compression Stroke',
      range: '540° – 720°',
      icon: <Layers className="w-4 h-4 text-amber-600" />,
      color: 'border-amber-300 bg-amber-50/70 text-amber-950',
      badgeBg: 'bg-amber-600 text-white',
      description:
        'Both valves close tightly. The ascending piston compresses the trapped air-fuel mixture into the small pent-roof combustion chamber volume, raising pressure to ~15 bar and temperature to ~400°C.',
      pistonDirection: 'Moves Upward (BDC → TDC)',
      intakeValve: 'Closed',
      exhaustValve: 'Closed',
      sparkStatus: 'Prepares to fire at ~705°'
    }
  ];

  const currentStrokeInfo = strokes.find((s) => s.id === activeStroke) || strokes[0];

  const stepAngle = (delta: number) => {
    setCrankAngle(((crankAngle + delta) % 720 + 720) % 720);
  };

  return (
    <aside className="w-96 h-full bg-white border-l border-slate-200/80 flex flex-col shadow-lg z-20 flex-shrink-0 animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/70">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
            Real-Time Otto Cycle Kinematics
          </span>
        </div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Four-Stroke Engine Simulator
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Step through the 720° thermodynamic cycle to observe valve timing and piston stroke.
        </p>
      </div>

      {/* Main Interactive Angle Scrubber & Player */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/40 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">Crankshaft Angle:</span>
          <span className="text-lg font-bold text-slate-900">{Math.round(crankAngle)}° / 720°</span>
        </div>

        {/* 720-Degree Timeline Bar */}
        <div className="relative w-full">
          <input
            type="range"
            min={0}
            max={720}
            step={1}
            value={Math.round(crankAngle)}
            onChange={(e) => setCrankAngle(parseFloat(e.target.value))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          {/* Phase segment indicators */}
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1 px-1">
            <span>0° (P)</span>
            <span>180° (E)</span>
            <span>360° (I)</span>
            <span>540° (C)</span>
            <span>720°</span>
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => stepAngle(-15)}
              className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
              title="Step Backward -15°"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white shadow-xs cursor-pointer flex items-center gap-1.5 ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              onClick={() => stepAngle(15)}
              className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
              title="Step Forward +15°"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setCrankAngle(0)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer text-xs font-mono flex items-center gap-1"
            title="Reset to 0° (Top Dead Center Power Stroke)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>0° TDC</span>
          </button>
        </div>
      </div>

      {/* Current Stroke Active Card */}
      <div className="p-4 border-b border-slate-200/80">
        <div className={`p-3.5 rounded-xl border ${currentStrokeInfo.color} space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentStrokeInfo.icon}
              <h3 className="font-bold text-sm tracking-tight">{currentStrokeInfo.name}</h3>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${currentStrokeInfo.badgeBg}`}>
              {currentStrokeInfo.range}
            </span>
          </div>
          <p className="text-xs leading-relaxed opacity-90 font-sans">
            {currentStrokeInfo.description}
          </p>
        </div>
      </div>

      {/* Mechanical State Matrix */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
          Cylinder #1 Mechanical Valve & Piston States
        </span>

        <div className="space-y-2 font-mono text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500">Piston Motion:</span>
            <strong className="text-slate-800">{currentStrokeInfo.pistonDirection}</strong>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500">Intake Valve:</span>
            <strong className={currentStrokeInfo.intakeValve.includes('Open') ? 'text-sky-700' : 'text-slate-700'}>
              {currentStrokeInfo.intakeValve}
            </strong>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500">Exhaust Valve:</span>
            <strong className={currentStrokeInfo.exhaustValve.includes('Open') ? 'text-rose-700' : 'text-slate-700'}>
              {currentStrokeInfo.exhaustValve}
            </strong>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500">Spark Electrode:</span>
            <strong className={currentStrokeInfo.sparkStatus.includes('Fired') ? 'text-amber-600' : 'text-slate-500'}>
              {currentStrokeInfo.sparkStatus}
            </strong>
          </div>
        </div>

        {/* Firing Order Timeline */}
        <div className="pt-2">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block mb-2">
            Inline-4 Firing Order (1 - 3 - 4 - 2)
          </span>
          <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px] text-center">
            {[
              { cyl: 'Cyl 1', deg: '0°' },
              { cyl: 'Cyl 3', deg: '180°' },
              { cyl: 'Cyl 4', deg: '360°' },
              { cyl: 'Cyl 2', deg: '540°' }
            ].map((c, i) => (
              <div key={i} className="p-2 bg-slate-50 rounded border border-slate-200">
                <strong className="text-slate-800 block">{c.cyl}</strong>
                <span className="text-sky-600 text-[10px]">{c.deg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
