import React, { useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Toolbar } from './components/layout/Toolbar';
import { EngineCanvas } from './components/engine/EngineCanvas';
import { ComponentExplorer } from './components/panels/ComponentExplorer';
import { ComponentInfoPanel } from './components/panels/ComponentInfoPanel';
import { OperationPanel } from './components/panels/OperationPanel';
import { LearningPanel } from './components/panels/LearningPanel';
import { QuizPanel } from './components/panels/QuizPanel';
import { DiagnosticsModal } from './components/panels/DiagnosticsModal';
import { HelpModal } from './components/panels/HelpModal';
import { useEngineStore } from './store/useEngineStore';

export const App: React.FC = () => {
  const {
    activeTab,
    selectedComponentId,
    setSelectedComponentId,
    togglePlay,
    setCrankAngle,
    crankAngle,
    triggerCameraReset,
    setIsDiagnosticsOpen
  } = useEngineStore();

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        setCrankAngle(((crankAngle + 15) % 720 + 720) % 720);
      } else if (e.code === 'ArrowLeft') {
        setCrankAngle(((crankAngle - 15) % 720 + 720) % 720);
      } else if (e.code === 'Escape') {
        setSelectedComponentId(null);
      } else if (e.key === 'h' || e.key === 'H') {
        triggerCameraReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, setCrankAngle, crankAngle, setSelectedComponentId, triggerCameraReset]);

  // When tab is 'inspector', automatically open diagnostics modal
  useEffect(() => {
    if (activeTab === 'inspector') {
      setIsDiagnosticsOpen(true);
    }
  }, [activeTab, setIsDiagnosticsOpen]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Top Navigation */}
      <Header />

      {/* Main Central Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Component Explorer Tree (visible in 'explore' & 'components' modes) */}
        {(activeTab === 'explore' || activeTab === 'components') && (
          <ComponentExplorer />
        )}

        {/* Central 3D Interactive Viewport */}
        <section className="flex-1 h-full relative overflow-hidden">
          <EngineCanvas />
        </section>

        {/* Right Dynamic Panels */}
        {activeTab === 'operation' ? (
          <OperationPanel />
        ) : activeTab === 'tour' ? (
          <LearningPanel />
        ) : activeTab === 'quiz' ? (
          <QuizPanel />
        ) : selectedComponentId ? (
          <ComponentInfoPanel />
        ) : null}
      </main>

      {/* Bottom Engineering Controls Toolbar */}
      <Toolbar />

      {/* Diagnostics Modal & Help Modal */}
      <DiagnosticsModal />
      <HelpModal />
    </div>
  );
};

export default App;
