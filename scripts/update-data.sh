#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

curl -L -s -o data/000196554626000002.json https://13f.info/data/13f/000196554626000002
curl -L -s -o data/000196554625000007.json https://13f.info/data/13f/000196554625000007
curl -L -s -o data/000196554625000004.json https://13f.info/data/13f/000196554625000004
curl -L -s -o data/000196554625000003.json https://13f.info/data/13f/000196554625000003
curl -L -s -o data/000184929925000001.json https://13f.info/data/13f/000184929925000001
curl -L -s -o data/000196554624000005.json https://13f.info/data/13f/000196554624000005
curl -L -s -o data/000196554624000004.json https://13f.info/data/13f/000196554624000004
curl -L -s -o data/000196554624000002.json https://13f.info/data/13f/000196554624000002
curl -L -s -o data/000196554224000002.json https://13f.info/data/13f/000196554224000002

node scripts/build-data.mjs
