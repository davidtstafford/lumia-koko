#!/usr/bin/env node
/**
 * postinstall.js
 *
 * 1. Ensures the Electron binary is extracted from its cached zip.
 *    electron's own install.js uses extract-zip@2 which is broken on Node 26+.
 *    We fall back to the system unzip / PowerShell Expand-Archive.
 *
 * 2. Rebuilds better-sqlite3 (and any other native modules) for the installed
 *    Electron ABI using @electron/rebuild.
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── 1. Ensure Electron binary ──────────────────────────────────────────────

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
const electronPkg = require(path.join(electronDir, 'package.json'));
const version = electronPkg.version;

const platform = process.platform;
const platformPath = platform === 'win32'
  ? 'electron.exe'
  : platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : 'electron';

const binaryPath = path.join(electronDir, 'dist', platformPath);

function isElectronInstalled() {
  try {
    return (
      fs.existsSync(binaryPath) &&
      fs.readFileSync(path.join(electronDir, 'dist', 'version'), 'utf-8').replace(/^v/, '') === version
    );
  } catch {
    return false;
  }
}

function writeMetaFiles() {
  fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath);
  fs.writeFileSync(path.join(electronDir, 'dist', 'version'), version);
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  if (platform === 'win32') {
    const ps = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Force -Path "${zipPath}" -DestinationPath "${destDir}"`
    ], { stdio: 'inherit' });
    if (ps.status !== 0) throw new Error('PowerShell Expand-Archive failed');
  } else {
    const result = spawnSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('unzip failed');
  }
}

async function ensureElectron() {
  if (isElectronInstalled()) {
    console.log(`[postinstall] Electron ${version} already installed.`);
    return;
  }

  console.log(`[postinstall] Electron binary missing — resolving from cache...`);

  // @electron/get is a dependency of electron itself so it's always available.
  const { downloadArtifact } = require('@electron/get');

  let arch = process.arch;
  // Rosetta detection on Apple Silicon
  if (platform === 'darwin' && arch === 'x64') {
    try {
      const out = execFileSync('sysctl', ['-in', 'sysctl.proc_translated']).toString().trim();
      if (out === '1') arch = 'arm64';
    } catch { /* ignore */ }
  }

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
  });

  console.log(`[postinstall] Extracting Electron from ${zipPath} ...`);
  const distDir = path.join(electronDir, 'dist');
  extractZip(zipPath, distDir);
  writeMetaFiles();

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Electron binary not found after extraction: ${binaryPath}`);
  }
  console.log(`[postinstall] Electron ${version} installed successfully.`);
}

// ── 2. Rebuild native modules for Electron ─────────────────────────────────

function rebuildNativeModules() {
  console.log('[postinstall] Rebuilding native modules for Electron...');
  const rebuildBin = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-rebuild');
  const result = spawnSync(rebuildBin, ['-f', '-w', 'better-sqlite3'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error('electron-rebuild failed');
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
  try {
    await ensureElectron();
    rebuildNativeModules();
  } catch (err) {
    console.error('[postinstall] Error:', err.message);
    process.exit(1);
  }
})();
