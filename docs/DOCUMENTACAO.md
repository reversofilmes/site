# Documentação — Site Reverso Filmes

Site estático Jekyll na Netlify, com CMS (painel admin + API Worker na Cloudflare). Conteúdo vivo em **D1** e **R2**; o build Netlify gera `_data/*.json` a partir do export do Worker.

Documentação complementar: [cms-ingest-youtube.md](cms-ingest-youtube.md).

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

**`_config.local.yml`** (gitignored):

```yaml
reverso_cms_api: "http://127.0.0.1:8787"
```

**`cf-worker/.dev.vars`** (gitignored) — overrides mínimos:

```ini
COOKIE_DOMAIN=
MEDIA_BASE_URL=http://127.0.0.1:8787/media
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
JWT_SECRET=...
BUILD_TOKEN=...
```

Para OAuth local, crie um **segundo** GitHub OAuth App com callback `http://127.0.0.1:8787/api/auth/github/callback` (o app de produção só aceita um callback: `https://cms.reversofilmes.com.br/api/auth/github/callback`).

Terminais:

```powershell
# A — Worker
cd cf-worker
npm run dev

# B — Site
bundle exec jekyll serve
```

### 2.4 Servidor local de mídia (opcional)

`scripts/local-server.mjs` em http://localhost:7847 — preview YouTube/Pixieset no editor. Só relevante em dev; a CSP do admin permite `localhost:7847`.

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

Segredos (`wrangler secret put`, não no Git): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, `BUILD_TOKEN`, `NETLIFY_DEPLOY_HOOK_URL`, `GITHUB_REPO`, `GITHUB_DISPATCH_TOKEN`, etc.

Deploy: `npx wrangler deploy` publica código + `[vars]`; segredos já na cloud não mudam com o deploy.

### 3.4 Scripts — fallback de URL

`scripts/fetch-projects.mjs` usa `process.env.WORKER_EXPORT_URL` ou fallback `https://cms.reversofilmes.com.br/api/projects/export`.

---

## 4. Fluxo do CMS

1. **Editar** no admin → API grava em **D1** (+ uploads em **R2**).
2. **Publicar** → debounce 5 min → POST ao build hook Netlify (branch `main`).
3. **Build Netlify** → `fetch-projects.mjs` (Bearer `CF_BUILD_TOKEN`) → `_data/*.json` → `jekyll build`.
4. Site estático publicado com dados do D1.

O admin **não** faz commit de `_projects/*.md` no GitHub ao publicar. Commits no `main` são código e workflows (ex. ingest YouTube).

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
│   ├── local-server.mjs     # dev: mídia local :7847
│   └── ingest-youtube-media.mjs
├── docs/                    # documentação (não publicada no site)
├── netlify.toml
└── Gemfile
```

---

## 6. Branches

| Branch | Uso típico |
|--------|------------|
| `main` | Produção — Netlify deploy, workflows GitHub |
| `temp` | Staging / desenvolvimento histórico |

Após mudanças em `main`, sincronizar `temp` com PR `main` → `temp` ou `git merge origin/main` em `temp`.

Conteúdo do CMS não diverge entre branches — está no D1. O `git pull` + `fetch-projects.mjs` alinha o preview local com produção.

---

## 7. Deploy e rollback

| Ação | Comando / lugar |
|------|-----------------|
| Worker | `cd cf-worker && npx wrangler deploy` |
| Site | `git push origin main` |
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
