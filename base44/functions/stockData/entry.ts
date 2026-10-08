import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticker } = await req.json();
    if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

    // Fetch 3 months of daily data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=3mo`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) return Response.json({ error: `Failed to fetch data for ${ticker}` }, { status: 400 });

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return Response.json({ error: `No data found for ${ticker}` }, { status: 404 });

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];
    const meta = result.meta || {};

    // Build chart data
    const rawData = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] ? parseFloat(closes[i].toFixed(2)) : null,
        volume: volumes[i] || null,
    })).filter(d => d.close != null);

    // Calculate moving averages
    const chartData = rawData.map((d, i) => {
        const slice5 = rawData.slice(Math.max(0, i - 4), i + 1).map(x => x.close);
        const slice20 = rawData.slice(Math.max(0, i - 19), i + 1).map(x => x.close);
        const ma5 = parseFloat((slice5.reduce((a, b) => a + b, 0) / slice5.length).toFixed(2));
        const ma20 = parseFloat((slice20.reduce((a, b) => a + b, 0) / slice20.length).toFixed(2));
        return { ...d, ma5, ma20 };
    });

    const lastClose = parseFloat((meta.regularMarketPrice || closes[closes.length - 1] || 0).toFixed(2));
    const companyName = meta.shortName || meta.longName || ticker.toUpperCase();

    // --- Ridge Regression prediction ---
    const closesOnly = rawData.map(d => d.close);
    const ma5Arr = chartData.map(d => d.ma5);
    const ma20Arr = chartData.map(d => d.ma20);
    const ridge = computeRidgePrediction(closesOnly, ma5Arr, ma20Arr);

    return Response.json({ chartData, lastClose, companyName, ticker: ticker.toUpperCase(), ridge });
});

// ---------- Ridge Regression helpers ----------
function dot(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + v * b[i], 0);
}

function solveLinear(A: number[][], b: number[]): number[] {
    const n = A.length;
    const aug = A.map((row, i) => [...row, b[i]]);
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let r = i + 1; r < n; r++) {
            if (Math.abs(aug[r][i]) > Math.abs(aug[maxRow][i])) maxRow = r;
        }
        [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
        if (Math.abs(aug[i][i]) < 1e-12) continue;
        for (let r = i + 1; r < n; r++) {
            const factor = aug[r][i] / aug[i][i];
            for (let c = i; c <= n; c++) aug[r][c] -= factor * aug[i][c];
        }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = aug[i][n];
        for (let j = i + 1; j < n; j++) sum -= aug[i][j] * x[j];
        x[i] = Math.abs(aug[i][i]) < 1e-12 ? 0 : sum / aug[i][i];
    }
    return x;
}

function ridgeFit(X: number[][], y: number[], alpha: number): number[] {
    const k = X[0].length;
    const XtX = Array(k).fill(0).map(() => Array(k).fill(0));
    for (let i = 0; i < X.length; i++) {
        for (let a = 0; a < k; a++) {
            for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
        }
    }
    for (let i = 0; i < k; i++) XtX[i][i] += alpha;
    const Xty = Array(k).fill(0);
    for (let i = 0; i < X.length; i++) {
        for (let a = 0; a < k; a++) Xty[a] += X[i][a] * y[i];
    }
    return solveLinear(XtX, Xty);
}

function computeRidgePrediction(closes: number[], ma5: number[], ma20: number[]) {
    const n = closes.length;
    if (n < 30) return null;

    // Features: [intercept, close, ma5, ma20, lag1 (prev close), 5d return]
    const features = (i: number): number[] => {
        const lag1 = i > 0 ? closes[i - 1] : closes[i];
        const ret5d = i >= 5 ? (closes[i] - closes[i - 5]) / closes[i - 5] : 0;
        return [1, closes[i], ma5[i] || closes[i], ma20[i] || closes[i], lag1, ret5d];
    };

    const splitIdx = Math.floor(n * 0.8);
    const alphas = [0.01, 0.1, 1, 10, 100, 1000];
    let best = { alpha: 1, mae: Infinity };

    for (const alpha of alphas) {
        const X: number[][] = [];
        const y: number[] = [];
        for (let i = 0; i < splitIdx - 1; i++) {
            X.push(features(i));
            y.push(closes[i + 1]);
        }
        const coefs = ridgeFit(X, y, alpha);

        let absErr = 0;
        let count = 0;
        for (let i = splitIdx; i < n - 1; i++) {
            const pred = dot(features(i), coefs);
            absErr += Math.abs(pred - closes[i + 1]);
            count++;
        }
        const mae = count > 0 ? absErr / count : Infinity;
        if (mae < best.mae) best = { alpha, mae };
    }

    // Retrain on ALL data with best alpha, predict next day
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        X.push(features(i));
        y.push(closes[i + 1]);
    }
    const finalCoefs = ridgeFit(X, y, best.alpha);
    const predictedNext = dot(features(n - 1), finalCoefs);

    return {
        predicted_next_close: parseFloat(predictedNext.toFixed(2)),
        model_mae: parseFloat(best.mae.toFixed(3)),
        best_alpha: best.alpha,
        confidence_lower: parseFloat((predictedNext - best.mae).toFixed(2)),
        confidence_upper: parseFloat((predictedNext + best.mae).toFixed(2)),
    };
}