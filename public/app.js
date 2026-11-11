/**
 * TCG CotaPool — Frontend Application
 * - Step 1: Import deck & list all cards from Fabrary (with tokens free / $0.00)
 * - Step 2: Filter by Edition Strategy, Language (Língua), Foiling, Set Type & Price Metric
 * - Always quotes the lowest value found across all editions matching the active filter
 * - Includes Compact Thumbnail mode (28x39px) and Visual List Mode (Hide Images)
 * - Includes Multi-Edition Showcase & Inline Comparison for cards with the same name in different editions
 */

const LANGUAGE_META = {
  English: { flag: '🇺🇸', short: 'EN', label: 'Inglês (EN)' },
  Japanese: { flag: '🇯🇵', short: 'JP', label: 'Japonês (JP)' },
  French: { flag: '🇫🇷', short: 'FR', label: 'Francês (FR)' },
  German: { flag: '🇩🇪', short: 'DE', label: 'Alemão (DE)' },
  Italian: { flag: '🇮🇹', short: 'IT', label: 'Italiano (IT)' },
  Spanish: { flag: '🇪🇸', short: 'ES', label: 'Espanhol (ES)' },
  Portuguese: { flag: '🇧🇷', short: 'PT', label: 'Português (PT)' },
  all: { flag: '🌐', short: 'ALL', label: 'Qualquer Idioma' },
};

const state = {
  deck: null,
  items: [], // Normalized deck card items
  hasEvaluatedTcg: false,
  evaluatedAt: null,
  detailsByProductId: {}, // Live TCGPlayer details & language listings keyed by productId
  activeTab: 'all',
  viewMode: 'compactThumb', // 'compactThumb' | 'visualList' (hide images)
  examplesCollapsed: false,
  expandedCardDrawers: new Set(), // Item IDs with open inline multi-edition drawer
  closedVersionPanels: new Set(), // Item IDs whose per-copy version box was closed/collapsed
  searchQuery: '',
  sortOrder: 'section',
  filters: {
    editionStrategy: 'cheapest', // 'cheapest' | 'deckDefault' | 'mostExpensive'
    language: 'English', // 'English' | 'all' | 'Japanese' | 'French' | 'German' | 'Italian' | 'Spanish' | 'Portuguese'
    foiling: 'all', // 'all' | 'Normal' | 'Rainbow' | 'Cold'
    setType: 'all', // 'all' | 'noPromos' | 'firstAlpha' | 'unlimitedRegular'
    priceMetric: 'lowestAvailable', // 'lowestAvailable' | 'printPrice' | 'marketPrice' | 'lowestWithShipping'
    freeGameTokens: true,
    freeRarityTokens: true,
    includedSections: new Set(['main', 'arena', 'inventory', 'hero']),
  },
};

