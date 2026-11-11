const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Default Fabrary AppSync configuration (with automatic dynamic fallback if rotated)
let fabraryConfig = {
  endpoint: 'https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql',
  apiKey: 'da2-ddvxcqgprncwtdpokajstcnjha',
};

const FABRARY_HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://fabrary.net',
  'Referer': 'https://fabrary.net/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const GET_DECK_QUERY = `
  query getDeck($deckId: ID!) {
    getDeck(deckId: $deckId) {
      deckId
      name
      format
      heroIdentifier
      heroPrintOverride
      hero {
        name
        cardIdentifier
        defaultImage
        types
        subtypes
        rarity
        rarities
        intellect
        life
        createdExtras
        referencedCards
        printings {
          print
          set
          edition
          foiling
          rarity
          image
          treatments
        }
        printingsWithPrices {
          print
          set
          edition
          foiling
          rarity
          image
          treatments
          tcgplayer {
            currency
            name
            price
            productId
            url
          }
        }
      }
      deckCards {
        cardIdentifier
        quantity
        sideboardQuantity
        maybeQuantity
        tokenQuantity
        printOverride
        card {
          cardIdentifier
          name
          pitch
          cost
          power
          defense
          types
          subtypes
          rarities
          rarity
          defaultImage
          keywords
          createdExtras
          referencedCards
          printings {
            print
            set
            edition
            foiling
            rarity
            image
            treatments
          }
          printingsWithPrices {
            print
            set
            edition
            foiling
            rarity
            image
            treatments
            tcgplayer {
              currency
              name
              price
              productId
              url
            }
          }
        }
      }
    }
  }
`;

const GET_CARD_QUERY = `
  query getCard($cardIdentifier: ID!) {
    getCard(cardIdentifier: $cardIdentifier) {
      cardIdentifier
      name
      pitch
      cost
      power
      defense
      types
      subtypes
      rarities
      rarity
      defaultImage
      keywords
      createdExtras
      referencedCards
      printings {
        print
        set
        edition
        foiling
        rarity
        image
        treatments
      }
      printingsWithPrices {
        print
        set
        edition
        foiling
        rarity
        image
        treatments
        tcgplayer {
          currency
          name
          price
          productId
          url
        }
      }
    }
  }
