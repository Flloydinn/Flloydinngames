# Vídeos do canal no site (TV 24/7 + catálogo)

Uma única busca nos uploads do canal gera **dois arquivos estáticos** (nenhuma chave vai para o site):

| Arquivo | Usado por | Conteúdo |
|---|---|---|
| `tv/playlist.json` | `tv.html` | só vídeos que tocam no player (sem Shorts), com duração exata |
| `data/videos.json` | `videos.html` e o destaque do `index.html` | catálogo completo: título, ID, data, duração, tipo (vídeo/short/live), jogo, tags, descrição, visualizações e thumbnail `https://i.ytimg.com/vi/ID/hqdefault.jpg` |

A página `tv.html` calcula, pelo relógio (`Date.now()` − `EPOCH`), qual vídeo está no ar e em que
segundo. Todo visitante, em qualquer fuso, vê o mesmo vídeo no mesmo ponto. O `index.html` mostra o
vídeo mais recente (não Short) como destaque, e o `videos.html` lista o catálogo com busca e filtros;
nos dois, o player do YouTube só carrega quando a pessoa clica (facade).

Os arquivos são **gerados** pelo script `scripts/tv-playlist.mjs` (configurado em `tv/tv.config.json`).
Não é preciso editar à mão.

## Atualização automática (recomendado)

O workflow `.github/workflows/tv-playlist.yml` roda **todo dia às 06:17 (BRT)** no GitHub Actions e atualiza os dois arquivos:
busca os vídeos, valida, e só faz commit se a lista mudou (o push publica no Netlify).
Também dá para rodar na hora em **Actions → Atualizar playlist da TV → Run workflow**.

Para buscar **todos** os vídeos do canal com duração exata, cadastre uma chave da YouTube Data API:

1. Google Cloud Console → crie um projeto → ative **YouTube Data API v3** → **Credenciais → Criar chave de API**.
   Em "Restrições da API", limite a chave à *YouTube Data API v3*.
2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   Nome: `YOUTUBE_API_KEY` — Valor: a chave.

A chave fica só no GitHub; **nunca** vai para o site. Custo: poucas unidades de cota por execução
(a cota grátis é 10.000/dia).

Sem a chave, o workflow usa o **RSS público** do canal: pega os 15 uploads mais recentes e lê a
duração na página pública de cada vídeo novo (modo *best-effort*: pode falhar se o YouTube mudar a
página ou bloquear o acesso automatizado). Vídeos antigos que já estão na playlist são mantidos.

## Rodar no seu computador (Node 18+)

```bash
node scripts/tv-playlist.mjs sync            # atualiza tv/playlist.json (API se houver YOUTUBE_API_KEY, senão RSS)
node scripts/tv-playlist.mjs sync --dry      # só mostra o resultado, sem gravar
node scripts/tv-playlist.mjs sync --refresh  # relê a duração de todos os vídeos (modo RSS)
node scripts/tv-playlist.mjs check           # valida o arquivo (IDs, durações, repetidos)
node scripts/tv-playlist.mjs check --online  # confere se cada vídeo existe e permite incorporação
```

Com chave no Windows (PowerShell): `$env:YOUTUBE_API_KEY="sua-chave"; node scripts/tv-playlist.mjs sync`

## Configuração — `tv/tv.config.json`

| Campo | Para que serve |
|---|---|
| `channelId` | ID do canal (`UC…`). Já preenchido: `UCZs7v1mWuMmcssEFk9sW7PA` (FLLOYDINN GAMEPLAY) |
| `handle` | `@flloydinn` (usado se `channelId` ficar vazio, no modo API) |
| `minDurationSec` | vídeos mais curtos ficam de fora (61 = exclui Shorts) |
| `maxDurationSec` | vídeos mais longos ficam de fora (10800 = 3 h; evita lives enormes) |
| `maxVideos` | tamanho máximo da grade |
| `order` | `newest` (mais recentes primeiro) ou `oldest` |
| `exclude` | IDs que nunca devem entrar, ex.: `["9UqW2L4Ha1A"]` |
| `include` | vídeos extras. No modo API basta o ID (`"abcDEF12345"`); no modo RSS informe `{ "id": "...", "title": "...", "dur": 845 }` |
| `catalog.maxVideos` | tamanho máximo do catálogo (`data/videos.json`) |
| `catalog.exclude` | IDs que não devem aparecer no catálogo (o `exclude` de cima vale só para a TV) |
| `catalog.games` | corrige o "jogo" de um vídeo, ex.: `{ "qUu9A3DCDIQ": "Mafia III" }`. Sem isso, o jogo vem do texto depois do último `|` no título (ou "Outros") |

Comandos extras: `sync --only tv` / `sync --only videos` (atualiza só um arquivo) e `sync --stats`
(grava também quando só as visualizações mudaram; o workflow usa isso às segundas).

Filtros automáticos: privados/não listados, lives e estreias, vídeos que **não permitem incorporação**
e com **restrição de idade** (no modo API) ficam de fora, porque não tocam no player.

## Formato de `tv/playlist.json`

```json
{
  "channel": { "id": "UCZs7v1mWuMmcssEFk9sW7PA", "handle": "@flloydinn", "title": "FLLOYDINN GAMEPLAY" },
  "source": "youtube-api",
  "updated": "2026-11-23T17:20:29.209Z",
  "count": 13,
  "totalSeconds": 6708,
  "videos": [
    { "id": "qUu9A3DCDIQ", "title": "ZOANDO NO MÁFIA III", "dur": 1112, "published": "2022-01-12" }
  ]
}
```

- `id`: 11 caracteres do link `youtube.com/watch?v=`**`qUu9A3DCDIQ`**.
- `dur`: duração **exata em segundos** (18min32s = 1112). Se estiver errada, a grade "pula"
  (a página avisa no console e mostra "Intervalo" em vez de travar).
- O formato antigo (só o array de vídeos) continua aceito.

## Segurança da grade

- Se a busca falhar ou vier vazia, o script **não altera** o arquivo (sai com código 2).
- Se a lista nova encolher mais de 50% de uma vez (modo API), o script recusa (use `--force` se for intencional).
- Na página: se `playlist.json` não carregar ou não tiver vídeos válidos, entra a **programação reserva**
  (3 vídeos do canal, em `tv.html`) e aparece um aviso no guia.
- Quando uma playlist nova é publicada, quem está assistindo **termina o vídeo atual** e só então
  muda para a grade nova (sem cortar no meio). Mudanças que não afetam o vídeo atual entram na hora.
- Vídeo removido ou bloqueado para incorporação: aparece um aviso até o próximo horário, sem loop.

> Não altere `EPOCH` em `tv.html`: ele é o marco absoluto da grade; mudá-lo desloca a programação de todos.
