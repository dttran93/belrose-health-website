import { ArrowRight } from 'lucide-react';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'secondary';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  sublabel,
  onClick,
  disabled,
  variant,
}) => {
  const base =
    'w-full rounded-xl px-4 py-3.5 text-left flex items-center gap-3 group transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

  const styles =
    variant === 'primary'
      ? `${base} bg-complement-3 hover:bg-complement-3/90`
      : `${base} bg-slate-50 hover:bg-slate-100 border border-slate-200`;

  const iconWrapperStyles =
    variant === 'primary'
      ? 'w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0'
      : 'w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0';

  const labelStyles =
    variant === 'primary'
      ? 'text-sm font-semibold text-white'
      : 'text-sm font-semibold text-slate-700';

  const sublabelStyles =
    variant === 'primary' ? 'text-xs text-white/70 mt-0.5' : 'text-xs text-slate-400 mt-0.5';

  const arrowStyles =
    variant === 'primary'
      ? 'w-4 h-4 text-white/60 flex-shrink-0 group-hover:translate-x-0.5 transition-transform'
      : 'w-4 h-4 text-slate-300 flex-shrink-0 group-hover:translate-x-0.5 transition-transform';

  return (
    <button onClick={onClick} disabled={disabled} className={styles}>
      <div className={iconWrapperStyles}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={labelStyles}>{label}</p>
        <p className={sublabelStyles}>{sublabel}</p>
      </div>
      <ArrowRight className={arrowStyles} />
    </button>
  );
};

export default ActionButton;