// DOM Elements
const els = {
  deckForm: document.getElementById('deckForm'),
  deckUrlInput: document.getElementById('deckUrlInput'),
  clearInputBtn: document.getElementById('clearInputBtn'),
  fetchDeckBtn: document.getElementById('fetchDeckBtn'),
  fetchSpinner: document.getElementById('fetchSpinner'),
  fetchBtnText: document.getElementById('fetchBtnText'),
  errorBanner: document.getElementById('errorBanner'),

  deckOverviewSection: document.getElementById('deckOverviewSection'),
  deckHeroBanner: document.getElementById('deckHeroBanner'),
  deckHeroThumb: document.getElementById('deckHeroThumb'),
  deckFormatBadge: document.getElementById('deckFormatBadge'),
  deckFabraryLink: document.getElementById('deckFabraryLink'),
  deckNameTitle: document.getElementById('deckNameTitle'),
  deckHeroSubtitle: document.getElementById('deckHeroSubtitle'),
  statUniqueCards: document.getElementById('statUniqueCards'),
  statTotalCopies: document.getElementById('statTotalCopies'),
  statTokenCount: document.getElementById('statTokenCount'),

  step2FiltersSection: document.getElementById('step2FiltersSection'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  evaluateTcgBtn: document.getElementById('evaluateTcgBtn'),
  evalSpinner: document.getElementById('evalSpinner'),
  evalBtnText: document.getElementById('evalBtnText'),
  inlineEvaluateBtn: document.getElementById('inlineEvaluateBtn'),

  filterEditionStrategy: document.getElementById('filterEditionStrategy'),
  filterLanguage: document.getElementById('filterLanguage'),
  filterFoiling: document.getElementById('filterFoiling'),
  filterSetType: document.getElementById('filterSetType'),
  filterPriceMetric: document.getElementById('filterPriceMetric'),
  toggleFreeGameTokens: document.getElementById('toggleFreeGameTokens'),
  toggleFreeRarityTokens: document.getElementById('toggleFreeRarityTokens'),
  sectionToggles: document.querySelectorAll('.section-toggle'),

  multiEditionExamplesSection: document.getElementById('multiEditionExamplesSection'),
  multiEditionExamplesGrid: document.getElementById('multiEditionExamplesGrid'),
  toggleExamplesBodyBtn: document.getElementById('toggleExamplesBodyBtn'),

  quoteSummarySection: document.getElementById('quoteSummarySection'),
  quoteTimestampTag: document.getElementById('quoteTimestampTag'),
  exportExcelBtn: document.getElementById('exportExcelBtn'),
  toolbarExportExcelBtn: document.getElementById('toolbarExportExcelBtn'),
  tcgMassEntryBtn: document.getElementById('tcgMassEntryBtn'),
  copyQuoteBtn: document.getElementById('copyQuoteBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  activeMetricLabel: document.getElementById('activeMetricLabel'),
  summaryTotalSelected: document.getElementById('summaryTotalSelected'),
  summaryCardsChargedSub: document.getElementById('summaryCardsChargedSub'),
  summaryTotalSavings: document.getElementById('summaryTotalSavings'),
  summarySavingsSub: document.getElementById('summarySavingsSub'),
  summaryTotalMarket: document.getElementById('summaryTotalMarket'),
  brkMain: document.getElementById('brkMain'),
  brkArena: document.getElementById('brkArena'),
  brkInventory: document.getElementById('brkInventory'),
  brkHero: document.getElementById('brkHero'),

  cardsListSection: document.getElementById('cardsListSection'),
  cardsTable: document.getElementById('cardsTable'),
  btnViewCompactThumb: document.getElementById('btnViewCompactThumb'),
  btnViewVisualList: document.getElementById('btnViewVisualList'),
  categoryTabs: document.getElementById('categoryTabs'),
  tabCountAll: document.getElementById('tabCountAll'),
  tabCountArena: document.getElementById('tabCountArena'),
  tabCountMain: document.getElementById('tabCountMain'),
  tabCountInventory: document.getElementById('tabCountInventory'),
  tabCountTokens: document.getElementById('tabCountTokens'),
  tabCountHero: document.getElementById('tabCountHero'),
  cardSearchInput: document.getElementById('cardSearchInput'),
  sortOrderSelect: document.getElementById('sortOrderSelect'),
  preEvaluationNotice: document.getElementById('preEvaluationNotice'),
  cardsTableBody: document.getElementById('cardsTableBody'),

  cardHoverPreview: document.getElementById('cardHoverPreview'),
  cardHoverImg: document.getElementById('cardHoverImg'),
  cardHoverCaption: document.getElementById('cardHoverCaption'),
  toastNotification: document.getElementById('toastNotification'),
};

const PROMO_SET_KEYWORDS = [
  'promo',
  'gem',
  'armory',
  'judge',
  'worlds',
  'pro tour',
  'calling',
  'battle hardened',
  'national',
  'convention',
  'prize',
  'slingshot',
];

/**
 * Formats a number as USD ($0.00).
 */
function formatUsd(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Displays a temporary toast message.
 */
let toastTimeout = null;
function showToast(message) {
  if (!els.toastNotification) return;
  els.toastNotification.textContent = message;
  els.toastNotification.hidden = false;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.toastNotification.hidden = true;
  }, 3400);
}

/**
 * Shows or hides the error banner in Step 1.
 */
function showError(message) {
  if (!message) {
    els.errorBanner.hidden = true;
    els.errorBanner.textContent = '';
    return;
  }
  els.errorBanner.textContent = message;
  els.errorBanner.hidden = false;
}

/**
 * Returns language badge info for the given language string.
 */
function getLanguageInfo(lang) {
  return LANGUAGE_META[lang] || { flag: '🌐', short: (lang || 'EN').slice(0, 2).toUpperCase(), label: lang || 'English' };
}

/**
 * Checks whether a printing matches the currently selected Foiling, Set Type & Language filters.
 */
function doesPrintingMatchFilters(printing, filters) {
  if (!printing) return false;

  // 1. Foiling check
  if (filters.foiling !== 'all') {
    const f = (printing.foiling || 'Normal').toLowerCase();
    if (filters.foiling === 'Normal' && f !== 'normal') return false;
    if (filters.foiling === 'Rainbow' && !f.includes('rainbow')) return false;
    if (filters.foiling === 'Cold' && !f.includes('cold')) return false;
  }

  // 2. Set / Edition check
  if (filters.setType !== 'all') {
    const setLower = (printing.set || '').toLowerCase();
    const editionLower = (printing.edition || '').toLowerCase();
    const printLower = (printing.print || '').toLowerCase();

    const isPromo =
      PROMO_SET_KEYWORDS.some((kw) => setLower.includes(kw)) ||
      editionLower.includes('promo') ||
      printLower.startsWith('gem') ||
      printLower.startsWith('fab') ||
      printLower.startsWith('jdg') ||
      printLower.startsWith('lgs');

    if (filters.setType === 'noPromos' && isPromo) {
      return false;
    }
    if (filters.setType === 'firstAlpha') {
      const isFirstOrAlpha =
        editionLower.includes('first') ||
        editionLower.includes('alpha') ||
        printLower.includes('-1st') ||
        printLower.includes('alpha') ||
        printLower.includes('first');
      if (!isFirstOrAlpha) return false;
    }
    if (filters.setType === 'unlimitedRegular') {
      const isUnlOrRegular =
        !isPromo &&
        !editionLower.includes('first') &&
        !editionLower.includes('alpha');
      if (!isUnlOrRegular) return false;
    }
  }

  // 3. Language check
  if (filters.language && filters.language !== 'all' && filters.language !== 'English') {
    const pid = printing.tcgplayer?.productId;
    const live = pid ? state.detailsByProductId[String(pid)] : null;
    const liveLangs = live?.listingsSummary?.availableLanguages?.map((l) => l.language) || [];
    const supported = printing.supportedLanguages || ['English'];
    if (!liveLangs.includes(filters.language) && !supported.includes(filters.language)) {
      return false;
    }
  }

  return true;
}

/**
 * Computes the effective unit price of a specific printing under the active filters & live TCGPlayer data.
 * Takes into account printing variant (Normal vs Rainbow vs 1st/Unl) and selected Language!
 */
function getPrintingEffectivePrice(printing, filters = state.filters) {
  if (!printing) return null;
  const tcg = printing.tcgplayer;
  const basePrintPrice = typeof tcg?.price === 'number' && tcg.price > 0 ? tcg.price : null;
  const pid = tcg?.productId ? String(tcg.productId) : null;
  const live = pid ? state.detailsByProductId[pid] || null : null;

  if (!live) {
    return basePrintPrice;
  }

  const summary = live.listingsSummary;
  const tcgPrintingKey = printing.tcgPrinting || 'Normal';
  const variantListing = summary?.cheapestByPrinting?.[tcgPrintingKey] || null;
  const overallListing = summary?.overallCheapest || null;

  // Exact live listing price for this specific printing & language
  const liveVariantPrice = variantListing?.price ?? null;
  const liveVariantWithShipping = variantListing?.totalWithShipping ?? null;

  const metric = filters.priceMetric;

  if (metric === 'printPrice') {
    return basePrintPrice ?? liveVariantPrice ?? live.lowestPrice ?? live.marketPrice;
  }

  if (metric === 'marketPrice') {
    // Only use product-wide marketPrice if it's close to the printing or there's only 1 printing on that productId
    return basePrintPrice ?? live.marketPrice ?? liveVariantPrice;
  }

  if (metric === 'lowestWithShipping') {
    if (typeof liveVariantWithShipping === 'number') return liveVariantWithShipping;
    if (typeof basePrintPrice === 'number') return basePrintPrice;
    return live.lowestPriceWithShipping ?? live.lowestPrice ?? null;
  }

  // Default: 'lowestAvailable' — ALWAYS pick the lowest verified value for this printing & language
  const candidates = [];
  if (typeof basePrintPrice === 'number' && basePrintPrice > 0) {
    candidates.push(basePrintPrice);
  }
  if (typeof liveVariantPrice === 'number' && liveVariantPrice > 0) {
    candidates.push(liveVariantPrice);
  } else if (
    summary?.availablePrintings?.length === 1 &&
    typeof overallListing?.price === 'number' &&
    overallListing.price > 0
  ) {
    candidates.push(overallListing.price);
  }

  if (candidates.length === 0) {
    return live.lowestPrice ?? live.marketPrice ?? null;
  }

  return Math.min(...candidates);
}

/**
 * Selects the best printing for a card item given current filters.
 * By default ('cheapest'), ALWAYS selects the printing with the lowest price found for that card's filter!
 */
function pickBestPrintingForItem(item, filters) {
  const allPrintings = item.printings || [];
  if (allPrintings.length === 0) return null;

  // Filter matching printings by Foiling, Set Type, and Language
  let candidates = allPrintings.filter((p) => doesPrintingMatchFilters(p, filters));

  // Fallback to all printings if strict filter matched 0 printings for this card
  const usedFallback = candidates.length === 0;
  if (usedFallback) {
    candidates = [...allPrintings];
  }

  // Decorate candidates with their effective price for the active filter
  const scored = candidates.map((printing) => ({
    printing,
    effectivePrice: getPrintingEffectivePrice(printing, filters),
  }));

  const priced = scored.filter(
    (s) => typeof s.effectivePrice === 'number' && s.effectivePrice > 0
  );

  // Calculate min & max price across matching editions of this card for comparison
  let minFilterPrice = null;
  let maxFilterPrice = null;
  if (priced.length > 0) {
    const vals = priced.map((p) => p.effectivePrice);
    minFilterPrice = Math.min(...vals);
    maxFilterPrice = Math.max(...vals);
  }

  // 1. Deck Default strategy (if explicitly chosen and override exists)
  if (filters.editionStrategy === 'deckDefault' && item.printOverride) {
    const exactMatch = scored.find((s) => s.printing.print === item.printOverride);
    if (exactMatch) {
      return {
        printing: exactMatch.printing,
        usedFallback,
        matchingCount: candidates.length,
        minFilterPrice,
        maxFilterPrice,
      };
    }
  }

  if (priced.length > 0) {
    if (filters.editionStrategy === 'mostExpensive') {
      priced.sort((a, b) => b.effectivePrice - a.effectivePrice);
      return {
        printing: priced[0].printing,
        usedFallback,
        matchingCount: candidates.length,
        minFilterPrice,
        maxFilterPrice,
      };
    }

    // Default / 'cheapest': ALWAYS pick the lowest price found for this card's filter!
    priced.sort((a, b) => a.effectivePrice - b.effectivePrice);
    return {
      printing: priced[0].printing,
      usedFallback,
      matchingCount: candidates.length,
      minFilterPrice,
      maxFilterPrice,
    };
  }

  return {
    printing: candidates[0],
    usedFallback,
    matchingCount: candidates.length,
    minFilterPrice,
    maxFilterPrice,
  };
}

/**
 * Applies active filters to all items that don't have a manual override.
 */
function applyFiltersToAllItems(clearManualOverrides = false) {
  for (const item of state.items) {
    if (clearManualOverrides) {
      item.manualPrintKey = null;
      item.versionSplits = null;
    }

    // Update inclusion based on section checkboxes unless user manually toggled the row checkbox
    if (!item.manualCheckOverride) {
      if (item.section === 'tokens' || item.isGameToken) {
        item.included = true; // Tokens are listed and free ($0.00)
      } else {
        item.included = state.filters.includedSections.has(item.section);
      }
    }

    const picked = pickBestPrintingForItem(item, state.filters);
    item.matchingEditionsCount = picked ? picked.matchingCount : item.printings.length;
    item.minFilterPrice = picked ? picked.minFilterPrice : item.editionStats?.minPrice;
    item.maxFilterPrice = picked ? picked.maxFilterPrice : item.editionStats?.maxPrice;

    if (item.manualPrintKey) {
      const found = item.printings.find((p) => p.print === item.manualPrintKey);
      if (found) {
        item.selectedPrinting = found;
        item.usedFilterFallback = false;
        continue;
      }
    }

    item.selectedPrinting = picked ? picked.printing : item.printings[0] || null;
    item.usedFilterFallback = picked ? picked.usedFallback : false;
  }
}

/**
 * Picks the cheapest printing of a card matching a requested foil category ('Normal' | 'Foil' | 'Cold').
 */
function pickCheapestPrintingByFoilCategory(item, category = 'Normal') {
  const all = item.printings || [];
  if (all.length === 0) return null;

  let pool = [];
  if (category === 'Normal') {
    pool = all.filter((p) => (p.foiling || 'Normal') === 'Normal');
  } else if (category === 'Cold') {
    pool = all.filter((p) => (p.foiling || '').includes('Cold'));
    if (pool.length === 0) {
      pool = all.filter((p) => (p.foiling || 'Normal') !== 'Normal');
    }
  } else {
    // 'Foil': prefer Rainbow Foil or any non-Normal foil
    pool = all.filter((p) => (p.foiling || 'Normal') !== 'Normal');
  }

  if (pool.length === 0) {
    pool = [...all];
  }

  // Sort by effective price ascending (cheapest first)
  pool.sort((a, b) => {
    const pa = getPrintingEffectivePrice(a, state.filters) ?? Infinity;
    const pb = getPrintingEffectivePrice(b, state.filters) ?? Infinity;
    return pa - pb;
  });

  return pool[0] || all[0] || null;
}

/**
 * Returns display metadata for a version/foiling tag.
 */
function getFoilingBadgeMeta(foilingOrTag) {
  const str = String(foilingOrTag || 'Normal');
  if (str.includes('Cold')) {
    return {
      category: 'Cold',
      shortLabel: '❄️ Cold Foil',
      compactLabel: 'Cold Foil',
      cssClass: 'foil-cold',
      qtyTagClass: 'qty-sub-foil',
    };
  }
  if (str.includes('Rainbow') || str.includes('Gold') || str === 'Foil') {
    return {
      category: 'Foil',
      shortLabel: str.includes('Gold') ? '✨ Gold Foil' : '🌈 Foil (RF)',
      compactLabel: 'Foil',
      cssClass: str.includes('Gold') ? 'foil-gold' : 'foil-rainbow',
      qtyTagClass: 'qty-sub-foil',
    };
  }
  return {
    category: 'Normal',
    shortLabel: '⚪ Normal',
    compactLabel: 'Normal',
    cssClass: 'foil-normal',
    qtyTagClass: 'qty-sub-normal',
  };
}

/**
 * Initializes each individual copy as its own separate line when differentiating versions
 * (e.g., 3 copies -> Cópia 1 [1x] + Cópia 2 [1x] + Cópia 3 [1x]).
 */
function applyVersionSplitPreset(item, preset = 'auto') {
  if (!item) return;

  const totalQty = Math.max(1, item.quantity || 1);
  const currentPrinting = item.selectedPrinting || item.printings[0];
  const splits = [];

  for (let i = 0; i < totalQty; i++) {
    splits.push({
      id: `${item.id}-copy-${i + 1}`,
      copyNum: i + 1,
      qty: 1,
      printKey: currentPrinting?.print || '',
      versionTag: currentPrinting?.foiling || 'Normal',
    });
  }

  item.versionSplits = splits;
  item.quantity = totalQty;
}

/**
 * Determines whether a card item is free ($0.00) due to the Token rules.
 */
function isItemFreeToken(item) {
  if (!item) return { isFree: false, reason: null };

  // Rule 1: Game token / Extras section
  if (state.filters.freeGameTokens && (item.isGameToken || item.section === 'tokens')) {
    return { isFree: true, reason: 'Token de Jogo (Grátis)' };
  }

  // Rule 2: Token Rarity card or printing (e.g., Iris of Reality, Token weapons/heroes)
  if (state.filters.freeRarityTokens) {
    const selectedRarity = item.selectedPrinting?.rarity || item.rarity;
    if (item.hasTokenRarity || selectedRarity === 'Token') {
      return { isFree: true, reason: 'Raridade Token (Grátis)' };
    }
  }

  return { isFree: false, reason: null };
}

/**
 * Builds a language-aware TCGPlayer URL for the selected printing.
 */
function buildLanguageAwareTcgUrl(item, selectedPrinting, activeLang) {
  const tcg = selectedPrinting?.tcgplayer;
  const pid = tcg?.productId;
  const langParam = activeLang && activeLang !== 'all' ? activeLang : (tcg?.language || 'English');
  const printingParam = selectedPrinting?.tcgPrinting || 'Normal';

  if (pid) {
    const params = new URLSearchParams();
    params.set('Language', langParam);
    if (printingParam) params.set('Printing', printingParam);
    return `https://www.tcgplayer.com/product/${encodeURIComponent(pid)}?${params.toString()}`;
  }

  if (tcg?.url) return tcg.url;
  return `https://www.tcgplayer.com/search/flesh-and-blood-tcg/product?q=${encodeURIComponent(item.name)}`;
}

/**
 * Computes unit price, live metrics, language availability, per-copy version splits, and subtotal for a single card item.
 */
function computeItemPricing(item) {
  const tokenCheck = isItemFreeToken(item);
  const selectedPrinting = item.selectedPrinting;
  const tcgPrint = selectedPrinting?.tcgplayer || null;
  const productId = tcgPrint?.productId ? String(tcgPrint.productId) : null;
  const liveDetails = productId ? state.detailsByProductId[productId] || null : null;
  const listingsSummary = liveDetails?.listingsSummary || null;

  const tcgPrintingKey = selectedPrinting?.tcgPrinting || 'Normal';
  const variantListing = listingsSummary?.cheapestByPrinting?.[tcgPrintingKey] || null;

  const printPrice = typeof tcgPrint?.price === 'number' ? tcgPrint.price : null;
  const effectiveUnitPrice = getPrintingEffectivePrice(selectedPrinting, state.filters);
  const marketPrice =
    typeof liveDetails?.marketPrice === 'number' ? liveDetails.marketPrice : printPrice;
  const lowestPrice =
    typeof variantListing?.price === 'number'
      ? variantListing.price
      : typeof effectiveUnitPrice === 'number'
        ? effectiveUnitPrice
        : printPrice;

  // Determine active language label & whether requested language has live listings
  const requestedLang = state.filters.language || 'English';
  let resolvedLanguage =
    variantListing?.language ||
    listingsSummary?.overallCheapest?.language ||
    (requestedLang === 'all' ? 'English' : requestedLang);

  const availableLanguages =
    listingsSummary?.availableLanguages?.map((l) => l.language) ||
    selectedPrinting?.supportedLanguages ||
    ['English'];

  const tcgUrl = buildLanguageAwareTcgUrl(item, selectedPrinting, resolvedLanguage);

  const hasVersionSplits = Array.isArray(item.versionSplits) && item.versionSplits.length > 0;
  let resolvedSplits = [];

  if (hasVersionSplits) {
    resolvedSplits = item.versionSplits.map((sp, idx) => {
      const spPrinting =
        item.printings.find((p) => p.print === sp.printKey) ||
        selectedPrinting ||
        item.printings[0] ||
        null;
      const spUnit = tokenCheck.isFree
        ? 0
        : (getPrintingEffectivePrice(spPrinting, state.filters) ?? 0);
      const spQty = Math.max(0, Number(sp.qty) || 0);
      const spSub = tokenCheck.isFree || !item.included ? 0 : spUnit * spQty;
      const rawFoil = sp.versionTag || spPrinting?.foiling || 'Normal';
      const badgeMeta = getFoilingBadgeMeta(rawFoil);
      const spUrl = buildLanguageAwareTcgUrl(item, spPrinting, resolvedLanguage);

      return {
        id: sp.id || `${item.id}-sp-${idx}`,
        idx,
        qty: spQty,
        printKey: spPrinting?.print || sp.printKey || '',
        printing: spPrinting,
        versionTag: rawFoil,
        badgeMeta,
        unitPrice: spUnit,
        subtotal: spSub,
        tcgUrl: spUrl,
      };
    });
  } else {
    const rawFoil = selectedPrinting?.foiling || 'Normal';
    const badgeMeta = getFoilingBadgeMeta(rawFoil);
    const validU = tokenCheck.isFree
      ? 0
      : typeof effectiveUnitPrice === 'number'
        ? effectiveUnitPrice
        : 0;
    resolvedSplits = [
      {
        id: `${item.id}-default`,
        idx: 0,
        qty: item.quantity,
        printKey: selectedPrinting?.print || '',
        printing: selectedPrinting,
        versionTag: rawFoil,
        badgeMeta,
        unitPrice: validU,
        subtotal: tokenCheck.isFree || !item.included ? 0 : validU * item.quantity,
        tcgUrl,
      },
    ];
  }

  if (tokenCheck.isFree) {
    return {
      isFreeToken: true,
      freeReason: tokenCheck.reason,
      hasVersionSplits,
      splits: resolvedSplits,
      unitPrice: 0,
      subtotal: 0,
      printPrice,
      marketPrice,
      lowestPrice,
      liveDetails,
      variantListing,
      resolvedLanguage,
      availableLanguages,
      tcgUrl,
    };
  }

  const totalSplitSubtotal = resolvedSplits.reduce((acc, s) => acc + s.subtotal, 0);
  const validUnit = hasVersionSplits
    ? resolvedSplits.length > 0
      ? Math.min(...resolvedSplits.map((s) => s.unitPrice))
      : 0
    : typeof effectiveUnitPrice === 'number'
      ? effectiveUnitPrice
      : 0;
  const subtotal = item.included ? totalSplitSubtotal : 0;

  return {
    isFreeToken: false,
    freeReason: null,
    hasVersionSplits,
    splits: resolvedSplits,
    unitPrice: hasVersionSplits ? validUnit : effectiveUnitPrice,
    subtotal,
    printPrice,
    marketPrice,
    lowestPrice,
    liveDetails,
    variantListing,
    resolvedLanguage,
    availableLanguages,
    tcgUrl,
  };
}

/**
 * Formats a printing option label for the per-card <select> dropdown.
 */
function formatPrintingOptionLabel(p, isLowestInFilter = false) {
  const foilingShort =
    p.foiling === 'Rainbow'
      ? '🌈 RF'
      : p.foiling === 'Cold'
        ? '❄️ CF'
        : p.foiling === 'Gold'
          ? '✨ GF'
          : 'Normal';
  const editionTag = p.edition ? ` (${p.edition})` : '';
  const rarityTag = p.rarity === 'Token' ? ' [Token]' : '';
  const effPrice = getPrintingEffectivePrice(p, state.filters);
  const priceStr = typeof effPrice === 'number' ? formatUsd(effPrice) : 'S/ Preço';
  const star = isLowestInFilter ? '★ MENOR: ' : '';
  return `${star}${priceStr} — ${p.print} • ${p.set}${editionTag} (${foilingShort})${rarityTag}`;
}

/**
 * Renders the Multi-Edition Examples Panel showing cards with the same name in different editions.
 */
function renderMultiEditionExamples() {
  if (els.multiEditionExamplesSection) {
    els.multiEditionExamplesSection.hidden = true;
  }
}

/**
 * Updates the Deck Header Banner & tab counters.
 */
function renderDeckHeaderAndCounts() {
  if (!state.deck) return;

  els.deckOverviewSection.hidden = false;
  els.step2FiltersSection.hidden = false;
  els.cardsListSection.hidden = false;

  if (state.deck.heroBanner) {
    els.deckHeroBanner.style.backgroundImage = `url('${state.deck.heroBanner}')`;
  } else {
    els.deckHeroBanner.style.backgroundImage = 'none';
  }

  if (state.deck.heroCardImage) {
    els.deckHeroThumb.src = state.deck.heroCardImage;
    els.deckHeroThumb.alt = state.deck.heroName || 'Hero';
  }

  els.deckFormatBadge.textContent = state.deck.format || 'Flesh and Blood';
  els.deckFabraryLink.href = state.deck.url || '#';
  els.deckNameTitle.textContent = state.deck.name || 'Deck Importado';
  els.deckHeroSubtitle.textContent = state.deck.heroName
    ? `Herói: ${state.deck.heroName} • ID: ${state.deck.deckId}`
    : `ID: ${state.deck.deckId}`;

  // Counts
  let totalCopies = 0;
  let tokenCount = 0;
  const tabCounts = {
    all: 0,
    arena: 0,
    main: 0,
    inventory: 0,
    tokens: 0,
    hero: 0,
  };

  for (const item of state.items) {
    totalCopies += item.quantity;
    tabCounts.all += item.quantity;
    if (tabCounts[item.section] !== undefined) {
      tabCounts[item.section] += item.quantity;
    }

    const tokenCheck = isItemFreeToken(item);
    if (tokenCheck.isFree) {
      tokenCount += item.quantity;
    }
  }

  els.statUniqueCards.textContent = String(state.items.length);
  els.statTotalCopies.textContent = String(totalCopies);
  els.statTokenCount.textContent = String(tokenCount);

  els.tabCountAll.textContent = String(tabCounts.all);
  els.tabCountArena.textContent = String(tabCounts.arena);
  els.tabCountMain.textContent = String(tabCounts.main);
  els.tabCountInventory.textContent = String(tabCounts.inventory);
  els.tabCountTokens.textContent = String(tabCounts.tokens);
  els.tabCountHero.textContent = String(tabCounts.hero);
}

/**
 * Renders the cards table according to active tab, viewMode (thumbnails vs visual list), search query, and sort order.
 */
function renderCardsTable() {
  els.preEvaluationNotice.hidden = state.hasEvaluatedTcg;

  // Toggle visual-list-mode class on table when images are hidden
  if (state.viewMode === 'visualList') {
    els.cardsTable.classList.add('visual-list-mode');
    els.cardHoverPreview.hidden = true;
  } else {
    els.cardsTable.classList.remove('visual-list-mode');
  }

  // Filter items by active tab & search query
  const query = state.searchQuery.trim().toLowerCase();
  const filteredItems = state.items.filter((item) => {
    if (state.activeTab !== 'all') {
      if (state.activeTab === 'tokens') {
        const isTok = isItemFreeToken(item).isFree || item.section === 'tokens';
        if (!isTok) return false;
      } else if (item.section !== state.activeTab) {
        return false;
      }
    }

    if (query) {
      const nameMatch = item.name.toLowerCase().includes(query);
      const idMatch = item.cardIdentifier.toLowerCase().includes(query);
      const setMatch = item.printings.some(
        (p) =>
          (p.set || '').toLowerCase().includes(query) ||
          (p.print || '').toLowerCase().includes(query)
      );
      if (!nameMatch && !idMatch && !setMatch) return false;
    }

    return true;
  });

  // Sort items
  const sectionOrder = { hero: 1, arena: 2, main: 3, inventory: 4, tokens: 5, maybe: 6 };
  filteredItems.sort((a, b) => {
    if (state.sortOrder === 'nameAsc') {
      return a.name.localeCompare(b.name);
    }
    if (state.sortOrder === 'editionsDesc') {
      return b.printings.length - a.printings.length || a.name.localeCompare(b.name);
    }
    if (state.sortOrder === 'pitchAsc') {
      const pa = a.pitch ?? 99;
      const pb = b.pitch ?? 99;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    }
    if (state.sortOrder === 'priceDesc' || state.sortOrder === 'priceAsc') {
      const priceA = computeItemPricing(a);
      const priceB = computeItemPricing(b);
      const valA =
        state.sortOrder === 'priceDesc' ? priceA.subtotal : (priceA.unitPrice ?? Infinity);
      const valB =
        state.sortOrder === 'priceDesc' ? priceB.subtotal : (priceB.unitPrice ?? Infinity);
      return state.sortOrder === 'priceDesc' ? valB - valA : valA - valB;
    }
    // Default: section order then pitch then name
    const secDiff = (sectionOrder[a.section] || 99) - (sectionOrder[b.section] || 99);
    if (secDiff !== 0) return secDiff;
    const pa = a.pitch ?? 99;
    const pb = b.pitch ?? 99;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  els.cardsTableBody.innerHTML = '';

  if (filteredItems.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="9" style="text-align:center; padding: 26px; color: var(--text-muted);">
        Nenhuma carta encontrada para este filtro/aba.
      </td>
    `;
    els.cardsTableBody.appendChild(emptyRow);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of filteredItems) {
    const pricing = computeItemPricing(item);
    const tr = document.createElement('tr');
    if (!item.included) tr.classList.add('row-excluded');
    if (pricing.isFreeToken) tr.classList.add('row-token-free');

    const activeImg = item.selectedPrinting?.image || item.defaultImage || '';
    const pitchNum = item.pitch === 1 || item.pitch === 2 || item.pitch === 3 ? item.pitch : 0;
    const pitchLabels = { 1: 'Red • P1', 2: 'Yellow • P2', 3: 'Blue • P3' };
    const pitchPillHtml = pitchNum
      ? `<span class="pitch-label-pill pitch-pill-${pitchNum}">${pitchLabels[pitchNum]}</span>`
      : '';

    const typeSub = [...(item.types || []), ...(item.subtypes || [])].slice(0, 3).join(' • ');
    const selectedRarity = item.selectedPrinting?.rarity || item.rarity || 'Common';
    const rarityBadge =
      selectedRarity === 'Token'
        ? `<span class="section-pill section-tokens">Token</span>`
        : `<span class="live-meta-item">[${escapeHtml(selectedRarity)}]</span>`;

    // Find lowest printing in active filter to mark with ★
    const cheapestInFilter = pickBestPrintingForItem(item, {
      ...state.filters,
      editionStrategy: 'cheapest',
    })?.printing;

    // Sort dropdown options by effective price ascending so cheapest is always first
    const sortedPrintings = [...item.printings].sort((a, b) => {
      const pa = getPrintingEffectivePrice(a, state.filters) ?? Infinity;
      const pb = getPrintingEffectivePrice(b, state.filters) ?? Infinity;
      return pa - pb;
    });

    const optionsHtml = sortedPrintings
      .map((p) => {
        const isSelected = item.selectedPrinting?.print === p.print ? 'selected' : '';
        const isCheapest = cheapestInFilter?.print === p.print;
        return `<option value="${escapeHtml(p.print)}" ${isSelected}>${escapeHtml(
          formatPrintingOptionLabel(p, isCheapest)
        )}</option>`;
      })
      .join('');

    // Foiling & Language badges under select
    const foilingVal = item.selectedPrinting?.foiling || 'Normal';
    const foilingClass = foilingVal.includes('Rainbow')
      ? 'foil-rainbow'
      : foilingVal.includes('Cold')
        ? 'foil-cold'
        : foilingVal.includes('Gold')
          ? 'foil-gold'
          : 'foil-normal';

    const langInfo = getLanguageInfo(pricing.resolvedLanguage);
    const isAutoCheapest =
      !item.manualPrintKey &&
      state.filters.editionStrategy === 'cheapest' &&
      cheapestInFilter?.print === item.selectedPrinting?.print;

    const hasMultipleEditions = item.printings.length > 1;
    const isDrawerOpen = state.expandedCardDrawers.has(item.id);

    // Unit Price cell HTML (already visible from Fabrary TCGPlayer data, and refined on Step 2 live evaluation)
    let unitPriceHtml = '';
    if (pricing.isFreeToken) {
      unitPriceHtml = `
        <span class="unit-price-val price-free-token">$0.00</span>
        <div class="live-meta-item" style="color: var(--emerald)">${escapeHtml(pricing.freeReason)}</div>
      `;
    } else if (pricing.hasVersionSplits) {
      unitPriceHtml = `
        <div class="unit-split-list">
          ${pricing.splits
            .map(
              (sp) => `
            <div class="unit-split-item">
              <span class="live-meta-item"><strong>${sp.qty}x</strong> ${escapeHtml(sp.badgeMeta.compactLabel)}:</span>
              <strong style="color:#fff;">${formatUsd(sp.unitPrice)}</strong>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else if (typeof pricing.unitPrice === 'number') {
      unitPriceHtml = `
        <span class="unit-price-val">${formatUsd(pricing.unitPrice)}</span>
        <div class="live-meta-item" style="color: var(--emerald)">
          ${state.hasEvaluatedTcg ? '✓ Menor no TCGPlayer' : 'Menor pré-cotado'}
        </div>
      `;
    } else {
      unitPriceHtml = `<span class="price-pending">Indisponível</span>`;
    }

    // Edition Comparison & Live TCGPlayer Details cell HTML
    let liveDetailsHtml = '';
    if (pricing.isFreeToken) {
      liveDetailsHtml = `
        <span class="token-free-tag">🎁 Isento de Cobrança</span>
        ${
          typeof pricing.printPrice === 'number'
            ? `<div class="live-meta-item">Ref. TCG: ${formatUsd(pricing.printPrice)} (Ignorado)</div>`
            : ''
        }
      `;
    } else {
      const mkt = typeof pricing.marketPrice === 'number' ? formatUsd(pricing.marketPrice) : '—';
      const minEd =
        typeof item.minFilterPrice === 'number' ? formatUsd(item.minFilterPrice) : '—';
      const maxEd =
        typeof item.maxFilterPrice === 'number' ? formatUsd(item.maxFilterPrice) : '—';

      const rangeText =
        item.printings.length > 1 && item.minFilterPrice !== item.maxFilterPrice
          ? `<span class="edition-range-tag" title="Faixa de preço entre as ${item.printings.length} edições desta carta">
               ${item.printings.length} edições: <strong>${minEd}</strong> até ${maxEd}
             </span>`
          : `<span class="edition-range-tag">Edição única (${minEd})</span>`;

      const liveSellers =
        state.hasEvaluatedTcg && pricing.liveDetails && typeof pricing.liveDetails.listings === 'number'
          ? `<span class="live-meta-item">Ao vivo: <strong>${pricing.liveDetails.listings} listagens</strong> • Market: <strong>${mkt}</strong></span>`
          : `<span class="live-meta-item">Market Ref.: <strong>${mkt}</strong></span>`;

      const langsAvailableStr =
        pricing.availableLanguages.length > 1
          ? `<span class="live-meta-item">Idiomas: ${pricing.availableLanguages
              .map((l) => getLanguageInfo(l).flag)
              .join(' ')}</span>`
          : '';

      liveDetailsHtml = `
        <div class="live-meta-grid">
          ${rangeText}
          ${liveSellers}
          ${langsAvailableStr}
        </div>
      `;
    }

    // Subtotal cell HTML
    let subtotalHtml = '';
    if (pricing.isFreeToken) {
      subtotalHtml = `<span class="subtotal-val price-free-token">$0.00</span>`;
    } else if (!item.included) {
      subtotalHtml = `<span class="price-pending">$0.00 (Excluída)</span>`;
    } else if (pricing.hasVersionSplits) {
      const partsStr = pricing.splits
        .map((sp) => `${sp.qty}x ${formatUsd(sp.unitPrice)}`)
        .join(' + ');
      subtotalHtml = `
        <span class="subtotal-val">${formatUsd(pricing.subtotal)}</span>
        <div class="live-meta-item">${escapeHtml(partsStr)}</div>
      `;
    } else {
      subtotalHtml = `<span class="subtotal-val">${formatUsd(pricing.subtotal)}</span>`;
    }

    // Card copies breakdown right below the card name when differentiated
    const cardCopiesBreakdownHtml = pricing.hasVersionSplits
      ? `
        <div class="card-copies-breakdown">
          <div class="card-copies-title">${escapeHtml(item.name)} — ${item.quantity} ${
            item.quantity === 1 ? 'cópia' : 'cópias'
          }:</div>
          ${pricing.splits
            .map(
              (sp) => `
            <div class="card-copies-line">
              <span class="copy-qty-pill">${sp.qty}x</span>
              <span class="foil-badge ${sp.badgeMeta.cssClass}">${escapeHtml(
                sp.badgeMeta.shortLabel
              )}</span>
              <span class="edition-code-pill">${escapeHtml(sp.printing?.print || 'N/A')}</span>
              <span class="live-meta-item">${escapeHtml(sp.printing?.set || '')} • <strong>${
                pricing.isFreeToken ? '$0.00' : formatUsd(sp.unitPrice)
              }</strong>/un.</span>
              <a
                href="${escapeHtml(sp.tcgUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                class="tcg-link-btn"
                style="padding: 1px 6px; font-size: 0.67rem; margin-left: 4px;"
                title="Abrir esta versão no TCGPlayer.com"
              >
                TCGPlayer ↗
              </a>
            </div>
          `
            )
            .join('')}
        </div>
      `
      : '';

    // Quantity cell HTML
    const qtyCellHtml = pricing.hasVersionSplits
      ? `
        <div class="qty-split-stack">
          <span class="qty-total-badge">${item.quantity} ${
            item.quantity === 1 ? 'cópia' : 'cópias'
          }</span>
          ${pricing.splits
            .map(
              (sp) =>
                `<span class="qty-sub-tag ${sp.badgeMeta.qtyTagClass}">${sp.qty}x ${escapeHtml(
                  sp.badgeMeta.compactLabel
                )}</span>`
            )
            .join('')}
        </div>
      `
      : `
        <input
          type="number"
          min="0"
          max="99"
          value="${item.quantity}"
          class="qty-input"
          data-item-id="${escapeHtml(item.id)}"
          title="Quantidade de cópias"
        />
      `;

    // Edition cell HTML (Unified vs Differentiated per Copy)
    let editionCellHtml = '';
    const isPanelClosed = state.closedVersionPanels.has(item.id);

    if (pricing.hasVersionSplits && isPanelClosed) {
      // Differentiated versions are saved, but panel is closed/minimized
      const summaryBadges = pricing.splits
        .map(
          (sp) =>
            `<span class="qty-sub-tag ${sp.badgeMeta.qtyTagClass}">${sp.qty}x ${escapeHtml(
              sp.badgeMeta.compactLabel
            )} (${escapeHtml(sp.printing?.print || '')})</span>`
        )
        .join(' ');

      editionCellHtml = `
        <div class="edition-select-wrap">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            ${summaryBadges}
          </div>
          <div class="edition-badges-row" style="margin-top: 4px;">
            <button
              type="button"
              class="btn-edit-splits"
              data-reopen-split-item="${escapeHtml(item.id)}"
              title="Abrir painel para alterar versões destas cópias"
            >
              ✏️ Alterar Versões (${item.quantity}x)
            </button>
            <button
              type="button"
              class="btn-version-preset btn-version-unify"
              data-unify-split-item="${escapeHtml(item.id)}"
              title="Voltar todas as cópias para uma única versão"
            >
              ↺ Unificar
            </button>
            ${
              hasMultipleEditions
                ? `<button type="button" class="btn-compare-editions" data-item-id="${escapeHtml(item.id)}">
                     🔍 ${isDrawerOpen ? 'Ocultar' : `Comparar ${item.printings.length} edições`}
                   </button>`
                : ''
            }
          </div>
        </div>
      `;
    } else if (pricing.hasVersionSplits) {
      const splitRowsHtml = pricing.splits
        .map((sp, spIdx) => {
          const spOptionsHtml = sortedPrintings
            .map((p) => {
              const isSelected = sp.printKey === p.print ? 'selected' : '';
              const isCheapest = cheapestInFilter?.print === p.print;
              return `<option value="${escapeHtml(p.print)}" ${isSelected}>${escapeHtml(
                formatPrintingOptionLabel(p, isCheapest)
              )}</option>`;
            })
            .join('');

          const cat = sp.badgeMeta.category;
          const copyLabel = sp.copyNum ? `Cópia ${sp.copyNum}` : `Cópia ${spIdx + 1}`;
          return `
            <div class="version-split-row">
              <div class="version-split-top">
                <span class="copy-qty-pill" style="padding: 2px 7px; font-size: 0.72rem;">${copyLabel}</span>
                <label class="split-qty-wrap" title="Quantidade de cópias nesta versão">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value="${sp.qty}"
                    class="split-qty-input"
                    data-split-item-id="${escapeHtml(item.id)}"
                    data-split-idx="${spIdx}"
                  />
                  <span>x</span>
                </label>
                <div class="split-quick-foil-group" role="group" aria-label="Versão da cópia">
                  <button
                    type="button"
                    class="btn-quick-foil ${cat === 'Normal' ? 'active-normal' : ''}"
                    data-quick-foil-item="${escapeHtml(item.id)}"
                    data-quick-foil-idx="${spIdx}"
                    data-quick-foil-type="Normal"
                    title="Definir esta cópia como Normal (Non-Foil)"
                  >
                    ⚪ Normal
                  </button>
                  <button
                    type="button"
                    class="btn-quick-foil ${cat === 'Foil' ? 'active-foil' : ''}"
                    data-quick-foil-item="${escapeHtml(item.id)}"
                    data-quick-foil-idx="${spIdx}"
                    data-quick-foil-type="Foil"
                    title="Definir esta cópia como Foil (Rainbow Foil)"
                  >
                    🌈 Foil
                  </button>
                  <button
                    type="button"
                    class="btn-quick-foil ${cat === 'Cold' ? 'active-cold' : ''}"
                    data-quick-foil-item="${escapeHtml(item.id)}"
                    data-quick-foil-idx="${spIdx}"
                    data-quick-foil-type="Cold"
                    title="Definir esta cópia como Cold Foil"
                  >
                    ❄️ Cold
                  </button>
                </div>
                <span class="lang-badge">${langInfo.flag} ${langInfo.short}</span>
                <a
                  href="${escapeHtml(sp.tcgUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="tcg-link-btn"
                  style="padding: 2px 7px; font-size: 0.7rem;"
                  title="Conferir anúncio e preço desta cópia no TCGPlayer"
                >
                  TCGPlayer ↗
                </a>
                ${
                  pricing.splits.length > 1
                    ? `<button
                         type="button"
                         class="btn-remove-split"
                         data-remove-split-item="${escapeHtml(item.id)}"
                         data-remove-split-idx="${spIdx}"
                         title="Remover esta cópia"
                       >✕</button>`
                    : ''
                }
              </div>
              <select
                class="split-edition-select"
                data-split-select-item="${escapeHtml(item.id)}"
                data-split-select-idx="${spIdx}"
                title="Escolher coleção/edição específica para esta cópia"
              >
                ${spOptionsHtml}
              </select>
            </div>
          `;
        })
        .join('');

      editionCellHtml = `
        <div class="version-splits-panel">
          <div class="version-splits-toolbar">
            <span class="version-splits-label">🔀 Versões por Cópia (${item.quantity} cópias)</span>
            <div class="version-preset-btns">
              <button
                type="button"
                class="btn-version-preset"
                data-add-split-item="${escapeHtml(item.id)}"
                title="Adicionar mais uma versão diferente para esta carta"
              >
                + Versão
              </button>
              <button
                type="button"
                class="btn-version-preset btn-version-unify"
                data-unify-split-item="${escapeHtml(item.id)}"
                title="Voltar todas as cópias para uma única versão"
              >
                ↺ Unificar
              </button>
              <button
                type="button"
                class="btn-version-preset btn-version-close"
                data-close-split-item="${escapeHtml(item.id)}"
                title="Salvar e fechar esta caixa de seleção"
              >
                ✓ Fechar Caixa
              </button>
            </div>
          </div>
          ${splitRowsHtml}
        </div>
      `;
    } else {
      const splitBtnLabel = '🔀 Diferenciar versões';

      editionCellHtml = `
        <div class="edition-select-wrap">
          <select class="edition-select" data-item-id="${escapeHtml(item.id)}">
            ${optionsHtml}
          </select>
          <div class="edition-badges-row">
            <span class="lang-badge" title="Idioma considerado na cotação">${langInfo.flag} ${langInfo.short}</span>
            <span class="foil-badge ${foilingClass}">${escapeHtml(foilingVal)}</span>
            ${
              isAutoCheapest
                ? `<span class="cheapest-lock-badge" title="Menor valor encontrado para o filtro atual">⚡ Menor Valor</span>`
                : item.manualPrintKey
                  ? `<span class="live-meta-item" style="color: var(--gold)">• Edição manual</span>`
                  : ''
            }
            ${
              hasMultipleEditions && item.quantity > 1
                ? `<button
                     type="button"
                     class="btn-split-versions"
                     data-split-init-id="${escapeHtml(item.id)}"
                     title="Separar as cópias desta carta em versões diferentes"
                   >
                     ${splitBtnLabel}
                   </button>`
                : ''
            }
            ${
              hasMultipleEditions
                ? `<button type="button" class="btn-compare-editions" data-item-id="${escapeHtml(item.id)}">
                     🔍 ${isDrawerOpen ? 'Ocultar' : `Comparar ${item.printings.length} edições`}
                   </button>`
                : ''
            }
          </div>
        </div>
      `;
    }

    // TCGPlayer Link cell HTML
    const linkCellHtml = pricing.hasVersionSplits
      ? `
        <div class="link-split-list">
          ${pricing.splits
            .map(
              (sp) => `
            <a
              href="${escapeHtml(sp.tcgUrl)}"
              target="_blank"
              rel="noopener noreferrer"
              class="tcg-link-btn"
              title="Abrir ${sp.qty}x ${escapeHtml(sp.badgeMeta.compactLabel)} (${escapeHtml(
                sp.printing?.print || ''
              )}) no TCGPlayer.com"
            >
              ${sp.qty}x ${escapeHtml(sp.badgeMeta.compactLabel)} ↗
            </a>
          `
            )
            .join('')}
        </div>
      `
      : `
        <a
          href="${escapeHtml(pricing.tcgUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="tcg-link-btn"
          title="Abrir esta edição e idioma no TCGPlayer.com"
        >
          TCGPlayer ↗
        </a>
      `;

    tr.innerHTML = `
      <td class="col-check">
        <input
          type="checkbox"
          class="row-include-check"
          data-item-id="${escapeHtml(item.id)}"
          ${item.included ? 'checked' : ''}
          title="Incluir ou excluir carta da cotação"
        />
      </td>
      <td class="col-card">
        <div class="card-cell">
          <span class="pitch-stripe pitch-stripe-${pitchNum}" title="Pitch ${pitchNum || 'N/A'}"></span>
          <img
            src="${escapeHtml(activeImg)}"
            alt="${escapeHtml(item.name)}"
            class="card-thumb"
            width="28"
            height="39"
            loading="lazy"
            data-hover-img="${escapeHtml(activeImg)}"
            data-hover-caption="${escapeHtml(item.name)} (${escapeHtml(item.selectedPrinting?.print || '')})"
          />
          <div>
            <div class="card-title-row">
              <span class="card-name">${escapeHtml(item.name)}</span>
              ${pitchPillHtml}
            </div>
            <div class="card-submeta">
              <span>${escapeHtml(typeSub)}</span>
              ${rarityBadge}
            </div>
            ${cardCopiesBreakdownHtml}
          </div>
        </div>
      </td>
      <td class="col-section">
        <span class="section-pill section-${escapeHtml(item.section)}">${escapeHtml(item.sectionLabel)}</span>
      </td>
      <td class="col-qty">
        ${qtyCellHtml}
      </td>
      <td class="col-edition">
        ${editionCellHtml}
      </td>
      <td class="col-unit">${unitPriceHtml}</td>
      <td class="col-subtotal">${subtotalHtml}</td>
      <td class="col-link">
        ${linkCellHtml}
      </td>
    `;

    fragment.appendChild(tr);

    // If inline edition comparison drawer is open for this card, render the comparison row
    if (isDrawerOpen && hasMultipleEditions) {
      const drawerTr = document.createElement('tr');
      drawerTr.className = 'edition-drawer-row';
      const drawerCardsHtml = sortedPrintings
        .map((p) => {
          const effP = getPrintingEffectivePrice(p, state.filters);
          const isCurrent = item.selectedPrinting?.print === p.print;
          const isLowest = cheapestInFilter?.print === p.print;
          const foilShort =
            p.foiling === 'Rainbow' ? '🌈 RF' : p.foiling === 'Cold' ? '❄️ CF' : 'Normal';
          const edStr = p.edition ? ` (${p.edition})` : '';

          return `
            <div
              class="drawer-edition-item ${isCurrent ? 'active-edition' : ''}"
              data-select-item-id="${escapeHtml(item.id)}"
              data-select-print="${escapeHtml(p.print)}"
              title="Clique para selecionar esta edição"
            >
              <div>
                <div>
                  <span class="edition-code-pill">${escapeHtml(p.print)}</span>
                  <strong>${escapeHtml(p.set)}${escapeHtml(edStr)}</strong>
                </div>
                <div class="live-meta-item" style="margin-top:2px;">
                  ${foilShort} • Raridade: ${escapeHtml(p.rarity)} • ${langInfo.flag} ${langInfo.short}
                </div>
              </div>
              <div style="text-align:right;">
                <div class="unit-price-val" style="color: ${isLowest ? '#34d399' : '#fff'}">
                  ${typeof effP === 'number' ? formatUsd(effP) : 'S/ Preço'}
                </div>
                ${
                  isLowest
                    ? `<span class="chosen-cheapest-badge">★ Menor Valor</span>`
                    : isCurrent
                      ? `<span class="chosen-cheapest-badge">Selecionada</span>`
                      : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      drawerTr.innerHTML = `
        <td colspan="8">
          <div class="drawer-inner">
            <div class="drawer-header">
              <span>🔍 Todas as ${item.printings.length} edições encontradas para "${escapeHtml(item.name)}" (Clique em qualquer edição para alternar):</span>
              <span class="live-meta-item">O filtro automático seleciona sempre a edição de menor valor compatível.</span>
            </div>
            <div class="drawer-editions-grid">
              ${drawerCardsHtml}
            </div>
          </div>
        </td>
      `;
      fragment.appendChild(drawerTr);
    }
  }

  els.cardsTableBody.appendChild(fragment);
  bindTableRowEvents();
}

/**
 * Updates the Step 3 TCGPlayer Quote Summary Dashboard and Mass Entry link.
 */
function renderQuoteSummary() {
  if (!state.items || state.items.length === 0) {
    els.quoteSummarySection.hidden = true;
    return;
  }

  // Show Quote Summary Dashboard both when pre-quoted and after live TCGPlayer evaluation
  els.quoteSummarySection.hidden = false;

  const langInfo = getLanguageInfo(state.filters.language);
  const metricLabels = {
    lowestAvailable: `Total Menor Valor (${langInfo.flag} ${langInfo.short})`,
    printPrice: `Total Edição Selecionada (${langInfo.flag} ${langInfo.short})`,
    marketPrice: `Total Market Price (${langInfo.flag} ${langInfo.short})`,
    lowestWithShipping: `Total Menor Preço + Frete (${langInfo.flag} ${langInfo.short})`,
  };
  els.activeMetricLabel.textContent =
    metricLabels[state.filters.priceMetric] || 'Total da Lista (USD)';

  let totalSelected = 0;
  let totalMarket = 0;
  let totalMaxEditionCost = 0;
  let chargedCopiesCount = 0;
  let freeTokenCopiesCount = 0;

  const sectionTotals = {
    main: 0,
    arena: 0,
    inventory: 0,
    hero: 0,
    tokens: 0,
  };

  const massEntryParts = [];

  for (const item of state.items) {
    const pricing = computeItemPricing(item);

    if (pricing.isFreeToken) {
      freeTokenCopiesCount += item.quantity;
      continue;
    }

    if (!item.included || item.quantity <= 0) {
      continue;
    }

    chargedCopiesCount += item.quantity;
    totalSelected += pricing.subtotal;

    const mktUnit = pricing.marketPrice ?? pricing.unitPrice ?? 0;
    totalMarket += mktUnit * item.quantity;

    // Pick the most expensive printing/edition available on TCGPlayer for this card
    const pricedPrintings = (item.printings || [])
      .map((p) => getPrintingEffectivePrice(p, state.filters))
      .filter((pr) => typeof pr === 'number' && pr > 0);

    const maxUnit = pricedPrintings.length > 0
      ? Math.max(...pricedPrintings)
      : (typeof item.maxFilterPrice === 'number' && item.maxFilterPrice > 0
          ? item.maxFilterPrice
          : (pricing.unitPrice ?? 0));

    totalMaxEditionCost += maxUnit * item.quantity;

    if (sectionTotals[item.section] !== undefined) {
      sectionTotals[item.section] += pricing.subtotal;
    }

    // Build TCGPlayer Mass Entry item string (only for non-token charged cards)
    const tcgName = item.selectedPrinting?.tcgplayer?.name || item.name;
    massEntryParts.push(`${item.quantity} ${tcgName}`);
  }

  const diffSavings = Math.max(0, totalMaxEditionCost - totalSelected);

  els.summaryTotalSelected.textContent = formatUsd(totalSelected);
  els.summaryTotalMarket.textContent = formatUsd(totalMarket);
  // Show the total deck cost when using the most expensive editions
  els.summaryTotalSavings.textContent = formatUsd(totalMaxEditionCost);
  els.summarySavingsSub.textContent = `Economia de ${formatUsd(diffSavings)} em relação à cotação mais barata (${formatUsd(totalSelected)})`;
  els.summaryCardsChargedSub.textContent = `${chargedCopiesCount} cópias cobradas • ${freeTokenCopiesCount} tokens grátis ($0.00)`;

  els.brkMain.textContent = formatUsd(sectionTotals.main);
  els.brkArena.textContent = formatUsd(sectionTotals.arena);
  els.brkInventory.textContent = formatUsd(sectionTotals.inventory);
  els.brkHero.textContent = formatUsd(sectionTotals.hero);

  if (state.hasEvaluatedTcg && state.evaluatedAt) {
    const dt = new Date(state.evaluatedAt);
    els.quoteTimestampTag.textContent = `✓ Cotação Ao Vivo TCGPlayer (${langInfo.flag} ${langInfo.label}) atualizada às ${dt.toLocaleTimeString('pt-BR')}`;
  } else {
    els.quoteTimestampTag.textContent = `Pré-cotação pelo Menor Valor (${langInfo.flag} ${langInfo.label}) • Clique em "2. Avaliar Menor Preço no TCGPlayer" para listagens ao vivo`;
  }

  // TCGPlayer Mass Entry link
  if (massEntryParts.length > 0) {
    const encodedList = encodeURIComponent(massEntryParts.join('||'));
    els.tcgMassEntryBtn.href = `https://www.tcgplayer.com/massentry?productline=Flesh%20%26%20Blood%20TCG&c=${encodedList}`;
  } else {
    els.tcgMassEntryBtn.href = 'https://www.tcgplayer.com/';
  }
}

/**
 * Attaches event listeners to dynamically rendered table inputs, drawer toggles, and hover previews.
 */
function bindTableRowEvents() {
  // Include checkbox change
  document.querySelectorAll('.row-include-check').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-item-id');
      const item = state.items.find((i) => i.id === id);
      if (item) {
        item.included = e.target.checked;
        item.manualCheckOverride = true;
        renderCardsTable();
        renderQuoteSummary();
      }
    });
  });

  // Quantity input change
  document.querySelectorAll('.qty-input').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-item-id');
      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
      const item = state.items.find((i) => i.id === id);
      if (item) {
        item.quantity = val;
        renderDeckHeaderAndCounts();
        renderCardsTable();
        renderQuoteSummary();
      }
    });
  });

  // Individual Printing dropdown change
  document.querySelectorAll('.edition-select').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-item-id');
      const printKey = e.target.value;
      await selectSpecificPrintingForItem(id, printKey);
    });
  });

  // Initialize Per-Copy Version Differentiation (e.g., 3 copies -> 2x Foil + 1x Normal)
  document.querySelectorAll('[data-split-init-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-split-init-id');
      const item = state.items.find((i) => i.id === id);
      if (!item) return;
      state.closedVersionPanels.delete(id);
      applyVersionSplitPreset(item, 'auto');
      await ensureLiveTcgForSplits(item);
      renderDeckHeaderAndCounts();
      renderCardsTable();
      renderQuoteSummary();
      showToast(
        `🔀 "${item.name}" diferenciada por cópia (${item.versionSplits
          .map((s) => `${s.qty}x ${getFoilingBadgeMeta(s.versionTag).compactLabel}`)
          .join(' + ')})!`
      );
    });
  });

  // Reopen closed Per-Copy Version Panel to edit versions again
  document.querySelectorAll('[data-reopen-split-item]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-reopen-split-item');
      if (!id) return;
      state.closedVersionPanels.delete(id);
      renderCardsTable();
    });
  });

  // Close / Minimize Per-Copy Version Panel
  document.querySelectorAll('[data-close-split-item]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-close-split-item');
      if (!id) return;
      state.closedVersionPanels.add(id);
      renderCardsTable();
      showToast('✓ Versões salvas e caixa fechada.');
    });
  });

  // Quick Presets inside Per-Copy Version Panel (e.g., 2x Foil + 1x Normal, 1x Foil + 2x Normal)
  document.querySelectorAll('[data-preset-item]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-preset-item');
      const preset = e.currentTarget.getAttribute('data-preset-type');
      const item = state.items.find((i) => i.id === id);
      if (!item) return;
      applyVersionSplitPreset(item, preset);
      await ensureLiveTcgForSplits(item);
      renderDeckHeaderAndCounts();
      renderCardsTable();
      renderQuoteSummary();
    });
  });

  // Add another version row for the same card
  document.querySelectorAll('[data-add-split-item]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-add-split-item');
      const item = state.items.find((i) => i.id === id);
      if (!item || !Array.isArray(item.versionSplits)) return;
      const normalP =
        pickCheapestPrintingByFoilCategory(item, 'Normal') ||
        item.selectedPrinting ||
        item.printings[0];
      item.versionSplits.push({
        id: `${item.id}-sp-${Date.now()}`,
        qty: 1,
        printKey: normalP?.print || '',
        versionTag: normalP?.foiling || 'Normal',
      });
      item.quantity = item.versionSplits.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
      await ensureLiveTcgForSplits(item);
      renderDeckHeaderAndCounts();
      renderCardsTable();
      renderQuoteSummary();
    });
  });

  // Unify all copies back into a single version
  document.querySelectorAll('[data-unify-split-item]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-unify-split-item');
      const item = state.items.find((i) => i.id === id);
      if (!item) return;
      item.versionSplits = null;
      renderDeckHeaderAndCounts();
      renderCardsTable();
      renderQuoteSummary();
      showToast(`↺ Cópias de "${item.name}" unificadas na mesma versão.`);
    });
  });

  // Remove a single version row from a split card
  document.querySelectorAll('[data-remove-split-item]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-remove-split-item');
      const idx = parseInt(e.currentTarget.getAttribute('data-remove-split-idx'), 10);
      const item = state.items.find((i) => i.id === id);
      if (!item || !Array.isArray(item.versionSplits)) return;
      item.versionSplits.splice(idx, 1);
      if (item.versionSplits.length === 0) {
        item.versionSplits = null;
      } else {
        item.quantity = item.versionSplits.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
      }
      renderDeckHeaderAndCounts();
      renderCardsTable();
      renderQuoteSummary();
    });
  });

  // Change quantity of a specific version split
  document.querySelectorAll('.split-qty-input').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-split-item-id');
      const idx = parseInt(e.target.getAttribute('data-split-idx'), 10);
      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
      const item = state.items.find((i) => i.id === id);
      if (!item || !Array.isArray(item.versionSplits) || !item.versionSplits[idx]) return;
      item.versionSplits[idx].qty = val;
      item.quantity = item.versionSplits.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
      renderDeckHeaderAndCounts();
      renderCardsTable();
      renderQuoteSummary();
    });
  });

  // Quick toggle Normal / Foil / Cold Foil on a specific version split
  document.querySelectorAll('[data-quick-foil-item]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-quick-foil-item');
      const idx = parseInt(e.currentTarget.getAttribute('data-quick-foil-idx'), 10);
      const foilType = e.currentTarget.getAttribute('data-quick-foil-type');
      const item = state.items.find((i) => i.id === id);
      if (!item || !Array.isArray(item.versionSplits) || !item.versionSplits[idx]) return;

      const bestMatch = pickCheapestPrintingByFoilCategory(item, foilType);
      if (bestMatch) {
        item.versionSplits[idx].printKey = bestMatch.print;
        item.versionSplits[idx].versionTag =
          foilType === 'Normal'
            ? 'Normal'
            : foilType === 'Cold'
              ? 'Cold'
              : bestMatch.foiling && bestMatch.foiling !== 'Normal'
                ? bestMatch.foiling
                : 'Foil';
      } else {
        item.versionSplits[idx].versionTag = foilType;
      }

      await ensureLiveTcgForSplits(item);
      renderCardsTable();
      renderQuoteSummary();
    });
  });

  // Change specific printing dropdown on a version split
  document.querySelectorAll('.split-edition-select').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-split-select-item');
      const idx = parseInt(e.target.getAttribute('data-split-select-idx'), 10);
      const printKey = e.target.value;
      const item = state.items.find((i) => i.id === id);
      if (!item || !Array.isArray(item.versionSplits) || !item.versionSplits[idx]) return;

      const chosen = item.printings.find((p) => p.print === printKey);
      if (chosen) {
        item.versionSplits[idx].printKey = chosen.print;
        item.versionSplits[idx].versionTag = chosen.foiling || 'Normal';
        await ensureLiveTcgForSplits(item);
        renderCardsTable();
        renderQuoteSummary();
      }
    });
  });

  // Toggle inline multi-edition comparison drawer
  document.querySelectorAll('.btn-compare-editions').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-item-id');
      if (!id) return;
      if (state.expandedCardDrawers.has(id)) {
        state.expandedCardDrawers.delete(id);
      } else {
        state.expandedCardDrawers.add(id);
      }
      renderCardsTable();
    });
  });

  // Click on an edition inside the inline drawer
  document.querySelectorAll('.drawer-edition-item').forEach((cardEl) => {
    cardEl.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-select-item-id');
      const printKey = e.currentTarget.getAttribute('data-select-print');
      if (id && printKey) {
        await selectSpecificPrintingForItem(id, printKey);
      }
    });
  });

  // Hover image preview on card thumbnails (only when not in visualList mode)
  if (state.viewMode !== 'visualList') {
    document.querySelectorAll('.card-thumb').forEach((img) => {
      img.addEventListener('mouseenter', (e) => {
        if (state.viewMode === 'visualList') return;
        const src = e.target.getAttribute('data-hover-img');
        const caption = e.target.getAttribute('data-hover-caption');
        if (!src) return;
        els.cardHoverImg.src = src;
        els.cardHoverCaption.textContent = caption || '';
        els.cardHoverPreview.hidden = false;
        positionHoverPreview(e);
      });
      img.addEventListener('mousemove', positionHoverPreview);
      img.addEventListener('mouseleave', () => {
        els.cardHoverPreview.hidden = true;
      });
    });
  }
}

