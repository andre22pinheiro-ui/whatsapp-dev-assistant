import fs from "fs";
import path from "path";
import { spawn, execSync } from "child_process";
import config from "../config.js";
import logger from "../utils/logger.js";

// Listar todos os projetos dentro de Desktop\projectos
export function listAllProjects() {
  const dir = config.projectsDir;
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules" || ["app", "build", "gradle", "release"].includes(entry.name)) continue;

    const projPath = path.join(dir, entry.name);
    const hasRootGradle =
      fs.existsSync(path.join(projPath, "build.gradle")) ||
      fs.existsSync(path.join(projPath, "build.gradle.kts")) ||
      fs.existsSync(path.join(projPath, "gradlew.bat"));

    const hasCapacitorAndroid =
      fs.existsSync(path.join(projPath, "android", "gradlew.bat")) ||
      fs.existsSync(path.join(projPath, "capacitor.config.json"));

    const hasPackageJson = fs.existsSync(path.join(projPath, "package.json"));
    const hasPython = fs.existsSync(path.join(projPath, "server.py")) || fs.existsSync(path.join(projPath, "requirements.txt"));

    const apks = findApkFiles(projPath);

    let type = "general";
    if (hasCapacitorAndroid) type = "capacitor-android";
    else if (hasRootGradle) type = "android-native";
    else if (hasPython) type = "python";
    else if (hasPackageJson) type = "node";

    projects.push({
      name: entry.name,
      path: projPath,
      type,
      hasGradle: hasRootGradle || hasCapacitorAndroid,
      hasCapacitor: hasCapacitorAndroid,
      hasPackageJson,
      hasPython,
      apkCount: apks.length,
      latestApk: apks.length > 0 ? apks[0] : null
    });
  }

  return projects;
}

// Procurar recursivamente por ficheiros .apk dentro de um projeto
export function findApkFiles(dirPath, maxDepth = 6, currentDepth = 0) {
  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return [];
  const results = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...findApkFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".apk")) {
        const stats = fs.statSync(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
          sizeBytes: stats.size,
          modified: stats.mtime
        });
      }
    }
  } catch (e) {
    // ignorar pastas sem permissão
  }

  // Ordenar pelo mais recentemente modificado
  return results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

// Compilar Projeto (Suporta Capacitor Android, Android Nativo Gradle e Web)
export function buildAndroidProject(projectName, variant = "debug", onProgress = null) {
  return new Promise((resolve) => {
    const projectPath = path.join(config.projectsDir, projectName);

    if (!fs.existsSync(projectPath)) {
      return resolve({
        success: false,
        message: `Projeto "${projectName}" não foi encontrado em ${config.projectsDir}.`
      });
    }

    // Determinar diretório de compilação Gradle (raiz ou subpasta android/)
    let gradleDir = projectPath;
    const capacitorAndroidDir = path.join(projectPath, "android");
    const isCapacitor = fs.existsSync(path.join(capacitorAndroidDir, "gradlew.bat"));

    if (isCapacitor) {
      gradleDir = capacitorAndroidDir;
    }

    // Assegurar local.properties com sdk.dir correto
    const localProps = path.join(gradleDir, "local.properties");
    if (!fs.existsSync(localProps)) {
      try {
        fs.writeFileSync(localProps, `sdk.dir=C:\\\\Users\\\\Surface_Dpc\\\\AppData\\\\Local\\\\Android\\\\Sdk\n`, "utf8");
        logger.info(`Ficheiro local.properties criado automaticamente em ${gradleDir}`);
      } catch (e) {
        logger.warn("Não foi possível criar local.properties:", e);
      }
    }

    const gradlew = path.join(gradleDir, "gradlew.bat");
    const useGradlew = fs.existsSync(gradlew);

    if (!useGradlew) {
      return resolve({
        success: false,
        message: `Projeto "${projectName}" não possui ficheiro gradlew.bat (nem na raiz nem em android/).`
      });
    }

    const task = variant.toLowerCase() === "release" ? "assembleRelease" : "assembleDebug";

    logger.info(`A iniciar compilação Android: ${projectName} [${task}] em ${gradleDir}`);
    if (onProgress) onProgress(`🔨 A compilar *${projectName}* (${task})...`);

    const child = spawn(gradlew, [task, "--no-daemon"], {
      cwd: gradleDir,
      shell: true,
      env: {
        ...process.env,
        ANDROID_HOME: config.androidSdkPath,
        ANDROID_SDK_ROOT: config.androidSdkPath
      }
    });

    let outputLog = "";

    child.stdout.on("data", (data) => {
      const text = data.toString();
      outputLog += text;
      if (onProgress && (text.includes("BUILD") || text.includes("> Task") || text.includes("%"))) {
        const lines = text.trim().split("\n");
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.length > 5) logger.info(`[Gradle ${projectName}] ${lastLine}`);
      }
    });

    child.stderr.on("data", (data) => {
      outputLog += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        logger.info(`Compilação Android concluída com sucesso para ${projectName}`);
        const apks = findApkFiles(projectPath);
        const latestApk = apks.length > 0 ? apks[0] : null;

        resolve({
          success: true,
          projectName,
          apk: latestApk,
          message: latestApk
            ? `✅ *Compilação concluída com sucesso!*\n📱 Projeto: *${projectName}*\n📦 APK: \`${latestApk.name}\` (${latestApk.sizeMb} MB)\n📍 Local: \`${latestApk.path}\``
            : `✅ *Compilação concluída com sucesso!* (Nenhum ficheiro APK novo gerado).`
        });
      } else {
        logger.error(`Falha na compilação Gradle para ${projectName} (código ${code})`);
        const lines = outputLog.split("\n");
        const errorTail = lines.slice(-15).join("\n").trim();

        resolve({
          success: false,
          projectName,
          message: `❌ *Falha na compilação de ${projectName} (Código: ${code})*\n\`\`\`\n${errorTail}\n\`\`\``
        });
      }
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        projectName,
        message: `❌ Erro ao iniciar processo Gradle: ${err.message}`
      });
    });
  });
}

