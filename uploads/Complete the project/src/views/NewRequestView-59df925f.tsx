import { useState } from "react";
import { CheckCircle2, ChevronRight, Send } from "lucide-react";

const STEPS = [
  { id: 1, label: "Title & Summary" },
  { id: 2, label: "Problem Statement" },
  { id: 3, label: "Capabilities" },
  { id: 4, label: "Timeline" },
  { id: 5, label: "Budget & Submit" },
];

const CAPABILITIES = [
  "User authentication / SSO", "Real-time notifications", "File storage & uploads",
  "Payment processing", "Email / SMS integration", "API / webhook integration",
  "Admin dashboard", "Analytics & reporting", "Mobile responsiveness", "Offline support",
];

const FIELD_CLS = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";

export default function NewRequestView() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: "", summary: "", problem: "",
    capabilities: [] as string[],
    timeline: "4-6 weeks", priority: "medium",
    budget: "", notes: "",
  });

  function toggleCap(cap: string) {
    setForm((f) => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter((c) => c !== cap)
        : [...f.capabilities, cap],
    }));
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-[20px] font-bold text-slate-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Request Submitted</h2>
        <p className="text-[13px] text-slate-500 max-w-sm mb-6">
          Your request has been received. Our team will review it and generate an estimate within 1–2 business days.
        </p>
        <button
          onClick={() => { setSubmitted(false); setStep(1); }}
          className="px-5 py-2.5 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
        >
          Submit Another Request
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>New Request</h1>
        <p className="text-[13px] text-slate-500 mt-1">Describe what you need built — we handle the rest.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                    s.id < step ? "bg-indigo-600 text-white"
                    : s.id === step ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                    : "bg-slate-200 text-slate-500"
                  }`}>
                    {s.id < step ? <CheckCircle2 size={14} /> : s.id}
                  </div>
                  <span className={`text-[10px] mt-1 whitespace-nowrap font-medium ${s.id === step ? "text-indigo-600" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${s.id < step ? "bg-indigo-500" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            {step === 1 && (
              <>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Request Title *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Mobile App Push Notifications" className={FIELD_CLS} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">One-line Summary *</label>
                  <input type="text" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="What's the core outcome you want?" className={FIELD_CLS} />
                </div>
              </>
            )}
            {step === 2 && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Problem Statement *</label>
                <p className="text-[12px] text-slate-400 mb-3">Describe the current pain point or opportunity. More context = better estimate.</p>
                <textarea rows={7} value={form.problem} onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))} placeholder="Currently our users have no way to receive alerts when... This causes... We need a solution that..." className={`${FIELD_CLS} resize-none`} />
              </div>
            )}
            {step === 3 && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-3">Required Capabilities — select all that apply</label>
                <div className="grid grid-cols-2 gap-2">
                  {CAPABILITIES.map((cap) => (
                    <button key={cap} onClick={() => toggleCap(cap)}
                      className={`text-left px-3 py-3 rounded-xl border text-[12px] font-medium transition-all ${
                        form.capabilities.includes(cap)
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >{cap}</button>
                  ))}
                </div>
                {form.capabilities.length > 0 && (
                  <p className="text-[12px] text-indigo-600 font-semibold mt-3">{form.capabilities.length} selected</p>
                )}
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-2">Expected Timeline</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["1-2 weeks", "2-4 weeks", "4-6 weeks", "6-12 weeks", "3-6 months", "Flexible"].map((t) => (
                      <button key={t} onClick={() => setForm((f) => ({ ...f, timeline: t }))}
                        className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium transition-all ${
                          form.timeline === t ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-2">Priority</label>
                  <div className="flex gap-2">
                    {["low", "medium", "high", "critical"].map((p) => (
                      <button key={p} onClick={() => setForm((f) => ({ ...f, priority: p }))}
                        className={`flex-1 py-2.5 rounded-xl border text-[12px] font-semibold capitalize transition-all ${
                          form.priority === p ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >{p}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Budget Range (USD)</label>
                  <input type="text" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} placeholder="e.g. $5,000 – $10,000 or leave blank for estimate" className={FIELD_CLS} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Additional Notes</label>
                  <textarea rows={4} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any other context, constraints, or references…" className={`${FIELD_CLS} resize-none`} />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Summary</p>
                  <p className="text-[14px] font-bold text-slate-900">{form.title || "—"}</p>
                  <p className="text-[12px] text-slate-500">Timeline: {form.timeline} · Priority: <span className="capitalize">{form.priority}</span></p>
                  <p className="text-[12px] text-slate-500">{form.capabilities.length} capabilities selected</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors font-medium">
              ← Back
            </button>
            {step < 5 ? (
              <button onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={step === 1 && !form.title}
                className="flex items-center gap-2 px-5 py-2.5 text-[13px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors font-medium"
              >
                Continue <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={() => setSubmitted(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
              >
                <Send size={14} /> Submit Request
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
