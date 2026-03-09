import { Brain, CheckCircle2 } from "lucide-react";

export default function AIAnalysis({ data }) {
  if (!data.analysis_summary && !data.key_factors?.length) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-indigo-50">
          <Brain className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="font-semibold text-slate-800">AI Analysis</h3>
      </div>

      {data.analysis_summary && (
        <p className="text-slate-600 leading-relaxed">{data.analysis_summary}</p>
      )}

      {data.key_factors?.length > 0 && (
        <div className="space-y-2">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">Key Factors</p>
          <div className="space-y-2">
            {data.key_factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 text-sm">{f}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}