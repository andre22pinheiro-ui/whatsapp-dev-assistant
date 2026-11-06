// API Link Provisioning Protocol Service
// Provides exact, official registration links and direct onboarding steps for integrated services

export const API_PROVIDERS = {
  gemini: {
    name: "Google AI Studio (Gemini API)",
    category: "Modelos Multimodais, Análise de Imagem & Áudio",
    freeTier: "Tier Gratuito (Gemini 2.5 / 1.5 Flash - 15 RPM, sem custos e sem cartão)",
    url: "https://aistudio.google.com/app/apikey",
    portal: "https://aistudio.google.com",
    steps: [
      "1. Acede a https://aistudio.google.com/app/apikey e inicia sessão com a tua conta Google (Andre22pinheiro@gmail.com).",
      "2. Clica em 'Create API key' no topo da página.",
      "3. Seleciona 'Create API key in new project' (ou associa a um projeto Google Cloud existente).",
      "4. Copia a chave com prefixo `AIzaSy...` e configura no bot com `/config gemini <chave>`."
    ]
  },
  telegram: {
    name: "Telegram Bot API",
    category: "Mensagens & Controlo Remoto Autónomo",
    freeTier: "100% Gratuito sem limites práticos",
    url: "https://t.me/BotFather",
    portal: "Aplicação Telegram (Chat direto com @BotFather)",
    steps: [
      "1. Abre o Telegram e pesquisa por @BotFather (ou clica em https://t.me/BotFather).",
      "2. Envia `/newbot` e define o nome e o username (terminado em `bot`).",
      "3. O BotFather devolve imediatamente o token de API (ex: `9048099830:AAHK...`).",
      "4. Obtém o teu Chat ID enviando uma mensagem para @userinfobot no Telegram."
    ]
  },
  openrouteservice: {
    name: "OpenRouteService (ORS)",
    category: "Navegação de Pesados, Gabarito, Matrizes & Rotas 3D",
    freeTier: "2.000 pedidos/dia gratuitos (Plano Standard Grátis)",
    url: "https://openrouteservice.org/dev/#/signup",
    portal: "https://openrouteservice.org/dev/#/home",
    steps: [
      "1. Acede a https://openrouteservice.org/dev/#/signup e regista conta gratuita.",
      "2. Confirma o email e inicia sessão no Developer Dashboard.",
      "3. Em 'API Keys', escolhe 'Token type: Free' e atribui um nome.",
      "4. Clica em 'CREATE TOKEN' e copia a chave de 56 caracteres."
    ]
  },
  groq: {
    name: "Groq Cloud (LPU Inference Engine)",
    category: "Inteligência Artificial Determinística Ultra-Rápida (Temperatura 0.0)",
    freeTier: "Tier Gratuito (30 RPM, 14.400 requisições/dia, 0 custos)",
    url: "https://console.groq.com/keys",
    portal: "https://console.groq.com",
    steps: [
      "1. Acede a https://console.groq.com e faz login com Google ou GitHub.",
      "2. No menu lateral, acede a 'API Keys' (https://console.groq.com/keys).",
      "3. Clica em 'Create API Key', define um nome descritivo e clica em 'Submit'.",
      "4. Copia a chave com prefixo `gsk_...`."
    ]
  },
  supabase: {
    name: "Supabase (PostgreSQL & Storage Backend)",
    category: "Base de Dados Relacional, Autenticação & Edge Functions",
    freeTier: "2 Projetos gratuitos, 500MB DB, 1GB Storage, 50.000 utilizadores ativos",
    url: "https://supabase.com/dashboard/sign-up",
    portal: "https://supabase.com/dashboard",
    steps: [
      "1. Acede a https://supabase.com/dashboard/sign-up e faz login com GitHub.",
      "2. Clica em 'New project', define o nome e password e escolhe a região (Central EU).",
      "3. Aguarda 1 minuto pela conclusão do provisionamento PostgreSQL.",
      "4. Em 'Project Settings' -> 'API', copia a 'Project URL' e a chave 'anon / public'."
    ]
  },
  cloudinary: {
    name: "Cloudinary",
    category: "Media CDN, Armazenamento & Otimização de Imagem/Vídeo",
    freeTier: "25 Créditos mensais gratuitos (25.000 transformações ou 25GB armazenamento/largura de banda)",
    url: "https://cloudinary.com/users/register_free",
    portal: "https://console.cloudinary.com/pm",
    steps: [
      "1. Acede a https://cloudinary.com/users/register_free e cria conta gratuita.",
      "2. Conclui o registo e acede ao Dashboard principal.",
      "3. No painel 'Product Environment Credentials', copia o 'Cloud Name', 'API Key' e 'API Secret'.",
      "4. O URL de conexão segue o formato: `cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>`."
    ]
  },
  huggingface: {
    name: "Hugging Face (Inference API & Hub)",
    category: "Modelos de IA Open-Source, Embeddings & Visão Computacional",
    freeTier: "Acesso gratuito à Serverless Inference API (Rate limited, sem custos)",
    url: "https://huggingface.co/join",
    portal: "https://huggingface.co/settings/tokens",
    steps: [
      "1. Acede a https://huggingface.co/join e cria conta com o teu email.",
      "2. Acede a https://huggingface.co/settings/tokens.",
      "3. Clica em 'Create new token', define o tipo (Read para inferência) e um nome descritivo.",
      "4. Copia o token de acesso que inicia por `hf_...`."
    ]
  },
  dre_eurlex: {
    name: "DRE.pt (INCM) & EUR-Lex",
    category: "Legislação Portuguesa & Diretivas/Regulamentos da União Europeia",
    freeTier: "Acesso Livre & Aberto (Sem necessidade de Chave ou Token de API)",
    url: "https://dre.pt / https://eur-lex.europa.eu",
    portal: "Acesso Direto Público",
    steps: [
      "1. DRE.pt e EUR-Lex NÃO exigem chaves nem tokens privados.",
      "2. O bot consulta a legislação diretamente através da base interna determinística (portugalLawService) e endpoints públicos de dados abertos.",
      "3. Não precisas de registar contas nem gerar credenciais para este módulo: já está 100% ativo."
    ]
  },
  github: {
    name: "GitHub Developer Settings (Personal Access Token - PAT)",
    category: "Controlo de Versões, CI/CD Actions & Repositórios Autónomos",
    freeTier: "Repositórios ilimitados, 2.000 minutos mensais de GitHub Actions",
    url: "https://github.com/settings/tokens",
    portal: "https://github.com/settings/tokens?type=beta",
    steps: [
      "1. Acede a https://github.com/settings/tokens (Personal Access Tokens - Classic).",
      "2. Clica em 'Generate new token (classic)'.",
      "3. Define a nota (ex: 'Antigravity-Master') e seleciona os scopes: `repo`, `workflow`, `write:packages`.",
      "4. Clica em 'Generate token' no fundo da página e copia a chave `ghp_...`."
    ]
  },
  openstreetmap: {
    name: "OpenStreetMap / Overpass API / Nominatim",
    category: "Cartografia Aberta, Geocodificação & Redes Viárias",
    freeTier: "100% Gratuito & Open-Source (Sem token obrigatório para consultas standard)",
    url: "https://www.openstreetmap.org/user/new",
    portal: "https://nominatim.org / https://overpass-api.de",
    steps: [
      "1. Consultas espaciais e geocodificação direta via Nominatim e Overpass API não exigem API Key (basta User-Agent com contacto).",
      "2. Para exportações de mapas locais (.osm) com vias e POIs: Acede a https://www.openstreetmap.org, navega até à área pretendida e clica em 'Exportar' (ou 'Export').",
      "3. Para integrações OAuth2 avançadas e edição de mapa: Regista a app em https://www.openstreetmap.org/user/new -> 'OAuth 2 applications'."
    ]
  }
};

