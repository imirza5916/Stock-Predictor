import { useState, useCallback } from "react";
import { generateDemoData } from "../components/stocksage/DemoEngine";
import TickerInput from "../components/stocksage/TickerInput";
import PredictionCard from "../components/stocksage/PredictionCard";
import ModelStats from "../components/stocksage/ModelStats";
import PriceChart from "../components/stocksage/PriceChart";
import DownloadPanel from "../components/stocksage/DownloadPanel";
import BackendDocs from "../components/stocksage/BackendDocs";
import RecentPredictions from "../components/stocksage/RecentPredictions";
import { base44 } from "@/api/base44Client";
import { AlertCircle, Activity, Server } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || localStorage.getItem("stocksage_api_base") || "";

async function callBackend(ticker) {
  const [predRes, chartRes] = await Promise.all([
    fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    }),
    fetch(`${API_BASE}/chart-data?ticker=${ticker}`),
  ]);
  if (!predRes.ok) {
    const err = await predRes.json().catch(() => ({}));
    throw new Error(err.detail || "Prediction failed");
  }
  const prediction = await predRes.json();
  const chartJson  = await chartRes.json();
  return { prediction, chartData: chartJson.data || [] };
}

export default function Home() {
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [chartData, setChartData]  = useState([]);
  const [history, setHistory]      = useState([]);
  const [backendOnline, setBackendOnline] = useState(null);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem("stocksage_api_base") || "");
  const [apiUrlInput, setApiUrlInput] = useState(localStorage.getItem("stocksage_api_base") || "");

  const handlePredict = useCallback(async (ticker) => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setChartData([]);

    try {
      let result;
      if (API_BASE) {
        // Try real backend
        try {
          result = await callBackend(ticker);
          setBackendOnline(true);
        } catch (backendErr) {
          console.warn("Backend unavailable, using demo mode:", backendErr.message);
          setBackendOnline(false);
          result = generateDemoData(ticker);
        }
      } else {
        // No backend configured — use demo
        setBackendOnline(false);
        result = generateDemoData(ticker);
      }

      setPrediction(result.prediction);
      setChartData(result.chartData);

      // Save to history (local + entity)
      setHistory((prev) => {
        const deduped = [result.prediction, ...prev.filter((p) => p.ticker !== ticker)].slice(0, 8);
        return deduped;
      });
      try {
        await base44.entities.Prediction.create(result.prediction);
      } catch (_) { /* non-critical */ }

    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-[#0d1330] to-[#0a0e1a] border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Stock<span className="text-emerald-400">Sage</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs font-mono">ML v1.0</span>
          </div>
          <p className="text-white/40 text-sm mb-6">
            Ridge regression · TimeSeriesSplit CV · Log-return modeling
          </p>

          <TickerInput onPredict={handlePredict} loading={loading} />

          {/* Status bar */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              backendOnline === null ? "border-white/10 text-white/30" :
              backendOnline ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" :
              "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
            }`}>
              <Server className="w-3 h-3" />
              {backendOnline === null ? "Backend: not tested" :
               backendOnline ? "Backend: connected" : "Demo mode (no backend)"}
            </div>
            {!API_BASE && (
              <p className="text-white/30 text-xs">
                Set <code className="text-white/50">VITE_API_BASE</code> to connect your Python backend
              </p>
            )}
          </div>

          <div className="mt-4">
            <RecentPredictions history={history} onSelect={handlePredict} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {prediction && (
          <>
            <PredictionCard data={prediction} />
            <ModelStats data={prediction} />
          </>
        )}

        {chartData.length > 0 && (
          <PriceChart chartData={chartData} prediction={prediction} />
        )}

        {prediction && chartData.length > 0 && (
          <DownloadPanel chartData={chartData} prediction={prediction} />
        )}

        {/* Backend code section */}
        <div className="border-t border-white/5 pt-8">
          <BackendDocs />
        </div>
      </div>
    </div>
  );
}