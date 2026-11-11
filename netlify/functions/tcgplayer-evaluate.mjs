// Netlify Function: POST /api/tcgplayer/evaluate
// Fetches live TCGPlayer product details and language-filtered listings in USD.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const tcgProductCache = new Map();
const tcgListingsCache = new Map();

async function fetchTcgPlayerProductDetails(productId) {
  if (!productId) return null;
  const key = String(productId);
  const cached = tcgProductCache.get(key);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  try {
    const url = `https://mp-search-api.tcgplayer.com/v1/product/${encodeURIComponent(key)}/details`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Origin: 'https://www.tcgplayer.com',
        Referer: 'https://www.tcgplayer.com/',
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) return null;

    const raw = await response.json();
    const details = {
      productId: key,
      productName: raw.productName || null,
      setName: raw.setName || null,
      setCode: raw.setCode || null,
      rarityName: raw.rarityName || null,
      number: raw.customAttributes?.number || raw.formattedAttributes?.Number || null,
      marketPrice: typeof raw.marketPrice === 'number' ? raw.marketPrice : null,
      lowestPrice: typeof raw.lowestPrice === 'number' ? raw.lowestPrice : null,
      lowestPriceWithShipping:
        typeof raw.lowestPriceWithShipping === 'number' ? raw.lowestPriceWithShipping : null,
      medianPrice: typeof raw.medianPrice === 'number' ? raw.medianPrice : null,
      listings: typeof raw.listings === 'number' ? raw.listings : null,
      sellers: typeof raw.sellers === 'number' ? raw.sellers : null,
      url: `https://www.tcgplayer.com/product/${key}`,
    };

    tcgProductCache.set(key, { timestamp: Date.now(), data: details });
    return details;
  } catch (err) {
    console.error(`Error fetching TCGPlayer product ${key}:`, err.message);
    return null;
  }
}

async function fetchTcgPlayerListingsSummary(productId, languageFilter = 'all') {
  if (!productId) return null;
  const langKey = languageFilter && languageFilter !== 'all' ? languageFilter : 'ALL';
  const cacheKey = `${productId}::${langKey}`;
  const cached = tcgListingsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  try {
    const termFilters = {
      sellerStatus: 'Live',
      channelId: 0,
    };
    if (langKey !== 'ALL') {
      termFilters.language = [langKey];
    }

    const url = `https://mp-search-api.tcgplayer.com/v1/product/${encodeURIComponent(
      productId
    )}/listings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://www.tcgplayer.com',
        Referer: 'https://www.tcgplayer.com/',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        filters: {
          term: termFilters,
          range: { quantity: { gte: 1 } },
          exclude: { channelExclusion: 0 },
        },
        from: 0,
        size: 35,
        sort: { field: 'price', order: 'asc' },
        context: { shippingCountry: 'US', cart: {} },
        aggregations: ['language', 'printing', 'condition'],
      }),
    });

    if (!response.ok) return null;
    const raw = await response.json();
    const bucket = raw?.results?.[0];
    if (!bucket) return null;

    const availableLanguages = (bucket.aggregations?.language || []).map((l) => ({
      language: l.value,
      count: l.count,
    }));

    const availablePrintings = (bucket.aggregations?.printing || []).map((p) => ({
      printing: p.value,
      count: p.count,
    }));

    const listings = Array.isArray(bucket.results) ? bucket.results : [];
    const byPrinting = {};
    let overallCheapest = null;

    for (const item of listings) {
      if (typeof item.price !== 'number') continue;
      const ship = typeof item.shippingPrice === 'number' ? item.shippingPrice : 0;
      const entry = {
        price: item.price,
        shippingPrice: ship,
        totalWithShipping: Number((item.price + ship).toFixed(2)),
        language: item.language || 'English',
        languageAbbreviation: item.languageAbbreviation || 'EN',
        printing: item.printing || 'Normal',
        condition: item.condition || 'Near Mint',
        sellerName: item.sellerName || '',
        quantity: item.quantity || 1,
      };

      if (!overallCheapest || entry.price < overallCheapest.price) {
        overallCheapest = entry;
      }

      const pKey = entry.printing;
      if (!byPrinting[pKey] || entry.price < byPrinting[pKey].price) {
        byPrinting[pKey] = entry;
      }
    }

    const summary = {
      productId: String(productId),
      requestedLanguage: langKey,
      totalMatchingListings: bucket.totalResults || 0,
      availableLanguages,
      availablePrintings,
      overallCheapest,
      cheapestByPrinting: byPrinting,
    };

    tcgListingsCache.set(cacheKey, { timestamp: Date.now(), data: summary });
    return summary;
  } catch (err) {
    console.error(`Error fetching TCGPlayer listings for ${productId}:`, err.message);
    return null;
  }
}

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const productIds = Array.isArray(body?.productIds) ? body.productIds : [];
    const language = body?.language || 'English';
    const uniqueIds = [...new Set(productIds.filter(Boolean).map(String))];

    const resultsList = await mapConcurrent(uniqueIds, 8, async (id) => {
      const [details, listingsSummary] = await Promise.all([
        fetchTcgPlayerProductDetails(id),
        fetchTcgPlayerListingsSummary(id, language),
      ]);
      if (!details && !listingsSummary) return null;
      return {
        productId: id,
        ...(details || {}),
        listingsSummary: listingsSummary || null,
      };
    });

    const detailsByProductId = {};
    for (const item of resultsList) {
      if (item && item.productId) {
        detailsByProductId[item.productId] = item;
      }
    }

    return Response.json({
      evaluatedAt: new Date().toISOString(),
      language,
      detailsByProductId,
    });
  } catch (err) {
    console.error('Error in tcgplayer-evaluate function:', err);
    return Response.json(
      { error: 'Erro ao consultar preços no TCGPlayer: ' + (err.message || 'Erro interno') },
      { status: 500 }
    );
  }
};

export const config = {
  path: '/api/tcgplayer/evaluate',
};
