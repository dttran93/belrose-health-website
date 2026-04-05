import { Lock } from 'lucide-react';

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-50">
    <header className="bg-white border-b border-slate-100 px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <span className="font-bold text-slate-900 text-lg tracking-tight">Belrose</span>
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          End-to-end encrypted
        </span>
      </div>
    </header>
    <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
  </div>
);

export default PageShell;
