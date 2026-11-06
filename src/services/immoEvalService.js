import logger from "../utils/logger.js";

/**
 * IMMOEVAL-BOT: ESPECIALISTA DETERMINÍSTICO EM AVALIAÇÃO IMOBILIÁRIA E BANCÁRIA
 * Foco Regional: Amarante e Tâmega e Sousa (Penafiel, Marco de Canaveses, Baião, Lousada, Felgueiras)
 * Critérios: CMVM, Banco de Portugal (Critérios Prudenciais de Avaliação Imobiliária para Crédito Hipotecário)
 * 
 * Temperatura Estrita: 0.0 (Zero especulação, dados baseados em métricas reais por m² e coeficientes de depreciação).
 */

export const IMMO_BENCHMARKS_AMARANTE = {
  // Médias de mercado de transação real (escrituras) vs valores bancários por freguesia / zona (€/m² de ABP)
  zonas: {
    "amarante_centro": { nome: "Amarante (S. Gonçalo / Madalena / Cepelos)", preco_m2_novo: 1650, preco_m2_usado_bom: 1250, preco_m2_reabilitar: 700, bancario_m2: 1150 },
    "vila_meã": { nome: "Vila Meã / Real / Ataíde", preco_m2_novo: 1350, preco_m2_usado_bom: 980, preco_m2_reabilitar: 550, bancario_m2: 900 },
    "amarante_periferia": { nome: "Freguesias Rurais / Periferia Amarante (Telões, Candemil, Fridão, etc.)", preco_m2_novo: 1100, preco_m2_usado_bom: 780, preco_m2_reabilitar: 420, bancario_m2: 720 },
    "penafiel": { nome: "Penafiel (Urbano)", preco_m2_novo: 1750, preco_m2_usado_bom: 1350, preco_m2_reabilitar: 750, bancario_m2: 1220 },
    "marco_canaveses": { nome: "Marco de Canaveses", preco_m2_novo: 1400, preco_m2_usado_bom: 1050, preco_m2_reabilitar: 580, bancario_m2: 950 }
  },

  // Coeficientes de ponderação de área dependente (garagens, arrumos, varandas)
  ponderacao_areas: {
    abp: 1.0, // Área Bruta Privativa: 100%
    garagem_fechada: 0.45, // Box: 45% do valor do m² privativo
    lugar_garagem: 0.30, // Lugar aberto: 30%
    arrumos: 0.35, // Arrumos: 35%
    varandas_terraco: 0.30, // Varandas cobertas / Terraços: 30%
    terreno_rustico_anexo: 0.10 // Terreno envolvente: 10%
  },

  // Ajustes de Certificação Energética (Penalizações e Bonificações de Valor)
  coeficientes_energia: {
    "A+": 1.08,
    "A": 1.05,
    "B": 1.00,
    "B-": 0.98,
    "C": 0.93,
    "D": 0.88,
    "E": 0.82,
    "F": 0.75,
    "ISENTO": 0.90
  },

  // Coeficientes de Estado de Conservação
  coeficientes_conservacao: {
    "novo": 1.15,
    "remodelado": 1.05,
    "usado_bom": 0.95,
    "usado_habitavel": 0.82,
    "para_reabilitar": 0.58,
    "ruina": 0.35
  }
};

export class ImmoEvalService {
  /**
   * Processador de Análise Imobiliária Determinística
   */
  evaluatePropertyInput(textInput) {
    logger.info(`🏠 [IMMOEVAL] Análise imobiliária acionada: "${textInput.slice(0, 100)}..."`);

    const parsed = this.parsePropertyParameters(textInput);
    return this.generateValuationReport(parsed);
  }

