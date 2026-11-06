import { readData, writeData } from "../utils/storage.js";
import logger from "../utils/logger.js";

let reminderCallback = null;
const activeTimers = new Map();

export function setReminderNotifier(cb) {
  reminderCallback = cb;
}

// 1. GESTÃO DE TAREFAS (TO-DO)
export function getTasks() {
  return readData("tasks", []);
}

export function addTask(title) {
  const tasks = getTasks();
  const newTask = {
    id: Date.now().toString(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };
  tasks.push(newTask);
  writeData("tasks", tasks);
  logger.info(`Nova tarefa criada: "${newTask.title}"`);
  return newTask;
}

export function toggleTask(id) {
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === String(id) || t.id.endsWith(String(id)));
  if (!task) return null;
  task.completed = !task.completed;
  writeData("tasks", tasks);
  return task;
}

export function deleteTask(id) {
  let tasks = getTasks();
  const initialLen = tasks.length;
  tasks = tasks.filter((t) => t.id !== String(id) && !t.id.endsWith(String(id)));
  if (tasks.length !== initialLen) {
    writeData("tasks", tasks);
    return true;
  }
  return false;
}

// 2. GESTÃO DE LEMBRETES (REMINDERS)
export function getReminders() {
  return readData("reminders", []);
}

// Agendar lembrete (ex: "10m", "2h", "30s" ou "18:30")
export function scheduleReminder(timeExpr, text, targetJid = null) {
  let delayMs = 0;
  const now = new Date();

  // Caso A: Formato relativo (ex: 10m, 2h, 45s)
  const relMatch = timeExpr.match(/^(\d+)(s|m|h|d)$/i);
  if (relMatch) {
    const val = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    if (unit === "s") delayMs = val * 1000;
    else if (unit === "m") delayMs = val * 60 * 1000;
    else if (unit === "h") delayMs = val * 3600 * 1000;
    else if (unit === "d") delayMs = val * 86400 * 1000;
  }
  // Caso B: Formato horário HH:mm (ex: 18:30)
  else if (timeExpr.includes(":")) {
    const [hours, minutes] = timeExpr.split(":").map((v) => parseInt(v, 10));
    const targetDate = new Date();
    targetDate.setHours(hours, minutes, 0, 0);

    if (targetDate <= now) {
      // Se a hora já passou hoje, agenda para amanhã
      targetDate.setDate(targetDate.getDate() + 1);
    }
    delayMs = targetDate.getTime() - now.getTime();
  } else {
    // Número direto interpretado como minutos
    const mins = parseInt(timeExpr, 10);
    if (!isNaN(mins) && mins > 0) {
      delayMs = mins * 60 * 1000;
    }
  }

  if (delayMs <= 0) {
    return {
      success: false,
      message: `Formato de tempo inválido: "${timeExpr}". Exemplos válidos: "15m", "2h", "18:30", "45s".`
    };
  }

  const reminder = {
    id: Date.now().toString(),
    text: text.trim(),
    timeExpr,
    triggerAt: new Date(now.getTime() + delayMs).toISOString(),
    targetJid,
    fired: false
  };

  const reminders = getReminders();
  reminders.push(reminder);
  writeData("reminders", reminders);

  const timer = setTimeout(() => {
    fireReminder(reminder.id);
  }, delayMs);

  activeTimers.set(reminder.id, timer);
  logger.info(`Lembrete agendado para daqui a ${(delayMs / 60000).toFixed(1)} min: "${text}"`);

  const triggerDate = new Date(now.getTime() + delayMs);
  const gcalUrl = generateGoogleCalendarUrl(text.trim(), triggerDate);
  const ics = generateIcsContent(text.trim(), triggerDate);

  return {
    success: true,
    reminder,
    delayMinutes: (delayMs / 60000).toFixed(1),
    googleCalendarUrl: gcalUrl,
    icsContent: ics,
    triggerDate
  };
}

function fireReminder(id) {
  const reminders = getReminders();
  const rem = reminders.find((r) => r.id === id);
  if (!rem) return;

  rem.fired = true;
  writeData("reminders", reminders);
  activeTimers.delete(id);

  logger.info(`🔔 A disparar lembrete: "${rem.text}"`);

  if (reminderCallback) {
    reminderCallback(rem);
  }
}

// 3. NOTAS RÁPIDAS
export function getNotes() {
  return readData("notes", []);
}

export function addNote(title, content) {
  const notes = getNotes();
  const note = {
    id: Date.now().toString(),
    title: title.trim(),
    content: (content || "").trim(),
    createdAt: new Date().toISOString()
  };
  notes.push(note);
  writeData("notes", notes);
  return note;
}

// 4. INTEGRAÇÃO GOOGLE CALENDAR
export function generateGoogleCalendarUrl(title, startDate, durationMinutes = 30) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const dates = `${formatGCal(start)}/${formatGCal(end)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent("Evento guardado via WhatsApp Dev Assistant")}&add=Andre22pinheiro@gmail.com`;
}

export function generateIcsContent(title, startDate, durationMinutes = 30) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const formatIcs = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WhatsApp Dev Assistant//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:evt-${Date.now()}@whatsapp-dev-assistant`,
    `DTSTAMP:${formatIcs(new Date())}`,
    `DTSTART:${formatIcs(start)}`,
    `DTEND:${formatIcs(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:Evento gerado pelo WhatsApp Dev Assistant para Andre22pinheiro@gmail.com`,
    `ORGANIZER;CN=WhatsApp Assistant:mailto:Andre22pinheiro@gmail.com`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

