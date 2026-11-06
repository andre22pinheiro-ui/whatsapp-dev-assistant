import logger from "../utils/logger.js";

/**
 * FORMADOR TCC & PESADOS BOT (CCP HOLDER SPECIALIST)
 * Especialista Técnico e Pedagógico Certificado (CCP) para Transporte Rodoviário de Pesados de Passageiros e Mercadorias.
 * 
 * Enquadramento Normativo Estrito:
 * - Regulamento (CE) n.º 561/2006 & Lei n.º 27/2010 (Tempos de Condução e Repouso)
 * - Regulamento (UE) n.º 165/2014 & Regulamento de Execução (UE) 2021/1228 (Tacógrafo Inteligente Gen 2 / v2)
 * - Regulamento Geral de Segurança Veicular da UE (GSR2 - Regulamento UE 2019/2144)
 * - Diretiva 2003/59/CE & Decreto-Lei n.º 126/2009 (CAM / CQM - Qualificação Inicial e Contínua)
 * - Lei n.º 13/2006 de 17 de abril republicada (Transporte Coletivo de Crianças - TCC)
 * - Código da Estrada (Decreto-Lei n.º 114/94 consolidado)
 */

export const TCC_PEDAGOGICAL_DATABASE = {
  modulos_formacao: [
    {
      id: "mod_1_tempos",
      codigo: "UFCD-TCC-01",
      titulo: "Regulamentação Social Europeia: Condução, Pausas e Tacógrafo Inteligente Gen 2",
      carga_horaria: "14 horas",
      objetivo_pedagogico: "Capacitar os formandos para a gestão autónoma dos períodos de condução e repouso, eliminando infrações graves e dominando o registo no Tacógrafo Inteligente v2 (Smart Tacho 2).",
      conteudos_programaticos: [
        "Regulamento (CE) n.º 561/2006 e Lei n.º 27/2010: Âmbito de aplicação e isenções.",
        "Condução contínua (4h30) e a regra estrita do fracionamento de pausas (15m + 30m).",
        "Limites de condução diária (9h/10h), semanal (56h) e bi-semanal (90h).",
        "Regimes de repouso diário (11h regulares vs. 9h reduzidas) e repouso semanal (45h regulares vs. 24h reduzidas).",
        "Proibição formal de repouso semanal regular na cabina (Artigo 8.º, n.º 8 do Reg. 561/2006 e jurisprudência do TJUE C-102/16).",
        "Regulamento (UE) 165/2014 e Smart Tachograph Gen 2 (v2): Registo automático de passagens de fronteira via GNSS, comunicação DSRC remota para pré-fiscalização e pesagem dinâmica a bordo (OBW)."
      ],
      estudo_de_caso: {
        cenario: "Um motorista de autocarro inicia a marcha às 06:00. Conduz até às 09:00 (3h00), efetua uma pausa de 20 minutos. Retoma a condução às 09:20 e conduz até às 10:50 (1h30). Às 10:50 para e pretende descansar 25 minutos para somar 45 minutos.",
        analise_tecnica: "INFRAÇÃO GRAVE. Pelo Artigo 7.º do Reg. 561/2006, a pausa de 45m só pode ser substituída por uma primeira pausa de PELO MENOS 15 minutos, seguida de uma segunda de PELO MENOS 30 minutos intercaladas no período de 4h30. Os 25 minutos finais não atingem o patamar legal mínimo de 30m, configurando condução sem pausa regulamentar.",
        solucao_pedagogica: "O motorista deve estender a segunda paragem para 30 minutos ininterruptos (parando até às 11:20)."
      }
    },
    {
      id: "mod_2_tcc",
      codigo: "UFCD-TCC-02",
      titulo: "Transporte Coletivo de Crianças (Lei n.º 13/2006): Segurança Passiva, Operação e Vigilância",
      carga_horaria: "21 horas",
      objetivo_pedagogico: "Formar motoristas e vigilantes com certificação oficial TCC sobre os requisitos veiculares, retenção de segurança infantil e procedimentos em caso de emergência e evacuação.",
      conteudos_programaticos: [
        "Enquadramento jurídico da Lei n.º 13/2006 de 17 de abril alterada pela Lei n.º 34/2021.",
        "Requisitos legais da viatura: Idade máxima improrrogável de 16 anos (contada da 1.ª matrícula).",
        "Sistemas de Retenção para Crianças (SRI): Normas ECE R44/04 e UN R129 (i-Size). Pontos ISOFIX e cintos de 3 pontos obrigatórios.",
        "Equipamentos de segurança: Extintor homologado com capacidade regulamentar para a lotação, caixa de primeiros socorros certificada e painéis de sinalização de TCC frontal e retaguarda.",
        "Obrigatoriedade de Vigilante: Obrigatória em transporte de mais de 7 crianças em viaturas de mais de 9 lugares, ou sempre que transporte crianças com idade inferior a 7 anos.",
        "Requisitos do Motorista TCC: Carta de condução adequada há mais de 2 anos, idade mínima de 21 anos, Certificado de Motorista de TCC emitido pelo IMT com exame médico do Grupo 2 e psicotécnico aprovado, registo criminal sem condenações contra a liberdade/autodeterminação sexual de menores."
      ],
      estudo_de_caso: {
        cenario: "Uma carrinha de 16 lugares transporta 10 alunos do 1.º ciclo (idades entre 6 e 9 anos) sem vigilante a bordo, apenas com o motorista.",
        analise_tecnica: "AUTO DE CONTRAORDENAÇÃO MUITO GRAVE. A Lei n.º 13/2006, Artigo 8.º, estipula a obrigatoriedade de pelo menos um vigilante credenciado sempre que: a) O número de crianças exceda 7 em veículos com lotação superior a 9 lugares; OU b) Sejam transportadas crianças de idade inferior a 7 anos. Ambos os critérios foram violados.",
        coima_e_sancao: "Coima aplicável à entidade transportadora (de 500€ a 2.500€) e apreensão cautelar dos documentos da viatura até regularização."
      }
    },
    {
      id: "mod_3_gsr2",
      codigo: "UFCD-TCC-03",
      titulo: "Tecnologia Avançada de Veículos Pesados: Sistemas GSR2, Travagem Eletrónica (EBS) e ADAS",
      carga_horaria: "14 horas",
      objetivo_pedagogico: "Dotar os formandos do conhecimento técnico e operacional dos novos sistemas de segurança ativa e passiva do mandato europeu GSR2.",
      conteudos_programaticos: [
        "Regulamento Geral de Segurança Veicular (GSR2 - Reg. UE 2019/2144) em vigor para todas as novas matrículas na UE.",
        "Sistemas ADAS obrigatórios:",
        "  1. ISA (Intelligent Speed Assistance): Reconhecimento de sinalização e georreferenciação para limitação de velocidade.",
        "  2. MOIS (Moving Off Information System): Radares e câmaras dianteiras para deteção de peões e ciclistas no ângulo morto frontal ao arrancar.",
        "  3. BSIS (Blind Spot Information System): Sensores de ângulo morto lateral direito ao longo de toda a extensão do autocarro/pesado.",
        "  4. REVW (Reversing Detection): Câmaras e sensores de retaguarda de alta definição.",
        "  5. TPMS (Tire Pressure Monitoring System): Monitorização em tempo real de pressão e temperatura dos pneus em todos os eixos.",
        "  6. DDAW (Driver Drowsiness and Attention Warning): Algoritmo de deteção de fadiga e desvio de trajetória.",
        "  7. EDR (Event Data Recorder - 'Caixa Negra'): Gravação de telemetria de 30 segundos pré-colisão e 5 segundos pós-colisão.",
        "Sistemas de Travagem e Estabilidade: EBS (Electronic Braking System), ESP/ESC antibalanceamento de autocarros e retardador eletromagnético/hidráulico (Voith / Telma / Intarder)."
      ],
      estudo_de_caso: {
        cenario: "Numa rotunda urbana apertada, o autocarro inicia viragem à direita e o sistema BSIS emite alerta sonoro agudo e luz LED âmbar no pilar A direito.",
        analise_tecnica: "O sistema BSIS detetou um utilizador vulnerável (ciclista/trotineta) no ângulo morto traseiro direito (Regulamento UN ECE R151). O motorista deve imobilizar a manobra imediatamente sem guinar, aguardar a libertação do corredor e só retomar após confirmação visual direta por espelho grande angular e monitor de câmara lateral."
      }
    }
  ]
};

