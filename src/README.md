# StockSage 📈

An AI-powered stock analysis platform that delivers next-day price predictions, BUY/SELL/HOLD signals, and technical analysis using live market data and LLM integration.

## Features

- **AI Predictions** — Next-day closing price predictions with BUY/SELL/HOLD signals and confidence ratings
- **Technical Analysis** — Support/resistance levels, 5/20-day moving averages, 7-day and 30-day price targets
- **Interactive Charts** — Historical price chart with AI signal backtesting overlay to visualize prediction accuracy
- **Portfolio Tracker** — Track holdings with real-time P&L, cost basis, and AI-projected gains per position
- **Watchlist** — Save and monitor multiple tickers with one-click refresh
- **Email Alerts** — Set price threshold and signal-based email notifications per ticker
- **PDF Export** — Download a full analysis report for any stock

## Tech Stack

- **Frontend:** React, Tailwind CSS, Recharts, Framer Motion
- **AI/LLM:** LLM integration for sentiment analysis, signal generation, and price target prediction
- **Data:** Yahoo Finance API (real-time price history, volume, company info)
- **Backend:** Serverless Deno functions
- **Database:** Base44 (entity-based data persistence)
- **PDF:** jsPDF

## Getting Started

### Prerequisites
- Node.js 18+
- A Base44 account (for backend/database)

### Installation

```bash
git clone https://github.com/your-username/stocksage.git
cd stocksage
npm install
npm run dev
```

### Environment Variables

This project uses Base44's built-in backend. No additional API keys are required for the core functionality — the Yahoo Finance data fetch and LLM calls are handled server-side via Base44 functions.

## Project Structure

```
src/
├── pages/
│   ├── Home.jsx          # Main prediction interface
│   ├── Portfolio.jsx     # Portfolio tracker
│   └── Dashboard.jsx     # Watchlist, history & alerts
├── components/
│   └── stocksage/
│       ├── PredictionCard.jsx
│       ├── PriceChart.jsx
│       ├── AIAnalysis.jsx
│       ├── Watchlist.jsx
│       ├── TickerInput.jsx
│       ├── PDFReport.jsx
│       └── RecentPredictions.jsx
├── functions/
│   └── stockData.js      # Backend: Yahoo Finance data fetcher
└── entities/
    ├── Prediction.json
    ├── Watchlist.json
    ├── Holding.json
    └── AlertPreference.json
```

## Usage

1. Enter any stock ticker (e.g. `AAPL`, `TSLA`, `NVDA`) in the search bar
2. StockSage fetches live price data and runs AI analysis
3. View the prediction card, AI summary, key factors, and price chart
4. Add the stock to your **Watchlist** or **Portfolio** for ongoing tracking
5. Set up **Email Alerts** from the Dashboard to get notified on signal changes

## Disclaimer

StockSage is for educational and informational purposes only. It is **not financial advice**. Always do your own research before making investment decisions.

## License

MIT