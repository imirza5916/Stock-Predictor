import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Star, Plus, RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const signalStyle = {
  BUY:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  SELL: "bg-red-50 text-red-700 border-red-200",
  HOLD: "bg-amber-50 text-amber-700 border-amber-200",
};
const SignalIcon = { BUY: TrendingUp, SELL: TrendingDown, HOLD: Minus };

export default function Watchlist({ onSelect, fetchPrediction }) {
  const [items, setItems] = useState([]);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingTicker, setRefreshingTicker] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await base44.entities.Watchlist.list("-updated_date");
    setItems(data);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    if (items.find(i => i.ticker === ticker)) { setNewTicker(""); return; }
    setAdding(true);
    setError(null);
    try {
      const result = await fetchPrediction(ticker);
      await base44.entities.Watchlist.create({
        ticker: result.ticker,
        company_name: result.company_name,
        last_price: result.current_price,
        predicted_next_close: result.predicted_next_close,
        predicted_return_pct: result.predicted_return_pct,
        signal: result.signal,
        confidence: result.confidence,
        last_refreshed: new Date().toISOString(),
      });
      setNewTicker("");
      await load();
    } catch (err) {
      setError("Could not fetch data for " + ticker);
    }
    setAdding(false);
  }

  async function handleRemove(item) {
    await base44.entities.Watchlist.delete(item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  async function refreshOne(item) {
    setRefreshingTicker(item.ticker);
    try {
      const result = await fetchPrediction(item.ticker);
      await base44.entities.Watchlist.update(item.id, {
        last_price: result.current_price,
        predicted_next_close: result.predicted_next_close,
        predicted_return_pct: result.predicted_return_pct,
        signal: result.signal,
        confidence: result.confidence,
        company_name: result.company_name,
        last_refreshed: new Date().toISOString(),
      });
      await load();
    } catch (_) {}
    setRefreshingTicker(null);
  }

  async function handleRefreshAll() {
    setRefreshing(true);
    setError(null);
    for (const item of items) {
      setRefreshingTicker(item.ticker);
      try {
        const result = await fetchPrediction(item.ticker);
        await base44.entities.Watchlist.update(item.id, {
          last_price: result.current_price,
          predicted_next_close: result.predicted_next_close,
          predicted_return_pct: result.predicted_return_pct,
          signal: result.signal,
          confidence: result.confidence,
          company_name: result.company_name,
          last_refreshed: new Date().toISOString(),
        });
      } catch (_) {}
    }
    setRefreshingTicker(null);
    setRefreshing(false);
    await load();
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Star className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="font-semibold text-slate-800">Watchlist</h2>
          {items.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{items.length}</span>
          )}
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing || adding}
            onClick={handleRefreshAll}
            className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? `Refreshing ${refreshingTicker}...` : "Refresh All"}
          </Button>
        )}
      </div>

      {/* Add ticker form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <Input
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          placeholder="Add ticker"
          className="font-mono text-sm h-9"
          disabled={adding || refreshing}
          maxLength={10}
        />
        <Button type="submit" size="sm" disabled={adding || refreshing || !newTicker.trim()} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 h-9 px-3">
          <Plus className="w-3.5 h-3.5" />
          {adding ? "Adding..." : "Add"}
        </Button>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm mb-3 bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !adding && (
        <div className="text-center py-8 text-slate-400">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Add tickers to track them here</p>
        </div>
      )}

      {/* Watchlist rows */}
      <div className="space-y-2">
        {items.map(item => {
          const Icon = SignalIcon[item.signal] || Minus;
          const isLoading = refreshingTicker === item.ticker;
          const pct = item.predicted_return_pct;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group"
            >
              {/* Ticker + company */}
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => onSelect(item.ticker)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800 text-sm">{item.ticker}</span>
                  {item.company_name && (
                    <span className="text-slate-400 text-xs truncate hidden sm:block">{item.company_name}</span>
                  )}
                </div>
                {item.last_refreshed && (
                  <p className="text-slate-300 text-xs mt-0.5">
                    Updated {new Date(item.last_refreshed).toLocaleString()}
                  </p>
                )}
              </button>

              {/* Price */}
              {item.last_price != null && (
                <div className="text-right hidden sm:block">
                  <p className="font-mono text-sm font-semibold text-slate-700">${Number(item.last_price).toFixed(2)}</p>
                  <p className="text-xs text-slate-400">current</p>
                </div>
              )}

              {/* Predicted + pct */}
              {item.predicted_next_close != null && (
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-slate-700">${Number(item.predicted_next_close).toFixed(2)}</p>
                  <p className={`text-xs font-medium ${pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {pct >= 0 ? "+" : ""}{Number(pct).toFixed(2)}%
                  </p>
                </div>
              )}

              {/* Signal badge */}
              {item.signal && (
                <span className={`text-xs font-bold border px-2 py-1 rounded-lg ${signalStyle[item.signal] || signalStyle.HOLD}`}>
                  <Icon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                  {item.signal}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => refreshOne(item)}
                  disabled={isLoading || refreshing}
                  className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => handleRemove(item)}
                  disabled={refreshing}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}