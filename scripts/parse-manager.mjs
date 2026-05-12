import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const html = fs.readFileSync(path.join(root, "data", "manager.html"), "utf8");

function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  return Number(clean(value).replace(/,/g, ""));
}

function quarterLabel(raw) {
  const match = clean(raw).match(/Q([1-4])\s+(\d{4})/i);
  return match ? `${match[2]} Q${match[1]}` : clean(raw);
}

const rows = [...html.matchAll(/<tr class="bg-gray-50[\s\S]*?<\/tr>/g)].map((match) => match[0]);
const filings = rows.map((row) => {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
  const asOf = row.match(/data-order="(\d{4}-\d{2}-\d{2})"/)?.[1];
  const href = row.match(/href="(\/13f\/[^"]+)"/)?.[1];
  const id = clean(cells[6]);
  const filingDate = cells[5]?.match(/data-order="(\d{4}-\d{2}-\d{2})"/)?.[1] || clean(cells[5]);

  return {
    quarter: quarterLabel(cells[0]),
    asOf,
    filingDate,
    id,
    totalValueK: parseNumber(cells[2]),
    reportedHoldings: parseNumber(cells[1]),
    href: href ? `https://13f.info${href}` : null
  };
}).filter((filing) => filing.asOf && filing.id && Number.isFinite(filing.totalValueK));

filings.sort((a, b) => a.asOf.localeCompare(b.asOf));
const latest = filings.at(-1);
const cutoffYear = latest ? Number(latest.asOf.slice(0, 4)) - 5 : 0;
const fiveYearWindow = filings.filter((filing) => Number(filing.asOf.slice(0, 4)) >= cutoffYear);

fs.writeFileSync(
  path.join(root, "data", "filings.json"),
  JSON.stringify(fiveYearWindow, null, 2),
  "utf8"
);

console.log(`Parsed ${fiveYearWindow.length} filings from manager page.`);
