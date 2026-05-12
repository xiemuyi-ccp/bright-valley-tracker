import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const dataDir = path.join(root, "data");
const assetsDir = path.join(root, "assets");

const filings = [
  { quarter: "2023 Q4", asOf: "2023-12-31", filingDate: "2024-02-14", id: "000196554224000002", totalValueK: 125837, reportedHoldings: 9 },
  { quarter: "2024 Q1", asOf: "2024-03-31", filingDate: "2024-05-16", id: "000196554624000002", totalValueK: 67537, reportedHoldings: 10 },
  { quarter: "2024 Q2", asOf: "2024-06-30", filingDate: "2024-08-26", id: "000196554624000004", totalValueK: 88652, reportedHoldings: 11 },
  { quarter: "2024 Q3", asOf: "2024-09-30", filingDate: "2024-11-13", id: "000196554624000005", totalValueK: 127775, reportedHoldings: 8 },
  { quarter: "2024 Q4", asOf: "2024-12-31", filingDate: "2025-02-13", id: "000184929925000001", totalValueK: 234376, reportedHoldings: 10 },
  { quarter: "2025 Q1", asOf: "2025-03-31", filingDate: "2025-05-13", id: "000196554625000003", totalValueK: 297302, reportedHoldings: 18 },
  { quarter: "2025 Q2", asOf: "2025-06-30", filingDate: "2025-08-13", id: "000196554625000004", totalValueK: 141541, reportedHoldings: 11 },
  { quarter: "2025 Q3", asOf: "2025-09-30", filingDate: "2025-11-13", id: "000196554625000007", totalValueK: 168879, reportedHoldings: 13 },
  { quarter: "2025 Q4", asOf: "2025-12-31", filingDate: "2026-02-12", id: "000196554626000002", totalValueK: 269159, reportedHoldings: 15 }
];

const aliasBySymbol = {
  "0A2I.IL": "HTHT",
  "0A2S.IL": "PDD",
  "0FUT.IL": "FUTU",
  "0LQ0.IL": "VIPS",
  "35J.SG": "CAN",
  "3CM.F": "RLX",
  "DY8.SG": "DOYU",
  "DY8A.F": "DOYU"
};

const fallbackByCusip = {
  "01609W102": "BABA",
  "01609W902": "BABA",
  "01609W952": "BABA",
  "037833100": "AAPL",
  "056752108": "BIDU",
  "11135F951": "AVGO",
  "24703L202": "DELL",
  "36257Y109": "GOTU",
  "67066G954": "NVDA",
  "722304902": "PDD",
  "G01719114": "BABA",
  "G5223Y108": "BEKE",
  "G6180F108": "MNSO",
  "G6427A102": "NTES",
  "G6470A116": "EDU",
  "G8068L108": "SN"
};

const manualShareBases = {
  YY: {
    shares: 50_000_000,
    source: "JOYY 2025 Q4 results: ADS-equivalent shares outstanding as of 2025-12-31",
    quality: "reported"
  },
  IBIT: {
    shares: null,
    source: "ETF/fund shares are not comparable with operating-company shares",
    quality: "not_applicable"
  },
  HOLI: {
    shares: null,
    source: "Delisted/acquired; current market-cap-implied base unavailable",
    quality: "not_available"
  }
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
}

