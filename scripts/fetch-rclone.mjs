#!/usr/bin/env node
// Downloads the pinned rclone release and verifies its SHA256 against the release's SHA256SUMS.
//
//   pnpm fetch:rclone          # current platform only
//   pnpm fetch:rclone --all    # every supported platform
//   pnpm fetch:rclone --force  # re-download even if present
//
// Idempotent: skips a platform whose VERSION marker already matches.
// TODO(security): also verify the GPG signature on SHA256SUMS (it is clearsigned by the
// rclone release key, https://rclone.org/release_signing/). Until then we trust TLS +
// downloads.rclone.org for the checksum file.

import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'resources', 'rclone');

/** Our folder key (Node names) → rclone release asset suffix. */
const TARGETS = {
  'linux-x64': 'linux-amd64',
  'linux-arm64': 'linux-arm64',
  'win32-x64': 'windows-amd64',
  'darwin-x64': 'osx-amd64',
  'darwin-arm64': 'osx-arm64',
};

const args = new Set(process.argv.slice(2));
const all = args.has('--all');
const force = args.has('--force');

const { version, baseUrl } = JSON.parse(
  await readFile(path.join(ROOT, 'scripts', 'rclone-version.json'), 'utf8'),
);
if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error(`Bad rclone version: ${version}`);

const fetchBuffer = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'syncvault-fetch-rclone' } });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

/** Parses SHA256SUMS (possibly PGP clearsigned) into { filename: hex }. CRLF-safe. */
const parseSums = (text) => {
  const sums = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(\S+)$/.exec(line.trim());
    if (m) sums[m[2]] = m[1];
  }
  return sums;
};

/** Minimal zip reader: extracts one entry by basename (stored or deflated). */
const extractFromZip = (zip, wantedBase) => {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip: end of central directory not found');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const method = zip.readUInt16LE(p + 10);
    const compSize = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOff = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (path.posix.basename(name) !== wantedBase) continue;
    if (zip.readUInt32LE(localOff) !== 0x04034b50) throw new Error('zip: bad local header');
    const dataStart =
      localOff + 30 + zip.readUInt16LE(localOff + 26) + zip.readUInt16LE(localOff + 28);
    const data = zip.subarray(dataStart, dataStart + compSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data);
    throw new Error(`zip: unsupported compression method ${method}`);
  }
  throw new Error(`zip: ${wantedBase} not found`);
};

const currentKey = `${process.platform}-${process.arch}`;
const keys = all ? Object.keys(TARGETS) : [currentKey];
if (!all && !TARGETS[currentKey]) {
  console.error(
    `Unsupported platform ${currentKey}. Supported: ${Object.keys(TARGETS).join(', ')}`,
  );
  process.exit(1);
}

let sums;
for (const key of keys) {
  const asset = `rclone-${version}-${TARGETS[key]}.zip`;
  const exe = key.startsWith('win32') ? 'rclone.exe' : 'rclone';
  const dir = path.join(OUT_DIR, key);
  const marker = path.join(dir, 'VERSION');

  if (!force) {
    const existing = await readFile(marker, 'utf8').catch(() => '');
    if (existing.trim() === version) {
      console.log(`✓ ${key}: rclone ${version} already present`);
      continue;
    }
  }

  sums ??= parseSums((await fetchBuffer(`${baseUrl}/${version}/SHA256SUMS`)).toString('utf8'));
  const expected = sums[asset];
  if (!expected) throw new Error(`${asset} is not listed in SHA256SUMS`);

  console.log(`↓ ${key}: downloading ${asset}`);
  const zip = await fetchBuffer(`${baseUrl}/${version}/${asset}`);
  const actual = createHash('sha256').update(zip).digest('hex');
  if (actual !== expected) {
    throw new Error(`SHA256 mismatch for ${asset}: expected ${expected}, got ${actual}`);
  }
  console.log(`  SHA256 verified (${actual.slice(0, 16)}…)`);

  const binary = extractFromZip(zip, exe);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${exe}.tmp`);
  await writeFile(tmp, binary);
  await chmod(tmp, 0o755);
  await rm(path.join(dir, exe), { force: true });
  await rename(tmp, path.join(dir, exe));
  await writeFile(marker, version + '\n');
  console.log(`✓ ${key}: installed ${path.relative(ROOT, path.join(dir, exe))}`);
}