`;

// Cache for TCGPlayer live product details/listings and Fabrary extra cards
const tcgProductCache = new Map();
const tcgListingsCache = new Map();
const fabraryCardCache = new Map();

/**
 * Extracts the deck ID from a Fabrary URL or raw ID string.
 */
function extractDeckId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/fabrary\.(?:net|io)\/decks\/([A-Za-z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];
  const rawMatch = trimmed.match(/^([A-Za-z0-9]{20,32})$/);
  if (rawMatch) return rawMatch[1];
  return null;
}

/**
 * Dynamically refreshes Fabrary AppSync endpoint & API key from fabrary.net bundle if needed.
 */
async function refreshFabraryConfig() {
  try {
    const htmlRes = await fetch('https://fabrary.net/', {
      headers: { 'User-Agent': FABRARY_HEADERS['User-Agent'] },
    });
    const html = await htmlRes.text();
    const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!scriptMatch) return false;

    const jsRes = await fetch(`https://fabrary.net${scriptMatch[1]}`, {
      headers: { 'User-Agent': FABRARY_HEADERS['User-Agent'] },
    });
    const js = await jsRes.text();
    const endpointMatch = js.match(/aws_appsync_graphqlEndpoint:[`"']([^`"']+)[`"']/);
    const keyMatch = js.match(/aws_appsync_apiKey:[`"']([^`"']+)[`"']/);

    if (endpointMatch && keyMatch) {
      fabraryConfig = {
        endpoint: endpointMatch[1],
        apiKey: keyMatch[1],
      };
      return true;
    }
  } catch (err) {
    console.error('Failed to refresh Fabrary config:', err.message);
  }
  return false;
}

/**
 * Executes a GraphQL query against Fabrary's AppSync API.
 */
async function queryFabraryGraphQL(query, variables, retried = false) {
  const response = await fetch(fabraryConfig.endpoint, {
    method: 'POST',
    headers: {
      ...FABRARY_HEADERS,
      'x-api-key': fabraryConfig.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  if (data.errors && data.errors.length > 0 && !retried) {
    const isAuthOrWaf = data.errors.some(
      (e) => e.errorType === 'UnauthorizedException' || e.errorType === 'WAFForbiddenException'
    );
    if (isAuthOrWaf) {
      const updated = await refreshFabraryConfig();
      if (updated) {
        return queryFabraryGraphQL(query, variables, true);
      }
    }
  }
  return data;
}

/**
 * Fetches a single card by cardIdentifier from Fabrary (with cache).
 */
async function fetchFabraryCard(cardIdentifier) {
  if (fabraryCardCache.has(cardIdentifier)) {
    return fabraryCardCache.get(cardIdentifier);
  }
  try {
    const res = await queryFabraryGraphQL(GET_CARD_QUERY, { cardIdentifier });
    const card = res?.data?.getCard || null;
    if (card) {
      fabraryCardCache.set(cardIdentifier, card);
    }
    return card;
  } catch (err) {
    console.error(`Error fetching extra card ${cardIdentifier}:`, err.message);
    return null;
  }
}

/**
 * Parses Language and Printing query parameters from a TCGPlayer URL.
 */
function parseTcgUrlParams(tcgUrl, fallbackFoiling, fallbackEdition) {
  let language = 'English';
  let tcgPrinting = null;

  if (tcgUrl && typeof tcgUrl === 'string') {
    try {
      const parsed = new URL(tcgUrl);
      if (parsed.searchParams.get('Language')) {
        language = parsed.searchParams.get('Language');
      }
      if (parsed.searchParams.get('Printing')) {
        tcgPrinting = parsed.searchParams.get('Printing');
      }
    } catch (_) {
      // ignore invalid URL
    }
  }

  if (!tcgPrinting) {
    const f = fallbackFoiling === 'Rainbow'
      ? 'Rainbow Foil'
      : fallbackFoiling === 'Cold'
        ? 'Cold Foil'
        : 'Normal';
    if (fallbackEdition === 'First' || fallbackEdition === 'Alpha') {
      tcgPrinting = `1st Edition ${f}`;
    } else if (fallbackEdition === 'Unlimited') {
      tcgPrinting = `Unlimited Edition ${f}`;
    } else {
      tcgPrinting = f;
    }
  }

  return { language, tcgPrinting };
}

/**
 * Infers supported languages for a Flesh and Blood set/printing.
 */
function inferSupportedLanguagesForSet(setName, defaultLang) {
  const s = (setName || '').toLowerCase();
  const langs = new Set([defaultLang || 'English']);
  // Sets known to have multi-language printings on TCGPlayer
  if (
    s.includes('history pack') ||
    s.includes('part the mistveil') ||
    s.includes('rosetta') ||
    s.includes('heavy hitters') ||
    s.includes('the hunted') ||
    s.includes('archive') ||
    s.includes('omens') ||
    s.includes('compendium')
  ) {
    langs.add('English');
    langs.add('Japanese');
    langs.add('French');
    langs.add('German');
    langs.add('Italian');
    langs.add('Spanish');
  }
  return [...langs];
}

/**
 * Normalizes a card's printings and merges pricing data from printingsWithPrices.
 */
function normalizePrintings(card) {
  if (!card) return [];
  const pricedList = Array.isArray(card.printingsWithPrices) ? card.printingsWithPrices : [];
  const rawPrintings = Array.isArray(card.printings) ? card.printings : [];

  const pricedByPrint = new Map();
  for (const p of pricedList) {
    if (p && p.print) {
      pricedByPrint.set(p.print, p);
    }
  }

  const allPrintKeys = new Set([
    ...pricedList.map((p) => p.print),
    ...rawPrintings.map((p) => p.print),
  ]);

  const merged = [];
  for (const printKey of allPrintKeys) {
    if (!printKey) continue;
    const priced = pricedByPrint.get(printKey);
    const raw = rawPrintings.find((r) => r.print === printKey);
    const base = priced || raw;
    if (!base) continue;

    // Skip back-side duplicate images if front exists
    if (
      String(base.print).endsWith('-Back') &&
      allPrintKeys.has(String(base.print).replace(/-Back$/, ''))
    ) {
      continue;
    }

    const tcg = priced?.tcgplayer || null;
    const foiling = base.foiling || 'Normal';
    const edition = base.edition || null;
    const set = base.set || 'Unknown Set';
    const { language, tcgPrinting } = parseTcgUrlParams(tcg?.url, foiling, edition);
    const supportedLanguages = inferSupportedLanguagesForSet(set, language);

    // Extract short set code from print (e.g. "WTR215-Unlimited" -> "WTR215")
    const codeMatch = String(base.print).match(/^([A-Z0-9]{3,7})/i);
    const setCode = codeMatch ? codeMatch[1] : base.print;

    merged.push({
      print: base.print,
      setCode,
      set,
      edition,
      foiling,
      rarity: base.rarity || card.rarity || 'Common',
      treatments: base.treatments || [],
      language,
      supportedLanguages,
      tcgPrinting,
      image: base.image ? `https://content.fabrary.net/cards/${base.image}.webp` : null,
      tcgplayer: tcg
        ? {
            currency: tcg.currency || 'USD',
            name: tcg.name || card.name,
            price: typeof tcg.price === 'number' ? tcg.price : null,
            productId: tcg.productId ? String(tcg.productId) : null,
            language,
            tcgPrinting,
            url:
              tcg.url ||
              (tcg.productId ? `https://www.tcgplayer.com/product/${tcg.productId}` : null),
          }
        : null,
    });
  }

  // Always sort printings by TCGPlayer price ascending (lowest price first, unpriced at the end)
  merged.sort((a, b) => {
    const pa = a.tcgplayer?.price ?? Infinity;
    const pb = b.tcgplayer?.price ?? Infinity;
    return pa - pb;
  });

  return merged;
}

/**
 * Determines whether a card is an Arena card (Equipment / Weapon / Demi-Hero)
 */
function isArenaCard(card) {
  const types = card?.types || [];
  return types.includes('Equipment') || types.includes('Weapon') || types.includes('Demi-Hero');
}

/**
 * Determines whether a card is natively a Token type or Token rarity
 */
function analyzeTokenStatus(card, section, tokenQuantity) {
  const types = card?.types || [];
  const subtypes = card?.subtypes || [];
  const rarity = card?.rarity || '';
  const rarities = card?.rarities || [];

  const isGameToken =
    section === 'tokens' ||
    types.includes('Token') ||
    subtypes.includes('Token') ||
    (typeof tokenQuantity === 'number' && tokenQuantity > 0);

  const hasTokenRarity =
    rarity === 'Token' || (rarities.includes('Token') && rarities.length === 1);

  const hasAnyTokenRarityPrinting = rarities.includes('Token') || rarity === 'Token';

  return {
    isGameToken,
    hasTokenRarity,
    hasAnyTokenRarityPrinting,
  };
}

/**
 * Builds a structured card entry for the frontend list.
 */
function buildCardEntry({
  id,
  card,
  section,
  sectionLabel,
  quantity,
  printOverride,
  tokenQuantity,
}) {
  const printings = normalizePrintings(card);
  const tokenInfo = analyzeTokenStatus(card, section, tokenQuantity);
  const defaultImage = card.defaultImage
    ? `https://content.fabrary.net/cards/${card.defaultImage}.webp`
    : printings[0]?.image || null;

  // Compute unique sets count & price range across editions of this same card
  const pricedPrintings = printings.filter(
    (p) => typeof p.tcgplayer?.price === 'number' && p.tcgplayer.price > 0
  );
  const uniqueSets = [...new Set(printings.map((p) => p.set))];
  const minEditionPrice = pricedPrintings.length > 0 ? pricedPrintings[0].tcgplayer.price : null;
  const maxEditionPrice =
    pricedPrintings.length > 0
      ? pricedPrintings[pricedPrintings.length - 1].tcgplayer.price
      : null;

  return {
    id,
    cardIdentifier: card.cardIdentifier,
    name: card.name,
    pitch: card.pitch ?? null,
    cost: card.cost ?? null,
    power: card.power ?? null,
    defense: card.defense ?? null,
    types: card.types || [],
    subtypes: card.subtypes || [],
    rarity: card.rarity || 'Common',
    rarities: card.rarities || [],
    keywords: card.keywords || [],
    section,
    sectionLabel,
    quantity,
    printOverride: printOverride || null,
    defaultImage,
    isGameToken: tokenInfo.isGameToken,
    hasTokenRarity: tokenInfo.hasTokenRarity,
    hasAnyTokenRarityPrinting: tokenInfo.hasAnyTokenRarityPrinting,
    editionStats: {
      totalPrintings: printings.length,
      uniqueSetsCount: uniqueSets.length,
      uniqueSets,
      minPrice: minEditionPrice,
      maxPrice: maxEditionPrice,
    },
    printings,
  };
}

/**
 * Fetches live details from TCGPlayer's mp-search-api for a given productId.
 */
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
        'User-Agent': FABRARY_HEADERS['User-Agent'],
      },
    });

    if (!response.ok) {
      return null;
    }

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

/**
 * Fetches live listings & language/printing aggregations from TCGPlayer for a productId.
 */
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
        'User-Agent': FABRARY_HEADERS['User-Agent'],
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

/**
 * Runs promises with a concurrency limit.
 */
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

/**
 * Helper to read JSON body from incoming request.
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Endpoint 1: Fetch deck & cards from Fabrary
  if (req.method === 'POST' && parsedUrl.pathname === '/api/fabrary/deck') {
    try {
      const body = await readJsonBody(req);
      const deckId = extractDeckId(body.urlOrId);
      if (!deckId) {
        return sendJson(res, 400, {
          error:
            'Link ou ID do deck inválido. Exemplo: https://fabrary.net/decks/01M75ERAT0XKSFDHXV0D7FGEW9',
        });
      }

      const gqlRes = await queryFabraryGraphQL(GET_DECK_QUERY, { deckId });
      const deck = gqlRes?.data?.getDeck;

      if (!deck) {
        return sendJson(res, 404, {
          error: `Deck "${deckId}" não encontrado ou privado no Fabrary.`,
          details: gqlRes?.errors || null,
        });
      }

      const items = [];
      const existingCardIdentifiers = new Set();
      const createdExtraIdentifiers = new Set();

      // 1. Hero
      if (deck.hero) {
        existingCardIdentifiers.add(deck.hero.cardIdentifier);
        if (Array.isArray(deck.hero.createdExtras)) {
          deck.hero.createdExtras.forEach((id) => createdExtraIdentifiers.add(id));
        }
        items.push(
          buildCardEntry({
            id: `hero-${deck.hero.cardIdentifier}`,
            card: deck.hero,
            section: 'hero',
            sectionLabel: 'Herói',
            quantity: 1,
            printOverride: deck.heroPrintOverride,
            tokenQuantity: 0,
          })
        );
      }

      // 2. Deck Cards (Arena, Main Deck, Inventory/Sideboard, Maybeboard, Explicit Tokens)
      const deckCards = Array.isArray(deck.deckCards) ? deck.deckCards : [];
      for (const dc of deckCards) {
        if (!dc || !dc.card) continue;
        existingCardIdentifiers.add(dc.cardIdentifier);

        const activeQty = (dc.quantity || 0) + (dc.sideboardQuantity || 0);
        if (activeQty > 0 && Array.isArray(dc.card.createdExtras)) {
          dc.card.createdExtras.forEach((id) => createdExtraIdentifiers.add(id));
        }

        const arena = isArenaCard(dc.card);

        // Main / Arena quantity
        if (dc.quantity && dc.quantity > 0) {
          items.push(
            buildCardEntry({
              id: `${arena ? 'arena' : 'main'}-${dc.cardIdentifier}`,
              card: dc.card,
              section: arena ? 'arena' : 'main',
              sectionLabel: arena ? 'Arena (Equip. / Armas)' : 'Deck Principal',
              quantity: dc.quantity,
              printOverride: dc.printOverride,
              tokenQuantity: 0,
            })
          );
        }

        // Inventory / Sideboard quantity
        if (dc.sideboardQuantity && dc.sideboardQuantity > 0) {
          items.push(
            buildCardEntry({
              id: `inventory-${dc.cardIdentifier}`,
              card: dc.card,
              section: 'inventory',
              sectionLabel: 'Inventory (Sideboard)',
              quantity: dc.sideboardQuantity,
              printOverride: dc.printOverride,
              tokenQuantity: 0,
            })
          );
        }

        // Maybeboard quantity
        if (dc.maybeQuantity && dc.maybeQuantity > 0) {
          items.push(
            buildCardEntry({
              id: `maybe-${dc.cardIdentifier}`,
              card: dc.card,
              section: 'maybe',
              sectionLabel: 'Maybeboard',
              quantity: dc.maybeQuantity,
              printOverride: dc.printOverride,
              tokenQuantity: 0,
            })
          );
        }

        // Explicit tokenQuantity on deckCard
        if (dc.tokenQuantity && dc.tokenQuantity > 0) {
          items.push(
            buildCardEntry({
              id: `token-${dc.cardIdentifier}`,
              card: dc.card,
              section: 'tokens',
              sectionLabel: 'Tokens / Extras',
              quantity: dc.tokenQuantity,
              printOverride: dc.printOverride,
              tokenQuantity: dc.tokenQuantity,
            })
          );
        }
      }

      // 3. Fetch createdExtras tokens that are not already in the deck
      const extraIdsToFetch = [...createdExtraIdentifiers].filter(
        (id) => !existingCardIdentifiers.has(id)
      );

      if (extraIdsToFetch.length > 0) {
        const extraCards = await mapConcurrent(extraIdsToFetch, 5, (id) => fetchFabraryCard(id));
        for (const extraCard of extraCards) {
          if (!extraCard) continue;
          items.push(
            buildCardEntry({
              id: `token-extra-${extraCard.cardIdentifier}`,
              card: extraCard,
              section: 'tokens',
              sectionLabel: 'Tokens / Extras',
              quantity: 1,
              printOverride: null,
              tokenQuantity: 1,
            })
          );
        }
      }

      // Collect all unique sets, foilings, and languages found across printings
      const setsSet = new Set();
      const foilingsSet = new Set();
      const languagesSet = new Set(['English', 'Japanese', 'French', 'German', 'Italian', 'Spanish']);
      for (const item of items) {
        for (const p of item.printings) {
          if (p.set) setsSet.add(p.set);
          if (p.foiling) foilingsSet.add(p.foiling);
          if (p.language) languagesSet.add(p.language);
        }
      }

      return sendJson(res, 200, {
        deck: {
          deckId: deck.deckId,
          name: deck.name,
          format: deck.format,
          url: `https://fabrary.net/decks/${deck.deckId}`,
          heroName: deck.hero?.name || deck.heroIdentifier,
          heroIdentifier: deck.heroIdentifier,
          heroBanner: deck.heroIdentifier
            ? `https://content.fabrary.net/heroes/${deck.heroIdentifier}.webp`
            : null,
          heroCardImage: deck.hero?.defaultImage
            ? `https://content.fabrary.net/cards/${deck.hero.defaultImage}.webp`
            : null,
        },
        items,
        availableFilters: {
          sets: [...setsSet].sort(),
          foilings: [...foilingsSet].sort(),
          languages: [...languagesSet],
        },
      });
    } catch (err) {
      console.error('Error in /api/fabrary/deck:', err);
      return sendJson(res, 500, {
        error: 'Erro ao buscar o deck no Fabrary: ' + (err.message || 'Erro interno'),
      });
    }
  }

  // Endpoint 2: Evaluate live prices & language-aware listings on TCGPlayer
  if (req.method === 'POST' && parsedUrl.pathname === '/api/tcgplayer/evaluate') {
    try {
      const body = await readJsonBody(req);
      const productIds = Array.isArray(body.productIds) ? body.productIds : [];
      const language = body.language || 'English';
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

      return sendJson(res, 200, {
        evaluatedAt: new Date().toISOString(),
        language,
        detailsByProductId,
      });
    } catch (err) {
      console.error('Error in /api/tcgplayer/evaluate:', err);
      return sendJson(res, 500, {
        error: 'Erro ao consultar preços no TCGPlayer: ' + (err.message || 'Erro interno'),
      });
    }
  }

  // Serve static files from /public
  let filePath = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(__dirname, 'public', safePath);

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`TCG CotaPool server running at http://localhost:${PORT}`);
});
