import { useMemo } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Area
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm shadow-lg">
      <p className="text-slate-500 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono font-medium">
          {p.name}: {p.value != null ? (typeof p.value === "number" ? (p.name === "Volume" ? `${(p.value/1e6).toFixed(1)}M` : `$${p.value.toFixed(2)}`) : p.value) : "—"}
        </p>
      ))}
    </div>
  );
};

export default function PriceChart({ chartData, prediction }) {
  const data = useMemo(() => {
    if (!chartData?.length) return [];
    const mapped = chartData
      .filter((d) => d.date && d.close != null)
      .map((d) => ({
        date: d.date,
        close: parseFloat(d.close) || null,
        ma5: d.ma5 != null ? parseFloat(d.ma5) : null,
        ma20: d.ma20 != null ? parseFloat(d.ma20) : null,
        volume: d.volume != null ? parseInt(d.volume) : null,
      }));
    if (prediction) {
      mapped.push({
        date: prediction.prediction_date,
        close: null,
        predicted: prediction.predicted_next_close,
        confLow: prediction.confidence_lower,
        confHigh: prediction.confidence_upper,
        ma5: null, ma20: null, volume: null,
      });
    }
    return mapped;
  }, [chartData, prediction]);

  if (!data.length) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-3">
      <h3 className="font-semibold text-slate-800">Price History</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false}
            interval={Math.floor(data.length / 6)} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false}
            domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} width={65} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: "#64748b", fontSize: 12, paddingTop: 12 }} />
          <Area type="monotone" dataKey="close" name="Close" stroke="#6366f1"
            fill="url(#closeGrad)" strokeWidth={2} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="ma5" name="MA5" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="ma20" name="MA20" stroke="#ec4899" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="predicted" name="Prediction" stroke="#6366f1"
            dot={{ r: 7, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }} strokeWidth={0} connectNulls />
          {prediction?.confidence_lower && (
            <ReferenceLine y={prediction.confidence_lower} stroke="#6366f155" strokeDasharray="6 3" />
          )}
          {prediction?.confidence_upper && (
            <ReferenceLine y={prediction.confidence_upper} stroke="#6366f155" strokeDasharray="6 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={70}>
        <ComposedChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={65} tickFormatter={(v) => v > 1e6 ? `${(v/1e6).toFixed(0)}M` : v} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="volume" name="Volume" fill="#e0e7ff" radius={[2,2,0,0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}