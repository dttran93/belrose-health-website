const StatusCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  bg: string;
  border: string;
}> = ({ icon, title, description, bg, border }) => (
  <div
    className={`${bg} ${border} border rounded-xl p-8 flex flex-col items-center text-center gap-3 max-w-md mx-auto`}
  >
    {icon}
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="text-slate-500 text-sm">{description}</p>
  </div>
);

export default StatusCard;
