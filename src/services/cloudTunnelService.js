import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import EventEmitter from "events";
import config from "../config.js";
import logger from "../utils/logger.js";

class CloudTunnelService extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.cloudUrl = null;
    this.status = "stopped"; // "stopped" | "starting" | "connected" | "error"
    this.reconnectTimer = null;
    this.errorMsg = null;
  }

  isCloudflaredAvailable() {
    const cfPath = config.cloudflaredPath || "C:\\Users\\Surface_Dpc\\Desktop\\projectos\\PC-Remote-Portatil\\cloudflared.exe";
    return fs.existsSync(cfPath);
  }

  getCloudflaredPath() {
    return config.cloudflaredPath || "C:\\Users\\Surface_Dpc\\Desktop\\projectos\\PC-Remote-Portatil\\cloudflared.exe";
  }

  getCloudUrl() {
    return this.cloudUrl;
  }

  getStatus() {
    return {
      status: this.status,
      cloudUrl: this.cloudUrl,
      isAvailable: this.isCloudflaredAvailable(),
      error: this.errorMsg
    };
  }

  startTunnel(port = null) {
    const targetPort = port || config.port || 3333;
    const cfPath = this.getCloudflaredPath();

    if (!fs.existsSync(cfPath)) {
      this.status = "error";
      this.errorMsg = `cloudflared.exe não encontrado em ${cfPath}`;
      logger.warn(`[NUVEM] ${this.errorMsg}`);
      return false;
    }

    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {}
      this.process = null;
    }

    this.status = "starting";
    this.cloudUrl = null;
    this.errorMsg = null;
    logger.info(`☁️ [NUVEM] A iniciar Túnel Cloudflare para porta ${targetPort}...`);

    try {
      this.process = spawn(cfPath, ["tunnel", "--url", `http://localhost:${targetPort}`], {
        shell: false
      });

      const handleOutput = (data) => {
        const text = data.toString();
        // Procurar URL do Cloudflare Tunnel
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0] && !this.cloudUrl) {
          this.cloudUrl = match[0];
          this.status = "connected";
          logger.info(`☁️ [NUVEM] ✅ TÚNEL CLOUD ATIVO: ${this.cloudUrl}`);
          logger.info(`🌐 Podes aceder ao teu assistente em qualquer lugar do mundo através de: ${this.cloudUrl}`);
          this.emit("tunnel_ready", this.cloudUrl);
        }
      };

      this.process.stdout.on("data", handleOutput);
      this.process.stderr.on("data", handleOutput);

      this.process.on("close", (code) => {
        logger.warn(`[NUVEM] Túnel Cloudflare fechado (Código: ${code})`);
        this.status = "stopped";
        this.cloudUrl = null;

        // Auto-reconectar após 10s se não foi intencional
        if (code !== 0 && !this.manualStop) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            logger.info("[NUVEM] A restabelecer Túnel Cloudflare...");
            this.startTunnel(targetPort);
          }, 10000);
        }
      });

      this.process.on("error", (err) => {
        this.status = "error";
        this.errorMsg = err.message;
        logger.error(`[NUVEM] Erro no processo Cloudflare: ${err.message}`);
      });

      return true;
    } catch (err) {
      this.status = "error";
      this.errorMsg = err.message;
      logger.error(`[NUVEM] Falha ao arrancar túnel: ${err.message}`);
      return false;
    }
  }

  stopTunnel() {
    this.manualStop = true;
    clearTimeout(this.reconnectTimer);
    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {}
      this.process = null;
    }
    this.status = "stopped";
    this.cloudUrl = null;
  }
}

export const cloudTunnel = new CloudTunnelService();
export default cloudTunnel;

