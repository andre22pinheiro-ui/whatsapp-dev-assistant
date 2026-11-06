import logger from "../utils/logger.js";

/**
 * SERVIÇO ESPECIALISTA EM ROTEIROS, EDIÇÃO E DESIGN VISUAL PARA SHORTS & REELS
 * Otimizado para retenção extrema (0 a 3s), ritmo dinâmico e legendas centrais.
 */

export class VideoScriptService {
  /**
   * Gerador técnico de roteiro estruturado para Shorts/Reels
   */
  generateShortScript(theme) {
    const rawTheme = theme.trim();
    logger.info(`🎬 Gerador de Shorts/Reels acionado para tema: "${rawTheme}"`);

    const lower = rawTheme.toLowerCase();

    // 1. Nicho: IA / Programação / Antigravity
    if (lower.includes("ia") || lower.includes("programar") || lower.includes("app") || lower.includes("codigo") || lower.includes("código") || lower.includes("tecnologia")) {
      return this.buildAiDevScript(rawTheme);
    }

    // 2. Nicho: Pladur / Construção / Obras
    if (lower.includes("pladur") || lower.includes("obra") || lower.includes("construcao") || lower.includes("construção") || lower.includes("teto") || lower.includes("parede")) {
      return this.buildPladurScript(rawTheme);
    }

    // 3. Nicho: Pesados / Frotas / Condução / Tacógrafo
    if (lower.includes("camião") || lower.includes("camiao") || lower.includes("frota") || lower.includes("tacografo") || lower.includes("tacógrafo") || lower.includes("motorista")) {
      return this.buildTruckDriverScript(rawTheme);
    }

    // 4. Nicho: Nutrição / Fitness / Alta Proteína
    if (lower.includes("dieta") || lower.includes("proteina") || lower.includes("proteína") || lower.includes("treino") || lower.includes("cottage") || lower.includes("airfryer")) {
      return this.buildNutritionScript(rawTheme);
    }

    // 5. Nicho Geral / Customizado
    return this.buildCustomScript(rawTheme);
  }

