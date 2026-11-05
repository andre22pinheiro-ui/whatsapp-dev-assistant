import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { execSync } from "child_process";
import config from "../src/config.js";
import logger from "../src/utils/logger.js";

const CLOUD_URL = (config.cloudServerUrl || "http://136.64.71.248:3333").replace(/\/$/, "");
const SYNC_SECRET = config.syncSecret || "sync_default_token_9959";

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║      📤 EXPORTADOR DE SESSÃO WHATSAPP (PC ➔ GOOGLE CLOUD)             ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  const sourceDir = path.join(config.dataDir, "auth_receiver");
  const credsFile = path.join(sourceDir, "creds.json");

  if (!fs.existsSync(credsFile)) {
    console.error(`❌ Ficheiro creds.json não encontrado em: ${sourceDir}`);
    process.exit(1);
  }

  const zipPath = path.join(config.dataDir, "temp_transfer.zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  console.log(`📦 A compactar credenciais de sessão de: ${sourceDir}...`);
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  execSync(`${pythonCmd} -c "import zipfile, os, sys; zip = zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED); [zip.write(os.path.join(r, f), f) for r, d, fs_ in os.walk(sys.argv[2]) for f in fs_]; zip.close()" "${zipPath}" "${sourceDir}"`);

  const zipBytes = fs.readFileSync(zipPath);
  const zipBase64 = zipBytes.toString("base64");
  console.log(` Tamanho comprimido: ${(zipBytes.length / 1024).toFixed(1)} KB`);

  console.log(`🚀 A enviar sessão para a Google Cloud (${CLOUD_URL})...`);

  const postData = JSON.stringify({
    zipBase64,
    target: "receiver"
  });

  const url = new URL(`${CLOUD_URL}/api/sync/upload-session`);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  const req = transport.request(
    {
      method: "POST",
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "x-sync-token": SYNC_SECRET
      },
      timeout: 30000
    },
    (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.success) {
            console.log(`\n🎉 SUCESSO ABSOLUTO!`);
            console.log(`A sessão do WhatsApp foi instalada diretamente na Google Cloud.`);
            console.log(`O servidor já está a restabelecer a ligação com o telemóvel.`);
          } else {
            console.error(`❌ Erro do servidor:`, json);
          }
        } catch (e) {
          console.log(`Resposta do servidor:`, body);
        }
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      });
    }
  );

  req.on("error", (e) => {
    console.error(`❌ Erro de rede: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

main().catch(console.error);

