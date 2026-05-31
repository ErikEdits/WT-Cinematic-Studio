/**
 * Release Helper
 * Erzeugt eine latest.json mit Version + Download-URL für den Auto-Updater.
 *
 * Verwendung:
 *   node release.js                                  → erzeugt latest.json im dist/ Ordner
 *   node release.js https://example.com/setup.exe    → custom Download-URL
 *
 * Anschließend musst du HOCHLADEN:
 *   - latest.json   → an die URL die in updater.js DEFAULT_UPDATE_URL steht
 *   - Setup.exe     → an die "url" die in latest.json drin steht
 *
 * Empfohlenes Hosting: GitHub Releases (kostenlos, einfach).
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const pkg = require('./package.json');
const VERSION = pkg.version;
const DIST    = path.join(__dirname, 'dist');
const SETUP_EXE = path.join(DIST, `WT Cinematic Studio Setup ${VERSION}.exe`);

if (!fs.existsSync(SETUP_EXE)) {
  console.error(`❌ Installer nicht gefunden: ${SETUP_EXE}`);
  console.error('   Erst "npm run dist" ausführen!');
  process.exit(1);
}

// SHA256 für Integrität (optional)
const sha = crypto.createHash('sha256');
sha.update(fs.readFileSync(SETUP_EXE));
const sha256 = sha.digest('hex');

// Optional: custom URL als CLI-Argument
const customUrl = process.argv[2];
// GitHub Releases ersetzt Leerzeichen mit Punkten beim Upload
const defaultUrl = `https://github.com/ErikEdits/WT-Cinematic-Studio/releases/download/v${VERSION}/WT.Cinematic.Studio.Setup.${VERSION}.exe`;

const release = {
  version: VERSION,
  url:     customUrl || defaultUrl,
  notes:   process.env.RELEASE_NOTES || `Version ${VERSION}`,
  sha256:  sha256,
  releaseDate: new Date().toISOString(),
};

const outFile = path.join(DIST, 'latest.json');
fs.writeFileSync(outFile, JSON.stringify(release, null, 2), 'utf8');

console.log('✅ latest.json erstellt:', outFile);
console.log(JSON.stringify(release, null, 2));
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Nächste Schritte:');
console.log('  1. Hochladen:  ' + SETUP_EXE);
console.log('     → an URL:   ' + release.url);
console.log('  2. Hochladen:  ' + outFile);
console.log('     → an URL:   (siehe DEFAULT_UPDATE_URL in updater.js)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
