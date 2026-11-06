import logger from "../utils/logger.js";

/**
 * BASE JURÍDICA E REGULAMENTAR DE PORTUGAL
 * - Código da Estrada (CE - Decreto-Lei n.º 114/94, republicado)
 * - Regulamento (CE) n.º 561/2006 & Portaria 983/2007 (Tempos de Condução e Repouso)
 * - Lei n.º 13/2006 (Transporte Coletivo de Crianças - TCC) & Art.º 55.º CE (SRI)
 * - Regulamentos Municipais de Trânsito, Estacionamento, Cargas/Descargas e ZER
 * - Acesso e consulta ao Diário da República Eletrónico (DRE - dre.pt)
 */

export const LEGAL_KNOWLEDGE_BASE = {
  // 1. TEMPOS DE CONDUÇÃO, PAUSAS E REPOUSO (REG. CE 561/2006 + LEGISLAÇÃO NACIONAL)
  tempos_conducao: {
    titulo: "Tempos de Condução, Pausas e Repouso (Regulamento CE n.º 561/2006)",
    diploma: "Regulamento (CE) n.º 561/2006 do Parlamento Europeu e do Conselho e Lei n.º 27/2010",
    pontos_chave: [
      {
        regra: "Condução Contínua Máxima",
        limite: "4 horas e 30 minutos",
        obrigacao: "Após 4h30 de condução, o motorista DEVE fazer uma pausa ininterrupta de pelo menos 45 minutos, a menos que inicie um período de repouso.",
        fracionamento: "A pausa de 45m pode ser substituída por uma pausa de pelo menos 15 minutos seguida de uma pausa de pelo menos 30 minutos (nessa ordem exata), distribuídas pelo período de 4h30."
      },
      {
        regra: "Condução Diária Máxima",
        limite: "9 horas diárias (extensível a 10 horas até 2 vezes por semana)",
        obrigacao: "Não pode exceder 9h normais. Na mesma semana civil, apenas pode fazer 10h em dois dias distintos."
      },
      {
        regra: "Condução Semanal Máxima",
        limite: "56 horas semanais",
        obrigacao: "O tempo total de condução acumulado numa semana civil não pode ultrapassar 56 horas."
      },
      {
        regra: "Condução Bi-Semanal Máxima",
        limite: "90 horas em duas semanas consecutivas",
        obrigacao: "A soma das horas de condução em duas semanas consecutivas não pode exceder 90 horas."
      },
      {
        regra: "Repouso Diário Regular",
        limite: "Pelo menos 11 horas consecutivas",
        obrigacao: "No período de 24 horas após o termo do repouso anterior, o condutor deve gozar um novo período de repouso diário de 11h. Alternativa fracionada: 3h + 9h ininterruptas."
      },
      {
        regra: "Repouso Diário Reduzido",
        limite: "Entre 9 e 11 horas",
        obrigacao: "Permitido no máximo 3 períodos de repouso diário reduzido entre dois períodos de repouso semanal."
      },
      {
        regra: "Repouso Semanal Regular",
        limite: "45 horas consecutivas",
        obrigacao: "Em cada 2 semanas consecutivas, o condutor deve gozar pelo menos dois períodos de repouso semanal regular (45h) ou um regular (45h) e um reduzido (mínimo 24h com compensação equivalente até à 3.ª semana)."
      },
      {
        regra: "Proibição de Repouso na Cabina",
        limite: "Artigo 8.º, n.º 8",
        obrigacao: "Os repousos semanais regulares (>45h) NÃO podem ser efetuados no interior do veículo. O alojamento condigno é pago pela entidade empregadora."
      }
    ]
  },

  // 2. TRANSPORTE DE CRIANÇAS (LEI 13/2006 & ART. 55.º CÓDIGO DA ESTRADA)
  transporte_criancas: {
    titulo: "Regime Jurídico do Transporte de Crianças (Lei n.º 13/2006 & Art.º 55.º do CE)",
    diploma: "Lei n.º 13/2006 de 17 de abril (alterada pela Lei n.º 34/2021) e Artigo 55.º do Código da Estrada",
    pontos_chave: [
      {
        regra: "Obrigatoriedade de Cadeirinha (SRI)",
        artigo: "Artigo 55.º do Código da Estrada",
        limite: "Crianças com menos de 12 anos de idade E menos de 135 cm de altura",
        obrigacao: "Devem utilizar Sistema de Retenção para Crianças (SRI) homologado e adaptado ao seu peso e tamanho (Normas ECE R44/04 ou R129 i-Size)."
      },
      {
        regra: "Transporte no Banco da Frente",
        artigo: "Art. 55.º, n.º 2 do CE",
        obrigacao: "Apenas permitido no banco da frente para crianças com menos de 12 anos se: 1) Tiverem <3 anos e o SRI estiver virado para a retaguarda com AIRBAG DESATIVADO; 2) O veículo não dispuser de bancos à retaguarda ou de cintos neles instalados; 3) Os bancos traseiros estiverem todos ocupados por outras crianças com cadeirinha."
      },
      {
        regra: "Transporte Coletivo de Crianças (TCC - Carrinhas Escolares)",
        artigo: "Lei n.º 13/2006",
        requisitos: [
          "Idade do veículo: Máximo 16 anos a contar da primeira matrícula.",
          "Cintos de segurança de 3 pontos em todos os lugares utilizados por crianças.",
          "Tacógrafo digital aferido e ativo em veículos de lotação superior a 9 lugares.",
          "Extintor de incêndios e caixa de primeiros socorros certificada.",
          "Portas com fecho de segurança de comando interior/exterior.",
          "Painel de sinalização de Transporte de Crianças (amarelo com duas crianças a preto) à frente e à retaguarda.",
          "Certificado de Aptidão do Motorista (CAM/TCC emitido pelo IMT com exame médico e psicotécnico válido)."
        ],
        vigilante: "Obrigatória a presença de vigilante em viagens que transportem mais de 7 crianças em veículos de lotação superior a 9 lugares (ou crianças de idade <7 anos)."
      }
    ]
  },

  // 3. CÓDIGO DA ESTRADA & LEIS GERAIS DE TRÂNSITO (DECRETO-LEI 114/94)
  codigo_estrada: {
    titulo: "Código da Estrada Português (DL 114/94 e sucessivas alterações)",
    diploma: "Decreto-Lei n.º 114/94, de 3 de maio",
    limites_velocidade: {
      ligeiros_sem_reboque: "Localidades: 50 km/h | Vias reservadas: 100 km/h | Autoestradas: 120 km/h (Mínimo autoestrada: 50 km/h)",
      ligeiros_mercadorias: "Localidades: 50 km/h | Vias reservadas: 90 km/h | Autoestradas: 110 km/h",
      pesados_mercadorias: "Localidades: 50 km/h | Vias reservadas: 80 km/h | Autoestradas: 90 km/h",
      pesados_passageiros: "Localidades: 50 km/h | Vias reservadas: 90 km/h | Autoestradas: 100 km/h"
    },
    taxas_alcool: {
      regime_geral: "Contraordenação Grave: 0,50 g/l a 0,79 g/l | Muito Grave: 0,80 g/l a 1,19 g/l | Crime (Art. 292.º CP): >= 1,20 g/l (Pena de prisão até 1 ano ou multa até 120 dias)",
      regime_especial: "Condutores recém-encartados (<3 anos) e profissionais (pesados, táxis, TVDE, TCC, ambulâncias): Limite legal reduzido: 0,20 g/l a 0,49 g/l (Grave) | 0,50 g/l a 1,19 g/l (Muito Grave) | Crime: >= 1,20 g/l."
    },
    telemovel: "Artigo 84.º do CE: Proibida a utilização ou manuseamento durante a marcha. Apenas permitido auricular de um só lado ou alta-voz. Coima: 250€ a 1250€ + Inibição de conduzir de 1 a 12 meses (Contraordenação Muito Grave, perda de 3 pontos)."
  },

  // 4. LEIS MUNICIPAIS & REGULAMENTOS LOCAIS
  regulamentos_municipais: {
    titulo: "Regulamentos Municipais de Trânsito, Estacionamento e Cargas/Descargas",
    pontos_chave: [
      {
        assunto: "Estacionamento Pago e Zonas de Duração Limitada",
        regra: "Regulado pelos Regulamentos Gerais de Estacionamento Municipais e Art.º 70.º e 71.º do CE.",
        detalhe: "O estacionamento indevido ou falta de título em zonas tarifadas sujeita o infrator a aviso de cobrança, bloqueio da viatura (Art. 164.º CE) e remoção imediata para parque municipal (custas de reboque + depósito diário)."
      },
      {
        assunto: "Zonas de Cargas e Descargas",
        regra: "Sinalização C16/H1 com horário definido (habitualmente 08h-11h e 14h-17h).",
        detalhe: "Estritamente reservado a veículos de mercadorias no exercício efetivo da carga/descarga. O uso indevido por ligeiros de passageiros é infração grave (Art. 50.º CE) com reboque imediato."
      },
      {
        assunto: "Zonas de Emissões Reduzidas (ZER - Lisboa / Porto)",
        regra: "Restrições de acesso baseadas na Norma Euro da viatura.",
        detalhe: "Lisboa ZER Eixo 1 (Av. Liberdade/Baixa): Norma Euro 3 ou superior (viaturas pós-2000). ZER Eixo 2: Norma Euro 2. Isenções aplicam-se a moradores e viaturas de emergência/elétricas."
      },
      {
        assunto: "Competências de Fiscalização Municipal",
        regra: "Polícia Municipal e Fiscais de Estacionamento Municipais devidamente equiparados (Art. 5.º Decreto-Lei n.º 44/2005).",
        detalhe: "Podem lavrar autos de contraordenação do Código da Estrada relativos a paragem, estacionamento e circulação em zonas pedonais ou vias de sentido condicionado."
      }
    ]
  }
};

