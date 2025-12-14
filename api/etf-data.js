// Vercel Serverless Function - Yahoo Finance Proxy
// This bypasses CORS by making server-side requests

export default async function handler(req, res) {
  // Enable CORS for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ticker } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker is required' });
  }

  try {
    const YAHOO_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';
    
    const response = await fetch(
      `${YAHOO_API}${ticker}?range=1y&interval=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Yahoo Finance returned ${response.status}` 
      });
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result || !result.timestamp || !result.indicators.quote[0].close) {
      return res.status(404).json({ error: 'No data found for ticker' });
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    // Get valid prices (filter out nulls)
    const validPrices = closes
      .map((price, idx) => ({
        price,
        timestamp: timestamps[idx]
      }))
      .filter(item => item.price !== null);

    if (validPrices.length < 10) {
      return res.status(404).json({ error: 'Insufficient data' });
    }

    // Calculate performance
    const latestPrice = validPrices[validPrices.length - 1].price;
    const yesterdayPrice = validPrices[validPrices.length - 2]?.price;
    const fiveDaysPrice = validPrices[validPrices.length - 6]?.price;
    const oneMonthPrice = validPrices[validPrices.length - 22]?.price;
    const threeMonthPrice = validPrices[validPrices.length - 64]?.price;
    const oneYearPrice = validPrices[0]?.price;

    const calculateReturn = (oldPrice, newPrice) => {
      if (!oldPrice || !newPrice) return 0;
      return ((newPrice - oldPrice) / oldPrice) * 100;
    };

    // Return calculated data
    return res.status(200).json({
      ticker,
      today: calculateReturn(yesterdayPrice, latestPrice),
      '1y': calculateReturn(oneYearPrice, latestPrice),
      '3m': calculateReturn(threeMonthPrice, latestPrice),
      '1m': calculateReturn(oneMonthPrice, latestPrice),
      '5d': calculateReturn(fiveDaysPrice, latestPrice),
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch data',
      details: error.message 
    });
  }
}
