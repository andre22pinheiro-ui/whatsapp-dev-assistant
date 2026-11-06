import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";
import { promisify } from "util";
import https from "https";
import config from "../config.js";
import logger from "../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const execAsync = promisify(exec);

export function getSystemGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    const stdout = execSync("echo protocol=https`nhost=github.com | git credential fill", { encoding: "utf8" });
    const match = stdout.match(/password=(.+)/);
    if (match) return match[1].trim();
  } catch (e) {}
  return "";
}

const GITHUB_OWNER = "andre22pinheiro-ui";

export class AppScaffoldService {
  constructor() {
    this.projectsDir = config.projectsDir || "C:\\Users\\Surface_Dpc\\Desktop\\projectos";
  }

  // Sanitiza nome do projeto para kebab-case seguro
  slugify(text) {
    if (!text) return "app-" + Date.now().toString().slice(-4);
    return text
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "nova-app-" + Date.now().toString().slice(-4);
  }

  // Título legível a partir do slug
  toTitleCase(slug) {
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Chamada à API do GitHub
  requestGithubApi(endpoint, method = "GET", postData = null) {
    const token = getSystemGitHubToken();
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path: endpoint,
        method,
        headers: {
          "User-Agent": "Antigravity-AppScaffold/1.0",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "application/vnd.github.v3+json",
          ...(postData ? { "Content-Type": "application/json" } : {})
        }
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const json = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      });