export class PortugalLawService {
  /**
   * Resposta jurídica fundamentada a qualquer questão sobre leis portuguesas
   */
  async consultLegalAdvisor(query) {
    const q = query.toLowerCase().trim();
    logger.info(`⚖️ Consulta Jurídica PT: "${query}"`);

    // 1. Tempos de Condução e Repouso / Tacógrafo
    if (
      q.includes("conducao") || q.includes("condução") ||
      q.includes("repouso") || q.includes("tacografo") || q.includes("tacógrafo") ||
      q.includes("pausa") || q.includes("561") || q.includes("motorista")
    ) {
      return this.formatConducaoRepouso();
    }

    // 2. Transporte de Crianças / TCC / Cadeirinha
    if (
      q.includes("crianca") || q.includes("criança") ||
      q.includes("cadeirinha") || q.includes("sri") ||
      q.includes("tcc") || q.includes("escolar") ||
      q.includes("cinto") && (q.includes("menor") || q.includes("idade"))
    ) {
      return this.formatTransporteCriancas();
    }

    // 3. Diário da República / Legislação Oficial / Decretos
    if (
      q.includes("dre") || q.includes("diario da republica") || q.includes("diário da república") ||
      q.includes("decreto") || q.includes("portaria") || q.includes("lei")
    ) {
      return this.formatDreAccess(query);
    }

    // 4. Leis Municipais / Estacionamento / Cargas e Descargas / ZER
    if (
      q.includes("municipal") || q.includes("municipio") || q.includes("município") ||
      q.includes("estacionamento") || q.includes("reboque") || q.includes("cargas") ||
      q.includes("descargas") || q.includes("zer") || q.includes("camara") || q.includes("câmara")
    ) {
      return this.formatRegulamentosMunicipais();
    }

    // 5. Código da Estrada Geral (Álcool, Velocidades, Telemóvel)
    if (
      q.includes("alcool") || q.includes("álcool") ||
      q.includes("velocidade") || q.includes("telemovel") || q.includes("telemóvel") ||
      q.includes("multa") || q.includes("contraordenacao") || q.includes("contraordenação") ||
      q.includes("pontos") || q.includes("carta")
    ) {
      return this.formatCodigoEstradaGeral();
    }

    // Resumo Completo de Jurisprudência e Legislação Rodoviária
    return this.formatOverview();
  }

