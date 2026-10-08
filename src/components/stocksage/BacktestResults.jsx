import { Target, Trophy } from "lucide-react";

const ML = new Set(["Ridge", "Lasso", "k-NN", "Ensemble"]);

export default function BacktestResults({ backtest, ticker }) {
  if (!backtest) return null;
  const {
    n_signals, models = [], always_up_hit_rate, persistence_hit_rate, cost_bps,
  } = backtest;

  const baselineRows = [
    { name: "Always-Up", hit: always_up_hit_rate },
    { name: "Persistence", hit: persistence_hit_rate },
  ];

  const allHits = [...models.map((m) => m.hit_rate), always_up_hit_rate, persistence_hit_rate].filter((v) => v != null);
  const bestHit = Math.max(...allHits);
  const fmt = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const fmtRet = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
  const buyHold = models.find((m) => m.name === "Buy & Hold")?.return_pct;

  const Row = ({ r, highlight }) => (
    <tr className={`border-b border-slate-50 ${highlight ? "bg-indigo-50/40" : ""}`}>
      <td className="py-2.5 font-medium text-slate-700 flex items-center gap-2">
        {highlight && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
        {r.name}
      </td>
      <td className="py-2.5 text-right font-mono">
        <span className={r.hit != null && r.hit === bestHit && highlight ? "text-emerald-600 font-bold" : "text-slate-600"}>
          {fmt(r.hit)}
        </span>
      </td>
      <td className={`py-2.5 text-right font-mono ${r.ret != null && buyHold != null && r.ret > buyHold && highlight ? "text-emerald-600 font-semibold" : "text-slate-600"}`}>
        {fmtRet(r.ret)}
      </td>
      <td className="py-2.5 text-right font-mono text-slate-400">{r.trades ?? "—"}</td>
    </tr>
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <Target className="w-5 h-5 text-indigo-500" />
        <h3 className="font-semibold text-slate-800">Walk-Forward Backtest</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {n_signals} signals · {ticker} · long/flat · {cost_bps ?? 5} bps/trade · rolling 1y window · 5y test span
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left font-medium py-2">Strategy</th>
              <th className="text-right font-medium py-2">Hit Rate</th>
              <th className="text-right font-medium py-2">Return</th>
              <th className="text-right font-medium py-2">Trades</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => <Row key={m.name} r={{ ...m, ret: m.return_pct }} highlight={ML.has(m.name)} />)}
            <tr><td colSpan={4} className="pt-3 pb-1 text-xs text-slate-300 font-medium">Direction baselines</td></tr>
            {baselineRows.map((r) => <Row key={r.name} r={r} />)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Models refit each day on a rolling 1y window; alpha chosen by nested validation. Ensemble = average of Ridge, Lasso &amp; k-NN. Returns are net of {cost_bps ?? 5} bps per position change.
      </p>
    </div>
  );
}