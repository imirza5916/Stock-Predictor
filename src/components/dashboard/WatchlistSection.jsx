import { Star, TrendingUp, TrendingDown, Minus, RefreshCw, Trash2 } from "lucide-react";

const signalStyle = {
  BUY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SELL: "bg-red-50 text-red-700 border-red-200",
  HOLD: "bg-amber-50 text-amber-700 border-amber-200",
};
const SignalIcon = { BUY: TrendingUp, SELL: TrendingDown, HOLD: Minus };

export default function WatchlistSection({ items, onRefresh, onRemove, onSelect, refreshingTicker }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Star className="w-10 h-10 mx-auto mb-3 opacity-25" />
        <p className="font-medium">No stocks in your watchlist yet</p>
        <p className="text-sm mt-1">Search for a stock and add it to your watchlist</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => {
        const Icon = SignalIcon[item.signal] || Minus;
        const pct = item.predicted_return_pct;
        const isLoading = refreshingTicker === item.ticker;
        return (
          <div key={item.id} className="flex items-center gap-4 py-3 group hover:bg-slate-50 px-2 rounded-xl transition-colors">
            <button className="flex-1 text-left min-w-0" onClick={() => onSelect(item.ticker)}>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800">{item.ticker}</span>
                {item.company_name && <span className="text-slate-400 text-sm truncate">{item.company_name}</span>}
              </div>
              {item.last_refreshed && (
                <p className="text-slate-300 text-xs mt-0.5">Updated {new Date(item.last_refreshed).toLocaleString()}</p>
              )}
            </button>

            {item.last_price != null && (
              <div className="text-right hidden sm:block">
                <p className="font-mono text-sm font-semibold text-slate-700">${Number(item.last_price).toFixed(2)}</p>
                <p className="text-xs text-slate-400">current</p>
              </div>
            )}

            {item.predicted_next_close != null && (
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-slate-700">${Number(item.predicted_next_close).toFixed(2)}</p>
                <p className={`text-xs font-medium ${pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {pct >= 0 ? "+" : ""}{Number(pct).toFixed(2)}%
                </p>
              </div>
            )}

            {item.signal && (
              <span className={`text-xs font-bold border px-2 py-1 rounded-lg ${signalStyle[item.signal] || signalStyle.HOLD}`}>
                <Icon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                {item.signal}
              </span>
            )}

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onRefresh(item)}
                disabled={isLoading}
                className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => onRemove(item)}
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
  );
}