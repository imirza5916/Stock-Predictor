import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticker } = await req.json();
    if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

    // Validate ticker before interpolating into the outbound URL: only plain
    // exchange symbols (letters, digits, ., -, ^, =) up to 15 chars are allowed,
    // so path/query separators (?, &, #, /, %2F) cannot alter the request.
    const symbol = String(ticker).toUpperCase();
    if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) {
        return Response.json({ error: 'Invalid ticker' }, { status: 400 });
    }

    // Fetch 5 years of daily data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5y`;
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
    const companyName = meta.shortName || meta.longName || symbol;

    // --- Ridge Regression prediction ---
    const closesOnly = rawData.map(d => d.close);
    const volumesArr = rawData.map(d => d.volume || 0);
    const ma5Arr = chartData.map(d => d.ma5);
    const ma20Arr = chartData.map(d => d.ma20);
    const ridge = computeRidgePrediction(closesOnly, volumesArr, ma5Arr, ma20Arr);
    const backtest = walkForwardBacktest(closesOnly, volumesArr, ma5Arr, ma20Arr);

    return Response.json({ chartData, lastClose, companyName, ticker: symbol, ridge, backtest });
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

// Lasso (L1) via coordinate descent on the Gram matrix — tests whether sparse feature
// selection outperforms Ridge's shrink-all. Same standardized features / centered target.
function lassoFit(X: number[][], y: number[], alpha: number, maxIter = 50, tol = 1e-4): number[] {
    const n = X.length;
    const k = X[0].length;
    const G = Array(k).fill(0).map(() => Array(k).fill(0));
    const Xty = Array(k).fill(0);
    for (let i = 0; i < n; i++) {
        for (let a = 0; a < k; a++) {
            Xty[a] += X[i][a] * y[i];
            for (let b = a; b < k; b++) G[a][b] += X[i][a] * X[i][b];
        }
    }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) G[a][b] = G[b][a];
    const soft = (v: number, t: number) => Math.sign(v) * Math.max(0, Math.abs(v) - t);
    const beta = Array(k).fill(0);
    for (let iter = 0; iter < maxIter; iter++) {
        let maxChange = 0;
        for (let j = 0; j < k; j++) {
            const d = G[j][j];
            if (d < 1e-12) continue;
            let rho = Xty[j];
            for (let l = 0; l < k; l++) if (l !== j) rho -= G[j][l] * beta[l];
            const old = beta[j];
            beta[j] = soft(rho, alpha) / d;
            const diff = Math.abs(beta[j] - old);
            if (diff > maxChange) maxChange = diff;
        }
        if (maxChange < tol) break;
    }
    return beta;
}

// k-Nearest-Neighbors (k=5) in standardized feature space — non-parametric contrast to
// the linear models. Predicts the average target of the 5 closest training rows.
function knnPredict(X: number[][], y: number[], query: number[], k: number): number {
    const dists = X.map((row, i) => ({ d: row.reduce((s, v, j) => s + (v - query[j]) ** 2, 0), y: y[i] }));
    dists.sort((a, b) => a.d - b.d);
    const top = dists.slice(0, Math.min(k, dists.length));
    return top.reduce((s, t) => s + t.y, 0) / top.length;
}

