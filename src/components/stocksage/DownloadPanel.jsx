import { Download, FileText, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function downloadCSV(data, filename) {
  const rows = [
    ["date", "close", "ma5", "ma10", "ma20", "volume"],
    ...data.map((d) => [d.date, d.close, d.ma5, d.ma10, d.ma20, d.volume]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadPredictionJSON(prediction) {
  const blob = new Blob([JSON.stringify(prediction, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${prediction.ticker}_prediction.json`; a.click();
  URL.revokeObjectURL(url);
}

export default function DownloadPanel({ chartData, prediction }) {
  return (
    <div className="space-y-3">
      <h3 className="text-white/60 text-sm uppercase tracking-widest font-medium">Export Data</h3>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          className="border-white/20 text-white/70 hover:text-white hover:bg-white/10 gap-2"
          onClick={() => downloadCSV(chartData, `${prediction.ticker}_history.csv`)}
        >
          <Download className="w-4 h-4" />
          Download CSV
        </Button>
        <Button
          variant="outline"
          className="border-white/20 text-white/70 hover:text-white hover:bg-white/10 gap-2"
          onClick={() => downloadPredictionJSON(prediction)}
        >
          <FileText className="w-4 h-4" />
          Download Prediction JSON
        </Button>
      </div>
    </div>
  );
}