async function selectSpecificPrintingForItem(itemId, printKey) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  const chosen = item.printings.find((p) => p.print === printKey);
  if (chosen) {
    item.manualPrintKey = chosen.print;
    item.selectedPrinting = chosen;

    const pid = chosen.tcgplayer?.productId;
    if (state.hasEvaluatedTcg && pid && !state.detailsByProductId[pid]) {
      await fetchLiveTcgDetailsForProductIds([pid], state.filters.language);
    }

    renderDeckHeaderAndCounts();
    renderMultiEditionExamples();
    renderCardsTable();
    renderQuoteSummary();
  }
}

async function ensureLiveTcgForSplits(item) {
  if (!state.hasEvaluatedTcg || !item || !Array.isArray(item.versionSplits)) return;
  const pids = [];
  for (const sp of item.versionSplits) {
    const p = item.printings.find((pr) => pr.print === sp.printKey);
    const pid = p?.tcgplayer?.productId;
    if (pid && !state.detailsByProductId[String(pid)]) {
      pids.push(String(pid));
    }
  }
  if (pids.length > 0) {
    try {
      await fetchLiveTcgDetailsForProductIds(pids, state.filters.language);
    } catch (e) {
      console.warn('Could not fetch live TCGPlayer details for split printings:', e);
    }
  }
}

