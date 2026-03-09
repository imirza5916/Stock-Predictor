import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AlertPreferencesSection({ alerts, userEmail, onRefresh }) {
  const [form, setForm] = useState({ ticker: "", price_above: "", price_below: "", alert_on_buy: true, alert_on_sell: true, alert_on_hold: false });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.ticker.trim()) return;
    setAdding(true);
    await base44.entities.AlertPreference.create({
      ticker: form.ticker.trim().toUpperCase(),
      email: userEmail,
      alert_on_buy: form.alert_on_buy,
      alert_on_sell: form.alert_on_sell,
      alert_on_hold: form.alert_on_hold,
      price_above: form.price_above ? Number(form.price_above) : undefined,
      price_below: form.price_below ? Number(form.price_below) : undefined,
      is_active: true,
    });
    setForm({ ticker: "", price_above: "", price_below: "", alert_on_buy: true, alert_on_sell: true, alert_on_hold: false });
    setShowForm(false);
    setAdding(false);
    onRefresh();
  }

  async function handleDelete(id) {
    await base44.entities.AlertPreference.delete(id);
    onRefresh();
  }

  async function toggleActive(alert) {
    await base44.entities.AlertPreference.update(alert.id, { is_active: !alert.is_active });
    onRefresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => setShowForm(v => !v)}
          className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Alert
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-3 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Ticker *</label>
              <Input
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder="e.g. AAPL"
                className="font-mono h-9 text-sm"
                maxLength={10}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Alert if price above ($)</label>
              <Input
                type="number"
                value={form.price_above}
                onChange={e => setForm(f => ({ ...f, price_above: e.target.value }))}
                placeholder="Optional"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Alert if price below ($)</label>
              <Input
                type="number"
                value={form.price_below}
                onChange={e => setForm(f => ({ ...f, price_below: e.target.value }))}
                placeholder="Optional"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {[["alert_on_buy", "BUY signal"], ["alert_on_sell", "SELL signal"], ["alert_on_hold", "HOLD signal"]].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={adding} className="bg-indigo-600 hover:bg-indigo-700">
              {adding ? "Saving..." : "Save Alert"}
            </Button>
          </div>
        </form>
      )}

      {alerts.length === 0 && !showForm ? (
        <div className="text-center py-12 text-slate-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="font-medium">No email alerts configured</p>
          <p className="text-sm mt-1">Get notified when a stock signal changes or hits your price target</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-slate-50 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-800">{alert.ticker}</span>
                  {alert.alert_on_buy && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md font-semibold">BUY</span>}
                  {alert.alert_on_sell && <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-md font-semibold">SELL</span>}
                  {alert.alert_on_hold && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold">HOLD</span>}
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  {[
                    alert.price_above ? `Above $${alert.price_above}` : null,
                    alert.price_below ? `Below $${alert.price_below}` : null,
                  ].filter(Boolean).join(" · ") || "Signal alerts only"} · Sent to {alert.email}
                </p>
              </div>
              <button
                onClick={() => toggleActive(alert)}
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                title={alert.is_active ? "Disable alert" : "Enable alert"}
              >
                {alert.is_active
                  ? <ToggleRight className="w-6 h-6 text-indigo-500" />
                  : <ToggleLeft className="w-6 h-6" />}
              </button>
              <button
                onClick={() => handleDelete(alert.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}