export class FormadorTccService {
  /**
   * Processador técnico-pedagógico autoritário a temperatura 0.0
   */
  processPedagogicalQuery(query) {
    const q = query.toLowerCase().trim();
    logger.info(`🎓 [FORMADOR TCC & PESADOS] Consulta técnica recebida: "${query}"`);

    // 1. Tempos de Condução e Repouso / Tacógrafo Gen 2
    if (
      q.includes("tempo") || q.includes("conducao") || q.includes("condução") ||
      q.includes("tacografo") || q.includes("tacógrafo") || q.includes("gen 2") ||
      q.includes("smart tacho") || q.includes("pausa") || q.includes("561") || q.includes("165/2014")
    ) {
      return this.formatModuloTempos();
    }

    // 2. Transporte Coletivo de Crianças (TCC) / Lei 13/2006
    if (
      q.includes("tcc") || q.includes("crianca") || q.includes("criança") ||
      q.includes("escolar") || q.includes("vigilante") || q.includes("13/2006") ||
      q.includes("cadeirinha") || q.includes("16 anos")
    ) {
      return this.formatModuloTcc();
    }

    // 3. Sistemas de Segurança Veicular GSR2 / Tecnologia Pesados / ADAS
    if (
      q.includes("gsr2") || q.includes("gsr") || q.includes("adas") ||
      q.includes("bsis") || q.includes("mois") || q.includes("isa") ||
      q.includes("ebs") || q.includes("retarder") || q.includes("edr") ||
      q.includes("seguranca veicular") || q.includes("segurança veicular")
    ) {
      return this.formatModuloGsr2();
    }

    // 4. Formato Geral de Formação CCP
    return this.formatPlanoFormacaoCompleto();
  }

