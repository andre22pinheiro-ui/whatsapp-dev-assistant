import logger from "../utils/logger.js";
import { readData, writeData } from "../utils/storage.js";

/**
 * MÓDULO DE NUTRIÇÃO DE ALTA PERFORMANCE & ROTINA FÍSICA
 * Especialização: André Pinheiro
 * Macros de Alta Proteína, Turnos Prolongados, Ergonomia & Recuperação
 */

export const NUTRITION_DATABASE = {
  refeicoes_chave: [
    {
      id: "snack_proteico_1",
      nome: "Cottage Cheese c/ Nestum PRO ou Aveia",
      categoria: "Pequeno-almoço / Snack Rápido",
      ingredientes: [
        "200g Queijo Cottage (baixo teor de gordura / Milbona)",
        "30g-40g Nestum PRO ou Flocos de Aveia integrais",
        "Canela em pó a gosto (termogénico e controlo glicémico)"
      ],
      macros: { proteina_g: 28, hidratos_g: 26, gordura_g: 4, calorias_kcal: 252 },
      tempo_preparo: "2 minutos",
      vantagem_operacional: "Rápida absorção de proteína sem quebras de energia durante turnos de trabalho."
    },
    {
      id: "almoco_airfryer_1",
      nome: "Lombo de Porco Suculento em Air-Fryer",
      categoria: "Almoço / Jantar Anabólico",
      ingredientes: [
        "250g Lombo de porco limpo (corte magro)",
        "Alho picado, pimentão doce, orégãos, pitada de sal",
        "Acompanhamento: Arroz basmati ou batata doce assada"
      ],
      preparacao_airfryer: "Temperar e colocar na Air-Fryer a 180ºC durante 18 a 22 minutos (virar a meio).",
      macros: { proteina_g: 54, hidratos_g: 30, gordura_g: 8, calorias_kcal: 408 },
      vantagem_operacional: "Carne magra de alta digestibilidade sem fumos nem perdas de tempo."
    },
    {
      id: "frigideira_rapida_1",
      nome: "Peito de Peru Salteado c/ Vegetais Freshona",
      categoria: "Refeição Rápida de Recuperação",
      ingredientes: [
        "250g Peito de peru em cubos / tiras",
        "200g Mistura de Vegetais Freshona (brócolos, cenoura, milho, feijão verde)",
        "1 fio de azeite virgem extra, molho de soja ligeiro e gengibre"
      ],
      preparacao: "Wok ou frigideira bem quente durante 8 minutos. Selar o peru e juntar os vegetais Freshona até ficarem al dente.",
      macros: { proteina_g: 58, hidratos_g: 14, gordura_g: 6, calorias_kcal: 342 },
      vantagem_operacional: "Rico em micronutrientes, ferro e antioxidantes para redução de fadiga."
    },
    {
      id: "waffles_connect_1",
      nome: "Waffles / Panquecas Proteicas no Monsieur Cuisine Connect",
      categoria: "Pequeno-Almoço de Fim de Semana / Batch Cooking",
      ingredientes: [
        "60g Farinha de aveia",
        "150g Claras de ovo pasteurizadas ou 2 ovos inteiros",
        "1 dose (30g) Proteína Whey / Isolada",
        "100ml Bebida vegetal ou leite magro",
        "1 colher de chá de fermento em pó"
      ],
      preparacao_robot: "No Monsieur Cuisine Connect: Velocidade 5 durante 30 segundos com espátula. Verter diretamente na máquina de waffles ou frigideira antiaderente.",
      macros: { proteina_g: 45, hidratos_g: 40, gordura_g: 6, calorias_kcal: 394 },
      vantagem_operacional: "Permite congelar em doses e aquecer na torradeira antes de sair."
    },
    {
      id: "snack_estrada_1",
      nome: "Fatias de Fiambre de Peru Extra com Frutos Secos",
      categoria: "Snack de Viagem / Durante Condução",
      ingredientes: [
        "100g Fatias finas de peito de peru (>90% carne)",
        "20g Nozes ou Amêndoas ao natural"
      ],
      macros: { proteina_g: 22, hidratos_g: 3, gordura_g: 11, calorias_kcal: 199 },
      vantagem_operacional: "Consumo prático sem sujidade nem necessidade de reaquecimento."
    }
  ],

  ergonomia_postural: [
    {
      area: "Suporte Lombar e Condução Prolongada",
      diretriz: "Manter ângulo da anca entre 100º e 110º. Apoio lombar firme posicionado na curvatura natural (L1-L5). Pés apoiados uniformemente.",
      pausa_obrigatoria: "A cada 2h-4h30 (coincidindo com o tacógrafo), efetuar 5 minutos de descompressão da coluna: extensão lombar de pé e mobilidade da anca."
    },
    {
      area: "Proteção Térmica e Hidratação",
      diretriz: "Evitar choque térmico direto do ar condicionado nas costas. Hidratação calculada: mínimo de 35ml de água por kg de peso corporal por dia."
    }
  ]
};