// Fit a model with nested alpha selection: pick alpha on validation (last 20% of train),
// refit on the full train. Returns coefficients + the full-train scaler/mean for prediction.
function fitModel(fitFn: (X: number[][], y: number[], a: number) => number[],
                  trainX: number[][], trainY: number[], valStart: number, alphas: number[]) {
    const trainN = trainX.length;
    const valScaler = fitScaler(trainX.slice(0, valStart));
    const valYMean = trainY.slice(0, valStart).reduce((a, b) => a + b, 0) / Math.max(1, valStart);
    const XsVal = applyScaler(trainX, valScaler);
    const ycVal = trainY.map(v => v - valYMean);
    let best = { alpha: alphas[0], valMae: Infinity };
    for (const alpha of alphas) {
        const coefs = fitFn(XsVal.slice(0, valStart), ycVal.slice(0, valStart), alpha);
        let absErr = 0;
        for (let i = valStart; i < trainN; i++) {
            const pred = valYMean + dot(XsVal[i], coefs);
            absErr += Math.abs(pred - trainY[i]);
        }
        const valMae = absErr / Math.max(1, trainN - valStart);
        if (valMae < best.valMae) best = { alpha, valMae };
    }
    const fullScaler = fitScaler(trainX);
    const fullYMean = trainY.reduce((a, b) => a + b, 0) / trainN;
    const XsFull = applyScaler(trainX, fullScaler);
    const ycFull = trainY.map(v => v - fullYMean);
    const finalCoefs = fitFn(XsFull, ycFull, best.alpha);
    return { coefs: finalCoefs, yMean: fullYMean, scaler: fullScaler };
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

    // Calibrated signal: dead band scaled to the asset's own 20-day realized volatility,
    // so a predicted move only counts as a signal if it exceeds half a typical day's noise.
    const recentVol = vol[n - 1] || 0.01;
    const threshold = 0.5 * recentVol;
    const signal = predLogRet > threshold ? "BUY" : predLogRet < -threshold ? "SELL" : "HOLD";
    const ratio = recentVol > 0 ? Math.abs(predLogRet) / recentVol : 0;
    const confidence = ratio > 1.0 ? "HIGH" : ratio > 0.5 ? "MEDIUM" : "LOW";

    return {
        predicted_next_close: parseFloat(predictedNext.toFixed(2)),
        predicted_return_pct: parseFloat(((Math.exp(predLogRet) - 1) * 100).toFixed(2)),
        model_mae: parseFloat(testMae.toFixed(3)),
        best_alpha: best.alpha,
        signal,
        confidence,
        confidence_lower: parseFloat((predictedNext - testMae).toFixed(2)),
        confidence_upper: parseFloat((predictedNext + testMae).toFixed(2)),
    };
}

