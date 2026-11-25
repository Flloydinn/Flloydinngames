# Scripts do site (Node 18+, sem dependências)

## Estrutura do projeto
- **Raiz:** páginas `.html` (URLs públicas, canonicals e sitemap dependem delas), `index.html`, `404.html`, `manifest.webmanifest`,
  `sw.js` (precisa estar na raiz para controlar o site todo), `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `_headers`, `_redirects`.
- **`js/`:** `analytics`, `conquistas`, `engage`, `forms`, `img-fallback`, `layout`, `script`. **`css/`:** `styles`, `game-bar`.
- **`assets/`, `data/`, `posts/`, `tv/`, `scripts/`:** imagens, dados, artigos, TV e automação (como antes).

Esta pasta não é publicada: o `_redirects` do Netlify devolve 404 para `/scripts/*`.

## Validar os dados
```
node scripts/validar-dados.mjs
```
Confere `data/agenda.json`, `data/canais.json`, `data/canal.json`, `data/produtos.json` e `posts/index.json`
(campos, datas com fuso `-03:00`, ordem, ids/slugs únicos e se imagens e `.md` existem).
Sai com `0` se estiver tudo certo e `1` listando arquivo + erro.

## Publicar post ou evento
```
node scripts/publicar.mjs
```
- **1 — Novo post**: cria `posts/<slug>.md` (a partir de `posts/MODELO.md`) e a entrada em `posts/index.json`.
  Coloque a capa em `assets/` (ex.: `assets/capa-<slug>.jpg`) e edite o texto do `.md`.
- **2 — Novo evento**: insere em `data/agenda.json` com fuso `-03:00`, em ordem cronológica.
  Tipos: `live`, `launch`, `tour`, `rec` (`rec` não aparece na home nem no JSON-LD).

Ao final, a validação roda sozinha. Para editar um evento ou post existente, altere o JSON direto e rode a validação.

## Canal "Cortes do Flloydinn"
Quando o endereço oficial existir, edite só `data/canais.json`:
```json
"cortes": { "name": "Cortes do Flloydinn", "url": "https://www.youtube.com/@HANDLE_REAL" }
```
Deixe `""` enquanto não houver canal. O `js/layout.js` troca o selo "Em breve" por link em `index.html` e
`canais.html` e acrescenta a URL ao `sameAs` da `Organization`. Depois rode `node scripts/validar-dados.mjs`.

## GEO / AEO (IA e mecanismos de resposta)
```
node scripts/gerar-geo.mjs           # regenera llms.txt, llms-full.txt e o JSON-LD unificado
node scripts/gerar-geo.mjs --check   # só confere (o validar-dados.mjs já faz isso)
```
Gera `llms.txt` e `llms-full.txt` (raiz) a partir de `data/*.json` e `posts/index.json`, mantém o nó `Organization`
(`@id` `#org`, com `Brand` `#brand`, `sameAs` e `subOrganization`) igual em todas as páginas e os `ItemList` estáticos de
`videos.html` (vídeos) e `arcade.html` (jogos). O `publicar.mjs` já roda isso sozinho. Ao preencher `cortes.url`,
rode `node scripts/gerar-geo.mjs`: o canal Cortes entra nos arquivos e no JSON-LD.

## Auditoria de produção
`node scripts/auditar-producao.mjs [URL] [--lighthouse]` — status, redirects, headers, SEO/OG/JSON-LD, robots e llms.

## Outros
`tv-playlist.mjs` atualiza `tv/playlist.json`, `data/videos.json` e `data/canal.json` (veja o cabeçalho do arquivo).