  buildAiDevScript(theme) {
    return (
      `🎬 *ROTEIRO TÉCNICO SHORTS & REELS — RETENÇÃO MÁXIMA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *TEMA:* ${theme}\n\n` +
      `1️⃣ *TÍTULO DO VÍDEO:*\n` +
      `"Como criei uma App do zero no telemóvel em 30 segundos (sem tocar no PC)!"\n\n` +
      `2️⃣ *GANCHO (0 a 3 segundos):*\n` +
      `• *NARRADOR:* "Tu ainda estás a programar apps à mão em 2026?!"\n` +
      `  📹 *DESIGN VISUAL / B-ROLL:* Zoom in rápido num ecrã de código cheio de erros vermelhos piscando com SFX de 'glitch'.\n` +
      `  🔤 *TEXTO NA TELA:* *Ainda fazes isto?!*\n\n` +
      `3️⃣ *CONTEÚDO RÁPIDO (3 Pontos Diretos):*\n` +
      `• *PONTO 1 (4 a 14s):*\n` +
      `  *NARRADOR:* "Eu apenas envio uma mensagem no Telegram ou um email com a ideia da app..."\n` +
      `  📹 *DESIGN VISUAL:* Gravação de ecrã vertical em 60fps do telemóvel a enviar prompt no chat, com efeito de partículas a sair do botão.\n` +
      `  🔤 *TEXTO NA TELA:* *Apenas uma mensagem.*\n\n` +
      `• *PONTO 2 (15 a 26s):*\n` +
      `  *NARRADOR:* "O Antigravity AI assume tudo: desenha a interface React, faz push para o GitHub e publica no Vercel num estalar de dedos!"\n` +
      `  📹 *DESIGN VISUAL:* Transição 'whip pan' para o painel da Vercel a dar 'Production Ready' com checkmark verde em 3D animado.\n` +
      `  🔤 *TEXTO NA TELA:* *Deploy no Vercel!*\n\n` +
      `• *PONTO 3 (27 a 38s):*\n` +
      `  *NARRADOR:* "E em menos de um minuto, o APK nativo está compilado e pronto a instalar em qualquer smartphone."\n` +
      `  📹 *DESIGN VISUAL:* Close-up dinâmico da mão a abrir a app funcional no smartphone com interface ultra-moderna e fluida.\n` +
      `  🔤 *TEXTO NA TELA:* *APK Instalado agora.*\n\n` +
      `4️⃣ *CALL TO ACTION (CTA - 39 a 45s):*\n` +
      `• *NARRADOR:* "Queres ver o código e testar grátis? Comenta 'APP' que eu envio-te o link direto!"\n` +
      `  📹 *DESIGN VISUAL:* Seta animada a apontar para a caixa de comentários com efeito sonoro de 'click'.\n` +
      `  🔤 *TEXTO NA TELA:* *Comenta APP abaixo!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  buildPladurScript(theme) {
    return (
      `🎬 *ROTEIRO TÉCNICO SHORTS & REELS — RETENÇÃO MÁXIMA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *TEMA:* ${theme}\n\n` +
      `1️⃣ *TÍTULO DO VÍDEO:*\n` +
      `"O erro número 1 no Pladur que faz as paredes racharem em 6 meses!"\n\n` +
      `2️⃣ *GANCHO (0 a 3 segundos):*\n` +
      `• *NARRADOR:* "Se fazes as juntas de pladur assim, estás a deitar dinheiro ao lixo!"\n` +
      `  📹 *DESIGN VISUAL / B-ROLL:* Macro em câmera lenta de uma parede de pladur com uma fenda aberta, seguido de um som de estalo seco (SFX crack).\n` +
      `  🔤 *TEXTO NA TELA:* *Vai rachar tudo!*\n\n` +
      `3️⃣ *CONTEÚDO RÁPIDO (3 Pontos Diretos):*\n` +
      `• *PONTO 1 (4 a 14s):*\n` +
      `  *NARRADOR:* "Primeiro: nunca cruzes juntas de placas. Deves sempre desfasar as placas no mínimo 40 centímetros."\n` +
      `  📹 *DESIGN VISUAL:* Gráfico minimalista 3D sobreposto na parede mostrando o padrão de amarração correto com linhas verdes de cota.\n` +
      `  🔤 *TEXTO NA TELA:* *Desfasa 40 cm!*\n\n` +
      `• *PONTO 2 (15 a 26s):*\n` +
      `  *NARRADOR:* "Segundo: usa sempre banda de papel microperfurado nas esquinas e nunca fita de rede em tetos falsos!"\n` +
      `  📹 *DESIGN VISUAL:* Comparação dividida no ecrã (Split screen): Fita de rede rasgando à esquerda (X vermelho) vs Papel microperfurado colado com espátula (V verde).\n` +
      `  🔤 *TEXTO NA TELA:* *Usa papel microperfurado!*\n\n` +
      `• *PONTO 3 (27 a 38s):*\n` +
      `  *NARRADOR:* "E terceiro: respeita o aperto dos parafusos. Cabeça ligeiramente afundada, sem rasgar a celulose da placa."\n` +
      `  📹 *DESIGN VISUAL:* Vídeo macro em 120fps da ponta da aparafusadora a embutir o parafuso na placa com precisão milimétrica.\n` +
      `  🔤 *TEXTO NA TELA:* *Não rasgues papel!*\n\n` +
      `4️⃣ *CALL TO ACTION (CTA - 39 a 45s):*\n` +
      `• *NARRADOR:* "Salva este vídeo para a tua próxima obra e segue para mais truques de mestre!"\n` +
      `  📹 *DESIGN VISUAL:* Dedo a clicar no ícone de guardar do Instagram/YouTube com brilho e SFX 'ding'.\n` +
      `  🔤 *TEXTO NA TELA:* *Guarda este vídeo!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  buildTruckDriverScript(theme) {
    return (
      `🎬 *ROTEIRO TÉCNICO SHORTS & REELS — RETENÇÃO MÁXIMA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *TEMA:* ${theme}\n\n` +
      `1️⃣ *TÍTULO DO VÍDEO:*\n` +
      `"A multa de 2.000€ no Tacógrafo que a maioria dos motoristas comete sem saber!"\n\n` +
      `2️⃣ *GANCHO (0 a 3 segundos):*\n` +
      `• *NARRADOR:* "Fazer a pausa de 45 minutos assim vai custar-te a carta de condução!"\n` +
      `  📹 *DESIGN VISUAL / B-ROLL:* Luzes azuis de sirene de polícia refletidas no vidro de um camião pesado à noite com zoom in dinâmico.\n` +
      `  🔤 *TEXTO NA TELA:* *Multa de 2000€!*\n\n` +
      `3️⃣ *CONTEÚDO RÁPIDO (3 Pontos Diretos):*\n` +
      `• *PONTO 1 (4 a 14s):*\n` +
      `  *NARRADOR:* "Pela lei europeia 561, podes fracionar a pausa de 45 minutos, mas a ordem é estrita: primeiro 15 minutos, depois 30 minutos."\n` +
      `  📹 *DESIGN VISUAL:* Animação gráfica estilo tacógrafo digital marcando [15m] + [30m] com barra de progresso verde luminosa.\n` +
      `  🔤 *TEXTO NA TELA:* *Ordem obrigatória: 15+30!*\n\n` +
      `• *PONTO 2 (15 a 26s):*\n` +
      `  *NARRADOR:* "Se fizeres 30 minutos e depois 15 minutos, a fiscalização considera que cometeste infração muito grave de falta de pausa!"\n` +
      `  📹 *DESIGN VISUAL:* Impressora de fita de tacógrafo imprimindo o relatório com carimbo vermelho carimbando 'INFRAÇÃO'.\n` +
      `  🔤 *TEXTO NA TELA:* *Inversão é ilegal!*\n\n` +
      `• *PONTO 3 (27 a 38s):*\n` +
      `  *NARRADOR:* "E nunca te esqueças: o descanso semanal regular de 45 horas é expressamente proibido dentro da cabina!"\n` +
      `  📹 *DESIGN VISUAL:* Câmara deslizando pelo interior da cabina do camião com símbolo de proibição (🚫) em 3D flutuando.\n` +
      `  🔤 *TEXTO NA TELA:* *Proibido na cabina!*\n\n` +
      `4️⃣ *CALL TO ACTION (CTA - 39 a 45s):*\n` +
      `• *NARRADOR:* "Partilha este aviso urgente com outro colega de estrada para lhe poupar uma multa pesada!"\n` +
      `  📹 *DESIGN VISUAL:* Ícone de partilha do Reels piscando com transição rápida e som de buzina de pesados ao fundo.\n` +
      `  🔤 *TEXTO NA TELA:* *Partilha com colegas!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  buildNutritionScript(theme) {
    return (
      `🎬 *ROTEIRO TÉCNICO SHORTS & REELS — RETENÇÃO MÁXIMA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *TEMA:* ${theme}\n\n` +
      `1️⃣ *TÍTULO DO VÍDEO:*\n` +
      `"O lanche de 2 minutos com 30g de Proteína que me secou a barriga!"\n\n` +
      `2️⃣ *GANCHO (0 a 3 segundos):*\n` +
      `• *NARRADOR:* "Pára de comer barras de proteína cheias de açúcar e óleo de palma!"\n` +
      `  📹 *DESIGN VISUAL / B-ROLL:* Mão a atirar uma barra de proteína industrializada para o lixo em câmara lenta com som de impacto grave.\n` +
      `  🔤 *TEXTO NA TELA:* *Deita isso fora!*\n\n` +
      `3️⃣ *CONTEÚDO RÁPIDO (3 Pontos Diretos):*\n` +
      `• *PONTO 1 (4 a 14s):*\n` +
      `  *NARRADOR:* "Pega em 200g de queijo cottage magro e junta 35g de Nestum PRO ou flocos de aveia finos."\n` +
      `  📹 *DESIGN VISUAL:* Plano zenital (visto de cima) do queijo cottage a cair na taça de vidro transparente em ultra-slowmotion.\n` +
      `  🔤 *TEXTO NA TELA:* *Cottage + Nestum PRO*\n\n` +
      `• *PONTO 2 (15 a 26s):*\n` +
      `  *NARRADOR:* "Polvilha com canela da Ceilão: controla o pico de insulina e acelera a tua queima de gordura."\n` +
      `  📹 *DESIGN VISUAL:* Nuvem de canela a cair em pó sobre a taça com efeito de iluminação cinematográfica quente.\n` +
      `  🔤 *TEXTO NA TELA:* *Canela termogénica!*\n\n` +
      `• *PONTO 3 (27 a 38s):*\n` +
      `  *NARRADOR:* "Ficas com quase 30g de proteína pura por menos de 250 calorias e saciedade para 4 horas de trabalho."\n` +
      `  📹 *DESIGN VISUAL:* Tabela holográfica translúcida subindo com: '28g PROTEÍNA | 250 KCAL' com brilho verde neon.\n` +
      `  🔤 *TEXTO NA TELA:* *30g Proteína Pura!*\n\n` +
      `4️⃣ *CALL TO ACTION (CTA - 39 a 45s):*\n` +
      `• *NARRADOR:* "Segue o perfil para receitas de alta proteína que se fazem em menos de 5 minutos!"\n` +
      `  📹 *DESIGN VISUAL:* Colher a retirar uma porção cremosa perfeita aproximando-se da lente da câmara.\n` +
      `  🔤 *TEXTO NA TELA:* *Segue para mais!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  buildCustomScript(theme) {
    return (
      `🎬 *ROTEIRO TÉCNICO SHORTS & REELS — RETENÇÃO MÁXIMA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *TEMA:* ${theme}\n\n` +
      `1️⃣ *TÍTULO DO VÍDEO:*\n` +
      `"A verdade que ninguém te conta sobre ${theme} (em 40 segundos)!"\n\n` +
      `2️⃣ *GANCHO (0 a 3 segundos):*\n` +
      `• *NARRADOR:* "Quase toda a gente erra nisto e perde tempo todos os dias!"\n` +
      `  📹 *DESIGN VISUAL / B-ROLL:* Transição rápida com corte seco, zoom dinâmico e fundo desfocado com elemento gráfico em alerta amarelo piscando.\n` +
      `  🔤 *TEXTO NA TELA:* *Estás a errar!*\n\n` +
      `3️⃣ *CONTEÚDO RÁPIDO (3 Pontos Diretos):*\n` +
      `• *PONTO 1 (4 a 14s):*\n` +
      `  *NARRADOR:* "O segredo principal em ${theme} não é a quantidade, mas sim a consistência do método que aplicas."\n` +
      `  📹 *DESIGN VISUAL:* Gráfico minimalista de linha ascendente verde mostrando crescimento exponencial acelerado com SFX de 'whoosh'.\n` +
      `  🔤 *TEXTO NA TELA:* *Foca no método!*\n\n` +
      `• *PONTO 2 (15 a 26s):*\n` +
      `  *NARRADOR:* "Se automatizares o processo com ferramentas digitais, cortas 80% do esforço desnecessário."\n` +
      `  📹 *DESIGN VISUAL:* Time-lapse ultra acelerado de mãos num teclado e ecrã a completar processos em segundos.\n` +
      `  🔤 *TEXTO NA TELA:* *Automatiza tudo agora!*\n\n` +
      `• *PONTO 3 (27 a 38s):*\n` +
      `  *NARRADOR:* "O resultado aparece logo nos primeiros dias se eliminares as distrações e seguires este passo a passo."\n` +
      `  📹 *DESIGN VISUAL:* Ecrã com antes e depois (Split Screen) com transição de luz fluida e texto de alta nitidez.\n` +
      `  🔤 *TEXTO NA TELA:* *Resultado imediato!*\n\n` +
      `4️⃣ *CALL TO ACTION (CTA - 39 a 45s):*\n` +
      `• *NARRADOR:* "Clica no coração se concordas e segue para o próximo truque diário!"\n` +
      `  📹 *DESIGN VISUAL:* Ícone de coração a pulsar e a transformar-se em botão de 'Subscrever' animado.\n` +
      `  🔤 *TEXTO NA TELA:* *Deixa o like!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }
}

export const videoScriptService = new VideoScriptService();
export default videoScriptService;

