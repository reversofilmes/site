# Admin → Reverso Media (local) → R2: capa e prévia do YouTube

O painel admin gera **capa (JPEG)** e **prévia de hover (MP4, 5 s)** a partir de um URL do YouTube usando o **Reverso Media Server** no seu computador (`scripts/local-server.mjs`, porta **7847**). Não usa GitHub Actions.

## Fluxo

```
Admin (browser)
  │  POST http://localhost:7847/ingest-youtube
  │  { youtube_url, thumb_time_sec, preview_start_sec }
  ▼
Reverso Media (local-server.mjs)
  │  yt-dlp + FFmpeg
  ▼
Admin recebe poster + hover (base64) → rascunho local
  │  Salvar → Publicar
  ▼
Worker POST /api/upload → R2 + PATCH projeto no D1
  │  Deploy Netlify
  ▼
Site estático com novos URLs de mídia
```

Pixieset (capa + slideshow WebM) usa o mesmo servidor: `POST /resolve-pixieset`, `GET /proxy-pixieset`, etc.

## 1. Iniciar o Reverso Media

Na raiz do repositório:

| SO | Atalho |
|----|--------|
| Windows | `Iniciar Reverso Media.bat` |
| macOS | `Iniciar Reverso Media.command` |

Ou:

```powershell
cd scripts
npm install
node local-server.mjs
```

Aguarde a mensagem de que o servidor está a correr em **http://localhost:7847**. O admin mostra badge verde **Reverso Media online** quando o health check responde.

## 2. No admin

1. Edite um projeto com **YouTube URL** preenchido.
2. Use o player local para posicionar a linha do tempo.
3. **Salvar instante da capa** / **Salvar início do clipe**.
4. Clique **Gerar capa e prévia** (requer servidor local online).
5. **Salvar** o projeto (mantém rascunho) → **Publicar** (upload R2 + deploy).

## 3. Requisitos locais

- Node.js 20+
- `yt-dlp` e FFmpeg (instalados no PATH ou descarregados pelo script na primeira execução)
- Rede capaz de aceder ao YouTube (IP residencial; evita bloqueios de datacenter)

## 4. CLI opcional (sem admin)

Para processar um slug ou todos os projetos com `youtube_url` a partir do terminal:

```powershell
cd scripts
$env:WORKER_API_BASE = "https://cms.reversofilmes.com.br"
$env:CF_BUILD_TOKEN = "<BUILD_TOKEN>"
node ingest-youtube-media.mjs --slug meu-projeto
node ingest-youtube-media.mjs --all
```

O script lê instantes do D1, envia ficheiros para R2 via `POST /api/projects/media-keys`.

## Resolução de problemas

| Sintoma | Causa provável |
|---------|----------------|
| Badge **Reverso Media offline** | Servidor não iniciado ou firewall bloqueia `:7847` |
| Erro ao baixar vídeo | URL inválida, vídeo privado, ou bloqueio do YouTube |
| Capa gerada mas site não muda | Falta **Publicar** no admin (R2 + deploy Netlify) |
| CORS no browser | Admin deve ser servido pelo Jekyll local ou produção; o servidor envia `Access-Control-Allow-Origin: *` |

## Legado

Anteriormente existia um workflow `.github/workflows/ingest-youtube.yml` e a rota `POST /api/projects/:slug/ingest-youtube` no Worker (dispatch para GitHub Actions). Foi **substituído** pelo Reverso Media local — IPs de datacenter do GitHub eram bloqueados pelo YouTube com frequência.
