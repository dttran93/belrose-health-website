// src/features/AIChat/components/ContextBadge.tsx

import React from 'react';
import { FileText, User, Users, FolderOpen } from 'lucide-react';

export type ContextType = 'my-records' | 'subject' | 'all-accessible' | 'specific-records';

interface ContextBadgeProps {
  context: ContextSelection;
  subjectName?: string;
  className?: string;
}

export interface ContextSelection {
  type: ContextType;
  subjectId?: string | null;
  recordIds?: string[];
  recordCount: number;
  description: string;
}

export function ContextBadge({ context, subjectName, className = '' }: ContextBadgeProps) {
  const getIcon = () => {
    switch (context.type) {
      case 'my-records':
        return <User className="w-3.5 h-3.5" />;
      case 'subject':
        return <User className="w-3.5 h-3.5" />;
      case 'all-accessible':
        return <Users className="w-3.5 h-3.5" />;
      case 'specific-records':
        return <FolderOpen className="w-3.5 h-3.5" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getBadgeColor = () => {
    switch (context.type) {
      case 'my-records':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'subject':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'all-accessible':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'specific-records':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getDescription = () => {
    switch (context.type) {
      case 'my-records':
        return `Answering based on your ${context.recordCount} health record${context.recordCount !== 1 ? 's' : ''}`;
      case 'subject':
        return `Answering based on ${subjectName || 'their'}'s ${context.recordCount} health record${context.recordCount !== 1 ? 's' : ''}`;
      case 'all-accessible':
        return `Answering based on all ${context.recordCount} accessible record${context.recordCount !== 1 ? 's' : ''}`;
      case 'specific-records':
        return `Answering based on ${context.recordCount} selected record${context.recordCount !== 1 ? 's' : ''}`;
      default:
        return context.description || 'No context selected';
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${getBadgeColor()} ${className}`}
    >
      {getIcon()}
      <span>{getDescription()}</span>
    </div>
  );
}
