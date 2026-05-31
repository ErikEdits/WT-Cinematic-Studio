/**
 * Auto-Publish Pipeline
 * Bumpt die Patch-Version, baut den Installer, lädt alles auf GitHub.
 *
 * Verwendung:
 *   npm run publish              → bumpt patch (1.0.0 → 1.0.1)
 *   npm run publish -- minor     → bumpt minor (1.0.0 → 1.1.0)
 *   npm run publish -- major     → bumpt major (1.0.0 → 2.0.0)
 *   npm run publish -- 1.2.3     → setzt exakte Version
 *   npm run publish -- skip-bump → nutzt aktuelle package.json Version
 *
 * Optional: RELEASE_NOTES env var für eigene Release-Notes
 */
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { execSync, spawnSync } = require('child_process');

const ROOT    = __dirname;
const PKG_PATH = path.join(ROOT, 'package.json');
const LATEST   = path.join(ROOT, 'latest.json');
const DIST     = path.join(ROOT, 'dist');

const GH_OWNER = 'ErikEdits';
const GH_REPO  = 'WT-Cinematic-Studio';

// ── Utility ───────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  console.log(`\x1b[2m$ ${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}
function runQuiet(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function bumpVersion(current, mode) {
  const parts = current.split('.').map(n => parseInt(n, 10));
  if (mode === 'major') return `${parts[0]+1}.0.0`;
  if (mode === 'minor') return `${parts[0]}.${parts[1]+1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2]+1}`; // default: patch
}

// ── Step 0: Read package.json + decide version ────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const arg = process.argv[2] || 'patch';

let newVersion;
if (arg === 'skip-bump') {
  newVersion = pkg.version;
  console.log(`\x1b[33m⏩ Skip bump — Version bleibt ${newVersion}\x1b[0m`);
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  newVersion = arg;
} else {
  newVersion = bumpVersion(pkg.version, arg);
}

console.log(`\x1b[36m\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  📦 WT Cinematic Studio — Publish v${newVersion}`);
console.log(`     (aktuell: v${pkg.version})`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`);

// ── Step 1: Check Tag existiert noch nicht ───────────────────────────────────
try {
  const exists = runQuiet(`gh release view v${newVersion} --repo ${GH_OWNER}/${GH_REPO} --json tagName 2>nul`);
  if (exists) {
    console.error(`\x1b[31m❌ Release v${newVersion} existiert bereits auf GitHub!\x1b[0m`);
    console.error(`   Nutze eine andere Version oder lösche das Release zuerst:`);
    console.error(`   gh release delete v${newVersion} --repo ${GH_OWNER}/${GH_REPO} --yes`);
    process.exit(1);
  }
} catch {
  // 404 = good, release doesn't exist yet
}

// ── Step 2: Update package.json Version ──────────────────────────────────────
if (arg !== 'skip-bump') {
  pkg.version = newVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`\x1b[32m✅ package.json → v${newVersion}\x1b[0m\n`);
}

// ── Step 3: Build Installer ──────────────────────────────────────────────────
console.log(`\x1b[36m🔨 Build Installer…\x1b[0m`);
// Clear cache for clean build
try { fs.rmSync(path.join(DIST, 'win-unpacked'), { recursive: true, force: true }); } catch {}
try { fs.readdirSync(DIST).filter(f => f.endsWith('.7z')).forEach(f => fs.unlinkSync(path.join(DIST, f))); } catch {}
run('npm run dist');

const SETUP_EXE = path.join(DIST, `WT Cinematic Studio Setup ${newVersion}.exe`);
if (!fs.existsSync(SETUP_EXE)) {
  console.error(`\x1b[31m❌ Build hat keinen Installer erzeugt: ${SETUP_EXE}\x1b[0m`);
  process.exit(1);
}

// ── Step 4: Generate latest.json ─────────────────────────────────────────────
console.log(`\n\x1b[36m📝 Generiere latest.json…\x1b[0m`);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(SETUP_EXE)).digest('hex');
const latest = {
  version: newVersion,
  url:     `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/v${newVersion}/WT.Cinematic.Studio.Setup.${newVersion}.exe`,
  notes:   process.env.RELEASE_NOTES || `Version ${newVersion}`,
  sha256:  sha256,
  releaseDate: new Date().toISOString(),
};
fs.writeFileSync(LATEST, JSON.stringify(latest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(DIST, 'latest.json'), JSON.stringify(latest, null, 2) + '\n', 'utf8');
console.log(`\x1b[32m✅ latest.json erstellt (SHA256: ${sha256.slice(0,16)}…)\x1b[0m\n`);

// ── Step 5: Git Commit + Push ────────────────────────────────────────────────
console.log(`\x1b[36m📤 Git commit + push…\x1b[0m`);
try {
  run('git add latest.json package.json');
  run(`git commit -m "Release v${newVersion}"`);
  run('git push');
  console.log(`\x1b[32m✅ Git push erfolgreich\x1b[0m\n`);
} catch (e) {
  console.error(`\x1b[33m⚠️  Git push fehlgeschlagen — manuell pushen?\x1b[0m`);
}

// ── Step 6: GitHub Release ───────────────────────────────────────────────────
console.log(`\x1b[36m🚀 GitHub Release erstellen…\x1b[0m`);
const notes = (process.env.RELEASE_NOTES || `Version ${newVersion}`).replace(/"/g, '\\"');
const ghCmd = `gh release create v${newVersion} "${SETUP_EXE}" --repo ${GH_OWNER}/${GH_REPO} --title "v${newVersion}" --notes "${notes}"`;
try {
  run(ghCmd);
} catch (e) {
  console.error(`\x1b[31m❌ GitHub Release fehlgeschlagen\x1b[0m`);
  process.exit(1);
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log(`\n\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ✅ Release v${newVersion} ist live!`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
console.log(`  📦 Release:     https://github.com/${GH_OWNER}/${GH_REPO}/releases/tag/v${newVersion}`);
console.log(`  📄 latest.json: https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/latest.json`);
console.log(`  ⏱  Alle installierten Apps zeigen das Update-Popup innerhalb von 30 Minuten.\n`);
