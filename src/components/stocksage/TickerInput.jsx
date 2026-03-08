import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

const POPULAR = ["AAPL", "TSLA", "MSFT", "GOOGL", "NVDA", "AMZN", "META", "IREN"];

export default function TickerInput({ onPredict, loading }) {
  const [ticker, setTicker] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (ticker.trim()) onPredict(ticker.trim().toUpperCase());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter ticker (e.g. AAPL)"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-lg h-12 font-mono tracking-widest"
          maxLength={10}
        />
        <Button
          type="submit"
          disabled={loading || !ticker.trim()}
          className="h-12 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          {loading ? "Predicting..." : "Predict"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {POPULAR.map((t) => (
          <button
            key={t}
            onClick={() => { setTicker(t); onPredict(t); }}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm font-mono transition-all"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}