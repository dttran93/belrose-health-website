import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Reusable Settings Row Component
interface SettingsRowProps {
  label: string;
  value: React.ReactNode;
  buttonText?: string;
  onButtonClick?: () => void;
  mono?: boolean;
  isLink?: boolean;
  linkHref?: string;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  buttonText,
  onButtonClick,
  mono = false,
  isLink = false,
  linkHref = '',
}) => (
  <div className="flex justify-between items-start py-3">
    <div className="flex-1">
      <div className="text-sm text-left font-medium text-foreground mb-1">{label}</div>
      {isLink ? (
        <div className="text-left">
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm text-left text-complement-1 hover:underline inline-flex items-center gap-1',
            ${mono ? 'font-mono' : ''}`}
          >
            {value}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <div className={`text-sm text-left text-foreground break-all', ${mono ? 'font-mono' : ''}`}>
          {value}
        </div>
      )}
    </div>
    {buttonText && (
      <Button
        variant="outline"
        size="sm"
        onClick={onButtonClick}
        className="ml-4 items-left shrink-0"
      >
        {buttonText}
      </Button>
    )}
  </div>
);

// Section Header Component
interface SectionHeaderProps {
  title: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <h2 className="text-base text-left font-semibold text-primary mt-8 mb-2 pb-3 border-b border-border">
    {title}
  </h2>
);