  formatModuloTempos() {
    const mod = TCC_PEDAGOGICAL_DATABASE.modulos_formacao[0];
    return (
      `🎓 *MÓDULO TÉCNICO-PEDAGÓGICO (CCP) — ${mod.codigo}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 *Tema:* ${mod.titulo}\n` +
      `⏱️ *Carga Horária Regulamentar:* ${mod.carga_horaria}\n` +
      `🎯 *Objetivo Pedagógico:* ${mod.objetivo_pedagogico}\n\n` +
      `📋 *ENQUADRAMENTO NORMATIVO E CONTEÚDOS:*\n` +
      mod.conteudos_programaticos.map((c) => `• ${c}`).join("\n") +
      `\n\n` +
      `🔬 *ESTUDO DE CASO PARA FORMAÇÃO DE MOTORISTAS:*\n` +
      `📝 *Cenário Prático:* _"${mod.estudo_de_caso.cenario}"_\n` +
      `⚖️ *Parecer Técnico:* ${mod.estudo_de_caso.analise_tecnica}\n` +
      `✅ *Correção Pedagógica:* ${mod.estudo_de_caso.solucao_pedagogica}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📜 *Diplomas Oficiais:* Reg. (CE) n.º 561/2006 | Lei n.º 27/2010 | Reg. (UE) n.º 165/2014`
    );
  }

