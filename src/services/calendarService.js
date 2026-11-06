import fs from "fs";
import path from "path";
import config from "../config.js";
import logger from "../utils/logger.js";
import { readData, writeData } from "../utils/storage.js";

const CALENDAR_STORAGE_KEY = "calendar_events";
let reminderNotifier = null;
let schedulerInterval = null;

export function setCalendarNotifier(notifier) {
  reminderNotifier = notifier;
}

/**
 * Obter todos os eventos registados
 */
export function getAllEvents() {
  return readData(CALENDAR_STORAGE_KEY, []);
}

/**
 * Guardar lista de eventos
 */
function saveEvents(events) {
  writeData(CALENDAR_STORAGE_KEY, events);
}

/**
 * Adicionar novo evento ao calendário
 */
export function addEvent({ title, date, time, durationMinutes = 60, location = "", notes = "", source = "quick_whatsapp" }) {
  const events = getAllEvents();

  // Calcular data e hora completas
  const now = new Date();
  let eventDate = date; // YYYY-MM-DD
  let eventTime = time || "09:00"; // HH:mm

  if (!eventDate) {
    eventDate = now.toISOString().split("T")[0];
  }

  // Normalizar hora (ex: "15h" -> "15:00", "9" -> "09:00")
  if (eventTime.toLowerCase().endsWith("h")) {
    const hourPart = eventTime.slice(0, -1);
    eventTime = `${hourPart.padStart(2, "0")}:00`;
  } else if (!eventTime.includes(":")) {
    eventTime = `${eventTime.padStart(2, "0")}:00`;
  } else {
    const [h, m] = eventTime.split(":");
    eventTime = `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
  }

  const dateTimeIso = `${eventDate}T${eventTime}:00`;

  const newEvent = {
    id: "evt_" + Date.now().toString(),
    title: title.trim(),
    date: eventDate,
    time: eventTime,
    dateTime: dateTimeIso,
    durationMinutes: parseInt(durationMinutes, 10) || 60,
    location: (location || "").trim(),
    notes: (notes || "").trim(),
    source,
    reminded15m: false,
    remindedOnTime: false,
    createdAt: new Date().toISOString()
  };

  events.push(newEvent);
  // Ordenar por data/hora
  events.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  saveEvents(events);

  logger.info(`📅 Novo evento agendado: "${newEvent.title}" para ${newEvent.date} às ${newEvent.time}`);
  return newEvent;
}

/**
 * Eliminar evento por ID
 */
export function deleteEvent(id) {
  const events = getAllEvents();
  const filtered = events.filter((e) => e.id !== id && !e.id.endsWith(id));
  if (filtered.length !== events.length) {
    saveEvents(filtered);
    return true;
  }
  return false;
}

/**
 * Parser de frases rápidas em Português para absorver eventos instantaneamente
 * Ex: "amanhã às 15h Reunião de obras"
 * Ex: "hoje 18:30 Ginásio"
 * Ex: "sexta às 14h Consulta dentista"
 * Ex: "dia 15/11 às 10:00 Vistoria técnica"
 */
export function parseQuickEventPhrase(phrase) {
  if (!phrase || typeof phrase !== "string") return null;
  const raw = phrase.trim();
  const lower = raw.toLowerCase();

  const now = new Date();
  let targetDate = new Date();
  let foundTime = null;
  let cleanTitle = raw;

  // 1. Deteção de Dia Relativo ou Específico
  if (lower.startsWith("amanhã") || lower.startsWith("amanha")) {
    targetDate.setDate(now.getDate() + 1);
    cleanTitle = cleanTitle.replace(/^amanh[aã]\s*(às|as)?\s*/i, "");
  } else if (lower.startsWith("depois de amanhã") || lower.startsWith("depois de amanha")) {
    targetDate.setDate(now.getDate() + 2);
    cleanTitle = cleanTitle.replace(/^depois de amanh[aã]\s*(às|as)?\s*/i, "");
  } else if (lower.startsWith("hoje")) {
    targetDate = new Date();
    cleanTitle = cleanTitle.replace(/^hoje\s*(às|as)?\s*/i, "");
  } else {
    // Deteção de dias da semana (segunda, terça, quarta, quinta, sexta, sábado, domingo)
    const weekDays = [
      { names: ["domingo"], dayIdx: 0 },
      { names: ["segunda", "segunda-feira", "2ª"], dayIdx: 1 },
      { names: ["terça", "terca", "terça-feira", "terca-feira", "3ª"], dayIdx: 2 },
      { names: ["quarta", "quarta-feira", "4ª"], dayIdx: 3 },
      { names: ["quinta", "quinta-feira", "5ª"], dayIdx: 4 },
      { names: ["sexta", "sexta-feira", "6ª"], dayIdx: 5 },
      { names: ["sábado", "sabado"], dayIdx: 6 }
    ];

    for (const wd of weekDays) {
      for (const name of wd.names) {
        if (lower.startsWith(name)) {
          const currentDay = now.getDay();
          let diff = wd.dayIdx - currentDay;
          if (diff <= 0) diff += 7; // Próximo dia correspondente
          targetDate.setDate(now.getDate() + diff);
          cleanTitle = cleanTitle.replace(new RegExp(`^${name}\\s*(às|as)?\\s*`, "i"), "");
          break;
        }
      }
    }

    // Deteção de formato "dia DD/MM" ou "dia DD"
    const dateMatch = cleanTitle.match(/^dia\s+(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{2,4}))?\s*(às|as)?\s*/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = dateMatch[2] ? parseInt(dateMatch[2], 10) - 1 : now.getMonth();
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
      targetDate = new Date(year, month, day);
      cleanTitle = cleanTitle.replace(dateMatch[0], "");
    }
  }

  // 2. Deteção de Hora (ex: 15:30, 15h30, 15h, 9h, 18:00)
  const timeMatch = cleanTitle.match(/(?:às|as|\s|^)(\d{1,2})(?:[:h](\d{2})|h)?(?:\s|$)/i);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      foundTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      cleanTitle = cleanTitle.replace(timeMatch[0], " ").trim();
    }
  }

  // Limpeza de palavras conetoras no início do título
  cleanTitle = cleanTitle.replace(/^(às|as|para|de|em|com)\s+/i, "").trim();
  if (!cleanTitle) cleanTitle = "Evento sem título";

  const yyyy = targetDate.getFullYear();
  const mm = (targetDate.getMonth() + 1).toString().padStart(2, "0");
  const dd = targetDate.getDate().toString().padStart(2, "0");
  const formattedDate = `${yyyy}-${mm}-${dd}`;

  return {
    title: cleanTitle,
    date: formattedDate,
    time: foundTime || "09:00"
  };
}

/**
 * Obter eventos futuros ou de um período
 */
export function getUpcomingEvents(days = 14) {
  const events = getAllEvents();
  const now = new Date();
  const maxDate = new Date(now.getTime() + days * 86400 * 1000);

  return events.filter((e) => {
    const eventTime = new Date(e.dateTime);
    return eventTime >= new Date(now.getTime() - 7200000) && eventTime <= maxDate;
  });
}

/**
 * Obter eventos de um dia específico (YYYY-MM-DD)
 */
export function getEventsForDay(dateStr) {
  const events = getAllEvents();
  return events.filter((e) => e.date === dateStr);
}

/**
 * Pesquisar eventos por palavra-chave (título, notas, local)
 */
export function searchEvents(query) {
  if (!query) return getUpcomingEvents(14);
  const q = query.toLowerCase().trim();
  const events = getAllEvents();
  return events.filter(
    (e) =>
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q))
  );
}

/**
 * Verificar se existe conflito de horário no mesmo dia
 */
export function checkConflicts(date, time, durationMinutes = 60) {
  const dayEvents = getEventsForDay(date);
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  const newStart = h * 60 + (m || 0);
  const newEnd = newStart + durationMinutes;

  const conflicts = [];
  for (const ev of dayEvents) {
    const [eh, em] = ev.time.split(":").map((v) => parseInt(v, 10));
    const evStart = eh * 60 + (em || 0);
    const evEnd = evStart + (ev.durationMinutes || 60);

    // Sobreposição de intervalos: max(start1, start2) < min(end1, end2)
    if (Math.max(newStart, evStart) < Math.min(newEnd, evEnd)) {
      conflicts.push(ev);
    }
  }
  return conflicts;
}

/**
 * Formatar agenda detalhada de um dia (Hoje, Amanhã ou data específica)
 */
export function formatDayAgenda(targetDateStr = null, label = null) {
  const now = new Date();
  const dateStr = targetDateStr || now.toISOString().split("T")[0];
  const events = getEventsForDay(dateStr);
  const dayLabel = label || (dateStr === now.toISOString().split("T")[0] ? "HOJE" : dateStr);

  if (!events || events.length === 0) {
    return (
      `📅 *AGENDA DE ${dayLabel.toUpperCase()} (${dateStr}):*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Sem eventos agendados para este dia.\n\n` +
      `💡 _Para anotar um evento:_\n` +
      `\`agenda ${dayLabel.toLowerCase()} às 15h Reunião de Obra\``
    );
  }

  let text = `📅 *AGENDA DE ${dayLabel.toUpperCase()} (${dateStr}) - ${events.length} EVENTO(S):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  events.forEach((e, idx) => {
    const loc = e.location ? `\n   📍 _Local:_ ${e.location}` : "";
    const notes = e.notes ? `\n   📝 _Notas:_ ${e.notes}` : "";
    text += `${idx + 1}. 🕒 *${e.time}* - *${e.title}*${loc}${notes}\n`;
  });
  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para rever a semana completa:_ \`/agenda\`\n💡 _Para cancelar:_ \`/cancelar-evento <id>\``;
  return text;
}