function positionHoverPreview(e) {
  const previewWidth = 175;
  const previewHeight = 260;
  let left = e.clientX + 16;
  let top = e.clientY - 80;

  if (left + previewWidth > window.innerWidth - 12) {
    left = e.clientX - previewWidth - 16;
  }
  if (top < 12) top = 12;
  if (top + previewHeight > window.innerHeight - 12) {
    top = window.innerHeight - previewHeight - 12;
  }

  els.cardHoverPreview.style.left = `${left}px`;
  els.cardHoverPreview.style.top = `${top}px`;
}

/**
 * Fetches live TCGPlayer product details & language listings from our backend.
 */
async function fetchLiveTcgDetailsForProductIds(productIds, language = 'English') {
  const validIds = [...new Set(productIds.filter(Boolean).map(String))];
  if (validIds.length === 0) return;

  const response = await fetch('/api/tcgplayer/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds: validIds, language }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao consultar o TCGPlayer');
  }

  state.evaluatedAt = data.evaluatedAt;
  Object.assign(state.detailsByProductId, data.detailsByProductId || {});
}

/**
 * Step 1 Handler: Fetch deck and cards from Fabrary.
 */
async function handleFetchDeck(e) {
  if (e) e.preventDefault();
  const urlOrId = els.deckUrlInput.value.trim();
  if (!urlOrId) {
    showError('Por favor, insira o link do deck do Fabrary.');
    return;
  }

  showError(null);
  els.fetchDeckBtn.disabled = true;
  els.fetchSpinner.hidden = false;
  els.fetchBtnText.textContent = 'Buscando no Fabrary...';

  try {
    const response = await fetch('/api/fabrary/deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlOrId }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Não foi possível carregar o deck do Fabrary.');
    }

    state.deck = data.deck;
    state.hasEvaluatedTcg = false;
    state.evaluatedAt = null;
    state.expandedCardDrawers.clear();
    state.items = (data.items || []).map((item) => ({
      ...item,
      included: true,
      manualCheckOverride: false,
      manualPrintKey: null,
      selectedPrinting: null,
      usedFilterFallback: false,
    }));

    applyFiltersToAllItems(true);
    renderDeckHeaderAndCounts();
    renderMultiEditionExamples();
    renderCardsTable();
    renderQuoteSummary();

    showToast(
      `✅ ${state.items.length} cartas carregadas e pré-cotadas pelo menor valor entre as edições!`
    );
  } catch (err) {
    showError(err.message);
  } finally {
    els.fetchDeckBtn.disabled = false;
    els.fetchSpinner.hidden = true;
    els.fetchBtnText.textContent = '1. Buscar Lista no Fabrary';
  }
}