  /**
   * Extrator de Parâmetros de Anúncios / Dados Fornecidos
   */
  parsePropertyParameters(text) {
    const raw = text.toLowerCase();

    // 1. Preço Pedido (€)
    let precoPedido = 0;
    const priceMatch = text.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)\s*€|(\d+)\s*(?:mil|k)\s*€?/i) ||
      text.match(/(?:preço|preco|valor|custa|por)\s*:?\s*(\d{1,3}(?:[.\s]\d{3})*)/i);

    if (priceMatch) {
      if (priceMatch[2]) {
        precoPedido = parseInt(priceMatch[2], 10) * 1000;
      } else {
        const cleanDigits = (priceMatch[1] || priceMatch[0]).replace(/[^0-9]/g, "");
        precoPedido = parseInt(cleanDigits, 10) || 0;
      }
    }

    // 2. Área Bruta Privativa (ABP em m²)
    let abp = 0;
    const abpMatch = text.match(/(?:abp|privativa|área útil|area util|área|area)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/i) ||
      text.match(/(\d+)\s*(?:m2|m²)\s*(?:úteis|uteis|privativa)?/i);
    if (abpMatch) {
      abp = parseFloat(abpMatch[1].replace(",", ".")) || 0;
    }

    // 3. Área Bruta Dependente (ABD em m²)
    let abd = 0;
    const abdMatch = text.match(/(?:abd|dependente|garagem|arrumos)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/i);
    if (abdMatch) {
      abd = parseFloat(abdMatch[1].replace(",", ".")) || 0;
    }

    // 4. Localização (Amarante, Vila Meã, Penafiel, Marco de Canaveses, Periferia)
    let zonaKey = "amarante_centro";
    if (raw.includes("vila meã") || raw.includes("vila mea") || raw.includes("real") || raw.includes("ataíde")) {
      zonaKey = "vila_meã";
    } else if (raw.includes("penafiel") || raw.includes("novelas") || raw.includes("terras de sousa")) {
      zonaKey = "penafiel";
    } else if (raw.includes("marco de canaveses") || raw.includes("marco")) {
      zonaKey = "marco_canaveses";
    } else if (raw.includes("telões") || raw.includes("candemil") || raw.includes("fridão") || raw.includes("rural") || raw.includes("periferia") || raw.includes("vila caiz")) {
      zonaKey = "amarante_periferia";
    }

    // 5. Tipologia (T1, T2, T3, T4, Moradia)
    let tipologia = "T3";
    const typoMatch = text.match(/\b(t\d|moradia|terreno|apartamento)\b/i);
    if (typoMatch) {
      tipologia = typoMatch[1].toUpperCase();
    }

    // 6. Certificado Energético
    let certEnergia = "C";
    const certMatch = text.match(/\b(a\+|a|b-|b|c|d|e|f|isento)\b/i);
    if (certMatch && !certMatch[0].match(/^(a|b|e)$/i)) { // Evitar falsas capturas de preposições
      certEnergia = certMatch[0].toUpperCase();
    } else {
      const explicitCert = text.match(/(?:certifica(?:do|ção)|classe)\s*(?:energética|energetica)?\s*:?\s*([a-f]\+?|isento)/i);
      if (explicitCert) certEnergia = explicitCert[1].toUpperCase();
    }

    // 7. Estado de Conservação
    let conservacao = "usado_bom";
    if (raw.includes("novo") || raw.includes("em construção") || raw.includes("a estrear")) {
      conservacao = "novo";
    } else if (raw.includes("remodelado") || raw.includes("renovado") || raw.includes("recuperado")) {
      conservacao = "remodelado";
    } else if (raw.includes("reabilitar") || raw.includes("obras") || raw.includes("restaurar") || raw.includes("recuperar")) {
      conservacao = "para_reabilitar";
    } else if (raw.includes("ruína") || raw.includes("ruina")) {
      conservacao = "ruina";
    }

    // Se áreas não foram identificadas explicitamente mas preço foi fornecido
    if (abp === 0) abp = 120; // Padrão de simulação prudencial

    return {
      precoPedido,
      abp,
      abd,
      zonaKey,
      tipologia,
      certEnergia,
      conservacao,
      url: text.match(/https?:\/\/[^\s]+/)?.[0] || null
    };
  }

  /**
   * Geração do Relatório de Avaliação Bancária & Risco Prudencial (CMVM / BdP)
   */
  generateValuationReport(p) {
    const zona = IMMO_BENCHMARKS_AMARANTE.zonas[p.zonaKey];
    const coefEnergia = IMMO_BENCHMARKS_AMARANTE.coeficientes_energia[p.certEnergia] || 0.93;
    const coefEstado = IMMO_BENCHMARKS_AMARANTE.coeficientes_conservacao[p.conservacao] || 0.95;

    // 1. Cálculo da Área Homogénea (Área Útil Ponderada)
    const areaPonderada = p.abp + (p.abd * IMMO_BENCHMARKS_AMARANTE.ponderacao_areas.garagem_fechada);

    // 2. Preço de Mercado Teórico do m² de base para o perfil
    const precoBaseM2 = zona.bancario_m2 * coefEstado * coefEnergia;

    // 3. Avaliação Bancária Estimada (Critério Conservador CMVM)
    const avaliacaoBancaria = Math.round(areaPonderada * precoBaseM2);

    // 4. Preço por m² Real Pedido (Global e Útil)
    const precoM2GlobalPedido = p.precoPedido > 0 ? Math.round(p.precoPedido / (p.abp + p.abd || 1)) : 0;
    const precoM2UtilPedido = p.precoPedido > 0 ? Math.round(p.precoPedido / p.abp) : 0;
    const precoM2BancarioEstimado = Math.round(precoBaseM2);

    // 5. Análise de Desvio & Classificação
    let classificacao = "N/A";
    let desvioPercentagem = 0;
    let badge = "⚪";

    if (p.precoPedido > 0) {
      desvioPercentagem = Math.round(((p.precoPedido - avaliacaoBancaria) / avaliacaoBancaria) * 100);
      if (desvioPercentagem > 15) {
        classificacao = "SOBREAVALIADO (Overpriced - Risco de 'Down-Valuation' no Crédito)";
        badge = "🔴";
      } else if (desvioPercentagem >= -8 && desvioPercentagem <= 15) {
        classificacao = "VALOR DE MERCADO EQUILIBRADO (Fair Market Value)";
        badge = "🟢";
      } else {
        classificacao = "SUBVALIADO / OPORTUNIDADE (Undervalued - Margem de Segurança)";
        badge = "🔥";
      }
    }

    // 6. Rácio de Financiamento Máximo (LTV Máximo Recomendado Banco de Portugal: 85% ou 90% para HPP)
    const financiamentoMaximoEstimado = Math.round(Math.min(p.precoPedido || avaliacaoBancaria, avaliacaoBancaria) * 0.85);

    // 7. Alertas de Risco Regulamentar & Construtivo
    const alertas = [];
    if (["E", "F"].includes(p.certEnergia)) {
      alertas.push("⚠️ *Penalização Energética Grave:* Classe E/F exige investimento obrigatório de 15.000€ a 25.000€ em isolamento térmico (ETICS/Capoto e caixilharia de corte térmico) para atingir os novos mandatos climáticos da UE.");
    }
    if (p.conservacao === "para_reabilitar" || p.conservacao === "ruina") {
      alertas.push("⚠️ *Risco de Licenciamento Camarário:* Exigência de Certidão de Isenção de Utilização anterior a 1951 na Câmara Municipal de Amarante ou apresentação de Projeto de Arquitetura e Especialidades no RJUE.");
    }
    if (desvioPercentagem > 20) {
      alertas.push("⚠️ *Risco de Diferencial de Escritura:* A avaliação do perito pericial bancário será substancialmente inferior ao preço pedido. O comprador terá de entrar com mais capital próprio para suprir o desvio do LTV.");
    }
    if (p.abd > p.abp * 0.8) {
      alertas.push("ℹ️ *Rácio ABD/ABP Desproporcionado:* Grande percentagem de área dependente (garagem/arrumos) que os bancos avaliam a menos de 45% do valor da área privativa.");
    }

    return (
      `🏢 *RELATÓRIO DETERMINÍSTICO DE AVALIAÇÃO IMOBILIÁRIA (IMMOEVAL)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Zona Analisada:* ${zona.nome}\n` +
      `🏠 *Tipologia:* ${p.tipologia} | *Estado:* ${p.conservacao.toUpperCase()} | *Classe Energética:* [${p.certEnergia}]\n` +
      `📐 *Áreas:* ABP: *${p.abp} m²* | ABD: *${p.abd} m²* (Área Homogénea: *${Math.round(areaPonderada)} m²*)\n` +
      (p.url ? `🔗 *Origem:* ${p.url}\n` : "") +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *MÉTRICAS FINANCEIRAS:*\n` +
      (p.precoPedido > 0 ? `• *Preço Pedido:* *${p.precoPedido.toLocaleString("pt-PT")} €*\n` : "• *Preço Pedido:* Não especificado\n") +
      `• *Preço/m² Útil Pedido:* *${precoM2UtilPedido} €/m²*\n` +
      `• *Preço/m² Prudencial Bancário:* *${precoM2BancarioEstimado} €/m²*\n\n` +
      `🏦 *AVALIAÇÃO BANCÁRIA ESTIMADA (CMVM/BdP):*\n` +
      `👉 *${avaliacaoBancaria.toLocaleString("pt-PT")} €* (Base Prudencial de Hipoteca)\n` +
      (p.precoPedido > 0 ? `• *Desvio face ao Pedido:* *${desvioPercentagem > 0 ? "+" : ""}${desvioPercentagem}%* (${badge} ${classificacao})\n` : "") +
      `• *Financiamento Provável (LTV 85%):* *${financiamentoMaximoEstimado.toLocaleString("pt-PT")} €*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️ *AUDITORIA DE RISCO & LICENCIAMENTO:*\n` +
      (alertas.length > 0 ? alertas.join("\n\n") : "✅ Sem anomalias de risco detetadas face aos parâmetros fornecidos.") +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Para nova análise determinística, envia o link do Idealista/Imovirtual ou dados: \"T3 Amarante, 140m2, 180000€, Classe C\"_`
    );
  }
}

export const immoEvalService = new ImmoEvalService();
export default immoEvalService;
