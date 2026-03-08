/**
 * DemoEngine.js
 * Generates realistic simulated stock data when no backend is connected.
 * Replace with real API calls once Python backend is running.
 */

function seed(ticker) {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = Math.imul(31, h) + ticker.charCodeAt(i) | 0;
  return Math.abs(h) / 2147483648;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemoData(ticker) {
  const rng = mulberry32((seed(ticker) * 1e9) | 0);
  const basePrice = 50 + seed(ticker) * 450;
  const volatility = 0.012 + rng() * 0.018;

  const days = 220;
  const prices = [basePrice];
  const volumes = [];

  for (let i = 1; i < days; i++) {
    const ret = (rng() - 0.495) * volatility * 2;
    prices.push(prices[i - 1] * Math.exp(ret));
    volumes.push(Math.floor(1e6 + rng() * 5e7));
  }
  volumes.push(Math.floor(1e6 + rng() * 5e7));

  const today = new Date();
  const chartData = prices.slice(-200).map((close, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (200 - i));
    return {
      date: d.toISOString().split("T")[0],
      close: parseFloat(close.toFixed(4)),
      volume: volumes[i] || Math.floor(1e6 + rng() * 5e7),
    };
  });

  // Moving averages
  for (let i = 0; i < chartData.length; i++) {
    for (const w of [5, 10, 20]) {
      const key = `ma${w}`;
      if (i >= w - 1) {
        const avg = chartData.slice(i - w + 1, i + 1).reduce((s, d) => s + d.close, 0) / w;
        chartData[i][key] = parseFloat(avg.toFixed(4));
        if (w === 5)  chartData[i].ma5  = parseFloat(avg.toFixed(4));
        if (w === 10) chartData[i].ma10 = parseFloat(avg.toFixed(4));
        if (w === 20) chartData[i].ma20 = parseFloat(avg.toFixed(4));
      }
    }
  }

  const lastClose = chartData[chartData.length - 1].close;
  const predReturn = (rng() - 0.48) * 0.04;
  const clipped = Math.max(-0.15, Math.min(0.15, predReturn));
  const predictedClose = lastClose * Math.exp(clipped);
  const pctReturn = Math.exp(clipped) - 1;
  const mae = 0.008 + rng() * 0.012;

  const signal = pctReturn > 0.015 ? "BUY" : pctReturn < -0.015 ? "SELL" : "HOLD";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const prediction = {
    ticker,
    last_close: parseFloat(lastClose.toFixed(4)),
    predicted_next_close: parseFloat(predictedClose.toFixed(4)),
    predicted_return: parseFloat(pctReturn.toFixed(6)),
    signal,
    model_mae: parseFloat(mae.toFixed(6)),
    best_alpha: [0.01, 0.1, 1, 10, 100][Math.floor(rng() * 5)],
    confidence_lower: parseFloat((lastClose * Math.exp(clipped - mae * 1.5)).toFixed(4)),
    confidence_upper: parseFloat((lastClose * Math.exp(clipped + mae * 1.5)).toFixed(4)),
    prediction_date: tomorrow.toISOString().split("T")[0],
    is_demo: true,
  };

  return { chartData, prediction };
}