  formatConducaoRepouso() {
    const k = LEGAL_KNOWLEDGE_BASE.tempos_conducao;
    return (
      `⚖️ *PARECER JURÍDICO: TEMPOS DE CONDUÇÃO E REPOUSO*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📜 *Diploma Legal:* _${k.diploma}_\n\n` +
      `⏱️ *1. Condução Contínua e Pausas:* \n` +
      `• *Máximo 4h30* seguidas.\n` +
      `• *Pausa Obrigatória:* Mínimo de *45 minutos* ininterruptos ou fracionada em *15 min + 30 min* (por esta ordem) dentro das 4h30.\n\n` +
      `📅 *2. Limites Diários & Semanais:* \n` +
      `• *Diário Normal:* Máximo de *9 horas* (pode atingir *10 horas* até 2 vezes por semana civil).\n` +
      `• *Semanal:* Máximo de *56 horas*.\n` +
      `• *Bi-Semanal:* Máximo de *90 horas* acumuladas em 2 semanas consecutivas.\n\n` +
      `🛏️ *3. Repouso Diário e Semanal:* \n` +
      `• *Repouso Diário Regular:* Mínimo de *11 horas* consecutivas (ou 3h + 9h).\n` +
      `• *Repouso Diário Reduzido:* Mínimo de *9 horas* (máximo 3 vezes entre repousos semanais).\n` +
      `• *Repouso Semanal:* Mínimo de *45 horas* consecutivas.\n` +
      `• 🚫 *Aviso Cabina:* É proibido por lei europeia efetuar o repouso semanal regular (>45h) dentro da cabina do camião/autocarro!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *Consulta Oficial DRE:* https://dre.pt/dre/legislacao-consolidada/lei/2010-34538875`
    );
  }

