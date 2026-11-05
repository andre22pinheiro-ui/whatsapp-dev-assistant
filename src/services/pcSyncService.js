import EventEmitter from "events";
import logger from "../utils/logger.js";
import antigravityService from "./antigravityService.js";

class PcSyncService extends EventEmitter {
  constructor() {
    super();
    this.lastHeartbeat = null;
    this.pcInfo = null;
    this.whatsappNotifier = null;
  }

  setWhatsappNotifier(notifier) {
    this.whatsappNotifier = notifier;
  }

  recordHeartbeat(info = {}) {
    this.lastHeartbeat = Date.now();
    this.pcInfo = {
      ...info,
      lastSeen: new Date().toISOString(),
      lastSeenFormatted: new Date().toLocaleTimeString("pt-PT")
    };
    this.emit("heartbeat", this.pcInfo);
  }

  isPcOnline(timeoutMs = 60000) {
    if (!this.lastHeartbeat) return false;
    return Date.now() - this.lastHeartbeat < timeoutMs;
  }

  getProjects() {
    return this.pcInfo?.projects || [];
  }

  getStatus() {
    const isOnline = this.isPcOnline();
    return {
      isOnline,
      lastHeartbeat: this.lastHeartbeat ? new Date(this.lastHeartbeat).toISOString() : null,
      lastHeartbeatFormatted: this.pcInfo?.lastSeenFormatted || "Nunca visto",
      pcInfo: this.pcInfo || null,
      pendingOrdersCount: this.getPendingOrders().length
    };
  }

  getPendingOrders() {
    const orders = antigravityService.getOrders();
    return orders.filter((o) => o.status === "queued_for_pc");
  }

  queueOrderForPc(order) {
    antigravityService.updateOrder(order.id, {
      status: "queued_for_pc",
      queuedAt: new Date().toISOString()
    });
    logger.info(`📥 Ordem #${order.id} guardada na fila de espera para o PC.`);
    this.emit("order_queued", order);
  }

  async completeOrder(orderId, { success, output, durationSeconds }) {
    const updated = antigravityService.updateOrder(orderId, {
      status: success ? "completed" : "failed",
      result: output,
      durationSeconds: durationSeconds || 0,
      completedAt: new Date().toLocaleString("pt-PT")
    });

    if (!updated) {
      logger.warn(`Ordem #${orderId} não encontrada para conclusão`);
      return null;
    }

    logger.info(`✅ Ordem #${orderId} concluída pelo PC (Sucesso: ${success})`);
    this.emit("order_completed", updated);

    // Notificar WhatsApp se houver notificador configurado
    if (this.whatsappNotifier && typeof this.whatsappNotifier === "function") {
      try {
        await this.whatsappNotifier(updated);
      } catch (err) {
        logger.error(`Erro ao notificar conclusão da ordem #${orderId} no WhatsApp:`, err);
      }
    }

    return updated;
  }
}

export const pcSyncService = new PcSyncService();
export default pcSyncService;

