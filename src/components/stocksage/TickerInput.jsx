import { useState } from "react";
import { Search, Loader2, TrendingUp } from "lucide-react";

const POPULAR = ["AAPL", "TSLA", "MSFT", "GOOGL", "NVDA", "AMZN", "META", "NFLX"];

export default function TickerInput({ onPredict, loading }) {
  const [ticker, setTicker] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (ticker.trim()) onPredict(ticker.trim().toUpperCase());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter stock ticker (e.g. AAPL, TSLA...)"
            className="w-full pl-12 pr-4 h-14 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 text-lg font-medium tracking-widest focus:outline-none focus:border-indigo-400 transition-colors shadow-sm"
            maxLength={10}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !ticker.trim()}
          className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold flex items-center gap-2 transition-all shadow-sm disabled:shadow-none"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {POPULAR.map((t) => (
          <button
            key={t}
            onClick={() => { setTicker(t); onPredict(t); }}
            disabled={loading}
            className="px-4 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 text-sm font-mono font-medium transition-all shadow-sm"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}