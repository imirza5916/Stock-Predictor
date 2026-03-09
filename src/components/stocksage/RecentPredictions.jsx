import { TrendingUp, TrendingDown, Minus, Clock, X } from "lucide-react";

const signalIcon = { BUY: TrendingUp, SELL: TrendingDown, HOLD: Minus };
const signalStyle = {
  BUY:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  SELL: "border-red-200 bg-red-50 text-red-700",
  HOLD: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function RecentPredictions({ history, onSelect, onRemove }) {
  if (!history.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1 font-medium">
        <Clock className="w-3 h-3" /> Recent
      </p>
      <div className="flex flex-wrap gap-2">
        {history.map((p) => {
          const Icon = signalIcon[p.signal] || Minus;
          return (
            <div
              key={p.ticker + p.prediction_date}
              className={`flex items-center gap-1 rounded-xl border text-sm font-medium ${signalStyle[p.signal] || signalStyle.HOLD}`}
            >
              <button
                onClick={() => onSelect(p.ticker)}
                className="flex items-center gap-2 px-3 py-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="font-mono font-bold">{p.ticker}</span>
                <Icon className="w-3.5 h-3.5" />
                <span className="opacity-70">${Number(p.predicted_next_close).toFixed(2)}</span>
              </button>
              <button
                onClick={() => onRemove(p.ticker)}
                className="pr-2 py-1.5 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}