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
    <div className="space-y-4" role="search" aria-label="Stock ticker search">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter stock ticker"
            aria-label="Stock ticker symbol"
            className="w-full pl-12 pr-4 h-14 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 text-lg font-mono font-semibold tracking-widest focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !ticker.trim()}
          aria-label={loading ? "Analyzing stock" : "Analyze stock"}
          className="h-14 px-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-semibold flex items-center gap-2 transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 disabled:shadow-none active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Search className="w-5 h-5" aria-hidden="true" />}
          <span>{loading ? "Analyzing..." : "Analyze"}</span>
        </button>
      </form>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Popular stocks">
        <span className="text-xs text-slate-400 self-center mr-1 font-medium">Popular:</span>
        {POPULAR.map((t) => (
          <button
            key={t}
            onClick={() => { setTicker(t); onPredict(t); }}
            disabled={loading}
            aria-label={`Analyze ${t}`}
            className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-500 hover:text-indigo-700 text-xs font-mono font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-40"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}