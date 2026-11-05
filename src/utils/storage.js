import fs from "fs";
import path from "path";
import config from "../config.js";

function getFilePath(name) {
  return path.join(config.dataDir, `${name}.json`);
}

export function readData(name, defaultVal = []) {
  try {
    const file = getFilePath(name);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch (e) {
    console.error(`Erro ao ler ${name}.json:`, e);
  }
  return defaultVal;
}

export function writeData(name, data) {
  try {
    const file = getFilePath(name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error(`Erro ao gravar ${name}.json:`, e);
    return false;
  }
}