/**
 * Step 2 Handler: Apply filters and evaluate live prices across editions & language on TCGPlayer.
 */
async function handleEvaluateTcgPlayer() {
  if (!state.items || state.items.length === 0) return;

  els.evaluateTcgBtn.disabled = true;
  if (els.inlineEvaluateBtn) els.inlineEvaluateBtn.disabled = true;
  els.evalSpinner.hidden = false;
  els.evalBtnText.textContent = 'Cotando Menor Valor no TCGPlayer...';

  try {
    // Collect productIds for ALL matching editions of each card so we can compare live prices across editions!
    const productIds = new Set();
    for (const item of state.items) {
      const matching = item.printings.filter((p) => doesPrintingMatchFilters(p, state.filters));
      const pool = matching.length > 0 ? matching : item.printings;
      for (const p of pool.slice(0, 4)) {
        if (p.tcgplayer?.productId) {
          productIds.add(String(p.tcgplayer.productId));
        }
      }
      if (item.selectedPrinting?.tcgplayer?.productId) {
        productIds.add(String(item.selectedPrinting.tcgplayer.productId));
      }
      if (Array.isArray(item.versionSplits)) {
        for (const sp of item.versionSplits) {
          const spPrint = item.printings.find((pr) => pr.print === sp.printKey);
          if (spPrint?.tcgplayer?.productId) {
            productIds.add(String(spPrint.tcgplayer.productId));
          }
        }
      }
    }

    await fetchLiveTcgDetailsForProductIds([...productIds], state.filters.language);
    state.hasEvaluatedTcg = true;

    // Re-pick the cheapest edition now that live TCGPlayer prices & language listings are loaded!
    applyFiltersToAllItems(false);

    renderDeckHeaderAndCounts();
    renderMultiEditionExamples();
    renderCardsTable();
    renderQuoteSummary();

    els.quoteSummarySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showToast('💲 Menor valor por edição e idioma avaliado ao vivo no TCGPlayer (USD)!');
  } catch (err) {
    showError('Erro ao avaliar preços no TCGPlayer: ' + err.message);
  } finally {
    els.evaluateTcgBtn.disabled = false;
    if (els.inlineEvaluateBtn) els.inlineEvaluateBtn.disabled = false;
    els.evalSpinner.hidden = true;
    els.evalBtnText.textContent = '💲 2. Avaliar Menor Preço no TCGPlayer';
  }
}

