import { useMemo } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, Scatter, ZAxis
} from "recharts";

const SIGNAL_COLOR = { BUY: "#10b981", SELL: "#ef4444", HOLD: "#f59e0b" };
const SIGNAL_LABEL = { BUY: "▲", SELL: "▼", HOLD: "●" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const pastPoint = payload.find(p => p.name === "_past");
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm shadow-lg min-w-[160px]">
      <p className="text-slate-500 mb-2 font-medium">{label}</p>
      {payload.filter(p => p.name !== "_past" && p.value != null).map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono font-medium">
          {p.name}: {typeof p.value === "number"
            ? (p.name === "Volume" ? `${(p.value / 1e6).toFixed(1)}M` : `$${p.value.toFixed(2)}`)
            : p.value}
        </p>
      ))}
      {pastPoint?.payload?.pastSignal && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <p className="font-semibold" style={{ color: SIGNAL_COLOR[pastPoint.payload.pastSignal] }}>
            {SIGNAL_LABEL[pastPoint.payload.pastSignal]} AI Signal: {pastPoint.payload.pastSignal}
          </p>
          {pastPoint.payload.pastPredicted != null && (
            <p className="text-slate-500 text-xs font-mono">Predicted: ${Number(pastPoint.payload.pastPredicted).toFixed(2)}</p>
          )}
          {pastPoint.payload.pastConfidence && (
            <p className="text-slate-400 text-xs">Confidence: {pastPoint.payload.pastConfidence}</p>
          )}
        </div>
      )}
    </div>
  );
};

// Custom dot for past prediction signals
const SignalDot = (props) => {
  const { cx, cy, payload } = props;
  if (!payload?.pastSignal || payload?.pastPredicted == null) return null;
  const color = SIGNAL_COLOR[payload.pastSignal] || "#6366f1";
  const label = SIGNAL_LABEL[payload.pastSignal] || "●";
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={color} fontWeight="bold">{label}</text>
    </g>
  );
};

// Custom dot for the current AI prediction
const PredictDot = (props) => {
  const { cx, cy, payload, signal } = props;
  if (payload?.predicted == null) return null;
  const color = SIGNAL_COLOR[signal] || "#6366f1";
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={4} fill={color} />
    </g>
  );
};

export default function PriceChart({ chartData, prediction, pastPredictions = [], range, ranges, onRangeChange, loading }) {
  const data = useMemo(() => {
    if (!chartData?.length) return [];

    // Build a map: date -> past prediction record
    const pastMap = {};
    pastPredictions.forEach(p => {
      if (p.prediction_date) pastMap[p.prediction_date] = p;
    });

    const mapped = chartData
      .filter((d) => d.date && d.close != null)
      .map((d) => {
        const past = pastMap[d.date];
        return {
          date: d.date,
          close: parseFloat(d.close) || null,
          ma5: d.ma5 != null ? parseFloat(d.ma5) : null,
          ma20: d.ma20 != null ? parseFloat(d.ma20) : null,
          volume: d.volume != null ? parseInt(d.volume) : null,
          // past prediction overlaid at the actual close date
          pastPredicted: past ? past.predicted_next_close ?? null : null,
          pastSignal: past ? past.signal ?? null : null,
          pastConfidence: past ? past.confidence ?? null : null,
        };
      });

    const sliced = range?.points ? mapped.slice(-range.points) : mapped;

    if (prediction) {
      sliced.push({
        date: prediction.prediction_date,
        close: null,
        predicted: prediction.predicted_next_close,
        ma5: null, ma20: null, volume: null,
        pastPredicted: null, pastSignal: null,
      });
    }
    return sliced;
  }, [chartData, prediction, pastPredictions, range]);

  const hasPast = data.some(d => d.pastPredicted != null);

  if (!data.length) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-slate-800">Price History & AI Backtesting</h3>
          {hasPast && (
            <p className="text-xs text-slate-400 mt-0.5">
              Signal dots show past AI predictions overlaid on actual price
            </p>
          )}
        </div>
        {ranges && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {ranges.map((r) => (
              <button
                key={r.key}
                disabled={loading}
                onClick={() => onRangeChange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${range?.key === r.key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Signal legend */}
      {hasPast && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {["BUY", "SELL", "HOLD"].map(s => (
            <span key={s} className="flex items-center gap-1 font-medium">
              <span style={{ color: SIGNAL_COLOR[s], fontSize: 14 }}>{SIGNAL_LABEL[s]}</span>
              {s} signal
            </span>
          ))}
          <span className="text-slate-300">· Dots show past AI-predicted close on that date</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
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

          {/* Actual close price */}
          <Area type="monotone" dataKey="close" name="Close" stroke="#6366f1"
            fill="url(#closeGrad)" strokeWidth={2} dot={false} connectNulls={false} />

          {/* Moving averages */}
          <Line type="monotone" dataKey="ma5" name="MA5" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="ma20" name="MA20" stroke="#ec4899" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />

          {/* Past predictions as signal dots overlaid on actual price */}
          {hasPast && (
            <Line
              type="monotone"
              dataKey="pastPredicted"
              name="Past Prediction"
              stroke="transparent"
              dot={<SignalDot />}
              activeDot={false}
              legendType="none"
              connectNulls={false}
            />
          )}

          {/* Current AI prediction point */}
          <Line
            type="monotone"
            dataKey="predicted"
            name={`AI Predict (${prediction?.signal || ""})`}
            stroke={SIGNAL_COLOR[prediction?.signal] || "#6366f1"}
            dot={<PredictDot signal={prediction?.signal} />}
            activeDot={false}
            strokeWidth={0}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume chart */}
      <ResponsiveContainer width="100%" height={70}>
        <ComposedChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={65} tickFormatter={(v) => v > 1e6 ? `${(v / 1e6).toFixed(0)}M` : v} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="volume" name="Volume" fill="#e0e7ff" radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}