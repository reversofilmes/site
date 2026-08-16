# Documentação — Site Reverso Filmes

Site estático Jekyll na Netlify, com CMS (painel admin + API Worker na Cloudflare). Conteúdo vivo em **D1** e **R2**; o build Netlify gera `_data/*.json` a partir do export do Worker.

Documentação complementar: [cms-ingest-youtube.md](cms-ingest-youtube.md) (Reverso Media — servidor local).

---

## 1. Arquitetura

```
Hostgator (registrar .com.br)
    └── nameservers → Cloudflare DNS
                            ├── @, www, temp → Netlify (site estático, DNS only)
                            ├── MX/TXT → Zoho (email)
                            └── cms.* → Cloudflare Worker (proxied)

Netlify (reversofilmessite.netlify.app)
    └── Jekyll build ← fetch export ← Worker (D1)

Cloudflare Worker (reverso-cms-api)
    └── D1 (reverso-db) + R2 (reverso-media)
    └── Custom domain: cms.reversofilmes.com.br
```

| Componente | Função |
|------------|--------|
| **Site** | `reversofilmes.com.br` — páginas Jekyll, assets estáticos |
| **Admin** | `/admin` — SPA (Alpine.js), servida pelo Jekyll; API em `cms.*` |
| **Worker** | REST API, OAuth GitHub, upload R2, export para build, crons |
| **Netlify build** | `scripts/fetch-projects.mjs` → `_data/projects.json` + `site-settings.json` |

O host `reverso-cms-api.reversofilmes.workers.dev` continua ativo em paralelo, mas **produção** usa `cms.reversofilmes.com.br`.

### Cookies e domínios

- `COOKIE_DOMAIN=.reversofilmes.com.br` — sessão OAuth partilhada entre `reversofilmes.com.br` / `www` e `cms.reversofilmes.com.br` (`SameSite=Lax`).
- Em desenvolvimento local (`jekyll serve` + `wrangler dev`), `.dev.vars` define `COOKIE_DOMAIN` vazio para `SameSite=None` entre `localhost:4000` e `127.0.0.1:8787`.

---

## 2. Rodar localmente

### 2.1 Pré-requisitos

| Ferramenta | Função |
|------------|--------|
| Ruby 3.3 + Bundler | Jekyll |
| Node.js 20+ | `fetch-projects.mjs`, Worker, scripts |
| Git | Repositório e workflows |

Windows: RubyInstaller + Devkit. Use `bundle exec` para respeitar o `Gemfile`.

### 2.2 Site estático (preview)

```powershell
bundle install

$env:WORKER_EXPORT_URL = "https://cms.reversofilmes.com.br/api/projects/export"
$env:CF_BUILD_TOKEN = "<BUILD_TOKEN>"
node scripts/fetch-projects.mjs

bundle exec jekyll serve
```

- Site: http://localhost:4000
- Admin: http://localhost:4000/admin

Sem `fetch-projects.mjs`, o build usa `_data/` existente ou falha se vazio.

### 2.3 Admin + API local

**Não funciona** aceder a `http://localhost:4000/admin` com `reverso_cms_api` apontando para produção (`cms.reversofilmes.com.br`): o cookie de sessão OAuth fica no domínio `.reversofilmes.com.br` e o browser não o envia ao Jekyll local.

**Setup recomendado**

1. **`cf-worker/.dev.vars`** — credenciais do **OAuth App de desenvolvimento** (não o de produção):

```ini
COOKIE_DOMAIN=
OAUTH_REDIRECT_ORIGIN=http://127.0.0.1:8787
MEDIA_BASE_URL=http://127.0.0.1:8787/media
GITHUB_CLIENT_ID=<app dev>
GITHUB_CLIENT_SECRET=<app dev>
JWT_SECRET=...
BUILD_TOKEN=...
```

`OAUTH_REDIRECT_ORIGIN` é necessário com `wrangler dev --remote`: sem isto o Worker envia ao GitHub um `redirect_uri` em `*.workers.dev`, que não está no OAuth App local.

2. **GitHub → Developer settings → OAuth Apps** — app separado do de produção:

| Campo | Valor |
|-------|-------|
| Homepage URL | `http://localhost:4000` |
| Authorization callback URL | `http://127.0.0.1:8787/api/auth/github/callback` |

Produção mantém callback `https://cms.reversofilmes.com.br/api/auth/github/callback`.

3. O seu GitHub ID deve estar em `admin_allowlist` no D1.

**Terminais**

