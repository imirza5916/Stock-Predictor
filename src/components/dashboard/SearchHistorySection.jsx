import { Clock, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";

const signalStyle = {
  BUY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SELL: "bg-red-50 text-red-700 border-red-200",
  HOLD: "bg-amber-50 text-amber-700 border-amber-200",
};
const SignalIcon = { BUY: TrendingUp, SELL: TrendingDown, HOLD: Minus };

export default function SearchHistorySection({ history, onSelect }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-25" />
        <p className="font-medium">No search history yet</p>
        <p className="text-sm mt-1">Your past stock analyses will appear here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {history.map((item) => {
        const Icon = SignalIcon[item.signal] || Minus;
        const ret = item.predicted_return ?? item.predicted_return_pct;
        return (
          <div key={item.id} className="flex items-center gap-4 py-3 hover:bg-slate-50 px-2 rounded-xl transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="font-mono font-bold text-slate-600 text-xs">{item.ticker?.slice(0, 3)}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800">{item.ticker}</span>
                {item.signal && (
                  <span className={`text-xs font-bold border px-1.5 py-0.5 rounded-md ${signalStyle[item.signal]}`}>
                    <Icon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                    {item.signal}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                {item.prediction_date ? new Date(item.prediction_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
              </p>
            </div>

            <div className="text-right hidden sm:block">
              {item.last_close != null && (
                <>
                  <p className="font-mono text-sm font-semibold text-slate-700">${Number(item.last_close).toFixed(2)}</p>
                  <p className="text-xs text-slate-400">at search</p>
                </>
              )}
            </div>

            {ret != null && (
              <div className={`text-right text-sm font-bold font-mono ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {ret >= 0 ? "+" : ""}{Number(ret).toFixed(2)}%
              </div>
            )}

            <button
              onClick={() => onSelect(item.ticker)}
              className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
              title="Re-analyze"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}