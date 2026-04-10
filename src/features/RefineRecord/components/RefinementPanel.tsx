// src/features/RecordRefinement/components/RefinementPanel.tsx

/**
 * RefinementPanel
 *
 * Renders the record refinement UI after a file has been uploaded.
 * Displays one of four states driven by RefinementStatus:
 *   idle      → nothing (caller decides when to show this)
 *   analyzing → spinner while AI reviews the record
 *   needs_review → questions for the user to answer
 *   complete  → confirmation with metadata nudges if any
 *   error     → error message with retry option
 *
 * Pure presentational component — all state lives in useRecordRefinement.
 * Metadata questions (subjects, credibility review) are separated from
 * data quality questions since they don't block completion.
 */

import React, { useState } from 'react';
import { Loader2, CheckCircle, AlertTriangle, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { RefinementQuestion, RefinementAnswer, RefinementStatus } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RefinementPanelProps {
  status: RefinementStatus;
  questions: RefinementQuestion[];
  error: string | null;
  onStart: () => void; // triggers startRefinement()
  onSubmitAnswers: (answers: RefinementAnswer[]) => void;
  onSkip: () => void; // triggers skipRefinement()
  onDone: () => void; // called when user clicks done/continue
}

// ── Component ─────────────────────────────────────────────────────────────────

const RefinementPanel: React.FC<RefinementPanelProps> = ({
  status,
  questions,
  error,
  onStart,
  onSubmitAnswers,
  onSkip,
  onDone,
}) => {
  // Split questions into data quality (block completion) vs metadata nudges
  const dataQuestions = questions.filter(q => q.field !== 'metadata');
  const metadataQuestions = questions.filter(q => q.field === 'metadata');

  return (
    <div className="border-t border-gray-200">
      {status === 'idle' && <IdleView onStart={onStart} onSkip={onSkip} />}
      {status === 'analyzing' && <AnalyzingView />}
      {status === 'needs_review' && (
        <QuestionsView
          dataQuestions={dataQuestions}
          metadataQuestions={metadataQuestions}
          onSubmit={onSubmitAnswers}
          onSkip={onSkip}
        />
      )}
      {status === 'complete' && (
        <CompleteView metadataQuestions={metadataQuestions} onDone={onDone} />
      )}
      {status === 'error' && <ErrorView error={error} onSkip={onSkip} />}
    </div>
  );
};

// ── Sub-views ─────────────────────────────────────────────────────────────────

const IdleView: React.FC<{ onStart: () => void; onSkip: () => void }> = ({ onStart, onSkip }) => (
  <div className="p-4 bg-blue-50 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-blue-900">Ready to review your record</p>
      <p className="text-xs text-blue-700 mt-0.5">
        Our AI will check for data quality issues and suggest improvements
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onSkip} className="text-xs text-blue-600 hover:text-blue-800 underline">
        Skip
      </button>
      <Button size="sm" onClick={onStart}>
        Review Record
      </Button>
    </div>
  </div>
);

const AnalyzingView: React.FC = () => (
  <div className="p-4 bg-blue-50 flex items-center gap-3">
    <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
    <div>
      <p className="text-sm font-medium text-blue-900">Reviewing record quality...</p>
      <p className="text-xs text-blue-700 mt-0.5">
        Checking for contradictions, PII, and data completeness
      </p>
    </div>
  </div>
);