// Diagnóstico Completo de Saúde de um Projeto
export function diagnoseProject(projectName) {
  const projectPath = path.join(config.projectsDir, projectName);
  if (!fs.existsSync(projectPath)) {
    return { success: false, message: `Projeto "${projectName}" não encontrado.` };
  }

  const issues = [];
  const checks = [];

  const hasPackageJson = fs.existsSync(path.join(projectPath, "package.json"));
  const hasNodeModules = fs.existsSync(path.join(projectPath, "node_modules"));
  const hasCapacitor = fs.existsSync(path.join(projectPath, "capacitor.config.json"));
  const hasAndroidFolder = fs.existsSync(path.join(projectPath, "android"));
  const hasRootGradle = fs.existsSync(path.join(projectPath, "gradlew.bat"));
  const hasPython = fs.existsSync(path.join(projectPath, "server.py"));

  checks.push(`📁 Pasta: \`${projectPath}\``);

  if (hasPackageJson) {
    checks.push(`📦 Node.js / NPM: package.json detetado`);
    if (!hasNodeModules) {
      issues.push(`⚠️ Pasta \`node_modules\` em falta. É necessário executar \`npm install\`.`);
    } else {
      checks.push(`✅ Dependências \`node_modules\` instaladas`);
    }
  }

  if (hasCapacitor) {
    checks.push(`⚡ Capacitor: Aplicação Híbrida Mobile detetada`);
    if (hasAndroidFolder) {
      checks.push(`📱 Pasta \`android/\` presente`);
      const localProps = path.join(projectPath, "android", "local.properties");
      if (!fs.existsSync(localProps)) {
        issues.push(`⚠️ \`android/local.properties\` em falta (Android SDK não referenciado).`);
      } else {
        checks.push(`✅ \`local.properties\` configurado com Android SDK`);
      }
    } else {
      issues.push(`⚠️ Plataforma Android não sincronizada. Executar \`npx cap add android\`.`);
    }
  } else if (hasRootGradle) {
    checks.push(`🤖 Android Nativo (Gradle Kotlin/Java)`);
    const localProps = path.join(projectPath, "local.properties");
    if (!fs.existsSync(localProps)) {
      issues.push(`⚠️ \`local.properties\` em falta na raiz.`);
    } else {
      checks.push(`✅ \`local.properties\` configurado`);
    }
  }

  if (hasPython) {
    checks.push(`🐍 Projeto Python`);
    const venv = path.join(projectPath, ".venv");
    if (fs.existsSync(venv)) {
      checks.push(`✅ Ambiente Virtual (.venv) detetado`);
    } else {
      issues.push(`ℹ️ Ambiente virtual (.venv) não encontrado na raiz.`);
    }
  }

  const apks = findApkFiles(projectPath);
  if (apks.length > 0) {
    checks.push(`📦 ${apks.length} ficheiro(s) APK existente(s). Mais recente: \`${apks[0].name}\` (${apks[0].sizeMb} MB)`);
  }

  const isHealthy = issues.length === 0;

  return {
    success: true,
    projectName,
    isHealthy,
    checks,
    issues,
    message: isHealthy
      ? `🟢 *Diagnóstico: ${projectName} está SAUDÁVEL!*\n\n${checks.join("\n")}\n\n✨ Pronto para compilar e executar sem erros.`
      : `🟡 *Diagnóstico: ${projectName} tem alertas:*\n\n${checks.join("\n")}\n\n*Problemas Encontrados:*\n${issues.join("\n")}\n\n💡 Usa \`/corrigir ${projectName}\` para reparação autónoma.`
  };
}

