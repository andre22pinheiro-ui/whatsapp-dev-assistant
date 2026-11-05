@echo off
title WhatsApp Dev Assistant - Agente Local PC
cd /d "C:\Users\Surface_Dpc\Desktop\projectos\whatsapp-dev-assistant"
echo ========================================================
echo  Iniciando Agente Local do PC (Worker)...
echo ========================================================
node scripts/pc-worker.js
pause
