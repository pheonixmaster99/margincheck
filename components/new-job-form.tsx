"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SummaryCard } from "@/components/summary-card";
import { TopNavigation } from "@/components/top-navigation";
import { calculateJobFinancials } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { saveJob } from "@/lib/jobs-storage";
import { SUPPORTED_CURRENCIES, type CurrencyCode, type Job } from "@/types/job";

interface FormValues {
  name: string;
  customer: string;
  currency: CurrencyCode;
  quotedRevenue: string;
  estimatedLabourHours: string;
  labourCostPerHour: string;
  estimatedMaterials: string;
  estimatedSubcontractors: string;
  estimatedOther: string;
}

type FieldName = Exclude<keyof FormValues, "currency">;
type FormErrors = Partial<Record<FieldName, string>>;

const initialValues: FormValues = {
  name: "",
  customer: "",
  currency: "CAD",
  quotedRevenue: "",
  estimatedLabourHours: "",
  labourCostPerHour: "",
  estimatedMaterials: "",
  estimatedSubcontractors: "",
  estimatedOther: "",
};

const optionalNumericFields: FieldName[] = [
  "estimatedLabourHours",
  "labourCostPerHour",
  "estimatedMaterials",
  "estimatedSubcontractors",
  "estimatedOther",
];

const formFieldNames: FieldName[] = [
  "name",
  "customer",
  "quotedRevenue",
  ...optionalNumericFields,
];

