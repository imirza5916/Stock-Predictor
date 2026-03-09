import { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import TickerInput from "../components/stocksage/TickerInput";
import PredictionCard from "../components/stocksage/PredictionCard";
import PriceChart from "../components/stocksage/PriceChart";
import AIAnalysis from "../components/stocksage/AIAnalysis";
import RecentPredictions from "../components/stocksage/RecentPredictions";
import { AlertCircle, TrendingUp, BarChart2, Brain, Sparkles } from "lucide-react";

const RANGES = [
  { label: "1W", key: "1week",   points: 7  },
  { label: "1M", key: "1month",  points: 30 },
  { label: "3M", key: "3months", points: 90 },
];

async function fetchPrediction(ticker) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const predDate = tomorrow.toISOString().split("T")[0];

  // Step 1: Fetch real price data from Yahoo Finance
  const stockRes = await base44.functions.invoke("stockData", { ticker });
  const { chartData, lastClose, companyName } = stockRes.data;

  // Step 2: Ask LLM for analysis only (no chart data needed from LLM)
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a professional stock market analyst. The stock ticker is "${ticker}" (${companyName}) listed on NASDAQ or NYSE.
The current/last close price is $${lastClose}.

Based on this real price and your knowledge of this stock, provide:
- A predicted next-day closing price (must be realistic relative to the current price of $${lastClose})
- A trading signal (BUY, SELL, or HOLD)
- Confidence level
- 7-day and 30-day price targets
- Support and resistance levels
- A brief analysis summary
- Key factors influencing the prediction

All prices MUST be realistic and proportional to the current price of $${lastClose}.`,

    response_json_schema: {
      type: "object",
      properties: {
        predicted_next_close: { type: "number" },
        predicted_return_pct: { type: "number" },
        signal: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        price_target_7d: { type: "number" },
        price_target_30d: { type: "number" },
        support_level: { type: "number" },
        resistance_level: { type: "number" },
        analysis_summary: { type: "string" },
        key_factors: { type: "array", items: { type: "string" } },
      },
      required: ["predicted_next_close", "predicted_return_pct", "signal", "analysis_summary"]
    }
  });

  return {
    ...result,
    ticker: ticker.toUpperCase(),
    company_name: companyName,
    current_price: lastClose,
    last_close: lastClose,
    prediction_date: predDate,
    chart_data: chartData,
  };
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentTicker, setCurrentTicker] = useState(null);
  const [range, setRange] = useState(RANGES[2]);
  const handleRemove = useCallback((ticker) => {
    setHistory((prev) => prev.filter((p) => p.ticker !== ticker));
  }, []);

  const handlePredict = useCallback(async (ticker) => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setChartData([]);
    setCurrentTicker(ticker);
    const result = await fetchPrediction(ticker);
    setPrediction(result);
    setChartData(result.chart_data || []);
    setHistory((prev) => [result, ...prev.filter((p) => p.ticker !== ticker)].slice(0, 8));
    try { await base44.entities.Prediction.create({ ...result, is_demo: false }); } catch (_) {}
    setLoading(false);
  }, [range]);

  const handleRangeChange = useCallback((newRange) => {
    setRange(newRange);
  }, []);

  const features = [
    { icon: Brain, title: "AI-Powered", desc: "Real-time analysis using live market data, news & sentiment", bg: "bg-indigo-50", text: "text-indigo-600" },
    { icon: BarChart2, title: "Technical Analysis", desc: "Moving averages, support/resistance levels, and price targets", bg: "bg-violet-50", text: "text-violet-600" },
    { icon: TrendingUp, title: "Price Predictions", desc: "Next-day close, 7-day and 30-day price targets with confidence", bg: "bg-blue-50", text: "text-blue-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-2xl bg-indigo-600">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">StockSage</h1>
              <p className="text-slate-400 text-sm flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI-powered stock predictions
              </p>
            </div>
          </div>
          <TickerInput onPredict={handlePredict} loading={loading} />
          {history.length > 0 && (
            <div className="mt-4">
              <RecentPredictions history={history} onSelect={handlePredict} onRemove={handleRemove} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {loading && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700 text-lg">Analyzing market data...</p>
              <p className="text-slate-400 text-sm mt-1">AI is researching news, technicals & sentiment</p>
            </div>
            <div className="flex gap-1">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: `${i*0.1}s`}} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {prediction && !loading && (
          <>
            <PredictionCard data={prediction} />
            <AIAnalysis data={prediction} />
            {chartData.length > 0 && <PriceChart chartData={chartData} prediction={prediction} range={range} ranges={RANGES} onRangeChange={handleRangeChange} loading={loading} />}
          </>
        )}

        {!prediction && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc, bg, text }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}