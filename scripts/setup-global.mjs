#!/usr/bin/env node

import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const SERVER_NAME = "clickup-custom";
const OFFICIAL_SERVER_NAME = "clickup";
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(REPO_ROOT, ".env");

function parseArgs(argv) {
  const opts = {
    apiKey: "",
    teamId: "",
    ides: null,
    includeOfficial: false,
    allIdes: false,
    dryRun: false,
    noLink: false,
    nonInteractive: false,
    saveEnv: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--api-key":
        opts.apiKey = argv[++i] ?? "";
        break;
      case "--team-id":
        opts.teamId = argv[++i] ?? "";
        break;
      case "--ides":
        opts.ides = (argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--include-official":
        opts.includeOfficial = true;
        break;
      case "--all-ides":
        opts.allIdes = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--no-link":
        opts.noLink = true;
        break;
      case "-y":
      case "--yes":
        opts.nonInteractive = true;
        break;
      case "--save-env":
        opts.saveEnv = true;
        break;
      case "--no-save-env":
        opts.saveEnv = false;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
clickup-custom-mcp — setup global

Forma mais fácil:
  cp .env.example .env    # edite com suas credenciais
  npm run setup

Modo interativo (pergunta credenciais e IDEs):
  npm run setup

Opções:
  --api-key <token>       API key (senão: .env → env → prompt)
  --team-id <id>          Team/Workspace ID
  --ides <lista>          IDEs: cursor, claude-code, claude-desktop, vscode, kiro, trae, windsurf
  --all-ides              Configura todos os IDEs (ignora auto-detecção)
  --include-official      Também adiciona https://mcp.clickup.com/mcp
  --yes, -y               Não perguntar nada (exige .env ou env vars)
  --save-env              Salvar credenciais em .env após prompt
  --no-save-env           Não salvar .env
  --dry-run               Simular sem escrever arquivos
  --no-link               Não executa npm link
  -h, --help              Ajuda

Ordem de credenciais: --api-key/--team-id → .env → CLICKUP_* → prompt interativo
`);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function saveEnvFile({ apiKey, teamId }) {
  const content = `# Credenciais ClickUp — não commite este arquivo
CLICKUP_API_KEY=${apiKey}
CLICKUP_TEAM_ID=${teamId}
`;
  writeFileSync(ENV_FILE, content, "utf8");
  console.log(`\nCredenciais salvas em ${ENV_FILE}`);
}

async function resolveCredentials(opts) {
  const fileEnv = loadEnvFile(ENV_FILE);

  let apiKey = opts.apiKey || fileEnv.CLICKUP_API_KEY || process.env.CLICKUP_API_KEY || "";
  let teamId = opts.teamId || fileEnv.CLICKUP_TEAM_ID || process.env.CLICKUP_TEAM_ID || "";

  if (apiKey && teamId) {
    if (!opts.apiKey && !opts.teamId && existsSync(ENV_FILE)) {
      console.log(`Credenciais carregadas de ${ENV_FILE}`);
    }
    return { apiKey, teamId, shouldOfferSaveEnv: false };
  }

  if (opts.nonInteractive) {
    throw new Error(
      "Credenciais ausentes. Crie .env a partir de .env.example ou defina CLICKUP_API_KEY e CLICKUP_TEAM_ID.",
    );
  }

  if (!input.isTTY) {
    throw new Error(
      "Terminal não interativo. Use .env, variáveis de ambiente ou passe --api-key e --team-id.",
    );
  }

  console.log("\nCredenciais ClickUp");
  console.log("  Token: https://app.clickup.com/settings/apps");
  console.log("  Workspace ID: número na URL (app.clickup.com/TEAM_ID/...)\n");

  if (apiKey) {
    console.log("API Key: (já definida)");
  }
  if (teamId) {
    console.log("Workspace ID: (já definido)");
  }

  const rl = createInterface({ input, output, terminal: true });
  try {
    if (!apiKey) {
      apiKey = (await rl.question("API Key: ")).trim();
    }
    if (!teamId) {
      teamId = (await rl.question("Workspace ID (Team ID): ")).trim();
    }
  } finally {
    rl.close();
  }

  if (!apiKey || !teamId) {
    throw new Error("API Key e Workspace ID são obrigatórios.");
  }

  return { apiKey, teamId, shouldOfferSaveEnv: !existsSync(ENV_FILE) };
}

async function maybeSaveEnv(opts, credentials) {
  if (opts.saveEnv === false) return;
  if (existsSync(ENV_FILE) && opts.saveEnv !== true) return;

  if (opts.saveEnv === true) {
    saveEnvFile(credentials);
    return;
  }

  if (!credentials.shouldOfferSaveEnv || !input.isTTY || opts.dryRun) return;

  const rl = createInterface({ input, output, terminal: true });
  try {
    const answer = (await rl.question("\nSalvar credenciais em .env para próximas execuções? [S/n] "))
      .trim()
      .toLowerCase();
    if (!answer || answer === "s" || answer === "sim" || answer === "y" || answer === "yes") {
      saveEnvFile(credentials);
    }
  } finally {
    rl.close();
  }
}

function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`JSON inválido em ${path}: ${error.message}`);
  }
}

function writeJson(path, data, dryRun) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  if (dryRun) {
    console.log(`\n[dry-run] ${path}\n${content}`);
    return;
  }

  mkdirSync(dirname(path), { recursive: true });

  if (existsSync(path)) {
    const backup = `${path}.bak.${Date.now()}`;
    copyFileSync(path, backup);
    console.log(`  backup: ${backup}`);
  }

  writeFileSync(path, content, "utf8");
  console.log(`  salvo: ${path}`);
}

function resolveCommand() {
  try {
    const bin = execSync("command -v clickup-custom-mcp", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (bin) return { command: "clickup-custom-mcp", absolute: bin };
  } catch {
    // not in PATH
  }
  return null;
}

function ensureLinked(noLink) {
  const resolved = resolveCommand();
  if (resolved) return resolved;

  if (noLink) {
    throw new Error(
      "clickup-custom-mcp não encontrado no PATH. Rode 'npm link' no repo ou remova --no-link.",
    );
  }

  console.log("Registrando binário global (npm link)...");
  execSync("npm link", { cwd: REPO_ROOT, stdio: "inherit" });

  const afterLink = resolveCommand();
  if (!afterLink) {
    throw new Error("npm link concluiu, mas clickup-custom-mcp ainda não está no PATH.");
  }

  return afterLink;
}

function nodeBinDir() {
  try {
    const nodePath = execSync("command -v node", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return dirname(nodePath);
  } catch {
    return "/usr/local/bin";
  }
}

function appSupportPath(...segments) {
  const os = platform();
  if (os === "darwin") {
    return join(homedir(), "Library", "Application Support", ...segments);
  }
  if (os === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, ...segments);
  }
  return join(homedir(), ".config", ...segments);
}

function vscodeUserMcpPath() {
  const os = platform();
  if (os === "darwin") {
    return join(homedir(), "Library", "Application Support", "Code", "User", "mcp.json");
  }
  if (os === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "Code", "User", "mcp.json");
  }
  return join(homedir(), ".config", "Code", "User", "mcp.json");
}

const ALL_IDES = {
  cursor: {
    label: "Cursor",
    path: () => join(homedir(), ".cursor", "mcp.json"),
    detect: () => existsSync(join(homedir(), ".cursor")),
    apply({ config, serverEntry, includeOfficial }) {
      config.mcpServers ??= {};
      config.mcpServers[SERVER_NAME] = serverEntry.standard;
      if (includeOfficial) {
        config.mcpServers[OFFICIAL_SERVER_NAME] = { url: "https://mcp.clickup.com/mcp" };
      }
      return config;
    },
  },

  "claude-code": {
    label: "Claude Code",
    path: () => join(homedir(), ".claude.json"),
    detect: () => existsSync(join(homedir(), ".claude.json")) || existsSync(join(homedir(), ".claude")),
    apply({ config, serverEntry, includeOfficial }) {
      config.mcpServers ??= {};
      config.mcpServers[SERVER_NAME] = serverEntry.standard;
      if (includeOfficial) {
        config.mcpServers[OFFICIAL_SERVER_NAME] = { url: "https://mcp.clickup.com/mcp" };
      }
      return config;
    },
  },

  "claude-desktop": {
    label: "Claude Desktop",
    path: () => appSupportPath("Claude", "claude_desktop_config.json"),
    detect: () => existsSync(appSupportPath("Claude")),
    apply({ config, serverEntry, includeOfficial }) {
      config.mcpServers ??= {};
      config.mcpServers[SERVER_NAME] = serverEntry.standard;
      if (includeOfficial) {
        config.mcpServers[OFFICIAL_SERVER_NAME] = { url: "https://mcp.clickup.com/mcp" };
      }
      return config;
    },
  },

  vscode: {
    label: "VS Code",
    path: vscodeUserMcpPath,
    detect: () => existsSync(dirname(vscodeUserMcpPath())),
    apply({ config, serverEntry }) {
      config.servers ??= {};
      config.servers[SERVER_NAME] = serverEntry.vscode;
      return config;
    },
  },

  kiro: {
    label: "Kiro",
    path: () => join(homedir(), ".kiro", "settings", "mcp.json"),
    detect: () => existsSync(join(homedir(), ".kiro")),
    apply({ config, serverEntry }) {
      config.mcpServers ??= {};
      config.mcpServers[SERVER_NAME] = serverEntry.kiro;
      return config;
    },
  },

  trae: {
    label: "Trae",
    path: () => appSupportPath("Trae", "User", "mcp.json"),
    detect: () => existsSync(appSupportPath("Trae")),
    apply({ config, serverEntry, includeOfficial }) {
      config.mcpServers ??= {};
      config.mcpServers[SERVER_NAME] = serverEntry.standard;
      if (includeOfficial) {
        config.mcpServers[OFFICIAL_SERVER_NAME] = { url: "https://mcp.clickup.com/mcp" };
      }
      return config;
    },
  },

  windsurf: {
    label: "Windsurf",
    path: () => join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
    detect: () => existsSync(join(homedir(), ".codeium", "windsurf")),
    apply({ config, serverEntry, includeOfficial }) {
      config.mcpServers ??= {};
      config.mcpServers[SERVER_NAME] = serverEntry.standard;
      if (includeOfficial) {
        config.mcpServers[OFFICIAL_SERVER_NAME] = { url: "https://mcp.clickup.com/mcp" };
      }
      return config;
    },
  },
};

function detectInstalledIdes() {
  return Object.entries(ALL_IDES)
    .filter(([, ide]) => ide.detect())
    .map(([id]) => id);
}

async function resolveIdes(opts) {
  if (opts.ides) return opts.ides;
  if (opts.allIdes) return Object.keys(ALL_IDES);

  const detected = detectInstalledIdes();

  if (detected.length === 0) {
    console.log("Nenhum IDE detectado — configurando Cursor por padrão.");
    console.log("Use --all-ides para configurar todos.\n");
    return ["cursor"];
  }

  if (opts.nonInteractive || !input.isTTY) {
    console.log(`IDEs detectados: ${detected.map((id) => ALL_IDES[id].label).join(", ")}\n`);
    return detected;
  }

  const labels = detected.map((id) => ALL_IDES[id].label).join(", ");
  const rl = createInterface({ input, output, terminal: true });
  try {
    const answer = (await rl.question(`IDEs detectados: ${labels}\nConfigurar estes? [S/n/all] `))
      .trim()
      .toLowerCase();
    if (answer === "all" || answer === "todos") {
      return Object.keys(ALL_IDES);
    }
    if (answer === "n" || answer === "nao" || answer === "não" || answer === "no") {
      throw new Error("Setup cancelado.");
    }
    return detected;
  } finally {
    rl.close();
  }
}

function buildServerEntries({ apiKey, teamId, command, absoluteCommand }) {
  const env = {
    CLICKUP_API_KEY: apiKey,
    CLICKUP_TEAM_ID: teamId,
  };

  return {
    standard: { command, env },
    vscode: { type: "stdio", command, env },
    kiro: {
      command: absoluteCommand,
      env: {
        PATH: `${nodeBinDir()}:/usr/local/bin:/usr/bin:/bin`,
        ...env,
      },
      disabled: false,
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    return;
  }

  console.log("clickup-custom-mcp — setup global\n");

  const credentials = await resolveCredentials(opts);
  await maybeSaveEnv(opts, credentials);

  const selectedIdes = await resolveIdes(opts);
  const unknown = selectedIdes.filter((id) => !ALL_IDES[id]);
  if (unknown.length) {
    throw new Error(`IDEs desconhecidos: ${unknown.join(", ")}. Válidos: ${Object.keys(ALL_IDES).join(", ")}`);
  }

  const { command, absolute } = ensureLinked(opts.noLink);
  console.log(`\nBinário: ${absolute}`);

  const serverEntry = buildServerEntries({
    apiKey: credentials.apiKey,
    teamId: credentials.teamId,
    command,
    absoluteCommand: absolute,
  });

  console.log(`\nConfigurando ${selectedIdes.length} IDE(s)...`);

  for (const ideId of selectedIdes) {
    const ide = ALL_IDES[ideId];
    const path = ide.path();
    console.log(`→ ${ide.label}`);

    const current = readJson(path);
    const next = ide.apply({
      config: structuredClone(current),
      serverEntry,
      includeOfficial: opts.includeOfficial,
    });

    writeJson(path, next, opts.dryRun);
  }

  console.log("\nConcluído.");
  if (!opts.dryRun) {
    console.log("Reinicie os IDEs configurados para carregar o MCP.");
  }
}

main().catch((error) => {
  console.error(`\nErro: ${error.message}`);
  process.exit(1);
});
