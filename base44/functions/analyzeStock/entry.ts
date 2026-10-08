import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Narrow, app-specific operation: given a ticker, reuse stockData for market data +
// Ridge prediction + backtest, then run the LLM qualitative analysis server-side so
// integration credits are spent in the backend, not exposed to the client.
Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticker } = await req.json();
    if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });
    const symbol = String(ticker).toUpperCase();
    if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) {
        return Response.json({ error: 'Invalid ticker' }, { status: 400 });
    }

    // Reuse the stockData function — no duplicated Ridge/backtest logic.
    const stockRes = await base44.functions.invoke('stockData', { ticker: symbol });
    const sd = stockRes.data ?? stockRes;
    const { chartData, lastClose, companyName, ridge, backtest } = sd;

    const ridgePred = ridge?.predicted_next_close ?? lastClose;
    const ridgeReturnPct = ridge?.predicted_return_pct ?? ((ridgePred - lastClose) / lastClose) * 100;
    const recent = (chartData || []).slice(-20)
        .map((d: any) => `${d.date}: $${d.close} (MA5:${d.ma5}, MA20:${d.ma20})`).join("\n");

    // LLM explains the model's fixed signal; it does not generate one.
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a professional stock market analyst. Analyze "${symbol}" (${companyName}).

REAL MARKET DATA (last 20 trading days, date: close (MA5, MA20)):
${recent}

Current price: $${lastClose}
Ridge regression model prediction for next close: $${ridgePred} (expected return: ${ridgeReturnPct.toFixed(2)}%)
Model test MAE: $${ridge?.model_mae ?? "N/A"} | Best alpha: ${ridge?.best_alpha ?? "N/A"}
Confidence interval: $${ridge?.confidence_lower ?? "N/A"} - $${ridge?.confidence_upper ?? "N/A"}
MODEL SIGNAL: ${ridge?.signal ?? "HOLD"} (confidence: ${ridge?.confidence ?? "LOW"}) — derived from the predicted return vs the stock's 20-day realized volatility; a dead band filters noise.
Walk-forward backtest: model direction hit rate ${backtest?.model_hit_rate ?? "N/A"}% vs always-up ${backtest?.always_up_hit_rate ?? "N/A"}% over ${backtest?.n_signals ?? "N/A"} signals; model return ${backtest?.model_return_pct ?? "N/A"}% (net of costs) vs buy-and-hold ${backtest?.buy_hold_return_pct ?? "N/A"}%.

The trading signal above is FIXED — it comes from the Ridge model, not you. Your job is to EXPLAIN it. Provide:
- 7-day and 30-day price targets (realistic, near the Ridge prediction)
- Support and resistance levels (from the recent price range)
- A brief analysis summary explaining WHY the model arrived at this ${ridge?.signal ?? "HOLD"} signal, referencing the predicted return, moving averages, and the backtest hit rate
- Key factors influencing the prediction

Do not generate a different signal; interpret the model's ${ridge?.signal ?? "HOLD"}.`,
        response_json_schema: {
            type: "object",
            properties: {
                price_target_7d: { type: "number" },
                price_target_30d: { type: "number" },
                support_level: { type: "number" },
                resistance_level: { type: "number" },
                analysis_summary: { type: "string" },
                key_factors: { type: "array", items: { type: "string" } },
            },
            required: ["analysis_summary"],
        },
    });

    return Response.json({
        ...result,
        signal: ridge?.signal ?? "HOLD",
        confidence: ridge?.confidence ?? "LOW",
        predicted_next_close: ridgePred,
        predicted_return_pct: ridgeReturnPct,
        model_mae: ridge?.model_mae ?? null,
        best_alpha: ridge?.best_alpha ?? null,
        confidence_lower: ridge?.confidence_lower ?? null,
        confidence_upper: ridge?.confidence_upper ?? null,
        ticker: symbol,
        company_name: companyName,
        current_price: lastClose,
        last_close: lastClose,
        backtest,
        chart_data: chartData,
    });
});