import EventEmitter from "events";

class DashboardLogger extends EventEmitter {
  constructor(maxLogs = 200) {
    super();
    this.maxLogs = maxLogs;
    this.logs = [];
  }

  log(level, message, meta = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === "object" ? JSON.stringify(message) : String(message),
      meta
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const timeStr = new Date().toLocaleTimeString("pt-PT");
    const prefix = `[${timeStr}] [${level.toUpperCase()}]`;

    if (level === "error") {
      console.error(prefix, message, meta || "");
    } else if (level === "warn") {
      console.warn(prefix, message, meta || "");
    } else {
      console.log(prefix, message, meta || "");
    }

    this.emit("log", entry);
  }

  info(msg, meta) {
    this.log("info", msg, meta);
  }

  warn(msg, meta) {
    this.log("warn", msg, meta);
  }

  error(msg, meta) {
    this.log("error", msg, meta);
  }

  getRecentLogs() {
    return [...this.logs];
  }
}

export const logger = new DashboardLogger();
export default logger;

