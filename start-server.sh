#!/bin/bash
# ============================================================
# HaushaltsFinanz – Lokaler HTTPS-Server für iOS PWA
# ============================================================
# Voraussetzungen: Node.js installiert
# Einmalige Installation: npm install (im finance-pwa Ordner)
# Starten: bash start-server.sh
# ============================================================

set -e

# Prüfen ob Node.js verfügbar
if ! command -v node &> /dev/null; then
  echo "❌ Node.js nicht gefunden. Bitte installieren: https://nodejs.org"
  exit 1
fi

# Abhängigkeiten installieren falls nötig
if [ ! -d "node_modules" ]; then
  echo "📦 Installiere Abhängigkeiten..."
  npm install
fi

# IP-Adresse ermitteln
IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || \
     hostname -I 2>/dev/null | awk '{print $1}' || \
     echo "localhost")

echo ""
echo "🚀 HaushaltsFinanz HTTPS-Server startet..."
echo ""
echo "   Öffne auf dem iPad in Safari:"
echo "   👉 https://${IP}:8443"
echo ""
echo "   ⚠️  Safari zeigt eine Sicherheitswarnung (selbst-signiertes Zertifikat)"
echo "   → Tippe auf 'Erweitert' → 'Website trotzdem besuchen'"
echo "   → Danach funktioniert die App vollständig offline!"
echo ""
echo "   Drücke Ctrl+C zum Beenden"
echo ""

node server.js
