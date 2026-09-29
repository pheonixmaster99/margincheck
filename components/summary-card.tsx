interface SummaryCardProps {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger" | "success";
  detail?: string;
}

const valueTones = {
  default: "text-slate-900",
  warning: "text-amber-600",
  danger: "text-red-500",
  success: "text-emerald-600",
};

const detailTones = {
  default: "text-slate-500",
  warning: "text-amber-600",
  danger: "text-red-500",
  success: "text-emerald-600",
};

export function SummaryCard({ label, value, tone = "default", detail }: SummaryCardProps) {
  return (
    <article className="min-h-[118px] rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] sm:px-6">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-[27px] font-bold leading-none tracking-[-0.025em] ${valueTones[tone]}`}>{value}</p>
      {detail ? <p className={`mt-3 text-[11px] font-medium ${detailTones[tone]}`}>{detail}</p> : null}
    </article>
  );
}