function parseMoney(value) {
  if (!value || value === "N/A") return null;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferShareBases() {
  const bases = {};
  for (const file of fs.readdirSync(dataDir)) {
    if (!file.startsWith("nasdaq-") || !file.endsWith(".json")) continue;
    const ticker = file.replace("nasdaq-", "").replace(".json", "");
    let payload;
    try {
      payload = readJson(file);
    } catch {
      continue;
    }
    const summary = payload?.data?.summaryData;
    const marketCap = parseMoney(summary?.MarketCap?.value);
    const close = parseMoney(summary?.PreviousClose?.value);
    if (!marketCap || !close) continue;
    bases[ticker] = {
      shares: Math.round(marketCap / close),
      marketCap,
      close,
      source: "Nasdaq summary: market cap / previous close, ADS-or-share equivalent",
      quality: "market_implied"
    };
  }
  return { ...bases, ...manualShareBases };
}

function normalizeInstrument(row) {
  const [symbolRaw, issuerName, securityClass, cusip, valueK, reportedPct, shares, principal, optionRaw] = row;
  const symbol = symbolRaw || fallbackByCusip[cusip] || issuerName.split(/\s+/).slice(0, 2).join(" ");
  const classText = String(securityClass || "").toUpperCase();
  const optionType = optionRaw || (classText.includes("CALL") ? "call" : classText.includes("PUT") ? "put" : null);
  const baseTicker = aliasBySymbol[symbol] || fallbackByCusip[cusip] || symbol;
  const instrumentType = optionType || "equity";
  const key = `${baseTicker}:${instrumentType}`;
  const display = optionType ? `${baseTicker} ${optionType.toUpperCase()}` : baseTicker;

  return {
    key,
    display,
    symbol,
    baseTicker,
    issuerName,
    securityClass,
    cusip,
    optionType,
    instrumentType,
    valueK: Number(valueK || 0),
    valueUSD: Number(valueK || 0) * 1000,
    reportedPct: Number(reportedPct || 0),
    shares: Number(shares || 0),
    principal: principal ?? null
  };
}

const shareBases = inferShareBases();
const quarters = filings.map((filing, filingIndex) => {
  const raw = readJson(`${filing.id}.json`);
  const aggregated = new Map();
  for (const row of raw.data) {
    const normalized = normalizeInstrument(row);
    const existing = aggregated.get(normalized.key);
    if (existing) {
      existing.valueK += normalized.valueK;
      existing.valueUSD += normalized.valueUSD;
      existing.reportedPct += normalized.reportedPct;
      existing.shares += normalized.shares;
      existing.cusip = `${existing.cusip}, ${normalized.cusip}`;
      continue;
    }
    aggregated.set(normalized.key, normalized);
  }

  const positions = [...aggregated.values()].map((normalized) => {
    const base = shareBases[normalized.baseTicker];
    const ownershipPct = base?.shares ? (normalized.shares / base.shares) * 100 : null;
    return {
      ...normalized,
      weightPct: filing.totalValueK ? (normalized.valueK / filing.totalValueK) * 100 : normalized.reportedPct,
      ownershipPct,
      ownershipKind: normalized.optionType ? "notional" : "direct",
      shareBase: base?.shares ?? null,
      shareBaseQuality: base?.quality ?? "missing",
      shareBaseSource: base?.source ?? "No reliable current share base in local dataset",
      filingIndex
    };
  });

  return {
    ...filing,
    secUrl: `https://www.sec.gov/Archives/edgar/data/1965546/${filing.id}/${filing.id.slice(0, 10)}-${filing.id.slice(10, 12)}-${filing.id.slice(12)}-index.html`,
    sourceUrl: `https://13f.info/13f/${filing.id}-bright-valley-capital-ltd-${filing.quarter.toLowerCase().replace(" ", "-")}`,
    totalValueUSD: filing.totalValueK * 1000,
    positions
  };
});

const previousByKey = new Map();
for (const quarter of quarters) {
  for (const position of quarter.positions) {
    const previous = previousByKey.get(position.key);
    position.previousShares = previous?.shares ?? 0;
    position.previousValueK = previous?.valueK ?? 0;
    position.shareChange = position.shares - position.previousShares;
    position.valueChangeK = position.valueK - position.previousValueK;
    if (!previous) position.action = "new";
    else if (position.shares > previous.shares * 1.05) position.action = "increase";
    else if (position.shares < previous.shares * 0.95) position.action = "decrease";
    else position.action = "hold";
  }

  const currentKeys = new Set(quarter.positions.map((position) => position.key));
  quarter.exits = [...previousByKey.values()]
    .filter((position) => !currentKeys.has(position.key))
    .map((position) => ({
      ...position,
      action: "exit",
      valueChangeK: -position.valueK,
      shareChange: -position.shares
    }));

  previousByKey.clear();
  for (const position of quarter.positions) previousByKey.set(position.key, position);
}

const latest = quarters.at(-1);
const instruments = new Map();
for (const quarter of quarters) {
  for (const position of quarter.positions) {
    const existing = instruments.get(position.key) || {
      key: position.key,
      display: position.display,
      baseTicker: position.baseTicker,
      issuerName: position.issuerName,
      instrumentType: position.instrumentType,
      optionType: position.optionType,
      maxValueK: 0,
      totalValueK: 0,
      firstQuarter: quarter.quarter,
      lastQuarter: quarter.quarter,
      count: 0
    };
    existing.maxValueK = Math.max(existing.maxValueK, position.valueK);
    existing.totalValueK += position.valueK;
    existing.lastQuarter = quarter.quarter;
    existing.count += 1;
    instruments.set(position.key, existing);
  }
}

const sortedInstruments = [...instruments.values()].sort((a, b) => b.maxValueK - a.maxValueK);
const latestSorted = [...latest.positions].sort((a, b) => b.valueK - a.valueK);
const latestTop5Weight = latestSorted.slice(0, 5).reduce((sum, position) => sum + position.weightPct, 0);
const latestDirectWeight = latest.positions.filter((position) => !position.optionType).reduce((sum, position) => sum + position.weightPct, 0);
const latestOptionWeight = latest.positions.filter((position) => position.optionType).reduce((sum, position) => sum + position.weightPct, 0);

const appData = {
  generatedAt: new Date().toISOString(),
  manager: {
    name: "BRIGHT VALLEY CAPITAL Ltd",
    displayName: "Bright Valley Capital",
    cik: "0001965546",
    location: "Hong Kong",
    managerUrl: "https://13f.info/manager/0001965546-bright-valley-capital-ltd",
    secUrl: "https://www.sec.gov/cgi-bin/browse-edgar?CIK=0001965546"
  },
  coverage: {
    requestedWindow: "Five-year tracking window",
    availableFrom: quarters[0].quarter,
    availableTo: latest.quarter,
    note: "13f.info/SEC currently expose Bright Valley Capital filings from 2023 Q4 onward in the local dataset."
  },
  assumptions: {
    portfolioValue: "13F reported market value in USD thousands; not full firm AUM.",
    ownership: "Company ownership uses ADS/share-equivalent bases derived from current Nasdaq market cap divided by previous close where available. It is a monitoring estimate, not a legal ownership calculation.",
    options: "Call/put rows are shown separately. Ownership percentages for options are notional exposure only.",
    updateCadence: "Designed to be rebuilt weekly on Friday at 12:00 Asia/Shanghai; new 13F data appears only when the manager files."
  },
  summary: {
    latestQuarter: latest.quarter,
    latestAsOf: latest.asOf,
    latestFilingDate: latest.filingDate,
    latestTotalValueK: latest.totalValueK,
    latestHoldingCount: latest.positions.length,
    latestTop5Weight,
    latestDirectWeight,
    latestOptionWeight,
    quarterCount: quarters.length,
    uniqueInstrumentCount: instruments.size
  },
  shareBases,
  instruments: sortedInstruments,
  quarters,
  latestPositions: latestSorted,
  latestExits: latest.exits
};

fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(
  path.join(assetsDir, "portfolio-data.js"),
  `window.BVC_DATA = ${JSON.stringify(appData, null, 2)};\n`,
  "utf8"
);

console.log(`Built ${quarters.length} quarters and ${instruments.size} instruments.`);
