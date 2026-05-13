// this creates a .env file for custom zip builds that can be used to replace specific variables
// DO NOT use this unless you know what the heck you're doing

import { resolve } from "path";

// Number.MAX_SAFE_INTEGER - Math.floor(Number.MAX_SAFE_INTEGER / 2)
const SAFE_INTEGER = 4503599627370496;
// (BigInt(Math.PI.toFixed(40).replace(".","")) * 4n).toString(16)
const RANDOM_STRING = "1714add755dc69de3dd72c7aaee15e5aa88";

const TEXT = `VITE_APP_ID=${SAFE_INTEGER}
VITE_APP_HASH="${RANDOM_STRING}"`;

const HEADERS = `/*
  Access-Control-Allow-Origin: *
/manifest.webapp
  Content-Type: application/json
`;

const local = resolve(__dirname, "../.env.local");

// @ts-ignore
// only write if it doesn't exist
if (!(await Bun.file(local).exists())) Bun.write(local, TEXT);
// @ts-ignore
Bun.write(resolve(__dirname, "../builds/_headers"), HEADERS);
