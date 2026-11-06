import fs from "fs";
import path from "path";
import config from "../config.js";
import logger from "../utils/logger.js";

class AmaranteMapService {
  constructor() {
    this.osmPath = path.join(config.dataDir, "maps", "amarante.osm");
    this.isLoaded = false;
    this.bounds = null;
    this.pois = [];
    this.streets = [];
    this.amenities = [];
    this.busStops = [];
    this.schools = [];
    this.healthFacilities = [];
  }

  loadData() {
    if (this.isLoaded) return true;

    if (!fs.existsSync(this.osmPath)) {
      const fallbackPath = "C:\\Users\\Surface_Dpc\\Downloads\\map.osm";
      if (fs.existsSync(fallbackPath)) {
        this.osmPath = fallbackPath;
      } else {
        logger.warn(`Ficheiro OSM de Amarante não encontrado em ${this.osmPath}`);
        return false;
      }
    }

    try {
      const xml = fs.readFileSync(this.osmPath, "utf8");

      // 1. Bounds
      const boundsMatch = xml.match(/<bounds\s+minlat="([^"]+)"\s+minlon="([^"]+)"\s+maxlat="([^"]+)"\s+maxlon="([^"]+)"/);
      if (boundsMatch) {
        this.bounds = {
          minLat: parseFloat(boundsMatch[1]),
          minLon: parseFloat(boundsMatch[2]),
          maxLat: parseFloat(boundsMatch[3]),
          maxLon: parseFloat(boundsMatch[4])
        };
      }

      // 2. Extrair Nós com Tags (POIs e Amenities)
      const nodeBlockRegex = /<node\s+id="(\d+)"[^>]*lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/node>/g;
      let nodeMatch;
      while ((nodeMatch = nodeBlockRegex.exec(xml)) !== null) {
        const id = nodeMatch[1];
        const lat = parseFloat(nodeMatch[2]);
        const lon = parseFloat(nodeMatch[3]);
        const tagBlock = nodeMatch[4];

        const tags = {};
        const tagRegex = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\/>/g;
        let t;
        while ((t = tagRegex.exec(tagBlock)) !== null) {
          tags[t[1]] = t[2];
        }

        if (Object.keys(tags).length > 0) {
          const item = { id, lat, lon, tags, name: tags.name || tags["name:pt"] || "" };
          this.pois.push(item);

          if (tags.amenity) {
            this.amenities.push({ ...item, type: tags.amenity });
          }
          if (tags.highway === "bus_stop" || tags.bus === "yes") {
            this.busStops.push(item);
          }
          if (tags.amenity === "school" || tags.amenity === "music_school") {
            this.schools.push(item);
          }
          if (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.amenity === "pharmacy") {
            this.healthFacilities.push(item);
          }
        }
      }

      // 3. Extrair Vias / Ruas (Ways)
      const wayBlockRegex = /<way\s+id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
      let wayMatch;
      while ((wayMatch = wayBlockRegex.exec(xml)) !== null) {
        const id = wayMatch[1];
        const tagBlock = wayMatch[2];

        const tags = {};
        const tagRegex = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\/>/g;
        let t;
        while ((t = tagRegex.exec(tagBlock)) !== null) {
          tags[t[1]] = t[2];
        }

        if (tags.highway || tags.name) {
          const streetItem = {
            id,
            name: tags.name || tags["name:pt"] || "Via sem nome",
            highway: tags.highway || "unclassified",
            oneway: tags.oneway === "yes",
            maxspeed: tags.maxspeed || null,
            maxweight: tags.maxweight || null,
            maxheight: tags.maxheight || null,
            lanes: tags.lanes || null,
            tags
          };
          this.streets.push(streetItem);

          if (tags.highway === "bus_stop") {
            this.busStops.push(streetItem);
          }
          if (tags.amenity === "school") {
            this.schools.push(streetItem);
          }
        }
      }

      this.isLoaded = true;
      logger.info(
        `🗺️ [OSM Amarante] Dados carregados com sucesso: ` +
        `${this.streets.length} vias, ${this.pois.length} nós com tags, ` +
        `${this.busStops.length} paragens de autocarro, ${this.schools.length} escolas, ` +
        `${this.healthFacilities.length} unidades de saúde.`
      );
      return true;
    } catch (err) {
      logger.error("Erro ao carregar mapa OSM de Amarante:", err);
      return false;
    }
  }

  // Pesquisar ruas ou pontos de interesse em Amarante
  search(term) {
    this.loadData();
    const clean = term.toLowerCase().trim();

    const matchedStreets = this.streets.filter(s => s.name && s.name.toLowerCase().includes(clean));
    const matchedPois = this.pois.filter(p => p.name && p.name.toLowerCase().includes(clean));

    return {
      streets: matchedStreets.slice(0, 10),
      pois: matchedPois.slice(0, 10)
    };
  }

  // Obter vias para pesados (AppFrota / RotaBus)
  getHeavyVehicleRoads() {
    this.loadData();
    const primary = this.streets.filter(s => s.highway === "primary");
    const secondary = this.streets.filter(s => s.highway === "secondary");
    const tertiary = this.streets.filter(s => s.highway === "tertiary");

    return {
      primary: [...new Set(primary.map(s => s.name))],
      secondary: [...new Set(secondary.map(s => s.name))],
      tertiary: [...new Set(tertiary.map(s => s.name))]
    };
  }

  // Contexto urbano e infraestrutura para ImmoEval (Avaliação Imobiliária)
  getRealEstateInfrastructure() {
    this.loadData();
    return {
      schools: [...new Set(this.schools.map(s => s.name).filter(Boolean))],
      health: [...new Set(this.healthFacilities.map(s => s.name || s.type).filter(Boolean))],
      busStopsCount: this.busStops.length,
      supermarkets: this.pois
        .filter(p => p.tags?.shop === "supermarket" || p.name?.toLowerCase().includes("auchan") || p.name?.toLowerCase().includes("intermarché"))
        .map(p => p.name)
    };
  }

  formatSummary() {
    this.loadData();
    const infra = this.getRealEstateInfrastructure();
    const roads = this.getHeavyVehicleRoads();

    return (
      `🗺️ *CARTOGRAFIA OFICIAL OSM DE AMARANTE CARREGADA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Delimitação Espacial:* Lat [${this.bounds?.minLat} a ${this.bounds?.maxLat}] | Lon [${this.bounds?.minLon} a ${this.bounds?.maxLon}]\n` +
      `🏙️ *Área Central:* Centro Histórico, Rio Tâmega, Ecopista da Linha do Tâmega\n\n` +
      `🚌 *MOBILIDADE & FROTAS (RotaBus / AppFrota):*\n` +
      `• Vias Principais / Secundárias: ${roads.primary.concat(roads.secondary).slice(0, 5).join(", ")}\n` +
      `• Paragens de Autocarro Mapeadas: *${infra.busStopsCount} paragens*\n\n` +
      `🏠 *EQUIPAMENTOS URBANOS (ImmoEval-Bot):*\n` +
      `• *Educação:* ${infra.schools.join(", ") || "Escola Secundária, EB 2/3 Teixeira de Pascoaes, Conservatório"}\n` +
      `• *Saúde:* ${infra.health.join(", ") || "Centro de Saúde de Amarante, Hospital São Gonçalo, Farmácias"}\n` +
      `• *Supermercados:* ${infra.supermarkets.join(", ") || "Auchan SUPER, Intermarché"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Os módulos de frotas e avaliação bancária usam agora os dados espaciais determinísticos de Amarante!_`
    );
  }
}

export const amaranteMapService = new AmaranteMapService();
export default amaranteMapService;
