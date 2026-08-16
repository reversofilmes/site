[![Netlify Status](https://api.netlify.com/api/v1/badges/420411eb-df4b-4f05-bcbd-ffa096277a13/deploy-status)](https://app.netlify.com/projects/reversofilmessite/deploys)

# Reverso Filmes — site

Site estático (Jekyll) na Netlify. Conteúdo editável no painel admin; dados e mídia no Cloudflare (D1 + R2) via Worker API.

## URLs de produção

| Serviço | URL |
|---------|-----|
| Site | https://reversofilmes.com.br |
| Admin | https://reversofilmes.com.br/admin |
| API / CMS Worker | https://cms.reversofilmes.com.br |

O admin e a API partilham o registrável `.reversofilmes.com.br` (cookies first-party, Safari e Chrome).

## Documentação

- [docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md) — arquitetura, desenvolvimento local, deploy, branches e fluxo Git
- [docs/cms-ingest-youtube.md](docs/cms-ingest-youtube.md) — ingestão YouTube e Pixieset via Reverso Media (servidor local)

## Antes de uma nova implementação

Sempre que houver mudanças publicadas via admin, a branch `main` fica à frente de `temp` (merge commits de PR). Antes de começar trabalho novo:

```powershell
git checkout temp
git fetch origin
git merge origin/main
git push origin temp
```

Depois, alinhe o preview local com produção (dados do D1):

```powershell
$env:WORKER_EXPORT_URL = "https://cms.reversofilmes.com.br/api/projects/export"
$env:CF_BUILD_TOKEN = "<BUILD_TOKEN>"
node scripts/fetch-projects.mjs
```

Detalhes do fluxo Git (`temp` → PR → `main`), remotes e variáveis: [docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md).

## Rodar localmente (site)

Pré-requisitos: Ruby (Bundler), Node.js.

```powershell
bundle install
```

Sincronizar dados do export do Worker e subir o servidor de preview:

```powershell
$env:WORKER_EXPORT_URL = "https://cms.reversofilmes.com.br/api/projects/export"
$env:CF_BUILD_TOKEN = "<BUILD_TOKEN>"
node scripts/fetch-projects.mjs
bundle exec jekyll serve --config _config.yml,_config.local.yml
```

Em paralelo:

```
cd cf-worker
npx wrangler dev --remote
```

Abre http://127.0.0.1:4000/admin. Verifique se `_config.local.yml` (gitignored) aponta o admin a `http://127.0.0.1:8787` com o Worker local — **o Jekyll não carrega `_config.local.yml` sozinho**; use sempre `--config _config.yml,_config.local.yml` em dev. Ver documentação completa.

`CF_BUILD_TOKEN` não é o token de login do GitHub no admin; é o JWT de build (`BUILD_TOKEN` no Worker, gerado com `cf-worker/scripts/generate-build-token.mjs`).

Para só pré-visualizar sem novo fetch: `bundle exec jekyll serve` (usa `_data/` já existente no disco).

## Worker (API)

```powershell
cd cf-worker
npm install
npm run dev
```

Variáveis de produção em `wrangler.toml`; segredos e overrides locais em `cf-worker/.dev.vars` (nunca commitar).

```powershell
npx wrangler deploy
```

## Deploy

1. **Worker:** `cd cf-worker && npx wrangler deploy`
2. **Site:** commit em `temp` → PR para `main` → merge dispara Netlify (`fetch-projects.mjs` + Jekyll)

O «Publicar» no admin grava no D1 e dispara o build hook Netlify (branch `main`).
