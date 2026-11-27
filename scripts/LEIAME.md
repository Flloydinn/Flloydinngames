# Scripts do site (Node 18+, sem dependências)

## Estrutura do projeto
- **Raiz:** páginas `.html` (URLs públicas, canonicals e sitemap dependem delas), `index.html`, `404.html`, `manifest.webmanifest`,
  `sw.js` (precisa estar na raiz para controlar o site todo), `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `_headers`, `_redirects`.
- **`js/`:** `analytics`, `conquistas`, `engage`, `forms`, `img-fallback`, `layout`, `script`, `storage` (helper seguro de localStorage), `notificacoes` (avisos de vídeo novo). **`css/`:** `styles`, `game-bar`.
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

## Avisos de novos vídeos
`node scripts/gerar-vapid.mjs` gera as chaves VAPID; a configuração fica em `data/notificacoes.json` e o passo a passo
(o que já funciona e o que depende de servidor) em `scripts/NOTIFICACOES.md`.

## Post diário automático (games, cinema e cultura geek)
```
node scripts/gerar-post-semanal.mjs --dry-run   # testa os feeds e o prompt, sem IA e sem gravar nada
node scripts/gerar-post-semanal.mjs             # gera, grava, roda o GEO e valida (precisa de GEMINI_API_KEY)
```
- **O que faz:** lê feeds RSS (IGN Brasil, Canaltech Games, Gamerview, Cinema com Rapadura, g1 Cinema, Legião dos Heróis,
  Canaltech Entretenimento, Papelpop, Meio Bit; Polygon e Nerdist em inglês só como complemento), pega notícias das últimas
  48 horas do nicho, descarta promoções e assuntos já publicados (compara título, resumo, tags, tema e links de **todos** os posts), escolhe
  um tema (alternando Games, Cinema e Cultura geek) e pede o texto ao Google Gemini **usando só os fatos das notícias**.
  O script confere o texto (sem HTML, links ou citações longas; todo número precisa estar nas fontes), acrescenta
  a seção "Fontes" com os links reais e o aviso de que houve auxílio de IA, grava `posts/<slug>.md` e
  `posts/index.json` (capa `assets/og-flloydinn.jpg`, `views: 0`), roda `gerar-geo.mjs` e `validar-dados.mjs`.
  Se algo falhar, tudo é desfeito e o script sai com erro. Se não houver pauta inédita nas últimas 48 h, ele loga
  `Nenhuma pauta inédita hoje — encerrando sem publicar.` e sai com código 0 (o workflow não falha e nada é commitado).
- **Workflow:** `.github/workflows/post-semanal.yml` roda todos os dias às 12:00 UTC (09:00 em Brasília) e faz commit
  direto na `master` só se houver mudança (com `git pull --rebase` antes do push). Também pode ser disparado à mão.
- **Cadastrar o segredo no GitHub:** repositório > **Settings** > **Secrets and variables** > **Actions** >
  aba **Secrets** > **New repository secret** > nome `GEMINI_API_KEY` > cole a chave (criada em
  https://aistudio.google.com/apikey). Opcional: aba **Variables** > `GEMINI_MODEL` (padrão `gemini-3.8-flash`).
- **Testar no GitHub:** aba **Actions** > "Post diário do blog" > **Run workflow** > marque `dry_run`.
- **Revisão:** o texto é gerado por IA. Confira os posts publicados; para tirar um, apague a entrada em
  `posts/index.json` e o `.md`, e rode `node scripts/gerar-geo.mjs`.

## Outros
`tv-playlist.mjs` atualiza `tv/playlist.json`, `data/videos.json` e `data/canal.json` (veja o cabeçalho do arquivo).
