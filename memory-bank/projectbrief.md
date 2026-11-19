# Project Brief - Whatsapp Dev & Personal Assistant

## Stack Tecnológica

- **Linguagem Principal**: JavaScript/TypeScript (Node.js 18+)
- **Framework Web**: Express.js
- **Backend**: Node.js com módulos modulares
- **IA**: Gemini API, Groq, OpenAI (openai/gpt-oss-120b)
- **Automação**: Antigravity CLI (`agy`)
- **Notificações**: Telegram, WhatsApp, Cloudflare Tunnel
- **Banco de Dados**: Ficheros locais (JSON) - `data/`
- **Logs**: Pino (pino + pino-pretty)
- **Storage**: Ficheros de sessão em `data/sessions.json`

## Dependências

### Node.js & Runtime
- `@google/generative-ai` (^0.24.1)
- `@whiskeysockets/baileys` (^6.7.12)
- `cors` (^2.8.5)
- `dotenv` (^16.4.7)
- `express` (^4.21.2)
- `imapflow` (^2.10.2)
- `node-cron` (^4.6.0)
- `nodemailer` (^10.3.1)
- `pino` (^9.6.0)
- `pino-pretty` (^13.0.0)
- `qrcode` (^1.5.4)
- `qrcode-terminal` (^0.12.0)
- `systeminformation` (^5.23.5)

### Serviços de IA
- **Gemini**: `gemini-api-key` (obter em aistudio.google.com)
- **Groq**: `groq-api-key`, `groq-model` (default: openai/gpt-oss-120b)
- **HuggingFace**: `huggingface-token`
- **OpenRouteService**: `ors-api-key`
- **Cloudflare Tunnel**: `cloudflared-path`

### Outros
- `cors` para CORS
- `dotenv` para carregar variáveis de ambiente
- `pino` para logging
- `qrcode` e `qrcode-terminal` para gerar QR codes
- `node-cron` para agendamentos

## Estrutura de Pastas

```
whatsapp-dev-assistant/
├── src/
│   ├── index.js              # Ponto de entrada principal
│   ├── config.js             # Configuração e carregamento de settings
│   ├── web/
│   │   └── server.js         # Servidor web (Dashboard)
│   ├── services/
│   │   ├── personalAssistant.js
│   │   ├── androidService.js
│   │   ├── cloudinaryService.js
│   │   ├── cloudTunnelService.js
│   │   ├── emailService.js
│   │   ├── formadorTccService.js
│   │   ├── portugalLawService.js
│   │   ├── systemService.js
│   │   ├── telegramService.js
│   │   ├── amaremapService.js
│   │   ├── antigravityService.js
│   │   ├── igyEvalService.js
│   │   ├── masterDomainService.js
│   │   ├── orsRouteService.js
│   │   ├── pcSyncService.js
│   │   ├── appScaffoldService.js
│   │   ├── aiService.js
│   │   ├── agentx_ml.py
│   │   ├── blenderService.js
│   │   ├── calendarService.js
│   │   ├── videoScriptService.js
│   │   └── ... (outros serviços)
│   ├── ml/
│   │   └── agentx_ml.py
│   ├── lib/
│   │   └── whatsapp.ts
│   ├── data/
│   │   ├── settings.example.json
│   │   └── sessions.json
│   ├── scripts/
│   │   ├── start.bat
│   │   ├── start.pc-worker.bat
│   │   ├── start.bat
│   │   ├── run-pc-worker.vbs
│   │   ├── run-silent.vbs
│   │   ├── run-cycler.vbs
│   │   ├── send_status.js
│   │   ├── upload-session-to-cloud.js
│   │   └── ... (outros scripts)
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── README.md
│   └── setup-cloud.sh
├── memory-bank/
│   ├── projectbrief.md
│   ├── activeContext.md
│   └── progress.md
└── ... (outros arquivos)
```

## Funcionalidades Principais

1. **Automação de Desenvolvimento & Android Studio**
   - Listar projetos na pasta `C:\Users\Surface_Dpc\Desktop\projectos`
   - Compilar APKs via Gradle (`/build <projeto>`)
   - Enviar APKs para WhatsApp (`/apk <projeto>`)
   - Abrir projeto no Android Studio (`/studio <projeto>`)
   - Depuração ADB (`/adb`)

2. **Antigravity Coding AI (`/agy <prompt>`)**
   - Conexão direta ao Antigravity CLI (`agy.exe`)
   - Execução de tarefas de codificação, geração de scripts, refatoração
   - Exemplo: `/agy pladur-pro : cria um botão de exportação para PDF`

3. **Controlo Remoto do Computador**
   - Saúde & Métricas (`/status` ou `/pc`)
   - Captura de Ecrã (`/print` ou `/screenshot`)
   - Terminal PowerShell (`/cmd <comando>`)

4. **Gestor Pessoal (Tarefas & Lembretes)**
   - Lista de tarefas (`/tarefa <texto>`, `/tarefas`)
   - Lembretes inteligentes (`/lembrete <tempo> <texto>`)

5. **Painel Web Interativo (`http://localhost:3333`)**
   - QR Code visual
   - Monitor de sessão
   - Dashboard de métricas
   - Gestor de projetos
   - Consola de atividade

## Estado Atual

- O projeto está em desenvolvimento ativo.
- O `src/index.js` é o ponto de entrada principal.
- O `config.js` carrega configurações e settings.
- O `server.js` cria o dashboard web.
- Os serviços de IA (Gemini, Groq) estão configurados.
- A estrutura de pastas segue o design original.

## Próximos Passos

1. Criar a pasta `memory-bank/` com os três ficheiros.
2. Preencher `projectbrief.md` com as informações de stack, dependências e estrutura.
3. Preencher `activeContext.md` com o estado atual do código, commits recentes e tarefas em curso.
4. Preencher `progress.md` com checklist de conclusões e próximos passos.
5. Validar que todos os ficheiros foram criados corretamente.
