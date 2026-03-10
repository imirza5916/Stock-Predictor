import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
  TrendingUp, TrendingDown, Minus, Plus, Trash2, RefreshCw,
  Briefcase, AlertCircle, ArrowLeft, BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SIGNAL_STYLE = {
  BUY:  { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp },
  SELL: { badge: "bg-red-50 text-red-700 border-red-200",             icon: TrendingDown },
  HOLD: { badge: "bg-amber-50 text-amber-700 border-amber-200",       icon: Minus },
};

async function fetchLiveData(ticker) {
  const stockRes = await base44.functions.invoke("stockData", { ticker });
  const { lastClose, companyName } = stockRes.data;
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Stock analyst: ticker "${ticker}" (${companyName}), current price $${lastClose}. Give predicted next close, return %, signal (BUY/SELL/HOLD), confidence.`,
    response_json_schema: {
      type: "object",
      properties: {
        predicted_next_close: { type: "number" },
        predicted_return_pct: { type: "number" },
        signal: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      },
      required: ["predicted_next_close", "predicted_return_pct", "signal", "confidence"]
    }
  });
  return { ...result, ticker: ticker.toUpperCase(), company_name: companyName, last_price: lastClose };
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingTicker, setRefreshingTicker] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ticker: "", quantity: "", avg_buy_price: "" });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Holding.list("-updated_date");
    setHoldings(data);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker || !form.quantity) return;
    if (holdings.find(h => h.ticker === ticker)) {
      setFormError(`${ticker} is already in your portfolio.`);
      return;
    }
    setAdding(true);
    setFormError(null);
    const live = await fetchLiveData(ticker);
    await base44.entities.Holding.create({
      ticker: live.ticker,
      company_name: live.company_name,
      quantity: parseFloat(form.quantity),
      avg_buy_price: form.avg_buy_price ? parseFloat(form.avg_buy_price) : live.last_price,
      last_price: live.last_price,
      predicted_next_close: live.predicted_next_close,
      predicted_return_pct: live.predicted_return_pct,
      signal: live.signal,
      confidence: live.confidence,
      last_refreshed: new Date().toISOString(),
    });
    setForm({ ticker: "", quantity: "", avg_buy_price: "" });
    setShowForm(false);
    setAdding(false);
    await load();
  }

  async function handleRefresh(holding) {
    setRefreshingTicker(holding.ticker);
    const live = await fetchLiveData(holding.ticker);
    await base44.entities.Holding.update(holding.id, {
      last_price: live.last_price,
      company_name: live.company_name,
      predicted_next_close: live.predicted_next_close,
      predicted_return_pct: live.predicted_return_pct,
      signal: live.signal,
      confidence: live.confidence,
      last_refreshed: new Date().toISOString(),
    });
    setRefreshingTicker(null);
    await load();
  }

  async function handleDelete(id) {
    await base44.entities.Holding.delete(id);
    setHoldings(prev => prev.filter(h => h.id !== id));
  }

  // Portfolio summary calculations
  const totalValue = holdings.reduce((sum, h) => sum + (h.last_price ?? 0) * h.quantity, 0);
  const totalCost  = holdings.reduce((sum, h) => sum + (h.avg_buy_price ?? h.last_price ?? 0) * h.quantity, 0);
  const totalPnL   = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const projectedValue = holdings.reduce((sum, h) => sum + (h.predicted_next_close ?? h.last_price ?? 0) * h.quantity, 0);
  const projectedGain = projectedValue - totalValue;

  const signalCounts = holdings.reduce((acc, h) => {
    if (h.signal) acc[h.signal] = (acc[h.signal] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/70 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-200">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">My Portfolio</h1>
              <p className="text-slate-400 text-sm">Track holdings vs. AI signals</p>
            </div>
            <a
              href={createPageUrl("Home")}
              className="ml-auto flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </a>
          </div>

          {/* Summary cards */}
          {holdings.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Portfolio Value" value={`$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <SummaryCard
                label="Total P&L"
                value={`${totalPnL >= 0 ? "+" : ""}$${Math.abs(totalPnL).toFixed(2)}`}
                sub={`${totalPnLPct >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%`}
                positive={totalPnL >= 0}
              />
              <SummaryCard
                label="AI Projected Gain"
                value={`${projectedGain >= 0 ? "+" : ""}$${Math.abs(projectedGain).toFixed(2)}`}
                sub="next close"
                positive={projectedGain >= 0}
              />
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-400 mb-2 font-medium">Signal Mix</p>
                <div className="flex gap-1.5 flex-wrap">
                  {["BUY","SELL","HOLD"].map(s => signalCounts[s] ? (
                    <span key={s} className={`text-xs font-bold border px-2 py-0.5 rounded-lg ${SIGNAL_STYLE[s].badge}`}>
                      {signalCounts[s]} {s}
                    </span>
                  ) : null)}
                  {!Object.keys(signalCounts).length && <span className="text-slate-300 text-xs">—</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Add holding button */}
        <div className="flex justify-end">
          <Button
            onClick={() => { setShowForm(v => !v); setFormError(null); }}
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">New Holding</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Ticker *</label>
                  <Input
                    value={form.ticker}
                    onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                    placeholder="e.g. AAPL"
                    className="font-mono h-9 text-sm"
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Quantity *</label>
                  <Input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="e.g. 10"
                    className="h-9 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Avg Buy Price ($)</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.avg_buy_price}
                    onChange={e => setForm(f => ({ ...f, avg_buy_price: e.target.value }))}
                    placeholder="Optional — uses current"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={adding} className="bg-indigo-600 hover:bg-indigo-700">
                  {adding ? "Fetching data..." : "Add & Analyze"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Holdings table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading portfolio...</span>
            </div>
          ) : holdings.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No holdings yet</p>
              <p className="text-sm mt-1">Add your first position to start tracking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Stock</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Avg Cost</th>
                    <th className="text-right px-4 py-3">Current</th>
                    <th className="text-right px-4 py-3">P&L</th>
                    <th className="text-right px-4 py-3">AI Prediction</th>
                    <th className="text-center px-4 py-3">Signal</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {holdings.map(h => {
                    const cost = (h.avg_buy_price ?? h.last_price ?? 0) * h.quantity;
                    const value = (h.last_price ?? 0) * h.quantity;
                    const pnl = value - cost;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                    const projected = (h.predicted_next_close ?? h.last_price ?? 0) * h.quantity;
                    const projGain = projected - value;
                    const S = SIGNAL_STYLE[h.signal] || SIGNAL_STYLE.HOLD;
                    const Icon = S.icon;
                    const isRefreshing = refreshingTicker === h.ticker;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <BarChart2 className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="font-mono font-bold text-slate-800">{h.ticker}</p>
                              {h.company_name && <p className="text-slate-400 text-xs truncate max-w-[120px]">{h.company_name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-4 py-4 font-mono font-medium text-slate-700">{h.quantity}</td>
                        <td className="text-right px-4 py-4 font-mono text-slate-500">
                          {h.avg_buy_price != null ? `$${Number(h.avg_buy_price).toFixed(2)}` : "—"}
                        </td>
                        <td className="text-right px-4 py-4 font-mono font-semibold text-slate-700">
                          {h.last_price != null ? `$${Number(h.last_price).toFixed(2)}` : "—"}
                        </td>
                        <td className="text-right px-4 py-4">
                          <p className={`font-mono font-semibold ${pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                          </p>
                          <p className={`text-xs font-medium ${pnlPct >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                          </p>
                        </td>
                        <td className="text-right px-4 py-4">
                          {h.predicted_next_close != null ? (
                            <>
                              <p className="font-mono font-semibold text-slate-700">${Number(h.predicted_next_close).toFixed(2)}</p>
                              <p className={`text-xs font-medium ${projGain >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                {projGain >= 0 ? "+" : ""}${Math.abs(projGain).toFixed(2)}
                              </p>
                            </>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="text-center px-4 py-4">
                          {h.signal ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold border px-2 py-1 rounded-lg ${S.badge}`}>
                              <Icon className="w-3 h-3" />
                              {h.signal}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleRefresh(h)}
                              disabled={!!refreshingTicker}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Refresh"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                            </button>
                            <button
                              onClick={() => handleDelete(h.id)}
                              disabled={!!refreshingTicker}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, positive }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className="text-xs text-slate-400 mb-1 font-medium">{label}</p>
      <p className={`font-bold text-lg font-mono ${positive === true ? "text-emerald-600" : positive === false ? "text-red-500" : "text-slate-800"}`}>
        {value}
      </p>
      {sub && <p className={`text-xs font-medium mt-0.5 ${positive === true ? "text-emerald-500" : positive === false ? "text-red-400" : "text-slate-400"}`}>{sub}</p>}
    </div>
  );
}