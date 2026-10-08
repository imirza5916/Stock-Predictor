import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticker } = await req.json();
    if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

    // Fetch 3 months of daily data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1y`;
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

    // Calculate moving averages (trailing windows only — no lookahead)
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
    const volumesArr = rawData.map(d => d.volume || 0);
    const ma5Arr = chartData.map(d => d.ma5);
    const ma20Arr = chartData.map(d => d.ma20);
    const ridge = computeRidgePrediction(closesOnly, volumesArr, ma5Arr, ma20Arr);
    const backtest = walkForwardBacktest(closesOnly, volumesArr, ma5Arr, ma20Arr);

    return Response.json({ chartData, lastClose, companyName, ticker: ticker.toUpperCase(), ridge, backtest });
});

// ---------- Ridge Regression helpers ----------
// Linear algebra primitives (small matrices, no external deps)
function dot(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + v * b[i], 0);
}

// Solve A x = b via Gaussian elimination with partial pivoting
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

// Ridge: beta = (XᵀX + alpha I)⁻¹ Xᵀy  (no intercept column; intercept handled by target centering)
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

// Standardize features: mean/std computed from a TRAINING window only (no lookahead)
function fitScaler(X: number[][]): { mean: number[]; std: number[] } {
    const k = X[0].length;
    const mean = Array(k).fill(0);
    const std = Array(k).fill(0);
    for (let i = 0; i < X.length; i++) for (let j = 0; j < k; j++) mean[j] += X[i][j];
    for (let j = 0; j < k; j++) mean[j] /= X.length;
    for (let i = 0; i < X.length; i++) for (let j = 0; j < k; j++) std[j] += (X[i][j] - mean[j]) ** 2;
    for (let j = 0; j < k; j++) {
        std[j] = Math.sqrt(std[j] / X.length);
        if (std[j] < 1e-8) std[j] = 1; // guard constant columns
    }
    return { mean, std };
}

function applyScaler(X: number[][], s: { mean: number[]; std: number[] }): number[][] {
    return X.map(row => row.map((v, j) => (v - s.mean[j]) / s.std[j]));
}

// RSI (simple average, period 14) — momentum oscillator 0..100
function computeRSI(closes: number[], period: number): number[] {
    const rsi = Array(closes.length).fill(50);
    for (let i = period; i < closes.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const ch = closes[j] - closes[j - 1];
            if (ch >= 0) gains += ch; else losses -= ch;
        }
        const avgLoss = losses / period;
        if (avgLoss === 0) rsi[i] = 100;
        else rsi[i] = 100 - 100 / (1 + (gains / period) / avgLoss);
    }
    return rsi;
}

// 20-day realized volatility (std of log returns)
function computeRealizedVol(closes: number[], period: number): number[] {
    const vol = Array(closes.length).fill(0);
    for (let i = period; i < closes.length; i++) {
        const rets: number[] = [];
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const r = Math.log(closes[j] / closes[j - 1]);
            rets.push(r); sum += r;
        }
        const mean = sum / period;
        vol[i] = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    }
    return vol;
}

// Returns-based feature vector at index i. All features are stationary
// (log returns, normalized RSI, realized vol, volume ratio, normalized MA gap).
// Requires i >= 20 for all features to be defined.
function buildFeatures(closes: number[], volumes: number[], ma5: number[], ma20: number[],
                       rsi: number[], vol: number[]): (i: number) => number[] {
    const n = closes.length;
    const volAvg = Array(n).fill(0);
    for (let i = 19; i < n; i++) {
        let s = 0;
        for (let j = i - 19; j <= i; j++) s += volumes[j] || 0;
        volAvg[i] = s / 20;
    }
    return (i: number): number[] => {
        const logRet1d = Math.log(closes[i] / closes[i - 1]);
        const logRet5d = Math.log(closes[i] / closes[i - 5]);
        const logRet20d = Math.log(closes[i] / closes[i - 20]);
        const rsiNorm = (rsi[i] - 50) / 25;                          // RSI centered & scaled
        const rv = vol[i];                                             // 20d realized vol
        const volRatio = volAvg[i] > 0 ? (volumes[i] || 0) / volAvg[i] : 1;
        const maGap = ((ma5[i] || closes[i]) - (ma20[i] || closes[i])) / closes[i];
        return [logRet1d, logRet5d, logRet20d, rsiNorm, rv, volRatio, maGap];
    };
}