/**
 * Reads filter UI controls into state.filters and updates the table/summary.
 */
async function syncFiltersFromControls(clearManual = false) {
  const prevLang = state.filters.language;
  state.filters.editionStrategy = els.filterEditionStrategy.value;
  state.filters.language = els.filterLanguage.value;
  state.filters.foiling = els.filterFoiling.value;
  state.filters.setType = els.filterSetType.value;
  state.filters.priceMetric = els.filterPriceMetric.value;
  state.filters.freeGameTokens = els.toggleFreeGameTokens.checked;
  state.filters.freeRarityTokens = els.toggleFreeRarityTokens.checked;

  const included = new Set();
  els.sectionToggles.forEach((chk) => {
    if (chk.checked) included.add(chk.value);
  });
  state.filters.includedSections = included;

  // Always re-evaluate cheapest printing for the new filter!
  applyFiltersToAllItems(clearManual);

  // If already evaluated on TCGPlayer and language changed or new printings were picked, fetch live TCGPlayer data
  if (state.hasEvaluatedTcg) {
    const productIdsToFetch = [];
    for (const item of state.items) {
      const pid = item.selectedPrinting?.tcgplayer?.productId;
      if (pid && (!state.detailsByProductId[pid] || prevLang !== state.filters.language)) {
        productIdsToFetch.push(String(pid));
      }
    }
    if (productIdsToFetch.length > 0) {
      try {
        await fetchLiveTcgDetailsForProductIds(productIdsToFetch, state.filters.language);
        applyFiltersToAllItems(false);
      } catch (e) {
        console.warn('Could not fetch additional TCGPlayer details:', e);
      }
    }
  }

  renderDeckHeaderAndCounts();
  renderMultiEditionExamples();
  renderCardsTable();
  renderQuoteSummary();
}

