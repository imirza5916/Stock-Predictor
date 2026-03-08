import { useState } from "react";
import { Code2, ChevronDown, ChevronRight, Copy, Check, Download } from "lucide-react";

const FILES = [
  {
    name: "requirements.txt",
    lang: "text",
    content: `fastapi>=0.115.0
uvicorn[standard]>=0.30.0
scikit-learn>=1.5.0
pandas>=2.2.0
numpy>=2.0.0
requests>=2.31.0
python-dotenv>=1.0.1
diskcache>=5.6.3
`,
  },
  {
    name: "Dockerfile",
    lang: "dockerfile",
    content: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
  },
  {
    name: ".env.example",
    lang: "bash",
    content: `ALPHAVANTAGE_API_KEY=your_key_here
CACHE_DIR=./cache
PREDICTION_CACHE_TTL=600
`,
  },
  {
    name: "backend/main.py",
    lang: "python",
    content: `from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.services.predictor import predict_stock
from backend.services.chart_service import get_chart_data
import logging

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="StockSage API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    ticker: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "StockSage API"}

@app.post("/predict")
def predict(req: PredictRequest):
    ticker = req.ticker.upper().strip()
    if not ticker:
        raise HTTPException(400, "Ticker is required")
    result = predict_stock(ticker)
    if "error" in result:
        raise HTTPException(422, result["error"])
    return result

@app.get("/chart-data")
def chart_data(ticker: str):
    ticker = ticker.upper().strip()
    result = get_chart_data(ticker)
    if "error" in result:
        raise HTTPException(422, result["error"])
    return result
`,
  },
  {
    name: "backend/data/fetcher.py",
    lang: "python",
    content: `import os, requests, pandas as pd, logging
from io import StringIO
from datetime import datetime

logger = logging.getLogger(__name__)
AV_KEY = os.getenv("ALPHAVANTAGE_API_KEY", "")

def fetch_alpha_vantage(ticker: str) -> pd.DataFrame:
    url = (
        f"https://www.alphavantage.co/query"
        f"?function=TIME_SERIES_DAILY_ADJUSTED&symbol={ticker}"
        f"&outputsize=full&apikey={AV_KEY}"
    )
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    js = r.json()
    ts = js.get("Time Series (Daily)", {})
    if not ts:
        raise ValueError(f"No AV data for {ticker}: {js.get('Note', js.get('Information', 'Unknown'))}")
    rows = []
    for date, vals in ts.items():
        rows.append({
            "date": date,
            "open":   float(vals["1. open"]),
            "high":   float(vals["2. high"]),
            "low":    float(vals["3. low"]),
            "close":  float(vals["4. close"]),
            "volume": float(vals["6. volume"]),
        })
    df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
    df["date"] = pd.to_datetime(df["date"])
    return df

def fetch_stooq(ticker: str) -> pd.DataFrame:
    url = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&i=d"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    df.columns = [c.lower() for c in df.columns]
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df

def fetch_data(ticker: str) -> pd.DataFrame:
    if AV_KEY:
        try:
            logger.info(f"Fetching {ticker} via Alpha Vantage")
            return fetch_alpha_vantage(ticker)
        except Exception as e:
            logger.warning(f"AV failed: {e}, falling back to Stooq")
    logger.info(f"Fetching {ticker} via Stooq")
    return fetch_stooq(ticker)
`,
  },
  {
    name: "backend/model/features.py",
    lang: "python",
    content: `import numpy as np, pandas as pd

def engineer_features(df: pd.DataFrame, lookbacks=(1,2,3,5,10)) -> pd.DataFrame:
    df = df.copy()
    df["log_return"] = np.log(df["close"] / df["close"].shift(1))

    for lb in lookbacks:
        df[f"ret_{lb}"] = df["log_return"].shift(1).rolling(lb).sum()
        df[f"ma_{lb}"]  = df["close"].shift(1).rolling(lb).mean()

    for w in [5, 10, 20]:
        df[f"ma{w}"] = df["close"].rolling(w).mean()

    # RSI-14
    delta = df["close"].diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / loss.replace(0, np.nan)
    df["rsi"] = 100 - 100 / (1 + rs)

    # Volatility
    df["volatility_10"] = df["log_return"].rolling(10).std()

    # Volume z-score
    vol_mean = df["volume"].rolling(20).mean()
    vol_std  = df["volume"].rolling(20).std().replace(0, np.nan)
    df["vol_zscore"] = (df["volume"] - vol_mean) / vol_std

    # Target: next-day log return
    df["target"] = df["log_return"].shift(-1)
    df.dropna(inplace=True)

    FEATURE_COLS = (
        [f"ret_{lb}" for lb in lookbacks] +
        [f"ma_{lb}"  for lb in lookbacks] +
        ["rsi", "volatility_10", "vol_zscore"]
    )
    return df, FEATURE_COLS
`,
  },
  {
    name: "backend/model/trainer.py",
    lang: "python",
    content: `import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit, GridSearchCV
from sklearn.metrics import mean_absolute_error

def train_model(df, feature_cols):
    X = df[feature_cols].values
    y = df["target"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    tscv  = TimeSeriesSplit(n_splits=5)
    param_grid = {"alpha": [0.01, 0.1, 1.0, 10.0, 100.0, 1000.0]}
    ridge = Ridge()
    gs = GridSearchCV(ridge, param_grid, cv=tscv, scoring="neg_mean_absolute_error")
    gs.fit(X_scaled, y)

    best_model = gs.best_estimator_
    best_alpha = gs.best_params_["alpha"]

    # Evaluate on last 20% as test
    split = int(len(X) * 0.8)
    X_test_s = scaler.transform(X[split:])
    y_test    = y[split:]
    preds     = best_model.predict(X_test_s)
    mae = mean_absolute_error(y_test, preds)

    return best_model, scaler, feature_cols, mae, best_alpha
`,
  },
  {
    name: "backend/services/predictor.py",
    lang: "python",
    content: `import numpy as np, logging, diskcache, os
from datetime import datetime, timedelta
from backend.data.fetcher import fetch_data
from backend.model.features import engineer_features
from backend.model.trainer import train_model

logger = logging.getLogger(__name__)
cache = diskcache.Cache(os.getenv("CACHE_DIR", "./cache"))
TTL   = int(os.getenv("PREDICTION_CACHE_TTL", "600"))

def predict_stock(ticker: str) -> dict:
    cache_key = f"pred:{ticker}"
    if cache_key in cache:
        logger.info(f"Cache hit for {ticker}")
        return cache[cache_key]

    try:
        df_raw = fetch_data(ticker)
    except Exception as e:
        return {"error": f"Data fetch failed: {e}"}

    if len(df_raw) < 60:
        return {"error": f"Not enough data for {ticker}"}

    try:
        df_feat, feature_cols = engineer_features(df_raw)
        model, scaler, _, mae, best_alpha = train_model(df_feat, feature_cols)
    except Exception as e:
        return {"error": f"Model training failed: {e}"}

    last_row = df_feat[feature_cols].iloc[-1].values.reshape(1, -1)
    last_row_s = scaler.transform(last_row)
    pred_log_return = float(model.predict(last_row_s)[0])

    # Clip unrealistic predictions (±15%)
    pred_log_return = np.clip(pred_log_return, -0.15, 0.15)

    last_close = float(df_raw["close"].iloc[-1])
    predicted_close = last_close * np.exp(pred_log_return)
    pct_return = np.exp(pred_log_return) - 1

    # Confidence band using MAE in log-return space
    conf_low  = last_close * np.exp(pred_log_return - mae * 1.5)
    conf_high = last_close * np.exp(pred_log_return + mae * 1.5)

    signal = "HOLD"
    if pct_return > 0.015:  signal = "BUY"
    elif pct_return < -0.015: signal = "SELL"

    next_trading_day = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    result = {
        "ticker": ticker,
        "last_close": round(last_close, 4),
        "predicted_next_close": round(predicted_close, 4),
        "predicted_return": round(pct_return, 6),
        "signal": signal,
        "model_mae": round(mae, 6),
        "best_alpha": best_alpha,
        "confidence_lower": round(conf_low, 4),
        "confidence_upper": round(conf_high, 4),
        "prediction_date": next_trading_day,
    }
    cache.set(cache_key, result, expire=TTL)
    return result
`,
  },
  {
    name: "backend/services/chart_service.py",
    lang: "python",
    content: `import diskcache, os, logging
from backend.data.fetcher import fetch_data
from backend.model.features import engineer_features

logger = logging.getLogger(__name__)
cache = diskcache.Cache(os.getenv("CACHE_DIR", "./cache"))
TTL = int(os.getenv("PREDICTION_CACHE_TTL", "600"))

def get_chart_data(ticker: str) -> dict:
    cache_key = f"chart:{ticker}"
    if cache_key in cache:
        return cache[cache_key]
    try:
        df = fetch_data(ticker)
    except Exception as e:
        return {"error": str(e)}

    df_feat, _ = engineer_features(df)
    last200 = df_feat.tail(200).copy()

    rows = []
    for _, row in last200.iterrows():
        rows.append({
            "date":   row["date"].strftime("%Y-%m-%d"),
            "close":  round(float(row["close"]), 4),
            "volume": int(row["volume"]),
            "ma5":    round(float(row.get("ma_5",  row["close"])), 4),
            "ma10":   round(float(row.get("ma_10", row["close"])), 4),
            "ma20":   round(float(row.get("ma20",  row["close"])), 4),
        })

    result = {"ticker": ticker, "data": rows}
    cache.set(cache_key, result, expire=TTL)
    return result
`,
  },
  {
    name: "README.md",
    lang: "markdown",
    content: `# StockSage — ML Stock Prediction App

## Quick Start

### 1. Clone & setup
\`\`\`bash
cp .env.example .env
# Add your ALPHAVANTAGE_API_KEY (optional, Stooq is the free fallback)
\`\`\`

### 2. Run with Docker
\`\`\`bash
docker build -t stocksage .
docker run -p 8000:8000 --env-file .env stocksage
\`\`\`

### 3. Run locally
\`\`\`bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
\`\`\`

### 4. Point the React frontend
Set your API base URL in the frontend to http://localhost:8000

## API Endpoints
- GET  /health          — service status
- POST /predict         — { "ticker": "AAPL" } → prediction JSON
- GET  /chart-data?ticker=AAPL → price history + MAs

## ML Pipeline
1. Fetch data (Alpha Vantage → Stooq fallback)
2. Engineer features: log returns, momentum, MAs, RSI, vol z-score, volatility
3. Train Ridge regression with TimeSeriesSplit GridSearch
4. Predict next-day log return → convert to price
5. Clip extreme predictions ±15%
6. Generate confidence band (MAE-based)
7. Trading signal: BUY >1.5% | SELL <-1.5% | HOLD

## Caching
All predictions and chart data are cached for 10 minutes via diskcache.
`,
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-all"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function FileBlock({ file }) {
  const [open, setOpen] = useState(false);
  const isLong = file.content.split("\n").length > 15;

  function downloadFile() {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = file.name.split("/").pop(); a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-white/5 cursor-pointer hover:bg-white/8 transition-all"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
          <Code2 className="w-4 h-4 text-purple-400" />
          <span className="text-white/80 text-sm font-mono">{file.name}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <CopyButton text={file.content} />
          <button
            onClick={downloadFile}
            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-all"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      {open && (
        <pre className="bg-gray-950 text-green-300 text-xs p-4 overflow-x-auto max-h-96 leading-relaxed">
          {file.content}
        </pre>
      )}
    </div>
  );
}

function downloadAll() {
  FILES.forEach((f) => {
    const blob = new Blob([f.content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = f.name.split("/").pop(); a.click();
    URL.revokeObjectURL(url);
  });
}

export default function BackendDocs() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-white/60 hover:text-white text-sm uppercase tracking-widest font-medium transition-all"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Python Backend Code
      </button>
      {open && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              onClick={downloadAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm transition-all"
            >
              <Download className="w-4 h-4" />
              Download All Files
            </button>
          </div>
          {FILES.map((f) => <FileBlock key={f.name} file={f} />)}
        </div>
      )}
    </div>
  );
}