// Reparação / Auto-Cura de um Projeto
export function fixProject(projectName) {
  const projectPath = path.join(config.projectsDir, projectName);
  if (!fs.existsSync(projectPath)) {
    return { success: false, message: `Projeto "${projectName}" não encontrado.` };
  }

  const actionsDone = [];

  // 1. Assegurar local.properties em todas as pastas Android
  const targetDirs = [projectPath, path.join(projectPath, "android")];
  for (const d of targetDirs) {
    const hasGradle = fs.existsSync(path.join(d, "gradlew.bat")) || fs.existsSync(path.join(d, "build.gradle")) || fs.existsSync(path.join(d, "build.gradle.kts"));
    if (hasGradle) {
      const propPath = path.join(d, "local.properties");
      if (!fs.existsSync(propPath)) {
        try {
          fs.writeFileSync(propPath, `sdk.dir=C:\\\\Users\\\\Surface_Dpc\\\\AppData\\\\Local\\\\Android\\\\Sdk\n`, "utf8");
          actionsDone.push(`✅ Criado \`local.properties\` com SDK Android em \`${path.relative(projectPath, propPath) || "raiz"}\``);
        } catch (e) {
          actionsDone.push(`⚠️ Falha ao criar local.properties: ${e.message}`);
        }
      }
    }
  }

  // 2. Limpar bloqueios e ficheiros temporários de build
  for (const d of targetDirs) {
    const lockFile = path.join(d, ".gradle", "buildOutputCleanup", "buildOutputCleanup.lock");
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
        actionsDone.push(`🧹 Removido ficheiro de bloqueio de compilação (\`buildOutputCleanup.lock\`)`);
      } catch (e) {}
    }
  }

  // 3. Se for projeto Capacitor com package.json, garantir build web se dist não existir
  const hasCapacitor = fs.existsSync(path.join(projectPath, "capacitor.config.json"));
  const hasPackageJson = fs.existsSync(path.join(projectPath, "package.json"));
  const distDir = path.join(projectPath, "dist");

  if (hasCapacitor && hasPackageJson && !fs.existsSync(distDir)) {
    actionsDone.push(`ℹ️ Pasta \`dist/\` em falta para o Capacitor. Pode ser necessário correr \`npm run build\`.`);
  }

  if (actionsDone.length === 0) {
    actionsDone.push("ℹ️ Nenhuma inconsistência estrutural detetada. O projeto está íntegro.");
  }

  return {
    success: true,
    projectName,
    actionsDone,
    message: `🛠️ *Reparação Autónoma para ${projectName}:*\n\n${actionsDone.join("\n")}`
  };
}

// Dispositivos ADB conectados
export function getAdbDevices() {
  return new Promise((resolve) => {
    if (!fs.existsSync(config.adbPath)) {
      return resolve({
        success: false,
        message: `ADB não encontrado em ${config.adbPath}`
      });
    }

    const child = spawn(config.adbPath, ["devices", "-l"], { shell: true });
    let output = "";

    child.stdout.on("data", (d) => (output += d.toString()));
    child.on("close", (code) => {
      if (code === 0) {
        const lines = output
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("List of devices"));

        resolve({
          success: true,
          raw: output,
          devices: lines
        });
      } else {
        resolve({ success: false, message: `Erro ao executar adb (Código: ${code})` });
      }
    });
  });
}

// Instalar APK num telemóvel / emulador via ADB
export function installApkViaAdb(apkPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(apkPath)) {
      return resolve({ success: false, message: `Ficheiro APK não encontrado: ${apkPath}` });
    }

    logger.info(`A instalar APK via ADB: ${apkPath}`);
    const child = spawn(config.adbPath, ["install", "-r", apkPath], { shell: true });
    let output = "";

    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));

    child.on("close", (code) => {
      if (code === 0 && output.includes("Success")) {
        resolve({ success: true, message: `✅ APK instalado com sucesso no telemóvel/emulador!` });
      } else {
        resolve({
          success: false,
          message: `❌ Falha ao instalar APK via ADB:\n\`\`\`${output.trim()}\`\`\``
        });
      }
    });
  });
}

// Abrir projeto no Android Studio
export function openInAndroidStudio(projectName) {
  const projectPath = path.join(config.projectsDir, projectName);
  if (!fs.existsSync(projectPath)) {
    return { success: false, message: `Projeto "${projectName}" não encontrado.` };
  }

  if (!fs.existsSync(config.studioPath)) {
    return { success: false, message: `Android Studio não encontrado em ${config.studioPath}` };
  }

  try {
    const child = spawn(`"${config.studioPath}"`, [`"${projectPath}"`], {
      detached: true,
      shell: true,
      stdio: "ignore"
    });
    child.unref();

    return {
      success: true,
      message: `🚀 A abrir projeto *${projectName}* no Android Studio...`
    };
  } catch (e) {
    return { success: false, message: `Erro ao abrir Android Studio: ${e.message}` };
  }
}

export default {
  listAllProjects,
  findApkFiles,
  buildAndroidProject,
  diagnoseProject,
  fixProject,
  getAdbDevices,
  installApkViaAdb,
  openInAndroidStudio
};
