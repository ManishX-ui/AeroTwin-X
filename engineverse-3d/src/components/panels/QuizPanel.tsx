import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  ChevronRight,
  HelpCircle,
  Eye
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { QUIZ_QUESTIONS } from '../../data/quizQuestions';

export const QuizPanel: React.FC = () => {
  const { setSelectedComponentId } = useEngineStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQ = QUIZ_QUESTIONS[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswer(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    setIsAnswerSubmitted(true);
    if (selectedAnswer === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
    // Highlight related component in 3D if present
    if (currentQ.componentId) {
      setSelectedComponentId(currentQ.componentId);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswerSubmitted(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setIsCompleted(false);
  };

  return (
    <aside className="w-96 h-full bg-white border-l border-slate-200/80 flex flex-col shadow-lg z-20 flex-shrink-0 animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/70">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-800">
              Interactive Knowledge Check
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {isCompleted ? 'Finished' : `Question ${currentIndex + 1} / ${QUIZ_QUESTIONS.length}`}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
          <div
            className="bg-sky-600 h-full transition-all duration-300 rounded-full"
            style={{
              width: isCompleted
                ? '100%'
                : `${((currentIndex + 1) / QUIZ_QUESTIONS.length) * 100}%`
            }}
          />
        </div>
      </div>

      {isCompleted ? (
        /* Quiz Finished Summary */
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center border-2 border-sky-200">
            <Award className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Quiz Completed!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Mechanical Engineering Assessment Evaluation
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 w-full font-mono">
            <div className="text-3xl font-bold text-slate-900">
              {score} / {QUIZ_QUESTIONS.length}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {score >= 8
                ? 'Outstanding Mastery! Advanced understanding of engine mechanics.'
                : score >= 6
                ? 'Great Job! Solid grasp of core internal combustion principles.'
                : 'Good effort! Review the Guided Tour lessons to reinforce concepts.'}
            </span>
          </div>

          <button
            onClick={handleRestart}
            className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Quiz</span>
          </button>
        </div>
      ) : (
        /* Question Active View */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Question Text */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-semibold text-sm leading-snug">
              {currentQ.question}
            </div>

            {/* Multiple Choice Options */}
            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedAnswer === idx;
                const isCorrect = isAnswerSubmitted && idx === currentQ.correctIndex;
                const isWrong = isAnswerSubmitted && isSelected && idx !== currentQ.correctIndex;

                let btnStyles =
                  'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300';
                if (isSelected && !isAnswerSubmitted) {
                  btnStyles = 'bg-sky-50 text-sky-950 border-sky-500 ring-1 ring-sky-400 font-semibold';
                } else if (isCorrect) {
                  btnStyles = 'bg-emerald-50 text-emerald-950 border-emerald-500 font-bold';
                } else if (isWrong) {
                  btnStyles = 'bg-rose-50 text-rose-950 border-rose-500 font-bold';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    disabled={isAnswerSubmitted}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer ${btnStyles}`}
                  >
                    <span>{opt}</span>
                    {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    {isWrong && <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation box on submit */}
            {isAnswerSubmitted && (
              <div
                className={`p-3.5 rounded-lg border text-xs leading-relaxed font-sans animate-in fade-in duration-200 ${
                  selectedAnswer === currentQ.correctIndex
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/80 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1 font-mono text-[11px]">
                  {selectedAnswer === currentQ.correctIndex ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Correct Answer!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Incorrect</span>
                    </>
                  )}
                </div>
                <p>{currentQ.explanation}</p>
                {currentQ.componentId && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] font-mono text-sky-700">
                    <Eye className="w-3 h-3" />
                    <span>Highlighted in 3D Scene</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bottom Button */}
          <div className="pt-4 border-t border-slate-200">
            {!isAnswerSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1 transition-colors"
              >
                <span>
                  {currentIndex + 1 < QUIZ_QUESTIONS.length
                    ? 'Next Question'
                    : 'View Final Results'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