/**
 * Switches between Compact Thumbnails mode and Visual List (No Images) mode.
 */
function setViewMode(mode) {
  state.viewMode = mode;
  if (mode === 'visualList') {
    els.btnViewVisualList.classList.add('active');
    els.btnViewCompactThumb.classList.remove('active');
    els.cardHoverPreview.hidden = true;
    showToast('📋 Modo Lista Visual ativado (imagens ocultas).');
  } else {
    els.btnViewCompactThumb.classList.add('active');
    els.btnViewVisualList.classList.remove('active');
    showToast('🖼️ Miniaturas compactas ativadas.');
  }
  renderCardsTable();
}

/**
 * Resets all Step 2 filters to default values.
 */
function handleResetFilters() {
  els.filterEditionStrategy.value = 'cheapest';
  els.filterLanguage.value = 'English';
  els.filterFoiling.value = 'all';
  els.filterSetType.value = 'all';
  els.filterPriceMetric.value = 'lowestAvailable';
  els.toggleFreeGameTokens.checked = true;
  els.toggleFreeRarityTokens.checked = true;
  els.sectionToggles.forEach((chk) => {
    chk.checked = true;
  });

  state.items.forEach((item) => {
    item.manualCheckOverride = false;
    item.manualPrintKey = null;
    item.versionSplits = null;
  });

  syncFiltersFromControls(true);
  showToast('Filtros restaurados: cotando sempre o menor valor em Inglês (USD).');
}

/**
 * Copies a formatted text summary of the quote to the clipboard.
 */
async function handleCopyQuoteSummary() {
  if (!state.deck) return;

  const langInfo = getLanguageInfo(state.filters.language);
  const lines = [];
  lines.push(`⚔️ COTAÇÃO TCG COTAPOOL — ${state.deck.name} (${state.deck.heroName})`);
  lines.push(`🔗 Deck Fabrary: ${state.deck.url}`);
  lines.push(`💵 Moeda: USD ($) • Idioma: ${langInfo.label} • Critério: Menor Valor p/ Filtro`);
  lines.push('--------------------------------------------------');

  let grandTotal = 0;
  for (const item of state.items) {
    if (!item.included || item.quantity <= 0) continue;
    const pricing = computeItemPricing(item);
    const printCode = item.selectedPrinting?.print || 'N/A';
    const set = item.selectedPrinting?.set || '';
    const foil = item.selectedPrinting?.foiling || 'Normal';

    if (pricing.isFreeToken) {
      lines.push(
        `${item.quantity}x ${item.name} [${printCode} - ${set} - ${foil}] -> $0.00 (TOKEN GRÁTIS)`
      );
    } else if (pricing.hasVersionSplits) {
      grandTotal += pricing.subtotal;
      lines.push(
        `${item.name} — ${item.quantity} cópias (Subtotal: ${formatUsd(pricing.subtotal)}):`
      );
      for (const sp of pricing.splits) {
        const spCode = sp.printing?.print || 'N/A';
        const spSet = sp.printing?.set || '';
        lines.push(
          `   • ${sp.qty}x ${sp.badgeMeta.compactLabel} [${spCode} - ${spSet} - ${pricing.resolvedLanguage}] -> ${formatUsd(sp.unitPrice)} un. = ${formatUsd(sp.subtotal)}`
        );
      }
    } else {
      const unitStr = formatUsd(pricing.unitPrice ?? 0);
      const subStr = formatUsd(pricing.subtotal);
      grandTotal += pricing.subtotal;
      lines.push(
        `${item.quantity}x ${item.name} [${printCode} - ${set} - ${foil} - ${pricing.resolvedLanguage}] -> ${unitStr} un. = ${subStr}`
      );
    }
  }

  lines.push('--------------------------------------------------');
  lines.push(`💰 TOTAL DA LISTA (TCGPlayer USD): ${formatUsd(grandTotal)}`);

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast('📋 Cotação copiada para a área de transferência!');
  } catch (err) {
    showToast('Não foi possível copiar automaticamente.');
  }
}

