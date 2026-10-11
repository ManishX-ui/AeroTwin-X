import React from 'react';
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { LEARNING_STEPS } from '../../data/learningSteps';

export const LearningPanel: React.FC = () => {
  const {
    currentTourStep,
    setCurrentTourStep,
    setSelectedComponentId,
    setFocusTarget
  } = useEngineStore();

  const step = LEARNING_STEPS.find((s) => s.id === currentTourStep) || LEARNING_STEPS[0];

  const handleStepChange = (newStepId: number) => {
    if (newStepId < 1 || newStepId > LEARNING_STEPS.length) return;
    setCurrentTourStep(newStepId);
    const targetStep = LEARNING_STEPS.find((s) => s.id === newStepId);
    if (targetStep) {
      setSelectedComponentId(targetStep.focusComponentId);
      setFocusTarget(targetStep.cameraTarget);
    }
  };

  return (
    <aside className="w-96 h-full bg-white border-l border-slate-200/80 flex flex-col shadow-lg z-20 flex-shrink-0 animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/70">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-sky-600" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-800">
              Interactive Guided Curriculum
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {step.id} of {LEARNING_STEPS.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
          <div
            className="bg-sky-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(step.id / LEARNING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Lesson Navigation Header */}
      <div className="p-4 border-b border-slate-200/60 bg-white">
        <span className="text-[11px] font-mono text-sky-700 font-bold block mb-1">
          LESSON {step.id}: {step.subtitle}
        </span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
          {step.title}
        </h2>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans text-slate-700 divide-y divide-slate-100">
        {/* Core Lesson Narrative */}
        <div className="space-y-2">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-sky-600" />
            <span>Concept Overview</span>
          </span>
          <p className="leading-relaxed text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200/70 text-xs">
            {step.content}
          </p>
        </div>

        {/* Key Takeaways */}
        <div className="pt-3 space-y-2">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
            Essential Mechanical Principles
          </span>
          <ul className="space-y-2">
            {step.keyPoints.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Trivia Box */}
        <div className="pt-3 space-y-1.5">
          <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold font-mono text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Engineering Fact</span>
            </div>
            <p className="text-amber-950 text-xs leading-relaxed font-sans">
              {step.technicalTrivia}
            </p>
          </div>
        </div>

        {/* Quick Lesson Jump Selector */}
        <div className="pt-3 pb-6 space-y-1.5">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
            All Curriculum Lessons
          </span>
          <div className="space-y-1">
            {LEARNING_STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleStepChange(s.id)}
                className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  s.id === currentTourStep
                    ? 'bg-sky-50 font-bold text-sky-900 border border-sky-200'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="truncate">
                  {s.id}. {s.title}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0 ml-1" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation Buttons */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
        <button
          onClick={() => handleStepChange(currentTourStep - 1)}
          disabled={currentTourStep <= 1}
          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 text-slate-700 shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <button
          onClick={() => handleStepChange(currentTourStep + 1)}
          disabled={currentTourStep >= LEARNING_STEPS.length}
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 text-white shadow-xs"
        >
          <span>Next Lesson</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
