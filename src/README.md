# 📈 StockSage — AI Stock Predictor 🔮

An **AI-powered stock analysis platform** that fetches real-time market data, generates next-day price predictions, and delivers BUY/SELL/HOLD signals with full technical analysis.

---

## ✨ Features

✔️ Fetch **live stock prices** from Yahoo Finance  
✔️ Predict **next-day closing prices** using AI/LLM analysis  
✔️ Generate **BUY / SELL / HOLD signals** with confidence ratings  
✔️ Display **7-day and 30-day price targets**  
✔️ Visualize trends with **Moving Averages (MA5, MA20), support & resistance levels**  
✔️ **Backtesting chart** — overlay historical AI signals against actual closing prices  
✔️ **Portfolio tracker** — track holdings with real-time P&L and AI-projected gains  
✔️ **Watchlist** — monitor multiple tickers with one-click refresh  
✔️ **Email alerts** — get notified on signal changes or price thresholds  
✔️ **PDF export** — download a full analysis report for any stock  

---

## 🚀 How to Run

1. **Install Node.js** (v18+ recommended)
2. **Clone the repository**:
   ```bash
   git clone https://github.com/imirza5916/Stock_Predictor.git
   cd Stock_Predictor
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
5. Open your browser at `http://localhost:5173`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Tailwind CSS, Recharts |
| AI Analysis | LLM (sentiment, signals, price targets) |
| Market Data | Yahoo Finance API |
| PDF Export | jsPDF |

---

## 📁 Project Structure

```
src/
├── pages/
│   ├── Home.jsx              # Main prediction interface
│   ├── Portfolio.jsx         # Portfolio tracker
│   └── Dashboard.jsx         # Watchlist, history & alerts
├── components/
│   └── stocksage/
│       ├── PredictionCard.jsx
│       ├── PriceChart.jsx
│       ├── AIAnalysis.jsx
│       ├── Watchlist.jsx
│       ├── TickerInput.jsx
│       ├── PDFReport.jsx
│       └── RecentPredictions.jsx
```

---

## 📊 How It Works

1. Enter any stock ticker (e.g. `AAPL`, `TSLA`, `NVDA`)
2. Live price history is fetched from Yahoo Finance
3. AI analyzes technicals, sentiment, and fundamentals
4. Prediction card displays the signal, predicted close, and key factors
5. Chart overlays past AI signals on actual prices for backtesting

---

## ⚠️ Disclaimer

StockSage is for **educational and informational purposes only**. It is **not financial advice**. Always do your own research before making investment decisions.

---

## 📄 License

MIT