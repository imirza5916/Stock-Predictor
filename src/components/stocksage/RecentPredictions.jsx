import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

const signalIcon = { BUY: TrendingUp, SELL: TrendingDown, HOLD: Minus };
const signalStyle = {
  BUY:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  SELL: "border-red-200 bg-red-50 text-red-700",
  HOLD: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function RecentPredictions({ history, onSelect }) {
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
            <button
              key={p.ticker + p.prediction_date}
              onClick={() => onSelect(p.ticker)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all hover:shadow-sm ${signalStyle[p.signal] || signalStyle.HOLD}`}
            >
              <span className="font-mono font-bold">{p.ticker}</span>
              <Icon className="w-3.5 h-3.5" />
              <span className="opacity-70">${Number(p.predicted_next_close).toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}