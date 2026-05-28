// src/features/HomeDashboard/components/AIQuickAskWidget.tsx

/**
 * AIQuickAskWidget
 *
 * A teaser-style prompt bar on the home dashboard.
 * Clicking anywhere navigates to full AI assistant.
 * Shows contextual chip suggestions based on whether the user has records.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

interface AIQuickAskWidgetProps {
  recordCount: number;
}

export const AIAssistantWidget: React.FC<AIQuickAskWidgetProps> = ({ recordCount }) => {
  const navigate = useNavigate();

  const hasRecords = recordCount > 0;

  const chips = hasRecords
    ? ['Summarise my records', 'Any recent trends?', 'Check my medications']
    : ['What can you help me with?', 'How does this work?'];

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">AI health assistant</span>
      </div>

      <p className="text-xs text-muted-foreground -mt-1">
        {hasRecords
          ? `Analysing ${recordCount} record${recordCount === 1 ? '' : 's'}`
          : 'Add records first for the best answers'}
      </p>

      {/* Fake prompt bar — entire thing is a button */}
      <button
        onClick={() => navigate('/app/ai')}
        className="
          flex items-center gap-3 w-full text-left
          bg-muted hover:bg-accent
          border border-border rounded-lg
          px-3 py-2.5
          transition-colors duration-150
          group
        "
      >
        <span className="flex-1 text-sm text-muted-foreground">
          Ask anything about your health...
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map(chip => (
          <button
            key={chip}
            onClick={() => navigate('/app/ai')}
            className="
              text-xs text-complement-1 bg-complement-1/10
              hover:bg-complement-1/20
              rounded-full px-3 py-1
              transition-colors duration-150
            "
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AIAssistantWidget;
