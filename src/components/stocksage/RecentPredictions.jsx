import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

const signalIcon = { BUY: TrendingUp, SELL: TrendingDown, HOLD: Minus };
const signalColor = { BUY: "text-emerald-400", SELL: "text-red-400", HOLD: "text-yellow-400" };

export default function RecentPredictions({ history, onSelect }) {
  if (!history.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-white/40 text-xs uppercase tracking-widest flex items-center gap-1">
        <Clock className="w-3 h-3" /> Recent
      </p>
      <div className="flex flex-wrap gap-2">
        {history.map((p) => {
          const Icon = signalIcon[p.signal] || Minus;
          return (
            <button
              key={p.ticker + p.prediction_date}
              onClick={() => onSelect(p.ticker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <span className="text-white/80 text-sm font-mono font-bold">{p.ticker}</span>
              <Icon className={`w-3.5 h-3.5 ${signalColor[p.signal]}`} />
              <span className="text-white/40 text-xs">${Number(p.predicted_next_close).toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}