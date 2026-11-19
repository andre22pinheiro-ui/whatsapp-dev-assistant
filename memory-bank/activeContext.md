# Active Context - Estado Atual do Código

## Stack e Dependências
- **Linguagem**: JavaScript/TypeScript (Node.js 18+)
- **Framework Web**: Express.js
- **IA**: Gemini API, Groq, OpenAI (openai/gpt-oss-120b)
- **Automação**: Antigravity CLI (`agy`)
- **Notificações**: Telegram, WhatsApp, Cloudflare Tunnel
- **Banco de Dados**: Ficheros locais (JSON) - `data/`
- **Logs**: Pino (pino + pino-pretty)
- **Storage**: Ficheros de sessão em `data/sessions.json`

## Componentes Principais

### Backend (`src/`)
- `index.js` - Ponto de entrada principal (cria servidor web e inicia WhatsApp)
- `config.js` - Carregamento de configurações e settings
- `web/server.js` - Servidor web (Dashboard) com endpoints de status e APKs
- `services/` - Módulos de serviços (personalAssistant, androidService, cloudinaryService, etc.)
- `ml/` - Modelos de IA (agentx_ml.py)
- `lib/` - Bibliotecas auxiliares (whatsapp.ts)
- `scripts/` - Scripts de automação (start.bat, run-pc-worker.vbs, etc.)

### Dados (`data/`)
- `settings.example.json` - Exemplo de configuração
- `sessions.json` - Fichero de sessões do WhatsApp

### Configuração (`memory-bank/`)
- `projectbrief.md` - Resumo da arquitetura e stack
- `activeContext.md` - Este arquivo (estado atual)
- `progress.md` - Checklist de progresso

## Commits Recentes (últimos 20)
- (Ver `git log` para detalhes completos)
- Últimos commits mostram desenvolvimento ativo no backend e integração com serviços de IA.

## Tarefas em Curso

1. **Inicialização do Servidor Web** - O `src/index.js` está pronto para iniciar o dashboard.
2. **Integração Antigravity** - O `whatsapp/client.js` e `whatsapp/service.js` implementam a conexão com o Antigravity CLI.
3. **Controle Remoto do PC** - O `pcSyncService.js` e `cloudTunnelService.js` gerenciam a sincronização e o túnel de acesso.
4. **Gestão de Tarefas** - O `src/services/personalAssistant.js` implementa a funcionalidade de tarefas e lembretes.
5. **Painel Web** - O `src/web/server.js` está configurado para expor o dashboard em `http://localhost:3333`.

## Problemas Atuais
- Nenhum erro crítico detectado no `src/index.js` ou `config.js`.
- O `data/settings.example.json` está pronto para uso.
- A configuração do `.env` deve ser feita manualmente pelo desenvolvedor.

## Próximos Passos
- Criar e preencher os ficheiros da `memory-bank/` pasta.
- Validar a estrutura do projeto e corrigir eventuais inconsistências.
- Garantir que todos os módulos de serviços estão integrados corretamente.
