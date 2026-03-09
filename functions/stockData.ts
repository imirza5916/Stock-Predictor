import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticker, range } = await req.json();
    if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

    const is1D = range === '1d';
    const yahooInterval = is1D ? '5m' : '1d';
    const yahooRange = is1D ? '1d' : '3mo';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=${yahooInterval}&range=${yahooRange}`;
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
        date: is1D
            ? new Date(ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            : new Date(ts * 1000).toISOString().split('T')[0],
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

    return Response.json({ chartData, lastClose, companyName, ticker: ticker.toUpperCase() });
});