// 5. LISTA DE COMPRAS NA NUVEM (SHOPPING LIST & STOCK)
export function getShoppingList() {
  return readData("shopping_list", [
    { id: "shp_1", text: "Café em grão", category: "Alimentação", qty: "1 pacote", completed: false, createdAt: new Date().toISOString() },
    { id: "shp_2", text: "Água mineral", category: "Alimentação", qty: "1 garrafão", completed: false, createdAt: new Date().toISOString() }
  ]);
}

export function addShoppingItem(text, category = "Geral", qty = "") {
  const items = getShoppingList();
  const newItem = {
    id: "shp_" + Date.now().toString(),
    text: text.trim(),
    category: category.trim() || "Geral",
    qty: (qty || "").trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };
  items.push(newItem);
  writeData("shopping_list", items);
  logger.info(`🛒 Item adicionado à Lista de Compras: "${newItem.text}" (${newItem.qty || '1 un'})`);
  return newItem;
}

export function toggleShoppingItem(identifier) {
  const items = getShoppingList();
  const idStr = String(identifier).toLowerCase().trim();
  const item = items.find((i) => i.id === idStr || i.id.endsWith(idStr) || i.text.toLowerCase().includes(idStr));
  if (!item) return null;
  item.completed = !item.completed;
  writeData("shopping_list", items);
  return item;
}

export function removeShoppingItem(identifier) {
  let items = getShoppingList();
  const initialLen = items.length;
  const idStr = String(identifier).toLowerCase().trim();
  items = items.filter((i) => i.id !== idStr && !i.id.endsWith(idStr) && !i.text.toLowerCase().includes(idStr));
  if (items.length !== initialLen) {
    writeData("shopping_list", items);
    return true;
  }
  return false;
}

export function clearCheckedShoppingItems() {
  let items = getShoppingList();
  items = items.filter((i) => !i.completed);
  writeData("shopping_list", items);
  return items;
}

export function formatShoppingList() {
  const items = getShoppingList();
  if (!items || items.length === 0) {
    return "🛒 *LISTA DE COMPRAS NA NUVEM*\n━━━━━━━━━━━━━━━━━━━━━━━━\nA tua lista está vazia! Não precisas de comprar nada.\n\n💡 _Para adicionar:_ `/comprar <item> [quantidade]` ou _\"adicionar leite à lista\"_";
  }

  const pending = items.filter((i) => !i.completed);
  const bought = items.filter((i) => i.completed);

  const sb = [];
  sb.push("🛒 *LISTA DE COMPRAS NA NUVEM*");
  sb.push("━━━━━━━━━━━━━━━━━━━━━━━━");

  if (pending.length > 0) {
    sb.push(`📋 *POR COMPRAR (${pending.length}):*`);
    pending.forEach((it, idx) => {
      const q = it.qty ? ` _(${it.qty})_` : "";
      sb.push(`  ${idx + 1}. ⭕ *${it.text}*${q} [${it.category}]`);
    });
  } else {
    sb.push("🎉 Todos os artigos foram comprados!");
  }

  if (bought.length > 0) {
    sb.push("");
    sb.push(`✅ *COMPRADOS / NO CARRINHO (${bought.length}):*`);
    bought.forEach((it) => {
      sb.push(`  • ~${it.text}~`);
    });
  }

  sb.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  sb.push("💡 _Comandos Rápidos:_");
  sb.push("• `/comprar <artigo>` - Adiciona novo item");
  sb.push("• `/riscar <artigo ou número>` - Marca como comprado");
  sb.push("• `/limpar_compras` - Remove os comprados");

  return sb.join("\n");
}

// 6. GESTÃO DE DESPESAS RÁPIDAS
export function getExpenses() {
  return readData("expenses", []);
}

export function addExpense(amount, category = "Geral", description = "") {
  const expenses = getExpenses();
  const num = parseFloat(String(amount).replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
  const newExp = {
    id: "exp_" + Date.now().toString(),
    amount: num,
    category: (category || "Geral").trim(),
    description: (description || "").trim(),
    date: new Date().toISOString()
  };
  expenses.push(newExp);
  writeData("expenses", expenses);
  return newExp;
}

export function formatExpenseSummary() {
  const expenses = getExpenses();
  if (expenses.length === 0) {
    return "💰 *CONTROLO DE DESPESAS:* Nenhuma despesa registada ainda.\n💡 _Para registar:_ `/despesa 50€ em gasóleo`";
  }

  const total = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const recent = expenses.slice(-5).reverse();

  const lines = recent.map((e) => `• *${e.amount.toFixed(2)}€* - ${e.description || e.category} (${new Date(e.date).toLocaleDateString("pt-PT")})`);
  return (
    `💰 *REGISTO DE DESPESAS & GASTOS*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💳 *Total Acumulado:* *${total.toFixed(2)}€*\n\n` +
    `📝 *Últimos Gastos:*\n${lines.join("\n")}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 _Para adicionar:_ \`/despesa <valor>€ <descrição>\``
  );
}

export default {
  getTasks,
  addTask,
  toggleTask,
  deleteTask,
  getReminders,
  scheduleReminder,
  setReminderNotifier,
  getNotes,
  addNote,
  getShoppingList,
  addShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  clearCheckedShoppingItems,
  formatShoppingList,
  getExpenses,
  addExpense,
  formatExpenseSummary,
  generateGoogleCalendarUrl,
  generateIcsContent
};

