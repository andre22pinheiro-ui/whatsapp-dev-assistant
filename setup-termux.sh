#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Script de Configuração Rápida para Android (Termux)
# WhatsApp Dev Assistant 24/7
# ==============================================================================

set -e

echo "📱 [1/5] A atualizar pacotes do Termux no Android..."
pkg update -y && pkg upgrade -y

echo "📦 [2/5] A instalar Node.js LTS, Git e ferramentas..."
pkg install -y nodejs-lts git build-essential

echo "🔋 [3/5] A ativar Wake-Lock (impede o Android de suspender o bot)..."
termux-wake-lock || true

echo "📥 [4/5] A instalar dependências do projeto..."
npm install --omit=dev

echo "🚀 [5/5] A criar atalho de inicialização..."
cat << 'EOF' > start.sh
#!/data/data/com.termux/files/usr/bin/bash
cd "$(dirname "$0")"
termux-wake-lock
echo "A iniciar WhatsApp Assistant 24/7..."
node src/index.js
EOF

chmod +x start.sh

echo ""
echo "========================================================================"
echo "✅ TERMUX CONFIGURADO COM SUCESSO!"
echo "Para iniciar o bot sempre que quiser, basta correr:"
echo "  ./start.sh"
echo "========================================================================"

