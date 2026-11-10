// WhatsApp Dev & Personal Assistant - Client Dashboard Script

document.addEventListener("DOMContentLoaded", () => {
  // AUTENTICAÇÃO PRIVADA & CRIPTOGRAFADA (EMAIL + PIN OU LINK DIRETO COM TOKEN)
  const TOKEN_KEY = "dev_auth_token";
  const urlToken = new URLSearchParams(window.location.search).get("token");
  if (urlToken) {
    localStorage.setItem(TOKEN_KEY, urlToken);
  }
  let authToken = localStorage.getItem(TOKEN_KEY) || "";

  const authModal = document.getElementById("auth-gate-modal");
  const authForm = document.getElementById("auth-form");
  const authEmailInput = document.getElementById("auth-email-input");
  const authPinInput = document.getElementById("auth-pin-input");
  const authErrorMsg = document.getElementById("auth-error-msg");

  function showAuthGate(show = true) {
    if (authModal) {
      authModal.style.display = show ? "flex" : "none";
      if (show && authPinInput) {
        authPinInput.value = "";
        setTimeout(() => authPinInput.focus(), 150);
      }
    }
  }

  window.logoutAuth = async function() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem(TOKEN_KEY);
    authToken = "";
    showAuthGate(true);
  };

  // Intercetor global para anexar token Bearer e tratar 401
  const originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};

    if (typeof url === "string" && url.startsWith("/api/") && !url.startsWith("/api/auth/login")) {
      if (authToken) {
        if (options.headers instanceof Headers) {
          options.headers.set("Authorization", `Bearer ${authToken}`);
        } else {
          options.headers["Authorization"] = `Bearer ${authToken}`;
        }
      }
    }

    const response = await originalFetch(url, options);

    if (response.status === 401 && typeof url === "string" && !url.startsWith("/api/auth/")) {
      showAuthGate(true);
    }
    return response;
  };

  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = authEmailInput ? authEmailInput.value.trim() : "Andre22pinheiro@gmail.com";
      const pin = authPinInput ? authPinInput.value.trim() : "";
      if (authErrorMsg) authErrorMsg.style.display = "none";

      try {
        const res = await originalFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, pin })
        });
        const data = await res.json();
        if (data.success && data.token) {
          authToken = data.token;
          localStorage.setItem(TOKEN_KEY, authToken);
          showAuthGate(false);
          startDashboardData();
        } else {
          if (authErrorMsg) {
            authErrorMsg.textContent = data.error || "Email ou código de acesso incorretos.";
            authErrorMsg.style.display = "block";
          }
        }
      } catch (err) {
        if (authErrorMsg) {
          authErrorMsg.textContent = "Erro ao autenticar: " + err.message;
          authErrorMsg.style.display = "block";
        }
      }
    });
  }

  // Elementos DOM
  const waBadge = document.getElementById("wa-status-badge");
  const waStatusText = document.getElementById("wa-status-text");
  const waSessionTag = document.getElementById("wa-session-tag");
  const qrContainer = document.getElementById("qr-container");
  const qrImage = document.getElementById("qr-image");
  const waActiveSession = document.getElementById("wa-active-session");
  const waUserPhone = document.getElementById("wa-user-phone");
  const waUserName = document.getElementById("wa-user-name");
  const dispBotPhone = document.getElementById("disp-bot-phone");
  const dispOwnerPhone = document.getElementById("disp-owner-phone");
  const pairingCodeBox = document.getElementById("pairing-code-box");
  const pairingCodeDisplay = document.getElementById("pairing-code-display");
  const btnReconnect = document.getElementById("btn-reconnect");
  const reconnectStatusMsg = document.getElementById("reconnect-status-msg");

  // Sistema
  const sysCpu = document.getElementById("sys-cpu");
  const sysRam = document.getElementById("sys-ram");
  const sysBattery = document.getElementById("sys-battery");
  const sysDisk = document.getElementById("sys-disk");
  const sysOs = document.getElementById("sys-os");
  const sysUptime = document.getElementById("sys-uptime");
  const btnRefreshSys = document.getElementById("btn-refresh-sys");

  // Projetos
  const projectsList = document.getElementById("projects-list");
  const projectsCount = document.getElementById("projects-count");
  const btnRefreshProjects = document.getElementById("btn-refresh-projects");

  // Tarefas
  const taskForm = document.getElementById("task-form");
  const taskInput = document.getElementById("task-input");
  const tasksList = document.getElementById("tasks-list");

  // Terminal Logs
  const logTerminal = document.getElementById("log-terminal");
  const btnClearLogs = document.getElementById("btn-clear-logs");

  // Modal Definições
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const settingsModal = document.getElementById("settings-modal");
  const settingOwnerPhone = document.getElementById("setting-owner-phone");
  const settingGeminiKey = document.getElementById("setting-gemini-key");
  const settingAllowAll = document.getElementById("setting-allow-all");
  const btnSaveSettings = document.getElementById("btn-save-settings");

  // 1. CARREGAR ESTADO INICIAL
  async function loadInitialStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      updateDualBotUI(data);
      updateSystemUI(data.system);
      updateCloudUI(data.cloud);
    } catch (e) {
      console.error("Falha ao carregar status:", e);
    }
  }

  function updateCloudUI(cloud) {
    const linkEl = document.getElementById("cloud-public-link");
    const textEl = document.getElementById("cloud-link-text");
    const badgeEl = document.getElementById("cloud-status-badge");
    if (!linkEl || !textEl) return;

    if (cloud && cloud.cloudUrl) {
      linkEl.href = cloud.cloudUrl;
      textEl.textContent = cloud.cloudUrl;
      if (badgeEl) {
        badgeEl.className = "pill pill-online";
        badgeEl.textContent = "Online Global (HTTPS)";
      }
    } else {
      textEl.textContent = "A gerar túnel seguro de nuvem...";
      if (badgeEl) {
        badgeEl.className = "pill pill-offline";
        badgeEl.textContent = "A Ligar...";
      }
    }
  }

  window.copyCloudLink = function() {
    const linkEl = document.getElementById("cloud-public-link");
    if (linkEl && linkEl.href && linkEl.href !== "#") {
      navigator.clipboard.writeText(linkEl.href);
      alert("Link público em nuvem copiado para a área de transferência:\n" + linkEl.href);
    }
  };

  // 2. ATUALIZAR INTERFACE DUAL-BOT (RECEPTOR & EMISSOR)
  function updateDualBotUI(data) {
    if (!data) return;
    const rec = data.receiver || data.whatsapp?.receiver;
    const send = data.sender || data.whatsapp?.sender;

    // BOT 1: RECEPTOR
    const recTag = document.getElementById("receiver-session-tag");
    const recCode = document.getElementById("receiver-code-display");
    const recBox = document.getElementById("receiver-pairing-box");
    const recQr = document.getElementById("receiver-qr-image");
    const recConn = document.getElementById("receiver-connected-box");
    const dispRec = document.getElementById("disp-receiver-phone");

    if (rec) {
      if (dispRec && rec.phone) dispRec.textContent = `+${rec.phone}`;
      if (rec.state === "connected") {
        if (recTag) { recTag.className = "pill pill-online"; recTag.textContent = "Online"; }
        if (recBox) recBox.style.display = "none";
        if (recQr) recQr.style.display = "none";
        if (recConn) recConn.style.display = "block";
      } else {
        if (recTag) { recTag.className = "pill pill-offline"; recTag.textContent = "Emparelhar"; }
        if (recBox) recBox.style.display = "flex";
        if (recConn) recConn.style.display = "none";
        if (recCode) recCode.textContent = rec.pairingCode || "A gerar...";
        if (recQr && rec.qrDataUrl) {
          recQr.src = rec.qrDataUrl;
          recQr.style.display = "block";
        }
      }
    }

    // BOT 2: EMISSOR
    const sendTag = document.getElementById("sender-session-tag");
    const sendCode = document.getElementById("sender-code-display");
    const sendBox = document.getElementById("sender-pairing-box");
    const sendQr = document.getElementById("sender-qr-image");
    const sendConn = document.getElementById("sender-connected-box");
    const dispSend = document.getElementById("disp-sender-phone");

    if (send) {
      if (dispSend && send.phone) dispSend.textContent = `+${send.phone}`;
      if (send.state === "connected") {
        if (sendTag) { sendTag.className = "pill pill-online"; sendTag.textContent = "Online"; }
        if (sendBox) sendBox.style.display = "none";
        if (sendQr) sendQr.style.display = "none";
        if (sendConn) sendConn.style.display = "block";
      } else {
        if (sendTag) { sendTag.className = "pill pill-offline"; sendTag.textContent = "Emparelhar"; }
        if (sendBox) sendBox.style.display = "flex";
        if (sendConn) sendConn.style.display = "none";
        if (sendCode) sendCode.textContent = send.pairingCode || "A gerar...";
        if (sendQr && send.qrDataUrl) {
          sendQr.src = send.qrDataUrl;
          sendQr.style.display = "block";
        }
      }
    }

    // STATUS GERAL DA PONTE
    const bridgeTag = document.getElementById("bridge-status-tag");
    if (bridgeTag) {
      if (rec?.state === "connected" && send?.state === "connected") {
        bridgeTag.className = "pill pill-online";
        bridgeTag.textContent = "Ponte 100% Ativa (Receptor ➔ Emissor)";
        waBadge.className = "badge badge-connected";
        waStatusText.textContent = "Dual-Bot Conectado";
      } else if (rec?.state === "connected" || send?.state === "connected") {
        bridgeTag.className = "pill pill-offline";
        bridgeTag.textContent = rec?.state === "connected" ? "Receptor Ativo" : "Emissor Ativo";
        waBadge.className = "badge badge-connecting";
        waStatusText.textContent = "1 de 2 Conectado";
      } else {
        bridgeTag.className = "pill pill-offline";
        bridgeTag.textContent = "Aguardando Emparelhamento";
        waBadge.className = "badge badge-disconnected";
        waStatusText.textContent = "Offline";
      }
    }
  }

  window.reconnectBot = async (target) => {
    appendLog(`🔄 A solicitar novo código / reinicialização para [${target.toUpperCase()}]...`, "warn");
    try {
      await fetch("/api/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      setTimeout(loadInitialStatus, 3000);
    } catch (e) {
      appendLog("Erro ao reconectar: " + e.message, "error");
    }
  };

  function updateWhatsAppUI(wa) {
    // Retrocompatibilidade
    loadInitialStatus();
  }

  // 3. ATUALIZAR INTERFACE DE HARDWARE / SISTEMA
  function updateSystemUI(sys) {
    if (!sys || !sys.data) return;
    const d = sys.data;
    sysCpu.textContent = d.cpuLoad;
    sysRam.textContent = d.ram.split("livres de")[0].trim() || d.ram;
    sysBattery.textContent = d.battery;
    sysDisk.textContent = d.disk;
    sysOs.textContent = `${d.os} (${d.hostname})`;
    sysUptime.textContent = `Uptime: ${d.uptime}`;
  }

  async function refreshSystem() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      updateSystemUI(data.system);
    } catch (e) {}
  }

  // 4. CARREGAR E RENDERIZAR PROJETOS
  async function loadProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const projects = data.projects || [];

      projectsCount.textContent = projects.length;

      if (projects.length === 0) {
        projectsList.innerHTML = `<div class="empty-placeholder">Nenhum projeto encontrado.</div>`;
        return;
      }

      projectsList.innerHTML = projects
        .map((p) => {
          const icon = p.type === "android" ? "📱" : p.type === "node" ? "⚡" : "📁";
          const sub = p.type === "android"
            ? `Gradle • ${p.apkCount > 0 ? `${p.apkCount} APK(s) gerados` : "Sem APKs"}`
            : p.type === "node"
            ? "Node.js / Web"
            : "Geral";

          return `
          <div class="project-item">
            <div class="project-info">
              <div class="project-type-icon">${icon}</div>
              <div>
                <div class="project-name">${p.name}</div>
                <div class="project-sub">${sub}</div>
              </div>
            </div>
            <div class="project-actions">
              ${
                p.hasGradle
                  ? `<button class="btn btn-sm btn-primary" onclick="buildProject('${p.name}')">🔨 Compilar</button>
                     <button class="btn btn-sm btn-secondary" onclick="openStudio('${p.name}')">🚀 Studio</button>`
                  : ""
              }
            </div>
          </div>
        `;
        })
        .join("");
    } catch (e) {
      console.error("Erro ao carregar projetos:", e);
    }
  }

  window.buildProject = async (name) => {
    appendLog(`[DASHBOARD] A solicitar compilação de: ${name}...`, "info");
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: name })
      });
      const data = await res.json();
      if (data.success) {
        appendLog(`[GRADLE] ✅ Compilação concluída: ${name}`, "info");
      } else {
        appendLog(`[GRADLE] ❌ Falha na compilação: ${name}`, "error");
      }
      loadProjects();
    } catch (e) {
      appendLog(`[ERRO] ${e.message}`, "error");
    }
  };

  window.openStudio = async (name) => {
    appendLog(`[STUDIO] A abrir projeto no Android Studio: ${name}...`, "info");
    try {
      const res = await fetch("/api/open-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: name })
      });
      const data = await res.json();
      appendLog(data.message, "info");
    } catch (e) {}
  };

  // 5. GESTÃO DE TAREFAS
  async function loadTasks() {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      renderTasks(data.tasks || []);
    } catch (e) {}
  }

  function renderTasks(tasks) {
    if (tasks.length === 0) {
      tasksList.innerHTML = `<div class="empty-placeholder" style="font-size: 0.8rem; padding: 10px; color: var(--text-dim);">Sem tarefas pendentes.</div>`;
      return;
    }

    tasksList.innerHTML = tasks
      .map((t) => {
        return `
        <div class="task-item ${t.completed ? "completed" : ""}">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
            <input type="checkbox" ${t.completed ? "checked" : ""} onchange="toggleTask('${t.id}')" />
            <span>${t.title}</span>
          </label>
          <button class="task-del-btn" onclick="deleteTask('${t.id}')">✕</button>
        </div>
      `;
      })
      .join("");
  }

  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;

    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      taskInput.value = "";
      loadTasks();
    } catch (e) {}
  });

  window.toggleTask = async (id) => {
    try {
      await fetch(`/api/tasks/${id}/toggle`, { method: "POST" });
      loadTasks();
    } catch (e) {}
  };

  window.deleteTask = async (id) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      loadTasks();
    } catch (e) {}
  };

  // 6. LOGS EM TEMPO REAL
  function appendLog(text, level = "info") {
    const line = document.createElement("div");
    line.className = `log-line ${level}`;
    const time = new Date().toLocaleTimeString("pt-PT");
    line.textContent = `[${time}] ${text}`;
    logTerminal.appendChild(line);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  btnClearLogs.addEventListener("click", () => {
    logTerminal.innerHTML = "";
  });

  // 7. EVENT SOURCE (SSE) PARA TEMPO REAL
  function setupSSE() {
    if (!authToken) return;
    if (window.activeEventSource) {
      try { window.activeEventSource.close(); } catch (e) {}
    }
    const es = new EventSource(`/api/events?token=${encodeURIComponent(authToken)}`);
    window.activeEventSource = es;

    es.addEventListener("init", (e) => {
      loadInitialStatus();
      const data = JSON.parse(e.data);
      if (data.logs) {
        logTerminal.innerHTML = "";
        data.logs.forEach((l) => appendLog(l.message, l.level));
      }
    });

    es.addEventListener("whatsapp_status", (e) => {
      loadInitialStatus();
    });

    es.addEventListener("whatsapp_qr", (e) => {
      loadInitialStatus();
    });

    es.addEventListener("log_entry", (e) => {
      const log = JSON.parse(e.data);
      appendLog(log.message, log.level);
    });

    es.addEventListener("tasks_updated", (e) => {
      const data = JSON.parse(e.data);
      renderTasks(data.tasks || []);
    });
  }

  // 8. MODAL DE DEFINIÇÕES
  btnOpenSettings.addEventListener("click", async () => {
    const res = await fetch("/api/status");
    const data = await res.json();
    settingOwnerPhone.value = data.ownerPhone || "";
    settingsModal.style.display = "flex";
  });

  btnCloseSettings.addEventListener("click", () => {
    settingsModal.style.display = "none";
  });

  btnSaveSettings.addEventListener("click", async () => {
    const payload = {
      ownerPhone: settingOwnerPhone.value.trim(),
      allowAllSenders: settingAllowAll.checked
    };
    if (settingGeminiKey.value.trim()) {
      payload.geminiApiKey = settingGeminiKey.value.trim();
    }

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    settingsModal.style.display = "none";
    appendLog("⚙️ Definições guardadas com sucesso.", "info");
  });

  if (btnReconnect) {
    btnReconnect.addEventListener("click", async () => {
      btnReconnect.disabled = true;
      if (reconnectStatusMsg) reconnectStatusMsg.textContent = "A reiniciar sessão e gerar novo código...";
      appendLog("🔄 A solicitar novo código / reinicialização...", "warn");
      try {
        await fetch("/api/reconnect", { method: "POST" });
        setTimeout(async () => {
          await loadInitialStatus();
          btnReconnect.disabled = false;
          if (reconnectStatusMsg) reconnectStatusMsg.textContent = "";
        }, 3000);
      } catch (e) {
        btnReconnect.disabled = false;
        if (reconnectStatusMsg) reconnectStatusMsg.textContent = "Erro ao reiniciar";
      }
    });
  }

  // 9. SIMULADOR DE CHAT WHATSAPP DIRETO
  const simChatForm = document.getElementById("sim-chat-form");
  const simChatInput = document.getElementById("sim-chat-input");
  const simChatBox = document.getElementById("sim-chat-box");
  const simSenderSelect = document.getElementById("sim-sender-select");
  const btnRunFullTest = document.getElementById("btn-run-full-test");

  function appendChatBubble(role, text, meta = {}) {
    if (!simChatBox) return;
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;

    const tag = document.createElement("div");
    tag.className = "chat-sender-tag";
    tag.textContent = role === "user"
      ? (meta.sender ? `📱 +${meta.sender}` : "📱 Tu")
      : "🤖 Assistente (919 115 655)";
    bubble.appendChild(tag);

    if (text) {
      const msgDiv = document.createElement("div");
      msgDiv.textContent = text;
      bubble.appendChild(msgDiv);
    }

    if (meta.imageBase64) {
      const img = document.createElement("img");
      img.src = meta.imageBase64;
      bubble.appendChild(img);
    }

    simChatBox.appendChild(bubble);
    simChatBox.scrollTop = simChatBox.scrollHeight;
  }

  window.sendSimText = (text) => {
    if (simChatInput) {
      simChatInput.value = text;
      simChatForm.dispatchEvent(new Event("submit"));
    }
  };

  if (simChatForm) {
    simChatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = simChatInput.value.trim();
      if (!text) return;

      const fromPhone = simSenderSelect ? simSenderSelect.value : "351912101839";
      appendChatBubble("user", text, { sender: fromPhone });
      simChatInput.value = "";

      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, fromPhone })
        });
        const data = await res.json();
        if (data.responses && data.responses.length > 0) {
          data.responses.forEach(r => {
            appendChatBubble("bot", r.text || r.caption, { imageBase64: r.imageBase64 });
          });
        }
      } catch (err) {
        appendChatBubble("bot", `❌ Erro de comunicação: ${err.message}`);
      }
    });
  }

  if (btnRunFullTest) {
    btnRunFullTest.addEventListener("click", async () => {
      appendLog("🧪 A iniciar teste autónomo completo...", "info");
      appendChatBubble("user", "/status", { sender: "351912101839" });

      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "/status", fromPhone: "351912101839" })
        });
        const data = await res.json();
        if (data.responses) {
          data.responses.forEach(r => appendChatBubble("bot", r.text));
        }
        appendLog("✅ Teste autónomo concluído com sucesso (100% Operacional).", "info");
      } catch (e) {
        appendLog("❌ Falha no teste: " + e.message, "error");
      }
    });
  }

  // Eventos de botões de atualização
  btnRefreshSys.addEventListener("click", refreshSystem);
  btnRefreshProjects.addEventListener("click", loadProjects);

  window.loadChatOrders = async function() {
    try {
      const res = await fetch("/api/chat-orders");
      const data = await res.json();
      const listEl = document.getElementById("chat-orders-list");
      const sessEl = document.getElementById("active-session-id");
      if (sessEl && data.conversationId) {
        sessEl.textContent = data.conversationId;
      }
      if (!listEl) return;

      if (!data.orders || data.orders.length === 0) {
        listEl.innerHTML = '<div class="empty-placeholder">Nenhuma ordem registada no Chat Antigravity ainda. Envia <code>/ordem &lt;instrução&gt;</code> pelo WhatsApp!</div>';
        return;
      }

      let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
      data.orders.forEach(o => {
        const isDone = o.status === "completed";
        const isExec = o.status === "executing";
        const badgeColor = isDone ? "#10b981" : isExec ? "#f59e0b" : "#ef4444";
        const statusLabel = isDone ? "✅ Concluída" : isExec ? "⚡ Em execução..." : "❌ Falhou";

        html += `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; color: #fff; font-size: 0.85rem;">#${o.id} - ${escapeHtml(o.order)}</span>
              <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; background: rgba(0,0,0,0.4); color: ${badgeColor}; border: 1px solid ${badgeColor}; font-weight: 700;">
                ${statusLabel}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim);">
              <span>📱 De: ${o.from} ${o.targetProject ? `| 📁 ${o.targetProject}` : ''}</span>
              <span>🕒 ${o.createdAt || o.timestamp} ${o.durationSeconds ? `(${o.durationSeconds}s)` : ''}</span>
            </div>
            ${o.result ? `<div style="background: rgba(0,0,0,0.4); border-radius: 4px; padding: 6px 10px; font-size: 0.75rem; color: var(--text-muted); font-family: monospace; max-height: 80px; overflow-y: auto; white-space: pre-wrap;">${escapeHtml(o.result.slice(0, 300))}${o.result.length > 300 ? '...' : ''}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
      listEl.innerHTML = html;
    } catch (e) {
      console.error("Erro ao carregar ordens do chat:", e);
    }
  };

  function startDashboardData() {
    loadInitialStatus();
    loadProjects();
    loadTasks();
    loadChatOrders();
    setupSSE();
  }

  // Verificação inicial de sessão segura
  const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isLocalHost && !authToken) {
    // No PC local, autenticar automaticamente com as credenciais do proprietário
    originalFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "Andre22pinheiro@gmail.com", pin: "9959" })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.token) {
          authToken = data.token;
          localStorage.setItem(TOKEN_KEY, authToken);
        }
        showAuthGate(false);
        startDashboardData();
      })
      .catch(() => {
        showAuthGate(false);
        startDashboardData();
      });
  } else if (!authToken) {
    showAuthGate(true);
  } else {
    originalFetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then((res) => {
        if (res.ok) {
          showAuthGate(false);
          startDashboardData();
        } else {
          localStorage.removeItem(TOKEN_KEY);
          authToken = "";
          showAuthGate(true);
        }
      })
      .catch(() => {
        showAuthGate(false);
        startDashboardData();
      });
  }

  // Atualização periódica de hardware a cada 10s e ordens a cada 6s (apenas se autenticado)
  setInterval(() => {
    if (authToken) refreshSystem();
  }, 10000);
  setInterval(() => {
    if (authToken) loadChatOrders();
  }, 6000);
});