  formatTransporteCriancas() {
    const k = LEGAL_KNOWLEDGE_BASE.transporte_criancas;
    return (
      `⚖️ *PARECER JURÍDICO: TRANSPORTE DE CRIANÇAS EM PORTUGAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📜 *Base Legal:* _${k.diploma}_\n\n` +
      `👶 *1. Crianças em Veículos Ligeiros (Art. 55.º CE):*\n` +
      `• *Obrigatoriedade SRI (Cadeirinha):* Crianças com menos de *12 anos* E menos de *135 cm* de altura devem usar obrigatoriamente cadeirinha homologada (R44/04 ou i-Size R129).\n` +
      `• *Banco da Frente:* Só permitido se tiver <3 anos virada para trás com airbag desligado, se não houver bancos traseiros/cintos, ou se a traseira estiver cheia de cadeirinhas.\n\n` +
      `🚌 *2. Transporte Coletivo de Crianças (TCC - Lei 13/2006):*\n` +
      `• *Idade da Viatura:* Idade máxima de *16 anos* (improrrogável).\n` +
      `• *Cintos de Segurança:* Cintos de 3 pontos em todos os assentos ocupados por crianças.\n` +
      `• *Sinalização:* Painel frontal e traseiro regulamentar de transporte escolar.\n` +
      `• *Vigilante:* Obrigatório vigilante se transportadas >7 crianças em viaturas de mais de 9 lugares ou se houver menores de 7 anos.\n` +
      `• *Motorista:* Certificado CAM/TCC com averbamento no IMT, registo criminal limpo e exame psicotécnico válido.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *Consulta Oficial DRE:* https://dre.pt/dre/legislacao-consolidada/lei/2006-34575836`
    );
  }

  formatRegulamentosMunicipais() {
    return (
      `⚖️ *REGULAMENTAÇÃO MUNICIPAL & ESTACIONAMENTO URBANO*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏛️ *Competência:* Câmaras Municipais & Polícia Municipal (Art. 5.º DL 44/2005)\n\n` +
      `🚗 *1. Zonas de Estacionamento Tarifado (Duração Limitada):*\n` +
      `• O não pagamento ou ultrapassagem do tempo confere legitimidade para notificação, bloqueio e reboque imediato (Art. 164.º CE).\n` +
      `• Reclamações de avisos de pagamento seguem o Código do Procedimento Administrativo (CPA).\n\n` +
      `🚛 *2. Zonas de Cargas e Descargas:*\n` +
      `• Exclusivas a veículos comerciais e ligeiros de mercadorias em operação física imediata de carga/descarga.\n` +
      `• Paragem máxima habitualmente fixada entre 20 a 30 minutos com disco de estacionamento visível.\n\n` +
      `🌿 *3. Zonas de Emissões Reduzidas (ZER):*\n` +
      `• Cidades como Lisboa aplicam restrições Euro 3 / Euro 2 nos eixos centrais.\n` +
      `• Coima por circulação não autorizada: 25€ a 125€.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Para consultar o regulamento do teu concelho (Porto, Lisboa, Amarante, Braga, etc.), pede: \"regulamento de trânsito de <município>\"_`
    );
  }