```powershell
# A — Worker (D1 remoto = dados reais)
cd cf-worker
npx wrangler dev --remote

# B — Site + admin (carrega _config.local.yml explicitamente)
bundle exec jekyll serve --config _config.yml,_config.local.yml
```

4. Abra `http://127.0.0.1:4000/admin` → **Entrar com GitHub**.

**Verificação:** no HTML do admin, a meta `reverso-cms-api` deve ser `http://127.0.0.1:8787`. Se aparecer `https://cms.reversofilmes.com.br`, o `_config.local.yml` não foi carregado — reinicie o Jekyll com `--config` acima.

**Alternativa rápida (só preview da grelha Home, sem login):** `admin_dev_mode: true` em `_config.local.yml` — lê `/projects.json`; mutations desabilitadas.

**Produção:** `https://reversofilmes.com.br/admin` — validação completa sem setup local.

### 2.4 Reverso Media — servidor local (YouTube e Pixieset)

Fluxo **actual** para gerar capa e prévia a partir do YouTube (ou resolver Pixieset): o admin chama `http://localhost:7847`, não GitHub Actions.

**Iniciar o servidor**

- Windows: duplo clique em `Iniciar Reverso Media.bat` (na raiz do repo)
- macOS: duplo clique em `Iniciar Reverso Media.command`
- Ou manualmente: `cd scripts && node local-server.mjs` (porta **7847**)

Dependências: Node.js, `yt-dlp` e FFmpeg (o script pode baixar binários na primeira execução).

**No admin**

1. Abra um projeto com `youtube_url` preenchido.
2. Confirme o badge **Reverso Media online** (verde) no editor.
3. Ajuste instantes na linha do tempo → **Gerar capa e prévia**.
4. **Salvar** (rascunho) → **Publicar** (envia ficheiros ao R2 via Worker).

O servidor devolve poster + clip em base64; o admin faz upload normal (`POST /api/upload`) ao publicar.

**Script CLI opcional** (batch / terminal, sem admin):

```powershell
cd scripts
node ingest-youtube-media.mjs --slug <slug>
```

Usa `GET /api/projects/youtube-manifest` e `POST /api/projects/media-keys` no Worker. Requer `CF_BUILD_TOKEN` ou equivalente no ambiente — ver cabeçalho do script.

A CSP do admin permite `connect-src` a `localhost:7847` em dev.

---

## 3. Configuração

### 3.1 Jekyll — `_config.yml`

| Chave | Produção |
|-------|----------|
| `url` | `https://reversofilmes.com.br` |
| `reverso_cms_api` | `https://cms.reversofilmes.com.br` |

O admin lê `site.reverso_cms_api` na meta `reverso-cms-api` em `admin/index.html`.

### 3.2 Netlify — `netlify.toml`

| Chave | Valor |
|-------|-------|
| `WORKER_EXPORT_URL` | `https://cms.reversofilmes.com.br/api/projects/export` |
| CSP `/admin/*` | `connect-src`, `img-src`, `media-src` incluem `cms.reversofilmes.com.br` |

### 3.3 Worker — `cf-worker/wrangler.toml` (`[vars]`)

| Variável | Produção |
|----------|----------|
| `MEDIA_BASE_URL` | `https://cms.reversofilmes.com.br/media` |
| `COOKIE_DOMAIN` | `.reversofilmes.com.br` |
| `ALLOWED_ORIGINS` | `https://www.reversofilmes.com.br`, apex, `https://cms.reversofilmes.com.br` |
| `ADMIN_ORIGIN` | `https://www.reversofilmes.com.br/admin` |
| `NETLIFY_DEPLOY_BRANCH` | `main` |

Segredos (`wrangler secret put`, não no Git): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, `BUILD_TOKEN`, `NETLIFY_DEPLOY_HOOK_URL`, etc.

Deploy: `npx wrangler deploy` publica código + `[vars]`; segredos já na cloud não mudam com o deploy.

### 3.4 Scripts — fallback de URL

`scripts/fetch-projects.mjs` usa `process.env.WORKER_EXPORT_URL` ou fallback `https://cms.reversofilmes.com.br/api/projects/export`.

---

## 4. Fluxo do CMS

1. **Editar** no admin → API grava em **D1** (+ uploads em **R2**).
2. **Publicar** → debounce 5 min → POST ao build hook Netlify (branch `main`).
3. **Build Netlify** → `fetch-projects.mjs` (Bearer `CF_BUILD_TOKEN`) → `_data/*.json` → `jekyll build`.
4. Site estático publicado com dados do D1.

O admin **não** faz commit de `_projects/*.md` no GitHub ao publicar. Commits no `main` são código e workflows (ex. validação de uploads legados).