/**
 * Exports the evaluated deck list to a CSV file.
 */
function handleExportCsv() {
  if (!state.deck || state.items.length === 0) return;

  const headers = [
    'Incluida',
    'Quantidade',
    'Carta',
    'Pitch',
    'Secao',
    'Print_ID_Menor_Valor',
    'Colecao',
    'Edicao',
    'Foiling',
    'Idioma',
    'Total_Edicoes_Da_Carta',
    'Raridade',
    'Token_Gratis',
    'Menor_Preco_Unitario_USD',
    'Market_Price_USD',
    'Subtotal_USD',
    'TCGPlayer_URL',
  ];

  const rows = [headers.join(',')];

  for (const item of state.items) {
    const pricing = computeItemPricing(item);
    for (const sp of pricing.splits) {
      const p = sp.printing || item.selectedPrinting || {};
      const cardLabel = pricing.hasVersionSplits
        ? `${item.name} (${sp.qty}x ${sp.badgeMeta.compactLabel} de ${item.quantity})`
        : item.name;
      const cols = [
        item.included ? 'Sim' : 'Nao',
        sp.qty,
        csvEscape(cardLabel),
        item.pitch ?? '',
        csvEscape(item.sectionLabel),
        csvEscape(p.print || ''),
        csvEscape(p.set || ''),
        csvEscape(p.edition || ''),
        csvEscape(sp.badgeMeta.compactLabel),
        csvEscape(pricing.resolvedLanguage || 'English'),
        item.printings.length,
        csvEscape(p.rarity || item.rarity || ''),
        pricing.isFreeToken ? 'Sim ($0.00)' : 'Nao',
        pricing.isFreeToken ? '0.00' : (sp.unitPrice ?? 0).toFixed(2),
        (pricing.marketPrice ?? 0).toFixed(2),
        sp.subtotal.toFixed(2),
        csvEscape(sp.tcgUrl || ''),
      ];
      rows.push(cols.join(','));
    }
  }

  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cotacao-${state.deck.deckId || 'fabrary'}-tcgplayer.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 Arquivo CSV exportado com sucesso!');
}

/**
 * Generates and downloads a clean, simple native Excel (.xlsx) spreadsheet without images,
 * listing all cards and their values in USD ($), including differentiated copy versions (e.g., 2x Foil + 1x Normal).
 */
function handleExportExcel() {
  if (!state.deck || state.items.length === 0) return;

  const pitchLabelMap = { 1: '1 (Vermelho)', 2: '2 (Amarelo)', 3: '3 (Azul)' };
  const rows = [];

  // Header Row (row 1)
  rows.push([
    { type: 'str', value: 'Qtd', style: 1 },
    { type: 'str', value: 'Carta / Versão', style: 1 },
    { type: 'str', value: 'Pitch', style: 1 },
    { type: 'str', value: 'Seção', style: 1 },
    { type: 'str', value: 'Código da Edição', style: 1 },
    { type: 'str', value: 'Coleção (Set)', style: 1 },
    { type: 'str', value: 'Versão / Foiling', style: 1 },
    { type: 'str', value: 'Idioma', style: 1 },
    { type: 'str', value: 'Cobrança', style: 1 },
    { type: 'str', value: 'Valor Unitário (USD)', style: 1 },
    { type: 'str', value: 'Valor Total (USD)', style: 1 },
  ]);

  let grandTotal = 0;
  let totalCopies = 0;

  for (const item of state.items) {
    if (!item.included || item.quantity <= 0) continue;

    const pricing = computeItemPricing(item);
    for (const sp of pricing.splits) {
      if (sp.qty <= 0) continue;
      const p = sp.printing || item.selectedPrinting || {};
      const unitVal = pricing.isFreeToken ? 0 : Number((sp.unitPrice ?? 0).toFixed(2));
      const subVal = pricing.isFreeToken ? 0 : Number(sp.subtotal.toFixed(2));

      totalCopies += sp.qty;
      grandTotal += subVal;

      const cardNameDisplay = pricing.hasVersionSplits
        ? `${item.name} (${sp.qty}x ${sp.badgeMeta.compactLabel} de ${item.quantity} cópias)`
        : item.name;

      rows.push([
        { type: 'num', value: sp.qty, style: 0 },
        { type: 'str', value: cardNameDisplay, style: 0 },
        { type: 'str', value: pitchLabelMap[item.pitch] || '-', style: 0 },
        { type: 'str', value: item.sectionLabel, style: 0 },
        { type: 'str', value: p.print || '-', style: 0 },
        { type: 'str', value: p.set || '-', style: 0 },
        { type: 'str', value: sp.badgeMeta.compactLabel, style: 0 },
        { type: 'str', value: pricing.resolvedLanguage || 'English', style: 0 },
        {
          type: 'str',
          value: pricing.isFreeToken ? 'Token (Grátis $0.00)' : 'Cobrada',
          style: 0,
        },
        { type: 'num', value: unitVal, style: 2 },
        { type: 'num', value: subVal, style: 2 },
      ]);
    }
  }

  const lastDataRowIdx = rows.length;

  // Final Total Row
  rows.push([
    { type: 'num', value: totalCopies, style: 1 },
    { type: 'str', value: 'TOTAL GERAL DA LISTA (USD)', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    { type: 'str', value: '', style: 1 },
    {
      type: 'formula',
      formula: lastDataRowIdx >= 2 ? `SUM(K2:K${lastDataRowIdx})` : '0',
      value: Number(grandTotal.toFixed(2)),
      style: 3,
    },
  ]);

  const colWidths = [8, 30, 14, 24, 22, 26, 12, 12, 20, 20, 20];
  const xlsxBlob = buildSimpleXlsxBlob(rows, colWidths, 'Cotacao Cartas');

  const url = URL.createObjectURL(xlsxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planilha-cartas-${state.deck.deckId || 'fabrary'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📊 Planilha do Excel (.xlsx) gerada com sucesso!');
}

/**
 * Builds a valid native .xlsx (OpenXML) Blob in pure JS without external libraries.
 */
function buildSimpleXlsxBlob(rows, colWidths, sheetName = 'Planilha1') {
  const xmlEscape = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const colLetter = (colIdx) => {
    let n = colIdx + 1;
    let str = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      str = String.fromCharCode(65 + rem) + str;
      n = Math.floor((n - 1) / 26);
    }
    return str;
  };

  const colsXml = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const sheetDataXml = rows
    .map((row, rIdx) => {
      const rNum = rIdx + 1;
      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          const sAttr = cell.style ? ` s="${cell.style}"` : '';
          if (cell.type === 'num') {
            return `<c r="${ref}"${sAttr}><v>${Number(cell.value || 0)}</v></c>`;
          }
          if (cell.type === 'formula') {
            return `<c r="${ref}"${sAttr}><f>${xmlEscape(cell.formula)}</f><v>${Number(
              cell.value || 0
            )}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"${sAttr}><is><t>${xmlEscape(
            cell.value
          )}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}">${cellsXml}</row>`;
    })
    .join('');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Styles: 0 = default, 1 = Bold header/total text, 2 = USD Currency ($#,##0.00), 3 = Bold USD Currency
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="$#,##0.00"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>${sheetDataXml}</sheetData>
</worksheet>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
  ];

  return createStoredZipBlob(files);
}

/**
 * Packages an array of { name, content } UTF-8 files into an uncompressed ZIP Blob (for .xlsx).
 */
function createStoredZipBlob(files) {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // STORE (0)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((acc, arr) => acc + arr.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function csvEscape(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initialize event listeners.
 */
function init() {
  // Step 1 form submission
  els.deckForm.addEventListener('submit', handleFetchDeck);

  els.clearInputBtn.addEventListener('click', () => {
    els.deckUrlInput.value = '';
    els.deckUrlInput.focus();
  });

  // View Mode Switch (Miniaturas vs Lista Visual Sem Imagens)
  els.btnViewCompactThumb.addEventListener('click', () => setViewMode('compactThumb'));
  els.btnViewVisualList.addEventListener('click', () => setViewMode('visualList'));

  // Toggle Multi-Edition Examples Panel
  els.toggleExamplesBodyBtn.addEventListener('click', () => {
    state.examplesCollapsed = !state.examplesCollapsed;
    els.multiEditionExamplesGrid.hidden = state.examplesCollapsed;
    els.toggleExamplesBodyBtn.textContent = state.examplesCollapsed
      ? 'Mostrar Exemplos ▼'
      : 'Ocultar Exemplos ▲';
  });

  // Step 2 Evaluation buttons
  els.evaluateTcgBtn.addEventListener('click', handleEvaluateTcgPlayer);
  if (els.inlineEvaluateBtn) {
    els.inlineEvaluateBtn.addEventListener('click', handleEvaluateTcgPlayer);
  }
  els.resetFiltersBtn.addEventListener('click', handleResetFilters);

  // Filter controls — whenever a filter changes, clear manual overrides so it always picks the cheapest matching edition!
  els.filterEditionStrategy.addEventListener('change', () => syncFiltersFromControls(true));
  els.filterLanguage.addEventListener('change', () => syncFiltersFromControls(false));
  els.filterFoiling.addEventListener('change', () => syncFiltersFromControls(true));
  els.filterSetType.addEventListener('change', () => syncFiltersFromControls(true));
  els.filterPriceMetric.addEventListener('change', () => syncFiltersFromControls(false));
  els.toggleFreeGameTokens.addEventListener('change', () => syncFiltersFromControls(false));
  els.toggleFreeRarityTokens.addEventListener('change', () => syncFiltersFromControls(false));
  els.sectionToggles.forEach((chk) => {
    chk.addEventListener('change', () => {
      state.items.forEach((i) => {
        i.manualCheckOverride = false;
      });
      syncFiltersFromControls(false);
    });
  });

  // Category Tabs
  els.categoryTabs.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.categoryTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.getAttribute('data-tab') || 'all';
      renderCardsTable();
    });
  });

  // Search & Sort
  els.cardSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value || '';
    renderCardsTable();
  });

  els.sortOrderSelect.addEventListener('change', (e) => {
    state.sortOrder = e.target.value || 'section';
    renderCardsTable();
  });

  // Export & Copy buttons
  if (els.exportExcelBtn) {
    els.exportExcelBtn.addEventListener('click', handleExportExcel);
  }
  if (els.toolbarExportExcelBtn) {
    els.toolbarExportExcelBtn.addEventListener('click', handleExportExcel);
  }
  els.copyQuoteBtn.addEventListener('click', handleCopyQuoteSummary);
  els.exportCsvBtn.addEventListener('click', handleExportCsv);

  // Automatically load the default Fabrary deck on startup
  if (els.deckUrlInput.value.trim()) {
    handleFetchDeck();
  }
}

document.addEventListener('DOMContentLoaded', init);