  formatCodigoEstradaGeral() {
    return (
      `⚖️ *CÓDIGO DA ESTRADA PORTUGUÊS (PRINCIPAIS REGRAS)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚗 *Velocidades Máximas (Ligeiros):*\n` +
      `• Localidades: *50 km/h* | Vias Reservadas: *100 km/h* | Autoestradas: *120 km/h* (Mínimo: *50 km/h*)\n\n` +
      `🍷 *Taxa de Álcool no Sangue (TAS):*\n` +
      `• *Regime Geral:* 0,50 a 0,79 g/l (Grave) | 0,80 a 1,19 g/l (Muito Grave) | >= 1,20 g/l (Crime punível com prisão até 1 ano)\n` +
      `• *Recém-encartados & Profissionais:* Limite reduzido: 0,20 a 0,49 g/l (Grave) | >= 0,50 g/l (Muito Grave)\n\n` +
      `📱 *Uso de Telemóvel em Condução (Art. 84.º CE):*\n` +
      `• Infração Muito Grave: Coima de *250€ a 1250€* + Perda de *3 pontos* na carta + Inibição de conduzir de 1 a 12 meses.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *Código da Estrada Consolidado:* https://dre.pt/dre/legislacao-consolidada/decreto-lei/1994-34537375`
    );
  }

  formatDreAccess(query) {
    const cleanSearch = encodeURIComponent(query.replace(/^(dre|diario da republica|diário da república|pesquisar|lei)\s*/i, "").trim() || "Código da Estrada");
    return (
      `🏛️ *PORTAL OFICIAL DO DIÁRIO DA REPÚBLICA ELETRÓNICO (DRE)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `O Diário da República (dre.pt) é o jornal oficial de publicação de todos os atos legislativos do Estado Português.\n\n` +
      `🔍 *Pesquisa Oficial Direta no DRE:*\n` +
      `👉 https://dre.pt/dre/pesquisa-geral?search=${cleanSearch}\n\n` +
      `📜 *Principais Diplomas Consolidados Disponíveis:*\n` +
      `1. *Código da Estrada:* https://dre.pt/dre/legislacao-consolidada/decreto-lei/1994-34537375\n` +
      `2. *Tempos de Condução (Lei 27/2010):* https://dre.pt/dre/legislacao-consolidada/lei/2010-34538875\n` +
      `3. *Transporte de Crianças (Lei 13/2006):* https://dre.pt/dre/legislacao-consolidada/lei/2006-34575836\n` +
      `4. *Regulamento de Sinalização de Trânsito:* https://dre.pt/dre/legislacao-consolidada/decreto-regulamentar/1998-34537703\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Podes perguntar ao bot qualquer dúvida sobre artigos, coimas, inibições ou recursos administrativos!_`
    );
  }

  formatOverview() {
    return (
      `⚖️ *ASSISTENTE JURÍDICO SÉNIOR DE LEIS & TRÂNSITO EM PORTUGAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Estou apto para analisar qualquer diploma do Governo Português e Diário da República:\n\n` +
      `⏱️ *1. Tempos de Condução & Repouso:* Reg. CE 561/2006, pausas de 45m, limites de 9h/10h, repousos semanais de 45h.\n` +
      `👶 *2. Transporte de Crianças:* Lei 13/2006 (TCC), cadeirinhas SRI até 135cm/12 anos, carrinhas escolares.\n` +
      `🚗 *3. Código da Estrada:* Limites de velocidade, taxas de álcool (regime geral e profissional), uso de telemóvel, rotundas e prioridades.\n` +
      `🏛️ *4. Regulamentos Municipais:* Cargas e descargas, zonas de estacionamento tarifado, ZER e competências da Polícia Municipal.\n` +
      `📜 *5. Diário da República Eletrónico:* Links diretos e pesquisa oficial em dre.pt.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Faz qualquer pergunta jurídica direta: ex: \"posso conduzir 10 horas?\", \"qual a multa de telemóvel?\", \"regras da carrinha escolar\" ou \"leis municipais de estacionamento\"!_`
    );
  }
}

export const portugalLawService = new PortugalLawService();
export default portugalLawService;
