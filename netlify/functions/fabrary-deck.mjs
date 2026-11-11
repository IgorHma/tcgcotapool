// Netlify Function: POST /api/fabrary/deck
// Fetches a Flesh and Blood deck and its createdExtras tokens from Fabrary's AppSync GraphQL API.

let fabraryConfig = {
  endpoint: 'https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql',
  apiKey: 'da2-ddvxcqgprncwtdpokajstcnjha',
};

const FABRARY_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://fabrary.net',
  Referer: 'https://fabrary.net/',
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

const fabraryCardCache = new Map();

function extractDeckId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/fabrary\.(?:net|io)\/decks\/([A-Za-z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];
  const rawMatch = trimmed.match(/^([A-Za-z0-9]{20,32})$/);
  if (rawMatch) return rawMatch[1];
  return null;
}

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
      // ignore
    }
  }

  if (!tcgPrinting) {
    const f =
      fallbackFoiling === 'Rainbow'
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

function inferSupportedLanguagesForSet(setName, defaultLang) {
  const s = (setName || '').toLowerCase();
  const langs = new Set([defaultLang || 'English']);
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

  merged.sort((a, b) => {
    const pa = a.tcgplayer?.price ?? Infinity;
    const pb = b.tcgplayer?.price ?? Infinity;
    return pa - pb;
  });

  return merged;
}

function isArenaCard(card) {
  const types = card?.types || [];
  return types.includes('Equipment') || types.includes('Weapon') || types.includes('Demi-Hero');
}

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
    const deckId = extractDeckId(body?.urlOrId);
    if (!deckId) {
      return Response.json(
        {
          error:
            'Link ou ID do deck inválido. Exemplo: https://fabrary.net/decks/01M75ERAT0XKSFDHXV0D7FGEW9',
        },
        { status: 400 }
      );
    }

    const gqlRes = await queryFabraryGraphQL(GET_DECK_QUERY, { deckId });
    const deck = gqlRes?.data?.getDeck;

    if (!deck) {
      return Response.json(
        {
          error: `Deck "${deckId}" não encontrado ou privado no Fabrary.`,
          details: gqlRes?.errors || null,
        },
        { status: 404 }
      );
    }

    const items = [];
    const existingCardIdentifiers = new Set();
    const createdExtraIdentifiers = new Set();

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

    const deckCards = Array.isArray(deck.deckCards) ? deck.deckCards : [];
    for (const dc of deckCards) {
      if (!dc || !dc.card) continue;
      existingCardIdentifiers.add(dc.cardIdentifier);

      const activeQty = (dc.quantity || 0) + (dc.sideboardQuantity || 0);
      if (activeQty > 0 && Array.isArray(dc.card.createdExtras)) {
        dc.card.createdExtras.forEach((id) => createdExtraIdentifiers.add(id));
      }

      const arena = isArenaCard(dc.card);

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

    return Response.json({
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
    console.error('Error in fabrary-deck function:', err);
    return Response.json(
      { error: 'Erro ao buscar o deck no Fabrary: ' + (err.message || 'Erro interno') },
      { status: 500 }
    );
  }
};

export const config = {
  path: '/api/fabrary/deck',
};