  formatModuloTcc() {
    const mod = TCC_PEDAGOGICAL_DATABASE.modulos_formacao[1];
    return (
      `🎓 *MÓDULO TÉCNICO-PEDAGÓGICO (CCP) — ${mod.codigo}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 *Tema:* ${mod.titulo}\n` +
      `⏱️ *Carga Horária Regulamentar:* ${mod.carga_horaria}\n` +
      `🎯 *Objetivo Pedagógico:* ${mod.objetivo_pedagogico}\n\n` +
      `📋 *REQUISITOS LEGAIS E CONTEÚDOS PROGRAMÁTICOS:*\n` +
      mod.conteudos_programaticos.map((c) => `• ${c}`).join("\n") +
      `\n\n` +
      `🔬 *ESTUDO DE CASO PARA FORMAÇÃO TCC:*\n` +
      `📝 *Cenário Prático:* _"${mod.estudo_de_caso.cenario}"_\n` +
      `⚖️ *Parecer Técnico:* ${mod.estudo_de_caso.analise_tecnica}\n` +
      `🚨 *Regime Sancionatório:* ${mod.estudo_de_caso.coima_e_sancao}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📜 *Diplomas Oficiais:* Lei n.º 13/2006 de 17 de abril (alterada pela Lei n.º 34/2021) | Art.º 55.º Código da Estrada`
    );
  }

  formatModuloGsr2() {
    const mod = TCC_PEDAGOGICAL_DATABASE.modulos_formacao[2];
    return (
      `🎓 *MÓDULO TÉCNICO-PEDAGÓGICO (CCP) — ${mod.codigo}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 *Tema:* ${mod.titulo}\n` +
      `⏱️ *Carga Horária Regulamentar:* ${mod.carga_horaria}\n` +
      `🎯 *Objetivo Pedagógico:* ${mod.objetivo_pedagogico}\n\n` +
      `📋 *MANDATOS TECNOLÓGICOS EUROPEUS (GSR2):*\n` +
      mod.conteudos_programaticos.map((c) => `• ${c}`).join("\n") +
      `\n\n` +
      `🔬 *ESTUDO DE CASO: PROCEDIMENTO DE CONDUÇÃO DEFENSIVA:*\n` +
      `📝 *Cenário:* _"${mod.estudo_de_caso.cenario}"_\n` +
      `⚙️ *Protocolo Técnico:* ${mod.estudo_de_caso.analise_tecnica}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📜 *Diplomas Oficiais:* Regulamento (UE) 2019/2144 (GSR2) | Regulamentos UN/ECE R151 (BSIS) e R159 (MOIS)`
    );
  }

  formatPlanoFormacaoCompleto() {
    return (
      `🎓 *FORMADORTCC-BOT — PLANO CURRICULAR DE FORMAÇÃO PROFISSIONAL (CCP)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Assistente técnico e pedagógico para formadores certificados e motoristas profissionais de pesados.\n\n` +
      `📚 *Módulos Disponíveis para Ensino e Consulta:*\n` +
      `1. *UFCD-TCC-01:* Tempos de Condução, Pausas e Tacógrafo Inteligente v2 (Reg. CE 561/2006 & Reg. UE 165/2014).\n` +
      `2. *UFCD-TCC-02:* Transporte Coletivo de Crianças (Lei 13/2006): Inspeções, SRI, idades, cintos e vigilância.\n` +
      `3. *UFCD-TCC-03:* Mandato de Segurança Veicular GSR2 (Reg. UE 2019/2144): Radares BSIS/MOIS, ISA, EDR e EBS.\n\n` +
      `💡 *Como interagir:* Envia \`/tcc\` seguido da tua dúvida técnica ou pedagógica (ex: \`/tcc estudo de caso de fracionamento de pausas\`, \`/tcc requisitos de carrinhas escolares\` ou \`/tcc sistemas gsr2 em autocarros\`).`
    );
  }
}

export const formadorTccService = new FormadorTccService();
export default formadorTccService;
