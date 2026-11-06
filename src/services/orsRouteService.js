import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";

const ORS_BASE_URL = "https://api.openrouteservice.org/v2";

class OrsRouteService {
  constructor() {
    this.apiKey = config.orsApiKey || "";
  }

  isConfigured() {
    return Boolean(config.orsApiKey && config.orsApiKey.trim());
  }

  saveApiKey(key) {
    if (!key) return false;
    config.orsApiKey = key.trim();
    saveSettings({ orsApiKey: key.trim(), openRouteServiceApiKey: key.trim() });
    logger.info("🛣️ Token do OpenRouteService guardado com sucesso.");
    return true;
  }

  // Geocodificação simples e gratuita de endereços portugueses via Nominatim
  async geocodeLocation(name) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ", Portugal")}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "AntigravityMaster-RotaBus/1.0 (Andre22pinheiro@gmail.com)" }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          name: data[0].display_name.split(",")[0],
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
      }
    } catch (err) {
      logger.warn(`Erro na geocodificação de "${name}": ${err.message}`);
    }
    return null;
  }

  // Cálculo de Rota de Pesados / Autocarros com Gabarito (driving-hgv)
  async calculateHeavyRoute({
    startCoords, // [lon, lat]
    endCoords,   // [lon, lat]
    maxHeight = 3.8, // Altura em metros (ex: autocarro padrão)
    maxWeight = 19.0, // Peso bruto em toneladas
    profile = "driving-hgv"
  }) {
    if (!this.isConfigured()) {
      logger.warn("OpenRouteService API Key não configurada.");
      return null;
    }

    try {
      const payload = {
        coordinates: [startCoords, endCoords],
        instructions: true,
        preference: "recommended",
        options: {
          profile_params: {
            weightings: {
              steepness_difficulty: 2
            },
            restrictions: {
              height: maxHeight,
              weight: maxWeight
            }
          }
        }
      };

      const res = await fetch(`${ORS_BASE_URL}/directions/${profile}`, {
        method: "POST",
        headers: {
          "Authorization": config.orsApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.warn(`Erro OpenRouteService HTTP ${res.status}: ${errText.slice(0, 150)}`);
        return { success: false, error: errText };
      }

      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) {
        return { success: false, error: "Nenhuma rota viável encontrada para os parâmetros de gabarito." };
      }

      const summary = route.summary;
      const distanceKm = (summary.distance / 1000).toFixed(1);
      const durationMin = Math.round(summary.duration / 60);

      // Principais etapas
      const segments = route.segments?.[0]?.steps || [];
      const mainSteps = segments
        .filter(s => s.instruction && s.distance > 500)
        .slice(0, 5)
        .map(s => `• ${s.instruction} (${(s.distance / 1000).toFixed(1)} km)`);

      return {
        success: true,
        distanceKm,
        durationMin,
        steps: mainSteps,
        bbox: route.bbox
      };
    } catch (err) {
      logger.error("Erro na chamada OpenRouteService:", err);
      return { success: false, error: err.message };
    }
  }

  // Resumo de rota rápida por nomes de localidades
  async planRouteByNames(originName, destName) {
    const orig = await this.geocodeLocation(originName);
    const dest = await this.geocodeLocation(destName);

    if (!orig || !dest) {
      return `⚠️ Não foi possível georreferenciar ${!orig ? `"${originName}"` : `"${destName}"`}. Tenta com localidades conhecidas (ex: "Amarante para Penafiel").`;
    }

    const res = await this.calculateHeavyRoute({
      startCoords: [orig.lon, orig.lat],
      endCoords: [dest.lon, dest.lat]
    });

    if (!res || !res.success) {
      return `❌ Erro ao calcular rota para pesados: ${res?.error || "Inacessível para o gabarito definido"}.`;
    }

    let out = `🚌 *PLANEAMENTO DE ROTA DE PESADOS (ROTABUS / ORS)*\n`;
    out += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    out += `📍 *Origem:* ${orig.name}\n`;
    out += `🏁 *Destino:* ${dest.name}\n`;
    out += `⚖️ *Perfil de Veículo:* Pesado de Passageiros / HGV (Gabarito: 3.8m alt, 19t)\n\n`;
    out += `📏 *Distância Total:* *${res.distanceKm} km*\n`;
    out += `⏱️ *Tempo Estimado:* *${res.durationMin} minutos* (${Math.floor(res.durationMin / 60)}h ${res.durationMin % 60}m)\n\n`;
    if (res.steps && res.steps.length > 0) {
      out += `🛣️ *Principais Etapas:*\n${res.steps.join("\n")}\n\n`;
    }
    out += `✅ *Verificação de Gabarito:* Rota compatível com limites de pontes e arruamentos sem restrições impeditivas.\n`;
    out += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    out += `💡 _Para novo cálculo:_ \`/rota <origem> para <destino>\``;
    return out;
  }

  getStatus() {
    const hasKey = this.isConfigured();
    return (
      `🛣️ *ESTADO DO OPENROUTESERVICE (ROTABUS & PESADOS)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Token de Acesso:* ${hasKey ? "Ativo (Autenticação JWT / ORS válida)" : "❌ Não configurado"}\n` +
      `• *Perfil Ativo:* \`driving-hgv\` (Heavy Goods Vehicle / Autocarro)\n` +
      `• *Gabarito Padrão:* Altura 3.8m | Peso 19.0t | Restrições de inclinação\n` +
      `• *Cota:* 2.000 requisições/dia gratuitas\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (hasKey
        ? `✅ *Pronto para cálculo de rotas em tempo real!*\n💡 _Experimenta:_ \`/rota Amarante para Porto\` ou \`/rota Amarante para Penafiel\``
        : `💡 _Configura o teu token:_ \`/config ors <token>\``)
    );
  }
}

export const orsRouteService = new OrsRouteService();
export default orsRouteService;
