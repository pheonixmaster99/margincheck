interface InsightCardProps { message: string; }

export function InsightCard({ message }: InsightCardProps) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white px-5 py-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.02)] sm:px-6">
      <div className="flex items-center gap-2">
        <svg aria-hidden="true" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M10 9v4M10 6.5v.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <h2 className="text-[15px] font-bold text-slate-900">What changed?</h2>
      </div>
      <p className="mt-2.5 text-[11px] leading-4 text-slate-700">{message}</p>
    </aside>
  );
}
