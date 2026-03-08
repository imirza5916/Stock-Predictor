import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";

const signalConfig = {
  BUY:  { icon: TrendingUp,   color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/40", label: "BUY"  },
  SELL: { icon: TrendingDown, color: "text-red-400",     bg: "bg-red-500/20 border-red-500/40",         label: "SELL" },
  HOLD: { icon: Minus,        color: "text-yellow-400",  bg: "bg-yellow-500/20 border-yellow-500/40",   label: "HOLD" },
};

export default function PredictionCard({ data }) {
  const cfg = signalConfig[data.signal] || signalConfig.HOLD;
  const Icon = cfg.icon;
  const pct = data.predicted_return != null ? (data.predicted_return * 100).toFixed(2) : null;
  const isUp = data.predicted_return > 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm uppercase tracking-widest">Predicted Close</p>
          <p className="text-4xl font-bold text-white mt-1">
            ${Number(data.predicted_next_close).toFixed(2)}
          </p>
          <p className="text-white/50 text-sm mt-1">
            Last close: <span className="text-white/80">${Number(data.last_close).toFixed(2)}</span>
          </p>
        </div>
        <div className={`flex flex-col items-center justify-center rounded-xl border px-5 py-3 ${cfg.bg}`}>
          <Icon className={`w-8 h-8 ${cfg.color}`} />
          <span className={`text-lg font-bold mt-1 ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {pct !== null && (
        <div className={`flex items-center gap-2 text-lg font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          Expected move: {isUp ? "+" : ""}{pct}%
        </div>
      )}

      {data.confidence_lower != null && (
        <div className="flex gap-4 text-sm text-white/60">
          <span>Confidence band:</span>
          <span className="text-white/80">${Number(data.confidence_lower).toFixed(2)} – ${Number(data.confidence_upper).toFixed(2)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-white/40">
        <AlertCircle className="w-4 h-4" />
        Prediction for {data.prediction_date}
        {data.is_demo && <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">DEMO MODE</span>}
      </div>
    </div>
  );
}