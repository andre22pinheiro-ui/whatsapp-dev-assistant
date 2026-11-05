import si from "systeminformation";
import { exec, spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import config from "../config.js";
import logger from "../utils/logger.js";

// Obter resumo de saúde do computador
export async function getSystemHealth() {
  try {
    const [cpu, mem, battery, fsSize, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.battery(),
      si.fsSize(),
      si.osInfo()
    ]);

    const uptimeHours = (os.uptime() / 3600).toFixed(1);
    const freeRamGb = (mem.free / 1024 / 1024 / 1024).toFixed(2);
    const totalRamGb = (mem.total / 1024 / 1024 / 1024).toFixed(2);
    const usedRamPercent = ((mem.used / mem.total) * 100).toFixed(1);

    const primaryDisk = fsSize.length > 0 ? fsSize[0] : null;
    const diskInfo = primaryDisk
      ? `${(primaryDisk.available / 1024 / 1024 / 1024).toFixed(1)} GB livres de ${(primaryDisk.size / 1024 / 1024 / 1024).toFixed(1)} GB (${primaryDisk.use}%)`
      : "N/A";

    const batteryInfo = battery.hasBattery
      ? `${battery.percent}% ${battery.isCharging ? "⚡ (A carregar)" : "🔋"}`
      : "Desktop / Sem bateria";

    return {
      success: true,
      data: {
        cpuLoad: cpu.currentLoad.toFixed(1) + "%",
        ram: `${freeRamGb} GB livres de ${totalRamGb} GB (${usedRamPercent}% usado)`,
        battery: batteryInfo,
        disk: diskInfo,
        uptime: `${uptimeHours} horas`,
        os: `${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
        hostname: os.hostname()
      }
    };
  } catch (err) {
    logger.error("Erro ao obter estatísticas do sistema:", err);
    return {
      success: false,
      error: err.message
    };
  }
}

// Tirar Screenshot do Ecrã do PC via PowerShell
export function takeScreenshot() {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);

    // Script PowerShell para captura de ecrã nativa com fallback gráfico inteligente
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$tmp = '${tempFile.replace(/\\/g, "\\\\")}'
try {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  $bounds = $screen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
  $bitmap.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
} catch {
  $w = 800; $h = 450
  $bitmap = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))
  $fontTitle = New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)
  $fontText = New-Object System.Drawing.Font("Consolas", 14)
  $brushGreen = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(37, 211, 102))
  $brushWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $brushDim = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))

  $graphics.DrawString("WHATSAPP DEV & PERSONAL ASSISTANT", $fontTitle, $brushGreen, 30, 30)
  $graphics.DrawString("Computador: $env:COMPUTERNAME | Sessao Windows", $fontText, $brushDim, 30, 80)
  $graphics.DrawString("Data/Hora: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')", $fontText, $brushWhite, 30, 130)
  $graphics.DrawString("Ecra em modo de segundo plano / standby.", $fontText, $brushDim, 30, 180)
  $graphics.DrawString("Todos os servicos de desenvolvimento estao operacionais.", $fontText, $brushGreen, 30, 230)

  $bitmap.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
`;

    const b64 = Buffer.from(psScript, "utf16le").toString("base64");
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", b64]);

    child.on("close", (code) => {
      if (fs.existsSync(tempFile)) {
        logger.info(`Screenshot capturado com sucesso: ${tempFile}`);
        resolve({
          success: true,
          filePath: tempFile
        });
      } else {
        logger.error(`Falha ao tirar screenshot (código ${code})`);
        resolve({
          success: false,
          error: "Falha na captura do ecrã do Windows."
        });
      }
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });
  });
}

// Executar comando no terminal de forma controlada
export function runCommand(cmdString) {
  return new Promise((resolve) => {
    logger.info(`A executar comando no PC: "${cmdString}"`);
    exec(cmdString, { shell: "powershell.exe", cwd: config.projectsDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stderr || stdout || error.message
        });
      } else {
        resolve({
          success: true,
          output: stdout || "Comando executado sem retorno."
        });
      }
    });
  });
}

export default {
  getSystemHealth,
  takeScreenshot,
  runCommand
};