const CompleteView: React.FC<{
  metadataQuestions: RefinementQuestion[];
  onDone: () => void;
}> = ({ metadataQuestions, onDone }) => (
  <div className="p-4 bg-green-50">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-green-800">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Record looks good</span>
      </div>
      <Button size="sm" onClick={onDone}>
        Done
      </Button>
    </div>

    {/* Metadata nudges shown as non-blocking suggestions */}
    {metadataQuestions.length > 0 && (
      <div className="space-y-2 mt-3 pt-3 border-t border-green-200">
        <p className="text-xs font-medium text-green-800">Suggestions to improve your record:</p>
        {metadataQuestions.map(q => (
          <div
            key={q.id}
            className="flex items-start gap-2 text-xs text-green-700 bg-white 
                       rounded p-2 border border-green-200"
          >
            <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{q.question}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ErrorView: React.FC<{
  error: string | null;
  onSkip: () => void;
}> = ({ error, onSkip }) => (
  <div className="p-4 bg-red-50 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
      <div>
        <p className="text-sm font-medium text-red-800">Review failed</p>
        <p className="text-xs text-red-600 mt-0.5">{error || 'Something went wrong'}</p>
      </div>
    </div>
    <button onClick={onSkip} className="text-xs text-red-600 hover:text-red-800 underline">
      Continue anyway
    </button>
  </div>
);

// ── Questions view ────────────────────────────────────────────────────────────

const QuestionsView: React.FC<{
  dataQuestions: RefinementQuestion[];
  metadataQuestions: RefinementQuestion[];
  onSubmit: (answers: RefinementAnswer[]) => void;
  onSkip: () => void;
}> = ({ dataQuestions, metadataQuestions, onSubmit, onSkip }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allDataQuestionsAnswered = dataQuestions.every(q => answers[q.id]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    const answerArray: RefinementAnswer[] = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
    onSubmit(answerArray);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">A few questions about your record</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Your answers help us improve the quality of your data
          </p>
        </div>
        <button
          onClick={onSkip}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <SkipForward className="w-3 h-3" />
          Skip all
        </button>
      </div>

      {/* Data quality questions — must be answered to submit */}
      {dataQuestions.length > 0 && (
        <div className="space-y-3">
          {dataQuestions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i + 1}
              answer={answers[q.id]}
              onAnswer={handleAnswer}
            />
          ))}
        </div>
      )}

      {/* Metadata nudges shown separately as optional */}
      {metadataQuestions.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500">Suggestions (optional):</p>
          {metadataQuestions.map(q => (
            <div
              key={q.id}
              className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 
                         rounded p-2 border border-gray-200"
            >
              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
              <span>{q.question}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={handleSubmit} disabled={!allDataQuestionsAnswered}>
          Submit answers
        </Button>
      </div>
    </div>
  );
};

// ── Individual question card ──────────────────────────────────────────────────

const QuestionCard: React.FC<{
  question: RefinementQuestion;
  index: number;
  answer: string | undefined;
  onAnswer: (questionId: string, answer: string) => void;
}> = ({ question, index, answer, onAnswer }) => (
  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
    <div className="flex items-start gap-2">
      <span className="text-xs font-medium text-gray-400 mt-0.5 shrink-0">Q{index}</span>
      <p className="text-sm text-gray-800">{question.question}</p>
    </div>

    {question.context && <p className="text-xs text-gray-500 ml-5 italic">{question.context}</p>}

    {/* Choice question */}
    {question.type === 'choice' && question.options && (
      <div className="ml-5 space-y-1">
        {question.options.map(option => (
          <button
            key={option}
            onClick={() => onAnswer(question.id, option)}
            className={`w-full text-left text-xs px-3 py-2 rounded border transition-colors
              ${
                answer === option
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
          >
            {option}
          </button>
        ))}
      </div>
    )}

    {/* Confirm question (yes/no) */}
    {question.type === 'confirm' && (
      <div className="ml-5 flex gap-2">
        {['Yes', 'No'].map(option => (
          <button
            key={option}
            onClick={() => onAnswer(question.id, option)}
            className={`text-xs px-4 py-1.5 rounded border transition-colors
              ${
                answer === option
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
          >
            {option}
          </button>
        ))}
      </div>
    )}

    {/* Text question */}
    {question.type === 'text' && (
      <textarea
        value={answer || ''}
        onChange={e => onAnswer(question.id, e.target.value)}
        placeholder="Type your answer..."
        className="ml-5 w-full text-xs border border-gray-200 rounded p-2 
                   resize-none focus:outline-none focus:border-blue-400"
        rows={3}
      />
    )}
  </div>
);

export default RefinementPanel;
