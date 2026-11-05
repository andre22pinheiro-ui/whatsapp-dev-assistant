# 📱 WhatsApp Dev & Personal Assistant (Antigravity & Android Studio)

Programa de automação remota via **WhatsApp** para desenvolvimento de software, integração com **Antigravity CLI**, **Android Studio** e **Assistente Pessoal**.

Permite transformar qualquer conversa de WhatsApp num centro de comando inteligente para controlar o teu computador portátil/Surface, compilar aplicações móveis, gerar código e gerir a tua rotina.

---

## 🚀 Capacidades Principais

### 1. 🛠️ Automação de Desenvolvimento & Android Studio
* **Listar Projetos**: Encontra e categoriza todos os projetos na pasta `C:\Users\Surface_Dpc\Desktop\projectos`.
* **Compilação Gradle Remota (`/build <projeto>`)**:
  * Executa `./gradlew assembleDebug` ou `assembleRelease` de forma autónoma.
  * Captura erros e avisa se a compilação foi bem-sucedida.
* **Envio Automático de APK (`/apk <projeto>`)**:
  * Envia o ficheiro `.apk` recém-gerado como anexo diretamente no chat do WhatsApp para instalação imediata no teu telemóvel!
* **Abertura no Android Studio (`/studio <projeto>`)**:
  * Abre o projeto diretamente no Android Studio no computador.
* **Depuração ADB (`/adb`)**:
  * Lista dispositivos e emuladores conectados.

### 2. ⚡ Antigravity Coding AI (`/agy <prompt>`)
* Conexão direta ao **Antigravity CLI** (`agy.exe`).
* Permite executar tarefas de codificação, geração de scripts, refatoração e resolução de bugs a partir do WhatsApp com `--dangerously-skip-permissions`.
* Exemplo: `/agy pladur-pro : cria um botão de exportação para PDF`.

### 3. 💻 Controlo Remoto do Computador
* **Saúde & Métricas (`/status` ou `/pc`)**:
  * Uso de CPU, memória RAM livre/usada, percentagem de bateria, espaço em disco e uptime.
* **Captura de Ecrã (`/print` ou `/screenshot`)**:
  * Tira uma foto em tempo real do ecrã do teu computador e envia a imagem diretamente no chat.
* **Terminal PowerShell (`/cmd <comando>`)**:
  * Executa comandos controlados no computador e devolve o resultado.

### 4. 📋 Gestor Pessoal (Tarefas & Lembretes)
* **Lista de Tarefas (`/tarefa <texto>`, `/tarefas`, `/feita <id>`)**:
  * Adiciona e marca tarefas concluídas.
* **Lembretes Inteligentes (`/lembrete <tempo> <texto>`)**:
  * Suporta formatos relativos (`/lembrete 20m Ligar ao cliente`) ou horários (`/lembrete 18:30 Reunião`).
  * Quando o tempo chega, o bot envia uma mensagem de alerta no WhatsApp!

### 5. 🌐 Painel Web Interativo (`http://localhost:3333`)
* **QR Code Visual**: Emparelhamento fácil escaneando o QR code no navegador ou no terminal.
* **Monitor de Sessão**: Verificação do telemóvel emparelhado e estado da conexão.
* **Métricas em Direto**: Dashboard com uso de CPU, RAM, bateria e discos.
* **Gestor de Projetos**: Botões com 1 clique para compilar e abrir no Android Studio.
* **Consola de Atividade**: Streaming de logs em tempo real via Server-Sent Events (SSE).

---

## 📋 Lista Completa de Comandos do WhatsApp

| Comando | Descrição | Exemplo |
| :--- | :--- | :--- |
| `/ajuda` ou `/menu` | Mostra o menu com todos os comandos disponíveis | `/ajuda` |
| `/status` ou `/pc` | Mostra o estado do PC (CPU, RAM, bateria, disco) | `/status` |
| `/print` ou `/screenshot` | Tira um print do ecrã do computador e envia a foto | `/print` |
| `/projetos` | Lista os projetos na pasta Desktop\projectos | `/projetos` |
| `/build <projeto>` | Compila o APK Debug via Gradle e envia o APK | `/build pladur-pro` |
| `/release <projeto>` | Compila o APK Release com otimização | `/release pladur-pro` |
| `/apk <projeto>` | Envia o ficheiro .apk do projeto pelo chat | `/apk matchpro` |
| `/studio <projeto>` | Abre o projeto no Android Studio | `/studio pladur-pro` |
| `/adb` | Mostra os dispositivos móveis conectados | `/adb` |
| `/agy <prompt>` | Executa um comando autónomo no Antigravity | `/agy cria um script de backup` |
| `/agy <proj> : <prompt>` | Executa no Antigravity focado num projeto | `/agy matchpro : refatora o header` |
| `/tarefa <texto>` | Cria uma nova tarefa pessoal | `/tarefa Comprar bilhetes` |
| `/tarefas` | Lista todas as tarefas guardadas | `/tarefas` |
| `/feita <id>` | Marca uma tarefa como concluída | `/feita 4291` |
| `/lembrete <tempo> <msg>`| Agenda um lembrete (ex: 15m, 1h, 18:00) | `/lembrete 30m Rever o código` |
| `/cmd <comando>` | Executa comando no PowerShell | `/cmd dir` |

---

## 🛠️ Como Iniciar

### Opção 1: Atalho no Ambiente de Trabalho
* Clique duas vezes no atalho **WhatsApp Dev Assistant** no seu Ambiente de Trabalho.

### Opção 2: Linha de Comandos
```bash
cd "C:\Users\Surface_Dpc\Desktop\projectos\whatsapp-dev-assistant"
npm start
```

Ao iniciar, abra **http://localhost:3333** no seu navegador para ver o QR Code e emparelhar com o WhatsApp do seu telemóvel.

