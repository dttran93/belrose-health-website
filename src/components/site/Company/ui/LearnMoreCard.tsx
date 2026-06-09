import { Download, ExternalLink } from 'lucide-react';

interface ResourceCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  onDownload?: () => void;
  onView?: () => void;
  externalUrl?: string;
  externalLabel?: string;
}

const LearnMoreCard: React.FC<ResourceCardProps> = ({
  icon,
  iconBg,
  title,
  description,
  onDownload,
  onView,
  externalUrl,
  externalLabel,
}) => (
  <div className="flex flex-col gap-3 bg-white rounded-2xl border border-gray-200 p-5">
    <div className="flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
      >
        {icon}
      </div>

      <p className="text-[15px] text-left font-bold text-gray-900">{title}</p>
    </div>

    <p className="text-[13px] text-left text-gray-500 leading-relaxed flex-1">{description}</p>

    <div className="flex gap-2 flex-wrap pt-1 justify-center">
      {externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold
            px-3 py-2 rounded-lg border border-gray-200 text-gray-700
            hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={12} />
          {externalLabel}
        </a>
      ) : (
        <>
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold
              px-3 py-2 rounded-lg bg-primary text-white
              hover:opacity-90 transition-opacity"
          >
            <Download size={12} />
            Download
          </button>
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold
              px-3 py-2 rounded-lg border border-gray-200 text-gray-700
              hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={12} />
            View
          </button>
        </>
      )}
    </div>
  </div>
);

export default LearnMoreCard;
