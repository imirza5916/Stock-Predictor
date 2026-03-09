import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Star, Clock, Bell, User, TrendingUp, RefreshCw } from "lucide-react";
import WatchlistSection from "../components/dashboard/WatchlistSection";
import SearchHistorySection from "../components/dashboard/SearchHistorySection";
import AlertPreferencesSection from "../components/dashboard/AlertPreferencesSection";

const TABS = [
  { key: "watchlist", label: "Watchlist", icon: Star },
  { key: "history", label: "Search History", icon: Clock },
  { key: "alerts", label: "Email Alerts", icon: Bell },
];

async function fetchPrediction(ticker) {
  const stockRes = await base44.functions.invoke("stockData", { ticker });
  const { lastClose, companyName } = stockRes.data;
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a professional stock market analyst. The stock ticker is "${ticker}" (${companyName}). The current price is $${lastClose}. Provide predicted next close, signal (BUY/SELL/HOLD), confidence, and a brief analysis.`,
    response_json_schema: {
      type: "object",
      properties: {
        predicted_next_close: { type: "number" },
        predicted_return_pct: { type: "number" },
        signal: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        analysis_summary: { type: "string" },
      },
      required: ["predicted_next_close", "predicted_return_pct", "signal"]
    }
  });
  return { ...result, ticker: ticker.toUpperCase(), company_name: companyName, current_price: lastClose };
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("watchlist");
  const [user, setUser] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [refreshingTicker, setRefreshingTicker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [me, wl, hist, al] = await Promise.all([
      base44.auth.me(),
      base44.entities.Watchlist.list("-updated_date"),
      base44.entities.Prediction.filter({ is_demo: false }, "-created_date", 20),
      base44.entities.AlertPreference.list("-created_date"),
    ]);
    setUser(me);
    setWatchlist(wl);
    setHistory(hist);
    setAlerts(al);
    setLoading(false);
  }

  async function handleRefreshWatchlistItem(item) {
    setRefreshingTicker(item.ticker);
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
    setRefreshingTicker(null);
    const wl = await base44.entities.Watchlist.list("-updated_date");
    setWatchlist(wl);
  }

  async function handleRemoveWatchlistItem(item) {
    await base44.entities.Watchlist.delete(item.id);
    setWatchlist(prev => prev.filter(i => i.id !== item.id));
  }

  function handleSelectTicker(ticker) {
    window.location.href = createPageUrl("Home") + `?ticker=${ticker}`;
  }

  const counts = { watchlist: watchlist.length, history: history.length, alerts: alerts.length };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/70 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">My Dashboard</h1>
              {user && <p className="text-slate-400 text-sm">{user.email}</p>}
            </div>
            <div className="ml-auto">
              <a
                href={createPageUrl("Home")}
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Back to StockSage
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-0 border-b border-slate-100" role="tablist">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
                {counts[key] > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === key ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                    {counts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-4" role="status">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-slate-400 font-medium">Loading your dashboard...</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6" role="tabpanel">
            {activeTab === "watchlist" && (
              <WatchlistSection
                items={watchlist}
                onRefresh={handleRefreshWatchlistItem}
                onRemove={handleRemoveWatchlistItem}
                onSelect={handleSelectTicker}
                refreshingTicker={refreshingTicker}
              />
            )}
            {activeTab === "history" && (
              <SearchHistorySection
                history={history}
                onSelect={handleSelectTicker}
              />
            )}
            {activeTab === "alerts" && (
              <AlertPreferencesSection
                alerts={alerts}
                userEmail={user?.email || ""}
                onRefresh={loadAll}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}