/**
 * Formatar lista de eventos para o WhatsApp
 */
export function formatAgenda(events = null) {
  const list = events || getUpcomingEvents(7);
  if (!list || list.length === 0) {
    return "📅 *CALENDÁRIO & AGENDA:*\n━━━━━━━━━━━━━━━━━━━━━━━━\nNenhum evento agendado para os próximos 7 dias.\n\n💡 _Para adicionar um evento rápido, basta escrever:_\n`agenda amanhã às 15h Reunião de Obras`\nou\n`/evento sexta 10:30 Consulta Médica`";
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  let text = `📅 *TUA AGENDA & EVENTOS (${list.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  list.forEach((e, idx) => {
    let dayLabel = e.date;
    if (e.date === todayStr) dayLabel = "🚨 *HOJE*";
    else if (e.date === tomorrowStr) dayLabel = "📌 *AMANHÃ*";
    else {
      try {
        const d = new Date(e.date + "T00:00:00");
        const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        dayLabel = `${weekdays[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
      } catch (err) {}
    }

    const loc = e.location ? `\n   📍 _Local:_ ${e.location}` : "";
    text += `${idx + 1}. ${dayLabel} às *${e.time}*\n   📝 *${e.title}*${loc}\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para adicionar:_ \`agenda <quando> <o que>\`\n💡 _Exemplo:_ \`agenda amanhã às 14h Reunião com Engenheiro\``;
  return text;
}

/**
 * Verificador automático de lembretes de eventos a cada minuto
 */
export function startCalendarScheduler() {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    try {
      const events = getAllEvents();
      const now = new Date();
      let modified = false;

      for (const ev of events) {
        const evDate = new Date(ev.dateTime);
        const diffMs = evDate.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / 60000);

        // Notificar 15 minutos antes (entre 10 e 16 minutos)
        if (diffMins <= 15 && diffMins > 0 && !ev.reminded15m) {
          ev.reminded15m = true;
          modified = true;
          if (reminderNotifier) {
            const locText = ev.location ? `\n📍 *Local:* ${ev.location}` : "";
            await reminderNotifier({
              text: `⏰ *LEMBRETE DE EVENTO (EM 15 MINUTOS):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n📌 *${ev.title}*\n🕒 *Hora:* ${ev.time}${locText}\n━━━━━━━━━━━━━━━━━━━━━━━━`
            });
          }
        }

        // Notificar na hora exata
        if (diffMins <= 0 && diffMins >= -3 && !ev.remindedOnTime) {
          ev.remindedOnTime = true;
          modified = true;
          if (reminderNotifier) {
            const locText = ev.location ? `\n📍 *Local:* ${ev.location}` : "";
            await reminderNotifier({
              text: `🔔 *O TEU EVENTO ESTÁ A COMEÇAR AGORA!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n📌 *${ev.title}*\n🕒 *Hora:* ${ev.time}${locText}\n━━━━━━━━━━━━━━━━━━━━━━━━`
            });
          }
        }
      }

      if (modified) {
        saveEvents(events);
      }
    } catch (e) {
      logger.warn("Erro no agendador de calendário:", e.message);
    }
  }, 60000); // A cada 1 minuto
}

export default {
  getAllEvents,
  getEventsForDay,
  searchEvents,
  checkConflicts,
  formatDayAgenda,
  addEvent,
  deleteEvent,
  parseQuickEventPhrase,
  getUpcomingEvents,
  formatAgenda,
  setCalendarNotifier,
  startCalendarScheduler
};