// 3-way chronological split: train (60%) -> pick alpha on validation (20%) -> report MAE on test (20%, touched once)
// Target = next-day log return (stationary); price MAE reported for interpretability.
function computeRidgePrediction(closes: number[], volumes: number[], ma5: number[], ma20: number[]) {
    const n = closes.length;
    if (n < 35) return null;

    const rsi = computeRSI(closes, 14);
    const vol = computeRealizedVol(closes, 20);
    const features = buildFeatures(closes, volumes, ma5, ma20, rsi, vol);
    const featureStart = 20;

    // Supervised rows: features(i) -> log return of day i+1
    const allX: number[][] = [];
    const allY: number[] = [];
    for (let i = featureStart; i < n - 1; i++) {
        allX.push(features(i));
        allY.push(Math.log(closes[i + 1] / closes[i]));
    }
    const m = allX.length;

    const trainEnd = Math.floor(m * 0.6);
    const valEnd = Math.floor(m * 0.8);

    // Fit scaler + target mean on TRAIN only
    const scaler = fitScaler(allX.slice(0, trainEnd));
    const yTrainMean = allY.slice(0, trainEnd).reduce((a, b) => a + b, 0) / trainEnd;
    const Xs = applyScaler(allX, scaler);
    const yc = allY.map(v => v - yTrainMean);

    // Select alpha on VALIDATION (test set untouched)
    const alphas = [0.01, 0.1, 1, 10, 100, 1000];
    let best = { alpha: 1, valMae: Infinity };
    for (const alpha of alphas) {
        const coefs = ridgeFit(Xs.slice(0, trainEnd), yc.slice(0, trainEnd), alpha);
        let absErr = 0;
        for (let i = trainEnd; i < valEnd; i++) {
            const pred = yTrainMean + dot(Xs[i], coefs);
            absErr += Math.abs(pred - allY[i]);
        }
        const valMae = absErr / (valEnd - trainEnd);
        if (valMae < best.valMae) best = { alpha, valMae };
    }

    // Retrain on TRAIN+VALIDATION with best alpha; report price MAE on TEST once
    const finalScaler = fitScaler(allX.slice(0, valEnd));
    const finalYMean = allY.slice(0, valEnd).reduce((a, b) => a + b, 0) / valEnd;
    const Xfinal = applyScaler(allX, finalScaler);
    const ycFinal = allY.map(v => v - finalYMean);
    const finalCoefs = ridgeFit(Xfinal.slice(0, valEnd), ycFinal.slice(0, valEnd), best.alpha);
    let testAbsErr = 0, testCount = 0;
    for (let i = valEnd; i < m; i++) {
        const origIdx = featureStart + i;
        const predLogRet = finalYMean + dot(Xfinal[i], finalCoefs);
        const predClose = closes[origIdx] * Math.exp(predLogRet);
        testAbsErr += Math.abs(predClose - closes[origIdx + 1]);
        testCount++;
    }
    const testMae = testCount > 0 ? testAbsErr / testCount : best.valMae;

    // Predict next day after the last available close
    const lastScaled = applyScaler([features(n - 1)], finalScaler)[0];
    const predLogRet = finalYMean + dot(lastScaled, finalCoefs);
    const predictedNext = closes[n - 1] * Math.exp(predLogRet);

    return {
        predicted_next_close: parseFloat(predictedNext.toFixed(2)),
        model_mae: parseFloat(testMae.toFixed(3)),
        best_alpha: best.alpha,
        confidence_lower: parseFloat((predictedNext - testMae).toFixed(2)),
        confidence_upper: parseFloat((predictedNext + testMae).toFixed(2)),
    };
}