      req.on("error", (err) => reject(err));
      if (postData) {
        req.write(JSON.stringify(postData));
      }
      req.end();
    });
  }

  // Cria repositório no GitHub se não existir
  async ensureGitHubRepo(repoName, description) {
    try {
      logger.info(`🐙 A verificar repositório GitHub '${GITHUB_OWNER}/${repoName}'...`);
      const checkRes = await this.requestGithubApi(`/repos/${GITHUB_OWNER}/${repoName}`);
      if (checkRes.status === 200) {
        logger.info(`🐙 Repositório '${repoName}' já existe no GitHub.`);
        return {
          exists: true,
          html_url: checkRes.data.html_url,
          clone_url: checkRes.data.clone_url
        };
      }

      logger.info(`🐙 A criar novo repositório GitHub '${GITHUB_OWNER}/${repoName}'...`);
      const createRes = await this.requestGithubApi("/user/repos", "POST", {
        name: repoName,
        description: description || `Aplicação móvel e web desenvolvida automaticamente por Bot a partir de prompt.`,
        private: false,
        auto_init: false
      });

      if (createRes.status === 201) {
        logger.info(`✅ Repositório GitHub criado: ${createRes.data.html_url}`);
        return {
          exists: false,
          html_url: createRes.data.html_url,
          clone_url: createRes.data.clone_url
        };
      } else {
        logger.warn(`GitHub API devolveu status ${createRes.status}: ${JSON.stringify(createRes.data)}`);
        return {
          html_url: `https://github.com/${GITHUB_OWNER}/${repoName}`,
          clone_url: `https://github.com/${GITHUB_OWNER}/${repoName}.git`
        };
      }
    } catch (err) {
      logger.error(`Erro ao criar repositório no GitHub: ${err.message}`);
      return {
        html_url: `https://github.com/${GITHUB_OWNER}/${repoName}`,
        clone_url: `https://github.com/${GITHUB_OWNER}/${repoName}.git`
      };
    }
  }

  // Gera componente App.tsx com IA Gemini (com timeout estrito de 8s) ou fallback moderno
  async generateAppCode(prompt, appTitle) {
    const apiKey = config.geminiApiKey;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const CANDIDATE_MODELS = ["gemini-3.8-flash", "gemini-flash-latest"];

        const systemInstruction = `
Você é um Engenheiro Frontend e Mobile Sénior (React, TypeScript, TailwindCSS, Lucide Icons).
Sua missão é gerar APENAS o código do ficheiro 'src/App.tsx' para uma aplicação moderna e 100% funcional.
Regras Estritas:
1. Devolva APENAS o código TypeScript/React limpo.
2. NÃO use importações de ficheiros locais inexistentes além de 'lucide-react'.
3. O componente deve ser rico, moderno, responsivo (mobile-first), com Tailwind CSS.
4. Exportação padrão obrigatória: export default function App()
`;

        for (const modelName of CANDIDATE_MODELS) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction
            });
            const userPrompt = `Gera o App.tsx para esta aplicação:\nTítulo: ${appTitle}\nRequisitos e Prompt:\n${prompt}`;
            
            // Timeout de 8 segundos para não bloquear a pipeline autónoma
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Gemini 8s")), 8000));
            const generatePromise = model.generateContent(userPrompt);
            const res = await Promise.race([generatePromise, timeoutPromise]);

            let code = res.response.text().trim();
            if (code.includes("```")) {
              code = code.replace(/^```[a-z]*\r?\n/i, "").replace(/\r?\n```$/g, "").trim();
            }
            if (code && code.includes("export default function App")) {
              logger.info(`✨ Código App.tsx gerado com sucesso via Gemini (${modelName})`);
              return code;
            }
          } catch (e) {
            logger.warn(`Tentativa Gemini (${modelName}): ${e.message}`);
          }
        }
      } catch (err) {
        logger.warn(`Gemini indisponível: ${err.message}. A avançar com gerador inteligente local.`);
      }
    }

    // Fallback rico e profissional sem necessidade de IA externa
    return this.getFallbackAppCode(appTitle, prompt);
  }

  getFallbackAppCode(appTitle, prompt) {
    return `import React, { useState, useEffect } from "react";
import { 
  Plus, Search, CheckCircle2, Clock, AlertCircle, 
  Trash2, Filter, Share2, Sparkles, Smartphone, Layers
} from "lucide-react";

interface Item {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  category: string;
  createdAt: string;
}

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem("${this.slugify(appTitle)}_items");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: "1",
        title: "Registo Inicial",
        description: "Configuração inicial da aplicação gerada autonomamente pelo Bot.",
        status: "completed",
        category: "Sistema",
        createdAt: new Date().toLocaleDateString("pt-PT")
      },
      {
        id: "2",
        title: "Análise de Requisitos",
        description: "${(prompt || 'Objetivo da aplicação').replace(/"/g, '\\"')}",
        status: "in_progress",
        category: "Planeamento",
        createdAt: new Date().toLocaleDateString("pt-PT")
      }
    ];
  });

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Geral");

  useEffect(() => {
    localStorage.setItem("${this.slugify(appTitle)}_items", JSON.stringify(items));
  }, [items]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: Item = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim() || "Sem descrição detalhada.",
      status: "pending",
      category: newCategory,
      createdAt: new Date().toLocaleDateString("pt-PT")
    };

    setItems([newItem, ...items]);
    setNewTitle("");
    setNewDesc("");
    setIsModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const nextStatus = item.status === "completed" ? "pending" : "completed";
      return { ...item, status: nextStatus };
    }));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === "all" || item.status === filter;
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase()) ||
                          item.category.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const total = items.length;
  const completed = items.filter(i => i.status === "completed").length;
  const pending = items.filter(i => i.status !== "completed").length;
  const progressPercent = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Header */}
      <header className="bg-indigo-600 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/50 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">${appTitle}</h1>
              <p className="text-xs text-indigo-100 flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Web & Mobile App • André Pinheiro
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-3 py-2 rounded-xl text-sm shadow transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Registo</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center sm:items-start">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</span>
            <span className="text-2xl font-black text-slate-800 mt-1">{total}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center sm:items-start">
            <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Pendentes</span>
            <span className="text-2xl font-black text-amber-600 mt-1">{pending}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center sm:items-start">
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Concluídos</span>
            <span className="text-2xl font-black text-emerald-600 mt-1">{progressPercent}%</span>
          </div>
        </div>

        {/* Prompt Card */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-950 flex flex-col gap-1">
          <span className="font-semibold text-indigo-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" /> Prompt de Criação
          </span>
          <p className="text-slate-700 italic">"${(prompt || 'Aplicação desenvolvida a partir de instruções por email/WhatsApp.').replace(/"/g, '\\"')}"</p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar registos ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-medium text-slate-600">
            {["all", "pending", "completed"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={\`px-3 py-1.5 rounded-lg capitalize transition \${
                  filter === tab ? "bg-white text-indigo-600 shadow-sm font-bold" : "hover:text-slate-900"
                }\`}
              >
                {tab === "all" ? "Todos" : tab === "pending" ? "Pendentes" : "Concluídos"}
              </button>
            ))}
          </div>
        </div>

        {/* List of Items */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-300 text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-semibold">Nenhum registo encontrado</p>
              <p className="text-xs">Clica em "Novo Registo" para adicionares o primeiro elemento.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition flex items-start justify-between gap-3"
              >
                <button
                  onClick={() => toggleStatus(item.id)}
                  className="mt-0.5 text-slate-300 hover:text-emerald-500 transition"
                >
                  {item.status === "completed" ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-emerald-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={\`text-base font-semibold leading-tight \${
                        item.status === "completed" ? "line-through text-slate-400" : "text-slate-800"
                      }\`}
                    >
                      {item.title}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block">{item.createdAt}</span>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Floating Action Button (Mobile FAB) */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Modal for New Entry */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Criar Novo Registo</h2>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Título</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Tarefa / Cliente / Obra..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Categoria</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ex: Geral, Finanças, Obras..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Descrição / Notas</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;
  }

  // Gera toda a estrutura do projeto
  async generateProjectFiles(targetDir, slug, title, prompt) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. package.json
    const packageJson = {
      name: slug,
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "lucide-react": "^0.344.0",
        "@capacitor/core": "^6.0.0",
        "@capacitor/android": "^6.0.0"
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        autoprefixer: "^10.4.19",
        postcss: "^8.4.38",
        tailwindcss: "^3.4.4",
        typescript: "^5.2.2",
        vite: "^5.3.1"
      }
    };
    fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");

    // 2. vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  }
});
`;
    fs.writeFileSync(path.join(targetDir, "vite.config.ts"), viteConfig, "utf8");

    // 3. tsconfig.json & tsconfig.node.json
    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true
      },
      include: ["src"]
    };
    fs.writeFileSync(path.join(targetDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2), "utf8");

    // 4. tailwind.config.js & postcss.config.js
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
    fs.writeFileSync(path.join(targetDir, "tailwind.config.js"), tailwindConfig, "utf8");

    const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
    fs.writeFileSync(path.join(targetDir, "postcss.config.js"), postcssConfig, "utf8");

    // 5. index.html
    const indexHtml = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234f46e5'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#4f46e5" />
    <meta name="description" content="${title} - Desenvolvido por André Pinheiro" />
    <title>${title}</title>
  </head>
  <body class="bg-slate-50 antialiased selection:bg-indigo-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
    fs.writeFileSync(path.join(targetDir, "index.html"), indexHtml, "utf8");

    // 6. capacitor.config.json
    const capConfig = {
      appId: `com.andrepinheiro.${slug.replace(/-/g, "")}`,
      appName: title,
      webDir: "dist",
      server: {
        androidScheme: "https"
      }
    };
    fs.writeFileSync(path.join(targetDir, "capacitor.config.json"), JSON.stringify(capConfig, null, 2), "utf8");

    // 7. vercel.json
    const vercelConfig = {
      rewrites: [
        {
          source: "/(.*)",
          destination: "/index.html"
        }
      ]
    };
    fs.writeFileSync(path.join(targetDir, "vercel.json"), JSON.stringify(vercelConfig, null, 2), "utf8");

    // 8. .gitignore
    const gitignore = `node_modules
dist
dist-ssr
*.local
.env
.env.*
.DS_Store
android/app/build
android/.gradle
.idea
`;
    fs.writeFileSync(path.join(targetDir, ".gitignore"), gitignore, "utf8");

    // 9. src/index.css & src/main.tsx
    const srcDir = path.join(targetDir, "src");
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
`;
    fs.writeFileSync(path.join(srcDir, "index.css"), indexCss, "utf8");

    const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;
    fs.writeFileSync(path.join(srcDir, "main.tsx"), mainTsx, "utf8");

    // 10. src/App.tsx (Gerado com Gemini ou Fallback)
    const appTsxCode = await this.generateAppCode(prompt, title);
    fs.writeFileSync(path.join(srcDir, "App.tsx"), appTsxCode, "utf8");

    // 11. CI/CD GitHub Actions para compilação Android (.github/workflows/android.yml)
    const ghWorkflowDir = path.join(targetDir, ".github", "workflows");
    if (!fs.existsSync(ghWorkflowDir)) fs.mkdirSync(ghWorkflowDir, { recursive: true });

    const androidWorkflow = `name: Build Android APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci || npm install

      - name: Build Web Assets
        run: npm run build

      - name: Setup Java 17
        uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: 17

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Add Capacitor Android
        run: |
          npx cap add android || true
          npx cap sync android

      - name: Build Android APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --stacktrace

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: \${{ github.event.repository.name }}-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;
    fs.writeFileSync(path.join(ghWorkflowDir, "android.yml"), androidWorkflow, "utf8");

    // 12. README.md
    const readme = `# ${title}

Aplicação moderna Web e Mobile desenvolvida automaticamente através da pipeline autónoma de desenvolvimento.

## 🚀 Prompt de Origem
> ${prompt}

## 🌐 Acesso em Produção
- **Vercel Web App:** [Ver em Produção](https://${slug}.vercel.app)
- **Repositório GitHub:** [andre22pinheiro-ui/${slug}](https://github.com/${GITHUB_OWNER}/${slug})
- **Ações CI/CD (Android APK):** [GitHub Actions Workflow](https://github.com/${GITHUB_OWNER}/${slug}/actions)

## 🛠️ Tecnologias
- React 18 + TypeScript + Vite
- Tailwind CSS
- Capacitor Android
- Vercel Deployment
`;
    fs.writeFileSync(path.join(targetDir, "README.md"), readme, "utf8");
  }

  // Executa compilação e deploy no Vercel
  async deployToVercel(targetDir, slug) {
    try {
      logger.info(`▲ A iniciar deploy no Vercel para '${slug}'...`);
      // Executa vercel --prod --yes
      const { stdout, stderr } = await execAsync("vercel --prod --yes", {
        cwd: targetDir,
        timeout: 120000
      });

      // Extrair URL do output do Vercel
      const matches = stdout.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/g);
      let vercelUrl = matches ? matches[matches.length - 1] : `https://${slug}.vercel.app`;
      logger.info(`✅ Vercel Deploy com sucesso: ${vercelUrl}`);
      return { success: true, url: vercelUrl, output: stdout };
    } catch (err) {
      logger.warn(`Aviso no deploy Vercel via CLI: ${err.message}. A tentar fallback de link direto.`);
      return {
        success: false,
        url: `https://${slug}.vercel.app`,
        error: err.message
      };
    }
  }

  // Inicializa Git e envia para o GitHub
  async pushToGitHub(targetDir, slug) {
    try {
      logger.info(`🐙 A inicializar repositório Git local e fazer push para o GitHub...`);
      const token = getSystemGitHubToken();
      const gitRemoteUrl = token
        ? `https://${token}@github.com/${GITHUB_OWNER}/${slug}.git`
        : `https://github.com/${GITHUB_OWNER}/${slug}.git`;

      await execAsync("git init -b main", { cwd: targetDir });
      await execAsync(`git config user.name "${GITHUB_OWNER}"`, { cwd: targetDir });
      await execAsync(`git config user.email "andre22pinheiro@gmail.com"`, { cwd: targetDir });
      await execAsync("git add .", { cwd: targetDir });

      try {
        await execAsync(`git commit -m "feat: initial release generated by Bot from prompt"`, { cwd: targetDir });
      } catch (commitErr) {
        // Nada a commitar se já estiver limpo
      }

      // Configurar remote
      try {
        await execAsync(`git remote add origin ${gitRemoteUrl}`, { cwd: targetDir });
      } catch (remoteErr) {
        await execAsync(`git remote set-url origin ${gitRemoteUrl}`, { cwd: targetDir });
      }

      const pushRes = await execAsync("git push -u origin main --force", { cwd: targetDir });
      logger.info(`✅ Push para GitHub concluído com sucesso: ${pushRes.stdout.trim()}`);
      return {
        success: true,
        repoUrl: `https://github.com/${GITHUB_OWNER}/${slug}`,
        actionsUrl: `https://github.com/${GITHUB_OWNER}/${slug}/actions`
      };
    } catch (err) {
      logger.error(`Erro ao fazer push para o GitHub: ${err.message}`);
      return {
        success: false,
        repoUrl: `https://github.com/${GITHUB_OWNER}/${slug}`,
        actionsUrl: `https://github.com/${GITHUB_OWNER}/${slug}/actions`,
        error: err.message
      };
    }
  }

  // Pipeline Completa de Criação: Prompt -> Ficheiros -> Git/GitHub -> Vercel -> Relatório
  async buildAndDeployApp({ name, prompt, sender = null }) {
    const startTime = Date.now();
    const slug = this.slugify(name);
    const title = this.toTitleCase(slug);
    const targetDir = path.join(this.projectsDir, slug);

    logger.info(`🚀 [APP SCAFFOLD] Início da geração da app '${title}' (${slug})...`);

    // 1. Criar repositório GitHub antecipadamente
    await this.ensureGitHubRepo(slug, `App '${title}': ${prompt.slice(0, 100)}`);

    // 2. Gerar todos os ficheiros do projeto
    await this.generateProjectFiles(targetDir, slug, title, prompt);

    // 3. Fazer push para o GitHub
    const gitResult = await this.pushToGitHub(targetDir, slug);

    // 4. Fazer deploy no Vercel
    const vercelResult = await this.deployToVercel(targetDir, slug);

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    return {
      success: true,
      name: slug,
      title,
      targetDir,
      prompt,
      sender,
      githubUrl: gitResult.repoUrl || `https://github.com/${GITHUB_OWNER}/${slug}`,
      vercelUrl: vercelResult.url || `https://${slug}.vercel.app`,
      actionsUrl: gitResult.actionsUrl || `https://github.com/${GITHUB_OWNER}/${slug}/actions`,
      apkNote: `O APK Android está a ser compilado automaticamente no GitHub Actions (${gitResult.actionsUrl || 'Actions'}).`,
      durationSeconds
    };
  }
}

export const appScaffoldService = new AppScaffoldService();
export default appScaffoldService;
