import { useMemo } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Area
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-white/20 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white/60 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value != null ? (typeof p.value === "number" ? p.value.toFixed(2) : p.value) : "—"}
        </p>
      ))}
    </div>
  );
};

export default function PriceChart({ chartData, prediction }) {
  const data = useMemo(() => {
    if (!chartData?.length) return [];
    const mapped = chartData.map((d) => ({
      date: d.date,
      close: d.close,
      ma5:   d.ma5   ?? null,
      ma10:  d.ma10  ?? null,
      ma20:  d.ma20  ?? null,
      volume: d.volume ?? null,
    }));
    if (prediction) {
      mapped.push({
        date: prediction.prediction_date,
        close: null,
        predicted: prediction.predicted_next_close,
        confLow:  prediction.confidence_lower,
        confHigh: prediction.confidence_upper,
        ma5: null, ma10: null, ma20: null, volume: null,
      });
    }
    return mapped;
  }, [chartData, prediction]);

  if (!data.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-white/60 text-sm uppercase tracking-widest font-medium">Price Chart</h3>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false}
              interval={Math.floor(data.length / 6)} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false}
              domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} width={65} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12, paddingTop: 12 }} />
            <Area type="monotone" dataKey="close" name="Close" stroke="#6366f1"
              fill="url(#closeGrad)" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="ma5"  name="MA5"  stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="ma10" name="MA10" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="ma20" name="MA20" stroke="#ec4899" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="predicted" name="Prediction" stroke="#00f5a0"
              dot={{ r: 7, fill: "#00f5a0", stroke: "#000", strokeWidth: 2 }} strokeWidth={0} connectNulls />
            {prediction?.confidence_lower && (
              <ReferenceLine y={prediction.confidence_lower} stroke="rgba(0,245,160,0.3)" strokeDasharray="6 3" label="" />
            )}
            {prediction?.confidence_upper && (
              <ReferenceLine y={prediction.confidence_upper} stroke="rgba(0,245,160,0.3)" strokeDasharray="6 3" label="" />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} width={65} tickFormatter={(v) => v > 1e6 ? `${(v/1e6).toFixed(0)}M` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="volume" name="Volume" fill="rgba(99,102,241,0.5)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}