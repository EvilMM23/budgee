/**
 * server.js – Lokaler HTTPS-Server für HaushaltsFinanz
 *
 * Warum HTTPS?
 *   iOS Safari aktiviert Service Worker (= Offline-Funktion) NUR bei:
 *   1. HTTPS-Verbindungen, ODER
 *   2. localhost (nur auf dem Gerät selbst nutzbar)
 *   Eine lokale IP (192.168.x.x) über HTTP reicht nicht aus.
 *
 * Lösung: Selbst-signiertes Zertifikat → HTTPS über lokales Netz.
 * Safari zeigt einmalig eine Sicherheitswarnung, danach läuft alles.
 */

const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { execSync } = require('child_process');
const os      = require('os');

const HTTPS_PORT = 8443;
const HTTP_PORT  = 8080;  // Leitet automatisch auf HTTPS um
const CERT_DIR   = path.join(__dirname, '.cert');
const CERT_FILE  = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE   = path.join(CERT_DIR, 'key.pem');
const PUBLIC_DIR = __dirname;

// ── Zertifikat erstellen falls nicht vorhanden ──
function ensureCertificate() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    console.log('[CERT] Zertifikat vorhanden.');
    return;
  }

  console.log('[CERT] Erstelle selbst-signiertes Zertifikat...');
  fs.mkdirSync(CERT_DIR, { recursive: true });

  // IP-Adresse für SAN (Subject Alternative Name) ermitteln
  const ip = getLocalIP();

  // OpenSSL-Konfiguration mit IP-SAN (wichtig für iOS)
  const opensslConf = `
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_req

[dn]
C  = DE
ST = Local
L  = Local
O  = HaushaltsFinanz
CN = ${ip}

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:true

[alt_names]
IP.1   = ${ip}
IP.2   = 127.0.0.1
DNS.1  = localhost
`;

  const confFile = path.join(CERT_DIR, 'openssl.conf');
  fs.writeFileSync(confFile, opensslConf);

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" ` +
      `-out "${CERT_FILE}" -days 825 -nodes ` +
      `-config "${confFile}"`,
      { stdio: 'pipe' }
    );
    console.log('[CERT] Zertifikat erstellt für IP:', ip);
  } catch (err) {
    console.error('[CERT] OpenSSL-Fehler:', err.message);
    console.error('Bitte OpenSSL installieren: sudo apt install openssl');
    process.exit(1);
  }
}

// ── MIME-Types ──
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ── Request-Handler ──
function handleRequest(req, res) {
  let urlPath = req.url.split('?')[0]; // Query-String entfernen

  // Trailing Slash → index.html
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, urlPath);

  // Sicherheits-Check: Kein Path-Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Datei lesen
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Nicht gefunden → index.html (SPA Fallback)
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, buildHeaders('.html', indexData));
            res.end(indexData);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, buildHeaders(ext, data));
    res.end(data);
  });
}

/** HTTP-Response-Header mit korrektem Caching für PWA */
function buildHeaders(ext, data) {
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = {
    'Content-Type':  mime,
    'Content-Length': Buffer.byteLength(data),
    // Service Worker darf nicht gecacht werden (wichtig!)
    'Cache-Control': ext === '.js' && false ? 'no-store' : 'no-cache',
  };

  // Service Worker: niemals cachen
  if (ext === '.js') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  }

  // CORS für lokale Entwicklung
  headers['Access-Control-Allow-Origin'] = '*';

  return headers;
}

// ── HTTP → HTTPS Redirect ──
function startHTTPRedirect() {
  const ip = getLocalIP();
  http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${ip}:${HTTPS_PORT}${req.url}` });
    res.end();
  }).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[HTTP]  Redirect läuft auf Port ${HTTP_PORT} → HTTPS`);
  });
}

// ── HTTPS-Server starten ──
function startHTTPS() {
  const options = {
    key:  fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
    // Moderne TLS-Einstellungen für iOS-Kompatibilität
    minVersion: 'TLSv1.2',
  };

  https.createServer(options, handleRequest)
    .listen(HTTPS_PORT, '0.0.0.0', () => {
      const ip = getLocalIP();
      console.log('');
      console.log('✅ HTTPS-Server läuft!');
      console.log('');
      console.log(`   iPad/iPhone → Safari → https://${ip}:${HTTPS_PORT}`);
      console.log('');
      console.log('   Beim ersten Öffnen:');
      console.log('   1. Safari zeigt "Diese Verbindung ist nicht privat"');
      console.log('   2. Tippe auf "Details einblenden" (unten)');
      console.log('   3. Tippe auf "Website trotzdem besuchen"');
      console.log('   4. App öffnet sich → Teilen → "Zum Home-Bildschirm"');
      console.log('   5. Ab jetzt funktioniert die App VOLLSTÄNDIG OFFLINE!');
      console.log('');
    });
}

/** Lokale IP-Adresse ermitteln */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ── Start ──
ensureCertificate();
startHTTPRedirect();
startHTTPS();
