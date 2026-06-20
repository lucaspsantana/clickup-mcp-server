# clickup-custom-mcp

Servidor MCP (Model Context Protocol) customizado para integrar o ClickUp com assistentes de IA em **qualquer projeto** — sem copiar configuração para cada repositório.

Diferente do MCP oficial do ClickUp (`https://mcp.clickup.com/mcp`, OAuth), este servidor usa a **API REST do ClickUp** com Personal Access Token e expõe ferramentas focadas em **tasks** e **docs/wikis**.

---

## Início rápido

```bash
git clone git@github.com:lucaspsantana/clickup-mcp-server.git ~/mcp-servers/clickup-mcp-server
cd ~/mcp-servers/clickup-mcp-server
npm install
cp .env.example .env   # edite com suas credenciais
npm run setup
```

Reinicie os IDEs configurados. Pronto — funciona em todos os seus projetos.

Sem `.env`? Rode `npm run setup` e o script pergunta API Key e Team ID interativamente.

---

## Credenciais

Você precisa de duas informações do ClickUp:

| Variável | Onde obter |
|---|---|
| `CLICKUP_API_KEY` | [Settings → Apps → API Token](https://app.clickup.com/settings/apps) |
| `CLICKUP_TEAM_ID` | Número na URL: `https://app.clickup.com/{team_id}/...` |

### Onde colocar (em ordem de prioridade)

O script `npm run setup` busca credenciais nesta ordem:

1. **Argumentos CLI** — `--api-key` / `--team-id`
2. **Arquivo `.env`** na raiz do repo (recomendado)
3. **Variáveis de ambiente** — `CLICKUP_API_KEY` / `CLICKUP_TEAM_ID`
4. **Prompt interativo** — se nada acima existir

### `.env` (recomendado)

```bash
cp .env.example .env
```

```env
CLICKUP_API_KEY=pk_xxxxxxxx
CLICKUP_TEAM_ID=12345678
```

O `.env` é ignorado pelo Git. O setup grava as credenciais nos arquivos MCP dos IDEs — você configura **uma vez**.

### Variáveis de ambiente do sistema

Alternativa ao `.env` — adicione ao `~/.bashrc` ou `~/.zshrc`:

```bash
export CLICKUP_API_KEY="pk_xxxxxxxx"
export CLICKUP_TEAM_ID="12345678"
```

> IDEs abertos pelo menu do SO podem não herdar o `.bashrc`. Se isso acontecer, use `.env` + `npm run setup` (grava direto no JSON do IDE).

---

## O que o `npm run setup` faz

1. **Credenciais** — lê `.env`, env vars, ou pergunta interativamente
2. **IDEs** — auto-detecta instalados (Cursor, VS Code, Claude, Kiro, Trae, Windsurf…)
3. **Binário** — roda `npm link` se `clickup-custom-mcp` não estiver no PATH
4. **Config global** — grava nos arquivos MCP de cada IDE
5. **Backup** — salva `.bak.<timestamp>` antes de sobrescrever
6. **Preserva** — mantém outros servidores MCP já configurados

### Opções do script

```bash
npm run setup                                          # interativo
npm run setup -- --yes                                 # sem prompts (exige .env)
npm run setup -- --ides cursor,vscode                  # IDEs específicos
npm run setup -- --all-ides                            # todos (ignora auto-detecção)
npm run setup -- --include-official                    # + MCP oficial ClickUp (OAuth)
npm run setup -- --dry-run                             # simula sem escrever
npm run setup -- --api-key pk_xxx --team-id 12345678   # credenciais na CLI
clickup-mcp-setup --help                               # ajuda completa
```

### Arquivos que o script escreve

| IDE | Arquivo global (Linux) | Chave JSON |
|---|---|---|
| **Cursor** | `~/.cursor/mcp.json` | `mcpServers` |
| **Claude Code** | `~/.claude.json` | `mcpServers` |
| **Claude Desktop** | `~/.config/Claude/claude_desktop_config.json` | `mcpServers` |
| **VS Code** | `~/.config/Code/User/mcp.json` | `servers` ⚠️ |
| **Kiro** | `~/.kiro/settings/mcp.json` | `mcpServers` |
| **Trae** | `~/.config/Trae/User/mcp.json` | `mcpServers` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` |

**macOS:** Claude Desktop → `~/Library/Application Support/Claude/claude_desktop_config.json` · VS Code → `~/Library/Application Support/Code/User/mcp.json` · Trae → `~/Library/Application Support/Trae/User/mcp.json`

**Windows:** `%APPDATA%\Claude\`, `%APPDATA%\Code\User\`, `%APPDATA%\Trae\User\`

### Auto-detecção de IDEs

O script verifica pastas/configs existentes. Se nenhum IDE for detectado, configura **Cursor** por padrão.

No modo interativo, confirma a lista detectada. Digite `all` para configurar todos os IDEs suportados.

---

## Ferramentas disponíveis

| Ferramenta | Descrição |
|---|---|
| `clickup_list_tasks` | Lista tasks por list, status, assignee ou busca |
| `clickup_update_task` | Atualiza status, nome, descrição ou assignees |
| `clickup_list_docs` | Busca Docs e Wikis no workspace |
| `clickup_list_doc_pages` | Lista páginas de um Doc/Wiki |
| `clickup_create_doc` | Cria um Doc |
| `clickup_edit_doc` | Edita conteúdo de um Doc |
| `clickup_create_wiki` | Cria um Wiki |
| `clickup_edit_wiki` | Edita conteúdo de um Wiki |

---

## clickup (oficial) vs clickup-custom

Você pode usar **os dois** simultaneamente:

```bash
npm run setup -- --include-official
```

| | **clickup** (oficial) | **clickup-custom** (este repo) |
|---|---|---|
| Conexão | HTTP remoto (`mcp.clickup.com`) | Processo local (stdio) |
| Auth | OAuth / login ClickUp | Personal Access Token |
| Tools | Conjunto oficial ClickUp | Tasks + Docs/Wikis customizados |

---

## Configuração manual (alternativa)

Se preferir não usar o script, registre o binário e edite os arquivos manualmente.

### 1. Registrar binário

```bash
npm install
npm link
which clickup-custom-mcp
```

### 2. Bloco de configuração

**Maioria dos IDEs** (`mcpServers`):

```json
"clickup-custom": {
  "command": "clickup-custom-mcp",
  "env": {
    "CLICKUP_API_KEY": "pk_xxxxxxxx",
    "CLICKUP_TEAM_ID": "12345678"
  }
}
```

**VS Code** (`servers` + `type`):

```json
"clickup-custom": {
  "type": "stdio",
  "command": "clickup-custom-mcp",
  "env": {
    "CLICKUP_API_KEY": "pk_xxxxxxxx",
    "CLICKUP_TEAM_ID": "12345678"
  }
}
```

**Kiro** (não herda PATH — use caminho absoluto):

```json
"clickup-custom": {
  "command": "/caminho/absoluto/clickup-custom-mcp",
  "env": {
    "PATH": "/caminho/do/node/bin:/usr/local/bin:/usr/bin:/bin",
    "CLICKUP_API_KEY": "pk_xxxxxxxx",
    "CLICKUP_TEAM_ID": "12345678"
  },
  "disabled": false
}
```

### Config por IDE

| Ferramenta | Global | Por projeto |
|---|---|---|
| **Cursor** | `~/.cursor/mcp.json` | `.cursor/mcp.json` |
| **Claude Code** | `~/.claude.json` | `.mcp.json` |
| **Claude Desktop** | ver tabela acima | — |
| **VS Code** | *MCP: Open User Configuration* | `.vscode/mcp.json` |
| **Kiro** | `~/.kiro/settings/mcp.json` | `.kiro/settings/mcp.json` |
| **Trae** | `~/.config/Trae/User/mcp.json` | `.trae/mcp.json` (beta) |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | — |

**Claude Code via CLI:**

```bash
claude mcp add --scope user clickup-custom -- clickup-custom-mcp
```

---

## Atualizar

```bash
cd ~/mcp-servers/clickup-mcp-server
git pull && npm install
```

O `npm link` não precisa ser refeito — o symlink aponta para o repo e o binário é atualizado automaticamente.

Para reconfigurar credenciais ou IDEs:

```bash
npm run setup
```

---

## Solução de problemas

### Setup falhou com "Credenciais ausentes"

Crie `.env` a partir de `.env.example` ou rode sem `--yes` para o modo interativo.

### Servidor não aparece no IDE

1. Reinicie o IDE (a maioria só lê MCP na inicialização)
2. Valide JSON em [jsonlint.com](https://jsonlint.com)
3. Confirme o binário: `which clickup-custom-mcp`
4. Rebuild: `npm run build`

### Erro `CLICKUP_API_KEY is required`

Credenciais não chegaram ao processo MCP. Rode `npm run setup` novamente — ele grava `env` direto no JSON do IDE.

### Erro 401 / 403 da API ClickUp

- Token inválido ou revogado
- Token sem permissão no workspace
- `CLICKUP_TEAM_ID` incorreto

### VS Code: config do Cursor não funciona

VS Code usa `"servers"` (não `"mcpServers"`) e exige `"type": "stdio"`. Use `npm run setup` ou adapte manualmente.

### Kiro: binário não encontrado

Kiro não herda PATH. O script já usa caminho absoluto automaticamente. Confirme com `which clickup-custom-mcp`.

### WSL2

- Use caminhos Linux (`/home/...`) quando IDE e MCP rodam no WSL
- Se o IDE roda no **Windows** e o MCP no **WSL**, instale Node no Windows ou use caminho WSL compatível

### Teste manual do servidor

```bash
export CLICKUP_API_KEY="pk_xxx"
export CLICKUP_TEAM_ID="12345678"
clickup-custom-mcp
```

Erro de variável ausente = servidor OK, aguardando stdin MCP. `Ctrl+C` para sair.

---

## Estrutura do projeto

```
clickup-mcp-server/
├── src/
│   ├── index.ts              # entrypoint MCP (stdio)
│   ├── client.ts             # axios + env CLICKUP_*
│   └── tools/
│       ├── tasks.ts          # list/update tasks
│       └── docs.ts           # docs e wikis
├── scripts/
│   └── setup-global.mjs      # npm run setup
├── dist/                     # gerado por npm run build
├── .env.example              # template de credenciais
├── package.json
└── tsconfig.json
```

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm install` | Dependências + build automático (`prepare`) |
| `npm run setup` | Setup global interativo (recomendado) |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm link` | Registra `clickup-custom-mcp` no PATH |
| `npm start` | Inicia servidor (stdio) |
| `clickup-custom-mcp` | Binário MCP (após `npm link`) |
| `clickup-mcp-setup` | Alias do setup (após `npm link`) |

---

## Segurança

- **Nunca** commite `.env` ou tokens no Git (`.env` já está no `.gitignore`)
- O setup grava credenciais nos configs locais dos IDEs — tratá-los como secrets
- Revogue tokens comprometidos em [ClickUp Settings → Apps](https://app.clickup.com/settings/apps)
- O token tem o mesmo acesso que sua conta ClickUp — trate como senha

---

## Pré-requisitos

- **Node.js 18+** (`node --version`)
- **Personal Access Token** do ClickUp
- **Team ID** (Workspace ID)
