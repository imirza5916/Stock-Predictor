import { TrendingUp, TrendingDown, Minus, Calendar, Target, Shield } from "lucide-react";

const signalConfig = {
  BUY:  { icon: TrendingUp,   textColor: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", label: "BUY"  },
  SELL: { icon: TrendingDown, textColor: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     badge: "bg-red-100 text-red-700",         label: "SELL" },
  HOLD: { icon: Minus,        textColor: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   badge: "bg-amber-100 text-amber-700",     label: "HOLD" },
};

const confidenceColor = { HIGH: "text-emerald-600 bg-emerald-50", MEDIUM: "text-amber-600 bg-amber-50", LOW: "text-red-600 bg-red-50" };

export default function PredictionCard({ data }) {
  const cfg = signalConfig[data.signal] || signalConfig.HOLD;
  const Icon = cfg.icon;
  const pct = data.predicted_return_pct != null ? Number(data.predicted_return_pct).toFixed(2) : null;
  const isUp = Number(data.predicted_return_pct) > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`${cfg.bg} ${cfg.border} border-b px-6 py-5 flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl font-bold text-slate-800">{data.ticker}</span>
            {data.company_name && <span className="text-slate-500 font-medium">{data.company_name}</span>}
          </div>
          <p className="text-slate-500 text-sm flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Prediction for {data.prediction_date}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${cfg.badge} ${cfg.border} font-bold text-lg`}>
          <Icon className="w-5 h-5" />
          {cfg.label}
        </div>
      </div>

      {/* Main prices */}
      <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Current Price</p>
          <p className="text-2xl font-bold text-slate-800">${Number(data.current_price || data.last_close).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Predicted Close</p>
          <p className={`text-2xl font-bold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
            ${Number(data.predicted_next_close).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Expected Move</p>
          <p className={`text-2xl font-bold flex items-center gap-1 ${isUp ? "text-emerald-600" : "text-red-600"}`}>
            {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {isUp ? "+" : ""}{pct}%
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Confidence</p>
          <p className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${confidenceColor[data.confidence] || confidenceColor.MEDIUM}`}>
            {data.confidence || "MEDIUM"}
          </p>
        </div>
      </div>

      {/* Price targets & levels */}
      {(data.price_target_7d || data.support_level || data.resistance_level) && (
        <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.price_target_7d && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><Target className="w-3 h-3" /> 7-Day Target</p>
              <p className="text-slate-700 font-semibold mt-0.5">${Number(data.price_target_7d).toFixed(2)}</p>
            </div>
          )}
          {data.price_target_30d && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><Target className="w-3 h-3" /> 30-Day Target</p>
              <p className="text-slate-700 font-semibold mt-0.5">${Number(data.price_target_30d).toFixed(2)}</p>
            </div>
          )}
          {data.support_level && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><Shield className="w-3 h-3" /> Support</p>
              <p className="text-emerald-600 font-semibold mt-0.5">${Number(data.support_level).toFixed(2)}</p>
            </div>
          )}
          {data.resistance_level && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><Shield className="w-3 h-3" /> Resistance</p>
              <p className="text-red-500 font-semibold mt-0.5">${Number(data.resistance_level).toFixed(2)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}