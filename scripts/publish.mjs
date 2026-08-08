#!/usr/bin/env node
// Publishes the web-sdk docs slice from this (secondary) repo into a target
// Mintlify repo checkout: mirrors content dirs verbatim and merges the
// `refId`-tagged navigation subtree(s) into the target docs.json.
//
// Usage:
//   node scripts/publish.mjs <path-to-target-repo-checkout>
//
// Runs in CI and locally. Zero dependencies (Node 18+ for fs.cpSync/structuredClone).

import fs from "node:fs";
import path from "node:path";

// --- Config -----------------------------------------------------------------
const SRC_ROOT = "docs/public"; // Mintlify serving root of THIS repo
const CONTENT = [
  // dirs mirrored into the target, verbatim (relative to SRC_ROOT -> target root)
  { from: "web-sdk", to: "web-sdk" },
  { from: "images/web-sdk", to: "images/web-sdk" },
];
const SRC_DOCS = "docs/public/docs.json"; // relative to this repo root
const TGT_DOCS = "docs.json"; // relative to target repo root
// ----------------------------------------------------------------------------

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const targetRoot = process.argv[2];
if (!targetRoot) fail("Missing argument: <path-to-target-repo-checkout>");
if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
  fail(`Target path is not a directory: ${targetRoot}`);
}

const repoRoot = process.cwd();
const srcDocsPath = path.join(repoRoot, SRC_DOCS);
const tgtDocsPath = path.join(targetRoot, TGT_DOCS);
if (!fs.existsSync(srcDocsPath)) fail(`Source docs.json not found: ${srcDocsPath}`);
if (!fs.existsSync(tgtDocsPath)) fail(`Target docs.json not found: ${tgtDocsPath}`);

// --- 1. Mirror content (wipe-then-copy so deletions propagate) --------------
for (const { from, to } of CONTENT) {
  const src = path.join(repoRoot, SRC_ROOT, from);
  const dst = path.join(targetRoot, to);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ source content dir missing, skipping: ${src}`);
    continue;
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log(`↻ mirrored ${SRC_ROOT}/${from} → ${to}`);
}

// --- 2. Build refId map from source docs.json (unique values required) ------
function collectRefIds(node, map) {
  if (Array.isArray(node)) {
    for (const n of node) collectRefIds(n, map);
  } else if (node && typeof node === "object") {
    if (typeof node.refId === "string") {
      if (map.has(node.refId)) fail(`Duplicate refId in source docs.json: "${node.refId}"`);
      map.set(node.refId, node);
    }
    for (const v of Object.values(node)) collectRefIds(v, map);
  }
}

const srcDocs = JSON.parse(fs.readFileSync(srcDocsPath, "utf8"));
const refMap = new Map();
collectRefIds(srcDocs, refMap);
if (refMap.size === 0) fail("No refId found in source docs.json — nothing to merge.");

// --- 3. Merge into target docs.json (whole-node replacement) ----------------
const matched = new Set();
function mergeNode(node) {
  if (Array.isArray(node)) return node.map(mergeNode);
  if (node && typeof node === "object") {
    if (typeof node.refId === "string" && refMap.has(node.refId)) {
      matched.add(node.refId);
      return structuredClone(refMap.get(node.refId)); // keeps refId → idempotent
    }
    for (const k of Object.keys(node)) node[k] = mergeNode(node[k]);
  }
  return node;
}

const tgtDocs = JSON.parse(fs.readFileSync(tgtDocsPath, "utf8"));
const merged = mergeNode(tgtDocs);

// --- 4. Write back (pretty, trailing newline) -------------------------------
fs.writeFileSync(tgtDocsPath, JSON.stringify(merged, null, 2) + "\n");

// --- 5. Summary -------------------------------------------------------------
console.log(`✓ merged ${matched.size}/${refMap.size} refId group(s) into ${TGT_DOCS}`);
for (const refId of refMap.keys()) {
  if (!matched.has(refId)) console.warn(`⚠ refId not found in target, skipped: "${refId}"`);
}
