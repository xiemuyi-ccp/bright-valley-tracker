#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

curl -L -s -o data/manager.html https://13f.info/manager/0001965546-bright-valley-capital-ltd
node scripts/parse-manager.mjs

node -e 'const fs=require("fs"); for (const filing of JSON.parse(fs.readFileSync("data/filings.json","utf8"))) console.log(filing.id)' |
while read -r filing_id; do
  curl -L -s -o "data/${filing_id}.json" "https://13f.info/data/13f/${filing_id}"
done

node scripts/build-data.mjs
