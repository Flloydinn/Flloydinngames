# Scripts do site (Node 18+, sem dependências)

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
Deixe `""` enquanto não houver canal. O `layout.js` troca o selo "Em breve" por link em `index.html` e
`canais.html` e acrescenta a URL ao `sameAs` da `Organization`. Depois rode `node scripts/validar-dados.mjs`.

## Outros
`tv-playlist.mjs` atualiza `tv/playlist.json`, `data/videos.json` e `data/canal.json` (veja o cabeçalho do arquivo).
