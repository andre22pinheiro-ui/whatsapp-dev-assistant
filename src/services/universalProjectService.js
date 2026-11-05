import fs from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import logger from "../utils/logger.js";

const execAsync = promisify(exec);

// Diretórios monitorizados onde residem os projetos do desenvolvedor
export const PROJECT_ROOTS = [
  "C:\\Users\\Surface_Dpc\\Desktop\\projectos",
  "C:\\Users\\Surface_Dpc\\AndroidStudioProjects",
  "C:\\Users\\Surface_Dpc\\Documents\\GitHub"
];

const ANDROID_STUDIO_PATH = "C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe";
const RECENT_PROJECTS_XML = "C:\\Users\\Surface_Dpc\\AppData\\Roaming\\Google\\AndroidStudio2026.2.1\\options\\recentProjects.xml";

const EXCLUDE_DIRS = new Set([
  ".gradle", ".idea", ".kotlin", ".agent", "build", "gradle", "node_modules", "app", "release"
]);

/**
 * Obtém a lista de projetos atualmente abertos ou recentes no Android Studio
 */
export function getAndroidStudioRecentProjects() {
  const result = { opened: [], recent: [] };
  if (!fs.existsSync(RECENT_PROJECTS_XML)) return result;

  try {
    const xml = fs.readFileSync(RECENT_PROJECTS_XML, "utf8");
    const entryRegex = /<entry key="([^"]+)">([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const rawPath = match[1].replace("$USER_HOME$", "C:\\Users\\Surface_Dpc").replace(/\//g, "\\");
      const block = match[2];
      const isOpened = block.includes('opened="true"');

      if (isOpened) {
        result.opened.push(rawPath);
      } else {
        result.recent.push(rawPath);
      }
    }
  } catch (err) {
    logger.warn("Erro ao ler recentProjects.xml do Android Studio:", err);
  }

  return result;
}

/**
 * Lista todos os projetos de todos os diretórios com metadados de Git, tipo e compilação
 */
export async function listAllProjects(includeGitDetails = true) {
  const studioStatus = getAndroidStudioRecentProjects();
  const allProjects = [];

  for (const rootDir of PROJECT_ROOTS) {
    if (!fs.existsSync(rootDir)) continue;

    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || EXCLUDE_DIRS.has(entry.name)) continue;

        const projPath = path.join(rootDir, entry.name);

        // Identificar tipo de projeto
        const hasRootGradle =
          fs.existsSync(path.join(projPath, "build.gradle")) ||
          fs.existsSync(path.join(projPath, "build.gradle.kts")) ||
          fs.existsSync(path.join(projPath, "gradlew.bat"));

        const hasCapacitorAndroid =
          fs.existsSync(path.join(projPath, "android", "gradlew.bat")) ||
          fs.existsSync(path.join(projPath, "capacitor.config.json"));

        const hasPackageJson = fs.existsSync(path.join(projPath, "package.json"));
        const hasPython =
          fs.existsSync(path.join(projPath, "server.py")) ||
          fs.existsSync(path.join(projPath, "requirements.txt")) ||
          fs.existsSync(path.join(projPath, "main.py"));

        let type = "general";
        if (hasCapacitorAndroid) type = "capacitor-android";
        else if (hasRootGradle) type = "android-native";
        else if (hasPython) type = "python";
        else if (hasPackageJson) type = "node";

        // Git status
        const gitDir = path.join(projPath, ".git");
        const hasGit = fs.existsSync(gitDir);
        let gitInfo = { hasGit, branch: null, commits: 0, dirtyFiles: 0, remote: null };

        if (hasGit && includeGitDetails) {
          try {
            const branchRes = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: projPath }).catch(() => ({ stdout: "" }));
            gitInfo.branch = branchRes.stdout.trim() || "unknown";

            const countRes = await execAsync("git rev-list --count HEAD", { cwd: projPath }).catch(() => ({ stdout: "0" }));
            gitInfo.commits = parseInt(countRes.stdout.trim(), 10) || 0;

            const statusRes = await execAsync("git status --porcelain", { cwd: projPath }).catch(() => ({ stdout: "" }));
            const lines = statusRes.stdout.trim().split("\n").filter(l => l.trim().length > 0);
            gitInfo.dirtyFiles = lines.length;

            const remoteRes = await execAsync("git remote get-url origin", { cwd: projPath }).catch(() => ({ stdout: "" }));
            gitInfo.remote = remoteRes.stdout.trim() || null;
          } catch (e) {
            // Ignorar falhas pontuais de git
          }
        }

        // Estado no Android Studio
        const isOpenInStudio = studioStatus.opened.some(p => p.toLowerCase() === projPath.toLowerCase());
        const isRecentInStudio = studioStatus.recent.some(p => p.toLowerCase() === projPath.toLowerCase());

        // Apks
        const apks = findApks(projPath);

        allProjects.push({
          name: entry.name,
          path: projPath,
          rootSource: rootDir,
          type,
          hasGit,
          git: gitInfo,
          isOpenInStudio,
          isRecentInStudio,
          hasGradle: hasRootGradle || hasCapacitorAndroid,
          apkCount: apks.length,
          latestApk: apks.length > 0 ? apks[0] : null
        });
      }
    } catch (err) {
      logger.error(`Erro ao ler diretório de projetos ${rootDir}:`, err);
    }
  }

  return allProjects;
}