export class MasterDomainService {
  /**
   * Resumo de Rotina Nutricional & Macros
   */
  getNutritionPlan() {
    const r = NUTRITION_DATABASE.refeicoes_chave;
    const sb = [];
    sb.push("🥩 *PLANO NUTRICIONAL DE ALTA PROTEÍNA & RECUPERAÇÃO*");
    sb.push("━━━━━━━━━━━━━━━━━━━━━━━━");
    r.forEach((it, idx) => {
      sb.push(`*${idx + 1}. ${it.nome}* (${it.categoria})`);
      sb.push(`   • Ingredientes: ${it.ingredientes.join(", ")}`);
      sb.push(`   • Macros: *${it.macros.proteina_g}g Proteína* | ${it.macros.hidratos_g}g HC | ${it.macros.gordura_g}g Gord | *${it.macros.calorias_kcal} kcal*`);
      sb.push(`   • Vantagem: _${it.vantagem_operacional}_\n`);
    });

    sb.push("🏋️ *DIRETRIZES DE ERGONOMIA & COLUNA (TURNOS PESADOS):*");
    NUTRITION_DATABASE.ergonomia_postural.forEach((e) => {
      sb.push(`• *${e.area}:* ${e.diretriz}`);
      sb.push(`  _Pausa ativa: ${e.pausa_obrigatoria}_\n`);
    });

    return sb.join("\n");
  }

  /**
   * Registo diário de ingestão proteica
   */
  logDailyIntake(proteinGrams, mealDescription = "Refeição registada") {
    const intakeHistory = readData("nutrition_logs", []);
    const today = new Date().toISOString().split("T")[0];

    const entry = {
      id: "nut_" + Date.now().toString(),
      date: today,
      proteinGrams: parseInt(proteinGrams, 10) || 0,
      description: mealDescription.trim(),
      timestamp: new Date().toISOString()
    };

    intakeHistory.push(entry);
    writeData("nutrition_logs", intakeHistory);

    const todayTotal = intakeHistory
      .filter((i) => i.date === today)
      .reduce((sum, item) => sum + item.proteinGrams, 0);

    return {
      entry,
      todayTotal,
      metaRecomendada: 160,
      percentagemMeta: Math.round((todayTotal / 160) * 100)
    };
  }

  /**
   * Especificações Técnicas de Construção a Seco (Pladur-Pro)
   */
  getPladurSpecifications(tipoTrabalho = "divisoria") {
    return (
      `🏗️ *ESPECIFICAÇÕES TÉCNICAS NP/EN - PLADUR-PRO*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📐 *1. Normas Estruturais Obrigatórias:*\n` +
      `• *EN 520:* Placas de gesso cartonado (Tipo A standard, Tipo F fogo, Tipo H hidrófuga).\n` +
      `• *EN 14195:* Perfis metálicos estruturais (Montantes e Raias em aço galvanizado Z140/Z275, espessura mínima 0.6mm).\n\n` +
      `🧱 *2. Rácios de Consumo por m² de Divisória (Dupla Placa Standard 13mm):*\n` +
      `• Placas de Gesso (12.5mm / 15mm): *2.10 m²* (considerando 5% quebra técnica).\n` +
      `• Montantes verticais (48mm ou 70mm a cada 600mm): *2.00 m lineares*.\n` +
      `• Raias horizontais superior/inferior: *0.70 m lineares*.\n` +
      `• Parafusos Pladur (PM 25mm e PM 35mm): *24 unidades* por m².\n` +
      `• Banda de Juntas (papel microperfurado ou fibra): *1.40 m lineares*.\n` +
      `• Pasta de Juntas (secagem ou presa): *0.80 kg* por m².\n` +
      `• Lã Mineral / Rocha (50mm, densidade 30-40 kg/m³ para isolamento acústico RW >= 45dB): *1.05 m²*.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Para orçamentos específicos de tetos falsos, isolamento acústico ou corta-fogo EI60/EI90, indica a área em m²._`
    );
  }

  /**
   * Especificações de Frotas & Tacógrafo Digital (AppFrota / RotaBus)
   */
  getFleetTacographAnalysis() {
    return (
      `🚌 *SISTEMA DE GESTÃO DE FROTAS & TACÓGRAFO (APPFROTA / ROTABUS)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *1. Leitor de Tacógrafo Digital (VDO / Stoneridge / TQR-3011B):*\n` +
      `• *Descarregamento de Cartão de Condutor:* Máximo legal a cada *28 dias*.\n` +
      `• *Descarregamento de Memória da Viatura:* Máximo legal a cada *90 dias*.\n` +
      `• Formatos de ficheiro compatíveis: *.ddd*, *.tgd*, *.v1b*.\n\n` +
      `🗺️ *2. Parâmetros de Gabarito & Rotas Pesados (Regulamento CE 561/2006):*\n` +
      `• *Altura Máxima Livre:* 4.00 m (Pontes, Túneis e Viadutos monitorizados).\n` +
      `• *Largura Máxima:* 2.55 m (2.60 m para veículos frigoríficos isolados).\n` +
      `• *Peso Bruto Máximo Autorizado:* 40 toneladas (44 t para transporte intermodal).\n` +
      `• *Algoritmo de Pausa Automatizada (BabyAGI):* Alerta preventivo aos *4h15m* de condução contínua para encontrar parque seguro antes do limite estrito das *4h30m*.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *Integração com OpenRouteService & Android Auto ativa no RotaBus.*`
    );
  }
}

export const masterDomainService = new MasterDomainService();
export default masterDomainService;