// Walk-forward backtest with a rolling 252-day training window (adapts to regime changes,
// caps compute over 5y). Compares Ridge, Lasso, k-NN, and their ensemble vs baselines.
// Transaction costs: 5 bps per position change (long/flat, no shorting).
function walkForwardBacktest(closes: number[], volumes: number[], ma5: number[], ma20: number[]) {
    const n = closes.length;
    const featureStart = 20;
    const minTrain = 30;
    const windowSize = 252;
    const COST = 0.0005; // 5 bps per trade
    if (n < featureStart + minTrain + 5) return null;

    const rsi = computeRSI(closes, 14);
    const vol = computeRealizedVol(closes, 20);
    const features = buildFeatures(closes, volumes, ma5, ma20, rsi, vol);
    const ridgeAlphas = [0.01, 0.1, 1, 10, 100, 1000];
    const lassoAlphas = [0.01, 0.1, 1, 10];

    const c = { ridge: 0, lasso: 0, knn: 0, ens: 0, alwaysUp: 0, persist: 0, maCross: 0, n: 0 };
    const r = { ridge: 0, lasso: 0, knn: 0, ens: 0, buyHold: 0, maCross: 0 };
    const tr = { ridge: 0, lasso: 0, knn: 0, ens: 0, buyHold: 0, maCross: 0 };
    let posRidge = 0, posLasso = 0, posKnn = 0, posEns = 0, posMaCross = 0, posBuyHold = 0;

    for (let t = featureStart + minTrain; t < n - 1; t++) {
        const trainStart = Math.max(featureStart, t - windowSize);
        const trainX: number[][] = [];
        const trainY: number[] = [];
        for (let i = trainStart; i < t; i++) {
            trainX.push(features(i));
            trainY.push(Math.log(closes[i + 1] / closes[i]));
        }
        const trainN = trainX.length;
        const valStart = Math.floor(trainN * 0.8);

        const ridgeM = fitModel(ridgeFit, trainX, trainY, valStart, ridgeAlphas);
        const lassoM = fitModel(lassoFit, trainX, trainY, valStart, lassoAlphas);
        const query = features(t);
        const ridgePred = ridgeM.yMean + dot(applyScaler([query], ridgeM.scaler)[0], ridgeM.coefs);
        const lassoPred = lassoM.yMean + dot(applyScaler([query], lassoM.scaler)[0], lassoM.coefs);

        // k-NN in standardized feature space
        const knnScaler = fitScaler(trainX);
        const knnXs = applyScaler(trainX, knnScaler);
        const knnQuery = applyScaler([query], knnScaler)[0];
        const knnPred = knnPredict(knnXs, trainY, knnQuery, 5);

        const ensPred = (ridgePred + lassoPred + knnPred) / 3;
        const actualLogRet = Math.log(closes[t + 1] / closes[t]);
        const lastClose = closes[t];

        const actualUp = actualLogRet > 0;
        const persistUp = lastClose > closes[t - 1];
        const maCrossUp = (ma5[t] || lastClose) > (ma20[t] || lastClose);

        if ((ridgePred > 0) === actualUp) c.ridge++;
        if ((lassoPred > 0) === actualUp) c.lasso++;
        if ((knnPred > 0) === actualUp) c.knn++;
        if ((ensPred > 0) === actualUp) c.ens++;
        if (actualUp) c.alwaysUp++;
        if (persistUp === actualUp) c.persist++;
        if (maCrossUp === actualUp) c.maCross++;
        c.n++;

        // Buy & hold: long from first day, one entry cost
        if (posBuyHold === 0) { r.buyHold -= COST; tr.buyHold++; posBuyHold = 1; }
        r.buyHold += actualLogRet;

        // Long/flat strategies with 5 bps per position change
        let nR = ridgePred > 0 ? 1 : 0;
        if (nR !== posRidge) { r.ridge -= COST; tr.ridge++; posRidge = nR; }
        if (nR) r.ridge += actualLogRet;

        let nL = lassoPred > 0 ? 1 : 0;
        if (nL !== posLasso) { r.lasso -= COST; tr.lasso++; posLasso = nL; }
        if (nL) r.lasso += actualLogRet;

        let nK = knnPred > 0 ? 1 : 0;
        if (nK !== posKnn) { r.knn -= COST; tr.knn++; posKnn = nK; }
        if (nK) r.knn += actualLogRet;

        let nE = ensPred > 0 ? 1 : 0;
        if (nE !== posEns) { r.ens -= COST; tr.ens++; posEns = nE; }
        if (nE) r.ens += actualLogRet;

        let nM = maCrossUp ? 1 : 0;
        if (nM !== posMaCross) { r.maCross -= COST; tr.maCross++; posMaCross = nM; }
        if (nM) r.maCross += actualLogRet;
    }

    const toPct = (x: number) => parseFloat(((Math.exp(x) - 1) * 100).toFixed(2));
    const hr = (x: number) => parseFloat((x / c.n * 100).toFixed(1));
    return {
        n_signals: c.n,
        model_hit_rate: hr(c.ridge),
        model_return_pct: toPct(r.ridge),
        always_up_hit_rate: hr(c.alwaysUp),
        persistence_hit_rate: hr(c.persist),
        ma_cross_hit_rate: hr(c.maCross),
        buy_hold_return_pct: toPct(r.buyHold),
        ma_cross_return_pct: toPct(r.maCross),
        cost_bps: 5,
        models: [
            { name: "Ridge", hit_rate: hr(c.ridge), return_pct: toPct(r.ridge), trades: tr.ridge },
            { name: "Lasso", hit_rate: hr(c.lasso), return_pct: toPct(r.lasso), trades: tr.lasso },
            { name: "k-NN", hit_rate: hr(c.knn), return_pct: toPct(r.knn), trades: tr.knn },
            { name: "Ensemble", hit_rate: hr(c.ens), return_pct: toPct(r.ens), trades: tr.ens },
            { name: "MA Crossover", hit_rate: hr(c.maCross), return_pct: toPct(r.maCross), trades: tr.maCross },
            { name: "Buy & Hold", hit_rate: null, return_pct: toPct(r.buyHold), trades: tr.buyHold },
        ],
    };
}