/**
 * Encontra um projeto por nome aproximado ou caminho
 */
export async function findProject(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();

  const projects = await listAllProjects(false);

  // 1. Procura por caminho exato
  const exactPath = projects.find(p => p.path.toLowerCase() === q);
  if (exactPath) return exactPath;

  // 2. Procura por nome exato
  const exactName = projects.find(p => p.name.toLowerCase() === q);
  if (exactName) return exactName;

  // 3. Procura por substring
  const fuzzy = projects.find(p => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()));
  if (fuzzy) return fuzzy;

  return null;
}

/**
 * Executa uma operação Git em qualquer projeto
 */
export async function runGit(projectNameOrPath, gitCommand) {
  const proj = await findProject(projectNameOrPath);
  if (!proj) {
    return { success: false, message: `Projeto "${projectNameOrPath}" não encontrado no inventário universal.` };
  }

  try {
    const fullCmd = `git ${gitCommand}`;
    const { stdout, stderr } = await execAsync(fullCmd, { cwd: proj.path });
    return {
      success: true,
      project: proj.name,
      path: proj.path,
      output: (stdout || stderr || "Comando executado sem saída.").trim()
    };
  } catch (err) {
    return {
      success: false,
      project: proj.name,
      path: proj.path,
      error: err.message,
      output: err.stdout || err.stderr || err.message
    };
  }
}

/**
 * Abre o projeto diretamente no Android Studio
 */
export async function openInAndroidStudio(projectNameOrPath) {
  const proj = await findProject(projectNameOrPath);
  if (!proj) {
    return { success: false, message: `Projeto "${projectNameOrPath}" não encontrado.` };
  }

  if (!fs.existsSync(ANDROID_STUDIO_PATH)) {
    return { success: false, message: `Executável do Android Studio não encontrado em ${ANDROID_STUDIO_PATH}` };
  }

  try {
    const child = spawn(ANDROID_STUDIO_PATH, [proj.path], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();

    return {
      success: true,
      project: proj.name,
      message: `Projeto "${proj.name}" aberto com sucesso no Android Studio!`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Procura recursivamente ficheiros APK num projeto
 */
function findApks(dirPath, maxDepth = 4, depth = 0) {
  if (depth > maxDepth || !fs.existsSync(dirPath)) return [];
  const apks = [];

  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const f of files) {
      if (f.name === "node_modules" || f.name.startsWith(".")) continue;
      const full = path.join(dirPath, f.name);
      if (f.isDirectory()) {
        apks.push(...findApks(full, maxDepth, depth + 1));
      } else if (f.isFile() && f.name.toLowerCase().endsWith(".apk")) {
        const stats = fs.statSync(full);
        apks.push({
          name: f.name,
          path: full,
          sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
          modified: stats.mtime
        });
      }
    }
  } catch (e) {
    // ignorar pastas inacessíveis
  }

  return apks.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

export default {
  PROJECT_ROOTS,
  listAllProjects,
  findProject,
  runGit,
  openInAndroidStudio,
  getAndroidStudioRecentProjects
};