// Walk-forward backtest: refit each day on all prior data, predict next-day direction.
// Target = next-day log return; direction = sign of predicted return.
function walkForwardBacktest(closes: number[], volumes: number[], ma5: number[], ma20: number[]) {
    const n = closes.length;
    const featureStart = 20;
    const minTrain = 30; // training rows
    if (n < featureStart + minTrain + 5) return null;

    const rsi = computeRSI(closes, 14);
    const vol = computeRealizedVol(closes, 20);
    const features = buildFeatures(closes, volumes, ma5, ma20, rsi, vol);
    const alphas = [0.01, 0.1, 1, 10, 100, 1000];

    let modelHits = 0, alwaysUpHits = 0, persistHits = 0, maCrossHits = 0, nSignals = 0;
    let modelLogRet = 0, buyHoldLogRet = 0, maCrossLogRet = 0;

    for (let t = featureStart + minTrain; t < n - 1; t++) {
        // Training rows: features(i) -> log return(i -> i+1), for i in [featureStart, t)
        const trainX: number[][] = [];
        const trainY: number[] = [];
        for (let i = featureStart; i < t; i++) {
            trainX.push(features(i));
            trainY.push(Math.log(closes[i + 1] / closes[i]));
        }
        const trainN = trainX.length;
        // Nested validation: last 20% of train picks alpha (test day untouched)
        const valStart = Math.floor(trainN * 0.8);
        const scaler = fitScaler(trainX.slice(0, valStart));
        const yMean = trainY.slice(0, valStart).reduce((a, b) => a + b, 0) / Math.max(1, valStart);
        const Xs = applyScaler(trainX, scaler);
        const yc = trainY.map(v => v - yMean);

        let best = { alpha: 1, valMae: Infinity };
        for (const alpha of alphas) {
            const coefs = ridgeFit(Xs.slice(0, valStart), yc.slice(0, valStart), alpha);
            let absErr = 0;
            for (let i = valStart; i < trainN; i++) {
                const pred = yMean + dot(Xs[i], coefs);
                absErr += Math.abs(pred - trainY[i]);
            }
            const valMae = absErr / Math.max(1, trainN - valStart);
            if (valMae < best.valMae) best = { alpha, valMae };
        }
        // Refit on full train with best alpha
        const fullScaler = fitScaler(trainX);
        const fullYMean = trainY.reduce((a, b) => a + b, 0) / trainN;
        const Xfull = applyScaler(trainX, fullScaler);
        const ycFull = trainY.map(v => v - fullYMean);
        const coefs = ridgeFit(Xfull, ycFull, best.alpha);

        // Predict log return for day t -> t+1 and score direction
        const predScaled = applyScaler([features(t)], fullScaler)[0];
        const predLogRet = fullYMean + dot(predScaled, coefs);
        const actualLogRet = Math.log(closes[t + 1] / closes[t]);
        const lastClose = closes[t];

        const predUp = predLogRet > 0;
        const actualUp = actualLogRet > 0;
        const persistUp = lastClose > closes[t - 1];
        const maCrossUp = (ma5[t] || lastClose) > (ma20[t] || lastClose);

        if (predUp === actualUp) modelHits++;
        if (actualUp) alwaysUpHits++;
        if (persistUp === actualUp) persistHits++;
        if (maCrossUp === actualUp) maCrossHits++;
        nSignals++;

        buyHoldLogRet += actualLogRet;
        if (predUp) modelLogRet += actualLogRet;       // long when model says up, flat when down
        if (maCrossUp) maCrossLogRet += actualLogRet;  // long when MA5 > MA20, flat when down
    }

    const toPct = (x: number) => parseFloat(((Math.exp(x) - 1) * 100).toFixed(2));
    return {
        n_signals: nSignals,
        model_hit_rate: parseFloat((modelHits / nSignals * 100).toFixed(1)),
        always_up_hit_rate: parseFloat((alwaysUpHits / nSignals * 100).toFixed(1)),
        persistence_hit_rate: parseFloat((persistHits / nSignals * 100).toFixed(1)),
        ma_cross_hit_rate: parseFloat((maCrossHits / nSignals * 100).toFixed(1)),
        model_return_pct: toPct(modelLogRet),
        buy_hold_return_pct: toPct(buyHoldLogRet),
        ma_cross_return_pct: toPct(maCrossLogRet),
    };
}