function numericValue(value: string): number {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function buildJob(values: FormValues, id: string, createdAt: string): Job {
  return {
    id,
    name: values.name.trim(),
    customer: values.customer.trim(),
    status: "Active",
    currency: values.currency,
    quotedRevenue: numericValue(values.quotedRevenue),
    estimatedLabourHours: numericValue(values.estimatedLabourHours),
    labourCostPerHour: numericValue(values.labourCostPerHour),
    estimatedMaterials: numericValue(values.estimatedMaterials),
    estimatedSubcontractors: numericValue(values.estimatedSubcontractors),
    estimatedOther: numericValue(values.estimatedOther),
    createdAt,
  };
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = "Job name is required.";
  if (!values.customer.trim()) errors.customer = "Customer name is required.";

  const revenue = Number(values.quotedRevenue);
  if (values.quotedRevenue === "") {
    errors.quotedRevenue = "Quoted revenue is required.";
  } else if (!Number.isFinite(revenue) || revenue <= 0) {
    errors.quotedRevenue = "Quoted revenue must be greater than 0.";
  }

  for (const field of optionalNumericFields) {
    if (values[field] !== "" && (!Number.isFinite(Number(values[field])) || Number(values[field]) < 0)) {
      errors[field] = "Enter a valid value of 0 or more.";
    }
  }
  return errors;
}

interface FormFieldProps {
  id: FieldName;
  label: string;
  value: string;
  error?: string;
  type?: "text" | "number";
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  onChange: (field: FieldName, value: string) => void;
  onBlur: (field: FieldName) => void;
}

function FormField({ id, label, value, error, type = "text", prefix, suffix, placeholder, onChange, onBlur }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold text-slate-700">{label}</label>
      <div className="relative">
        {prefix ? <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-500">{prefix}</span> : null}
        <input
          id={id}
          name={id}
          type={type}
          min={type === "number" ? 0 : undefined}
          step={type === "number" ? "any" : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(id, event.target.value)}
          onBlur={() => onBlur(id)}
          className={`h-11 w-full rounded-lg border bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100 ${prefix ? "pl-8" : "pl-3.5"} ${suffix ? "pr-14" : "pr-3.5"} ${error ? "border-red-400" : "border-slate-300"}`}
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-slate-500">{suffix}</span> : null}
      </div>
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function NewJobForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  const errors = useMemo(() => validate(values), [values]);
  const isFormValid = Object.keys(errors).length === 0;
  const previewJob = useMemo(
    () => buildJob(values, "new-job-preview", new Date(0).toISOString()),
    [values],
  );
  const previewFinancials = useMemo(() => calculateJobFinancials(previewJob), [previewJob]);

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function touchField(field: FieldName) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid) {
      setTouched(Object.fromEntries(formFieldNames.map((key) => [key, true])) as Record<FieldName, boolean>);
      return;
    }

    const id = crypto.randomUUID();
    const job = buildJob(values, id, new Date().toISOString());
    saveJob(job);
    router.push(`/jobs/${encodeURIComponent(id)}`);
  }

  const fieldProps = (id: FieldName) => ({
    id,
    value: values[id],
    error: touched[id] ? errors[id] : undefined,
    onChange: updateField,
    onBlur: touchField,
  });

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <TopNavigation active="jobs" />
      <main className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-7 sm:px-10">
        <Link href="/dashboard#jobs" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700">
          <span aria-hidden="true">←</span> Back to Jobs
        </Link>

        <div className="mt-5">
          <h1 className="text-[30px] font-bold tracking-[-0.035em] text-slate-900">Create a new job</h1>
          <p className="mt-1.5 text-sm text-slate-600">Add the quote and estimated costs to see the margin you are planning for.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
          <div className="grid gap-5">
            <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-[16px] font-bold text-slate-900">Job information</h2>
                <p className="mt-1 text-xs text-slate-500">Basic details from the customer quote.</p>
              </div>
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <FormField {...fieldProps("name")} label="Job name" placeholder="e.g. Smith Patio" />
                <FormField {...fieldProps("customer")} label="Customer name" placeholder="e.g. John Smith" />
                <FormField {...fieldProps("quotedRevenue")} label="Quoted revenue" type="number" prefix={getCurrencySymbol(values.currency)} placeholder="0.00" />
                <div>
                  <label htmlFor="currency" className="mb-2 block text-[13px] font-semibold text-slate-700">Currency</label>
                  <select
                    id="currency"
                    name="currency"
                    value={values.currency}
                    onChange={(event) => setValues((current) => ({ ...current, currency: event.target.value as CurrencyCode }))}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                  >
                    {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-[16px] font-bold text-slate-900">Estimated costs</h2>
                <p className="mt-1 text-xs text-slate-500">Enter the assumptions used to price this job.</p>
              </div>
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <FormField {...fieldProps("estimatedLabourHours")} label="Estimated labour hours" type="number" suffix="hrs" placeholder="0" />
                <FormField {...fieldProps("labourCostPerHour")} label="Labour cost per hour" type="number" prefix={getCurrencySymbol(values.currency)} suffix="/ hr" placeholder="0.00" />
                <FormField {...fieldProps("estimatedMaterials")} label="Materials" type="number" prefix={getCurrencySymbol(values.currency)} placeholder="0.00" />
                <FormField {...fieldProps("estimatedSubcontractors")} label="Subcontractor cost" type="number" prefix={getCurrencySymbol(values.currency)} placeholder="0.00" />
                <FormField {...fieldProps("estimatedOther")} label="Other costs" type="number" prefix={getCurrencySymbol(values.currency)} placeholder="0.00" />
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</Link>
              <button type="submit" disabled={!isFormValid} className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none">Create Job</button>
            </div>
          </div>

          <aside className="grid gap-3 lg:sticky lg:top-5">
            <div className="mb-1">
              <h2 className="text-[16px] font-bold text-slate-900">Live estimate</h2>
              <p className="mt-1 text-xs text-slate-500">Updates as you enter the job.</p>
            </div>
            <SummaryCard label="Estimated Labour Cost" value={formatCurrency(previewFinancials.estimatedLabourCost, values.currency)} />
            <SummaryCard label="Estimated Total Cost" value={formatCurrency(previewFinancials.estimatedTotalCost, values.currency)} />
            <SummaryCard label="Expected Profit" value={formatCurrency(previewFinancials.expectedProfit, values.currency)} tone={previewFinancials.expectedProfit < 0 ? "danger" : "success"} />
            <SummaryCard label="Expected Margin" value={`${previewFinancials.expectedMargin.toFixed(1)}%`} tone={previewFinancials.expectedMargin < 0 ? "danger" : "default"} />
            {previewFinancials.expectedProfit < 0 ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium leading-5 text-red-700">This estimate is currently projected to lose money.</div>
            ) : null}
            <p className="rounded-lg bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">Values are shown in {values.currency} and will be saved on this device.</p>
          </aside>
        </form>
      </main>
    </div>
  );
}
