const NoteRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
    <span className="text-sm text-slate-700">{value}</span>
  </div>
);

export default NoteRow;
