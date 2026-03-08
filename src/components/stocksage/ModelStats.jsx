import { BarChart2, Target, Zap } from "lucide-react";

function StatCard({ icon: Icon, label, value, color = "text-white" }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/10">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-white/50 text-xs uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  );
}

export default function ModelStats({ data }) {
  return (
    <div className="space-y-3">
      <h3 className="text-white/60 text-sm uppercase tracking-widest font-medium">Model Statistics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={Target}
          label="Test MAE"
          value={data.model_mae != null ? `$${Number(data.model_mae).toFixed(3)}` : "N/A"}
          color="text-blue-400"
        />
        <StatCard
          icon={Zap}
          label="Best Alpha (Ridge)"
          value={data.best_alpha != null ? Number(data.best_alpha).toFixed(2) : "N/A"}
          color="text-purple-400"
        />
        <StatCard
          icon={BarChart2}
          label="Signal"
          value={data.signal || "N/A"}
          color={data.signal === "BUY" ? "text-emerald-400" : data.signal === "SELL" ? "text-red-400" : "text-yellow-400"}
        />
      </div>
    </div>
  );
}