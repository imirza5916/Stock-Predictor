import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";

export default function PDFReport({ prediction, chartData }) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const margin = 18;
    let y = 0;

    // Header bar
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, W, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("StockSage", margin, 14);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("AI-Powered Stock Analysis Report", margin, 22);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, W - margin, 22, { align: "right" });
    y = 42;

    // Ticker + company
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`${prediction.ticker}`, margin, y);
    if (prediction.company_name) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(prediction.company_name, margin + 22, y);
    }
    y += 10;

    // Signal badge
    const signalColors = { BUY: [16, 185, 129], SELL: [239, 68, 68], HOLD: [245, 158, 11] };
    const sc = signalColors[prediction.signal] || signalColors.HOLD;
    doc.setFillColor(...sc);
    doc.roundedRect(margin, y, 22, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(prediction.signal, margin + 11, y + 5.5, { align: "center" });

    if (prediction.confidence) {
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 25, y, 28, 8, 2, 2, "F");
      doc.setTextColor(71, 85, 105);
      doc.text(`${prediction.confidence} CONF`, margin + 39, y + 5.5, { align: "center" });
    }
    y += 16;

    // Price grid
    const priceItems = [
      ["Current Price", `$${Number(prediction.current_price || prediction.last_close).toFixed(2)}`],
      ["Predicted Close", `$${Number(prediction.predicted_next_close).toFixed(2)}`],
      ["Expected Move", `${Number(prediction.predicted_return_pct) > 0 ? "+" : ""}${Number(prediction.predicted_return_pct).toFixed(2)}%`],
      ["Prediction Date", prediction.prediction_date],
    ];
    const colW = (W - margin * 2) / 4;
    priceItems.forEach(([label, val], i) => {
      const x = margin + i * colW;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, colW - 3, 18, 2, 2, "F");
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(label.toUpperCase(), x + (colW - 3) / 2, y + 6, { align: "center" });
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(val, x + (colW - 3) / 2, y + 14, { align: "center" });
    });
    y += 26;

    // Price targets row
    const targetItems = [
      prediction.price_target_7d && ["7-Day Target", `$${Number(prediction.price_target_7d).toFixed(2)}`],
      prediction.price_target_30d && ["30-Day Target", `$${Number(prediction.price_target_30d).toFixed(2)}`],
      prediction.support_level && ["Support", `$${Number(prediction.support_level).toFixed(2)}`],
      prediction.resistance_level && ["Resistance", `$${Number(prediction.resistance_level).toFixed(2)}`],
    ].filter(Boolean);
    if (targetItems.length) {
      const tw = (W - margin * 2) / targetItems.length;
      targetItems.forEach(([label, val], i) => {
        const x = margin + i * tw;
        doc.setFillColor(238, 242, 255);
        doc.roundedRect(x, y, tw - 3, 16, 2, 2, "F");
        doc.setTextColor(99, 102, 241);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(label.toUpperCase(), x + (tw - 3) / 2, y + 6, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(val, x + (tw - 3) / 2, y + 13, { align: "center" });
      });
      y += 22;
    }

    // Analysis section
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, W - margin * 2, 6, 1, 1, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("AI Analysis", margin + 4, y + 4.2);
    y += 10;

    if (prediction.analysis_summary) {
      const lines = doc.splitTextToSize(prediction.analysis_summary, W - margin * 2 - 4);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(lines, margin + 2, y);
      y += lines.length * 5 + 4;
    }

    if (prediction.key_factors?.length) {
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Key Factors", margin + 2, y);
      y += 6;
      prediction.key_factors.forEach((f) => {
        const lines = doc.splitTextToSize(`• ${f}`, W - margin * 2 - 8);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(lines, margin + 4, y);
        y += lines.length * 4.5 + 1;
      });
      y += 4;
    }

    // Historical data table
    if (chartData?.length) {
      // Add new page if not enough space
      if (y > 220) { doc.addPage(); y = 18; }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, W - margin * 2, 6, 1, 1, "F");
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Historical Price Data (Last 30 Days)", margin + 4, y + 4.2);
      y += 10;

      const cols = ["Date", "Close", "MA5", "MA20", "Volume"];
      const cw = [38, 30, 30, 30, 46];
      let x = margin;

      // Table header
      doc.setFillColor(79, 70, 229);
      doc.rect(margin, y, W - margin * 2, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      cols.forEach((c, i) => {
        doc.text(c, x + cw[i] / 2, y + 5, { align: "center" });
        x += cw[i];
      });
      y += 7;

      const rows = chartData.slice(-30);
      rows.forEach((d, idx) => {
        if (y > 270) { doc.addPage(); y = 18; }
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, W - margin * 2, 6, "F");
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        x = margin;
        const vals = [
          d.date,
          d.close != null ? `$${Number(d.close).toFixed(2)}` : "—",
          d.ma5 != null ? `$${Number(d.ma5).toFixed(2)}` : "—",
          d.ma20 != null ? `$${Number(d.ma20).toFixed(2)}` : "—",
          d.volume != null ? `${(d.volume / 1e6).toFixed(1)}M` : "—",
        ];
        vals.forEach((v, i) => {
          doc.text(v, x + cw[i] / 2, y + 4.2, { align: "center" });
          x += cw[i];
        });
        y += 6;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.text("StockSage — AI-powered stock analysis. Not financial advice.", margin, 293);
      doc.text(`Page ${p} of ${pageCount}`, W - margin, 293, { align: "right" });
    }

    doc.save(`${prediction.ticker}_StockSage_Report.pdf`);
    setLoading(false);
  };

  return (
    <Button
      onClick={generate}
      disabled={loading}
      variant="outline"
      className="gap-2 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
    >
      <FileDown className="w-4 h-4" />
      {loading ? "Generating PDF..." : "Download PDF Report"}
    </Button>
  );
}