export function formatApiDirectory() {
  let output = "🌐 *DIRETÓRIO OFICIAL DE APIS & RECURSOS GRATUITOS*\n";
  output += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += "Protocolo de Provisionamento Determinístico (Free-Tier Permanente):\n\n";

  for (const [key, item] of Object.entries(API_PROVIDERS)) {
    output += `🔑 *${item.name.toUpperCase()}*\n`;
    output += `• *Categoria:* ${item.category}\n`;
    output += `• *Plano Gratuito:* ${item.freeTier}\n`;
    output += `• *Link Oficial:* ${item.url}\n`;
    output += `• *Passos de Onboarding:*\n`;
    for (const step of item.steps) {
      output += `  ${step}\n`;
    }
    output += "\n";
  }

  output += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += "💡 _Para configurar uma chave diretamente, envia:_ `/config <serviço> <chave>`";
  return output;
}

export function getProviderInfo(serviceName) {
  const clean = serviceName.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [key, item] of Object.entries(API_PROVIDERS)) {
    if (key.includes(clean) || item.name.toLowerCase().includes(clean)) {
      return item;
    }
  }
  return null;
}

export function formatSingleProvider(serviceName) {
  const item = getProviderInfo(serviceName);
  if (!item) {
    return formatApiDirectory();
  }

  let output = `🔑 *OBTER RECURSO GRATUITO: ${item.name.toUpperCase()}*\n`;
  output += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += `• *Categoria:* ${item.category}\n`;
  output += `• *Plano Gratuito:* ${item.freeTier}\n`;
  output += `• *Link Direto:* ${item.url}\n`;
  output += `• *Portal:* ${item.portal}\n\n`;
  output += `*Passos de Onboarding:*\n`;
  for (const step of item.steps) {
    output += `${step}\n`;
  }
  output += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += `💡 _Configura no bot:_ \`/config ${item.name.toLowerCase().split(' ')[0]} <tua-chave>\``;
  return output;
}

export default {
  API_PROVIDERS,
  formatApiDirectory,
  getProviderInfo,
  formatSingleProvider
};
