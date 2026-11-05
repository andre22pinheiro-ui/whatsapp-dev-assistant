#!/usr/bin/env bash
# ==============================================================================
# Script de Configuração Rápida do Servidor Cloud (Ubuntu 22.04 / 24.04 LTS)
# WhatsApp Dev Assistant 24/7
# ==============================================================================

set -e

echo "🚀 [1/5] A atualizar pacotes do sistema Ubuntu..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential

echo "📦 [2/5] A instalar Node.js 20 LTS e PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo "🛡️ [3/5] A configurar Firewall (UFW) para permitir SSH e porta 3333..."
sudo ufw allow 22/tcp || true
sudo ufw allow 3333/tcp || true
sudo ufw --force enable || true

echo "📥 [4/5] A instalar dependências do projeto..."
npm install --omit=dev

echo "⚙️ [5/5] A preparar arranque 24/7 com PM2..."
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

echo ""
echo "========================================================================"
echo "✅ SERVIDOR CONFIGURADO COM SUCESSO!"
echo "Para ver os logs e o QR Code do WhatsApp: pm2 logs whatsapp-assistant"
echo "O Web Dashboard está disponível em: http://SEU_IP_PUBLICO:3333"
echo "========================================================================"