---

## 5. Estrutura do repositório

```
site/
├── _config.yml              # url, reverso_cms_api, coleção projects (legado)
├── _config.local.yml        # gitignored — overrides locais
├── _data/                   # projects.json, site-settings.json (gitignored, build)
├── _projects/               # Markdown legado (rollback)
├── admin/                   # SPA do painel (Alpine.js + cf-api.js)
│   ├── index.html
│   └── assets/
├── cf-worker/               # Worker reverso-cms-api
│   ├── wrangler.toml
│   ├── .dev.vars            # gitignored
│   ├── migrations/
│   └── src/
├── scripts/
│   ├── fetch-projects.mjs   # build-time export
│   ├── local-server.mjs     # Reverso Media :7847 (YouTube/Pixieset no admin)
│   └── ingest-youtube-media.mjs  # CLI opcional → R2 via Worker
├── docs/                    # documentação (não publicada no site)
├── netlify.toml
└── Gemfile
```

---

## 6. Branches e fluxo Git

| Branch | Uso |
|--------|-----|
| `main` | Produção — Netlify deploy, workflows GitHub |
| `temp` | Desenvolvimento — commits e PRs antes de produção |

### Remote

O clone aponta direto para o repositório do cliente:

```powershell
git remote -v
# origin  https://github.com/reversofilmes/site.git (fetch)
# origin  https://github.com/reversofilmes/site.git (push)
```

Verificar branch atual e tracking:

```powershell
git branch --show-current
git branch -vv
```

Conta usada no **commit** (local):

```powershell
git config user.name
git config user.email
```

Conta usada no **push** (GitHub): `gh auth status` ou credenciais salvas no Git Credential Manager.

### Por que `main` fica à frente de `temp`

Cada PR mergeado em `main` gera um **merge commit** que fica só em `main`. Publicações pelo admin («Publicar») também disparam deploy em `main` sem alterar `temp`. Por isso `temp` aparece como “N commits behind main” até ser sincronizada.

O conteúdo do CMS **não** diverge entre branches — está no D1. O que diverge é o histórico Git e o código em produção vs. o da branch de trabalho.

### Ritual antes de nova implementação ou correção

Execute **sempre** no início de um ciclo de trabalho:

**1. Sincronizar `temp` com `main`**

```powershell
git checkout temp
git fetch origin
git merge origin/main
git push origin temp
```

**2. Sincronizar dados locais com produção (D1)**

```powershell
$env:WORKER_EXPORT_URL = "https://cms.reversofilmes.com.br/api/projects/export"
$env:CF_BUILD_TOKEN = "<BUILD_TOKEN>"
node scripts/fetch-projects.mjs
```

O `CF_BUILD_TOKEN` é o mesmo `BUILD_TOKEN` do Worker (segredo em `cf-worker/.dev.vars` local ou dashboard Cloudflare; no Netlify está em variáveis de ambiente do build). **Não** é o token de login GitHub do admin.

**3. Subir o preview**

```powershell
bundle exec jekyll serve
```

Com `_config.local.yml` e Worker local (`npm run dev` em `cf-worker/`), o admin aponta para `127.0.0.1:8787` — ver §2.3.

### Fluxo de entrega

```
editar em temp → commit → push origin temp → PR temp → main → merge → Netlify deploy
```

Após merge em `main`, repetir o ritual de sincronização (§ acima) antes do próximo ciclo.

### Comandos úteis

```powershell
git status
git log --oneline -10
git diff
git add -A
git commit -m "mensagem"
git push origin temp
git push origin temp --dry-run   # testar push sem enviar
```

---

## 7. Deploy e rollback

| Ação | Comando / lugar |
|------|-----------------|
| Worker | `cd cf-worker && npx wrangler deploy` |
| Site | PR `temp` → `main` + merge (Netlify build automático) |
| DNS rollback | Hostgator → nameservers anteriores (ver `docs/reversofilmes.com.br-cloudflare-import.txt`) |

---

## 8. Segurança (resumo)

- Admin: OAuth GitHub + allowlist; CSRF nas mutações; CSP em `/admin/*`.
- Export/build: JWT `BUILD_TOKEN` (`read:export`).
- R2: objetos via `/media` no Worker; bucket não público direto.
- Nunca commitar: `.dev.vars`, `_config.local.yml`, tokens.

---

## 9. Referências DNS

Ficheiros em `docs/` para migração Cloudflare (referência):

- `reversofilmes.com.br-cloudflare-import.txt` — zona BIND para import
- `reversofilmes.com.br-cloudflare-import.csv` — tabela de referência
