#!/usr/bin/env node
/* GEO/AEO: gera llms.txt, llms-full.txt e mantém o grafo JSON-LD unificado (Node 18+, sem dependências).
 *   node scripts/gerar-geo.mjs           # grava os arquivos que estiverem desatualizados
 *   node scripts/gerar-geo.mjs --check   # só confere (exit 1 se algo estiver desatualizado) — usado pelo validar-dados
 *
 * Fonte única dos dados: data/canais.json, data/canal.json, data/agenda.json, data/produtos.json,
 * data/videos.json e posts/index.json. Nenhuma URL ou dado é inventado: tudo vem desses arquivos
 * ou das próprias páginas do repositório.
 *
 * O que ele mantém em sincronia:
 *   - llms.txt e llms-full.txt (raiz)
 *   - nó "Organization" (@id #org) do <script id="ld-main"> de todas as páginas, com Brand, sameAs e subOrganization
 *     (o canal Cortes entra sozinho quando data/canais.json -> cortes.url estiver preenchido)
 *   - ItemList/VideoObject estático em videos.html (entre <!--GEO:videos:start/end-->)
 *   - ItemList/VideoGame estático em arcade.html (entre <!--GEO:games:start/end-->)
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = 'https://flloydinn.netlify.app';
const YT_MAIN = 'https://www.youtube.com/@flloydinn';
const YT_ESPORTE = 'https://www.youtube.com/@flloydinnesporteclube';
const json = async f => JSON.parse((await readFile(path.join(ROOT, f), 'utf8')).replace(/^\uFEFF/, ''));
const read = f => readFile(path.join(ROOT, f), 'utf8');

// ---------------- jogos (dados das próprias páginas) ----------------
const GAMES_3D = [
  { file: 'asteroid.html', name: 'Space Courier 3D', play: 'SinglePlayer' },
  { file: 'runner.html', name: 'Neon Runner 3D', play: 'SinglePlayer' },
  { file: 'drifter.html', name: 'Desert Drifter 3D', play: 'SinglePlayer' },
  { file: 'minigolf.html', name: 'Galaxy MiniGolf 3D', play: 'SinglePlayer' },
  { file: 'wildlands-online.html', name: 'Wildlands Online', play: 'MultiPlayer' },
];
const MINI = [
  { id: 'parry', name: 'Parry!', desc: 'Minijogo de reação: clique no instante certo, com média de reação salva como recorde.' },
  { id: 'aim', name: 'Aim Trainer', desc: 'Minijogo de mira: acerte os círculos em 15 segundos.' },
  { id: 'quiz', name: 'Boss Quiz', desc: 'Minijogo de perguntas e respostas sobre games.' },
];
const metaOf = (html, name) => (new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html) || [])[1] || '';
async function gamesData() {
  const out = [];
  for (const g of GAMES_3D) {
    const html = await read(g.file);
    out.push({ ...g, url: `${SITE}/${g.file}`, desc: metaOf(html, 'description'), image: metaOf(html, 'og:image') });
  }
  return out;
}

// ---------------- helpers ----------------
const isoDur = s => { s = Math.max(1, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (x || (!h && !m) ? x + 'S' : ''); };
const fmtDur = s => { s = Math.round(Number(s) || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const brl = n => 'R$ ' + Number(n).toFixed(2).replace('.', ',');
const brDate = iso => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const cortesUrl = c => (c && c.cortes && typeof c.cortes.url === 'string' && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(c.cortes.url.trim())) ? c.cortes.url.trim() : '';

// ---------------- nó Organization canônico ----------------
export function orgNode(canais, canal) {
  const main = (canal.channel && canal.channel.url) || YT_MAIN;
  const cortes = cortesUrl(canais);
  const subs = [
    { '@type': 'Organization', '@id': SITE + '/#canal-gameplay', name: 'Flloydinn Gameplay', url: main, sameAs: [main], parentOrganization: { '@id': SITE + '/#org' } },
    { '@type': 'Organization', '@id': SITE + '/#canal-esporte', name: 'Flloydinn Esporte Clube', url: YT_ESPORTE, sameAs: [YT_ESPORTE], parentOrganization: { '@id': SITE + '/#org' } },
  ];
  if (cortes) subs.push({ '@type': 'Organization', '@id': SITE + '/#canal-cortes', name: (canais.cortes && canais.cortes.name) || 'Cortes do Flloydinn', url: cortes, sameAs: [cortes], parentOrganization: { '@id': SITE + '/#org' } });
  return {
    '@type': 'Organization',
    '@id': SITE + '/#org',
    name: 'Flloydinn',
    alternateName: ['Flloydinn Gameplay', 'FLLOYDINN GAMEPLAY'],
    url: SITE + '/',
    logo: { '@type': 'ImageObject', url: SITE + '/assets/apple-touch-icon.png', width: 180, height: 180 },
    image: SITE + '/assets/og-flloydinn.jpg',
    description: 'Flloydinn é o projeto do canal Flloydinn Gameplay no YouTube: gameplays, lives, TV 24/7, jogos no navegador e o Flloydinn Esporte Clube.',
    brand: { '@type': 'Brand', '@id': SITE + '/#brand', name: 'Flloydinn', url: SITE + '/', logo: SITE + '/assets/apple-touch-icon.png' },
    knowsAbout: ['Gameplay', 'Lives', 'Jogos no navegador', 'Futebol', 'Fórmula 1', 'NBA', 'Super Bowl', 'Olimpíadas'],
    inLanguage: 'pt-BR',
    sameAs: [main, YT_ESPORTE, ...(cortes ? [cortes] : [])],
    subOrganization: subs,
  };
}

// ---------------- llms.txt ----------------
const PAGES = [
  ['index.html', 'Página inicial', 'Hub do projeto: vídeos em destaque, próximo evento, jogos e canais.'],
  ['canais.html', 'Canais', 'Todos os canais do ecossistema Flloydinn e como se complementam.'],
  ['videos.html', 'Vídeos', 'Catálogo do canal Flloydinn Gameplay com busca e filtros.'],
  ['tv.html', 'TV 24/7', 'Programação contínua com os vídeos do canal, sincronizada pelo relógio (horário de Brasília).'],
  ['arcade.html', 'Arcade', 'Jogos grátis no navegador, recordes e conquistas salvos localmente.'],
  ['agenda.html', 'Agenda', 'Lives, estreias e eventos da comunidade.'],
  ['blog.html', 'Blog', 'Análises e notícias de games.'],
  ['loja.html', 'Loja', 'Camisetas, caneca, adesivos e wallpapers do canal (pagamento por PIX).'],
  ['cortes.html', 'Cortes e momentos rápidos', 'Shorts e vídeos curtos do canal reunidos no site.'],
  ['sobre.html', 'Sobre', 'O projeto, a proposta do hub e os bastidores.'],
  ['faq.html', 'FAQ', 'Perguntas frequentes sobre canal, loja, TV e jogos.'],
  ['parcerias.html', 'Parcerias', 'Anuncie com o Flloydinn Gameplay: integrações em gameplay, lives e shorts, métricas públicas do canal e contato comercial.'],
];

async function buildLlms() {
  const [canais, canal, agenda, produtos, posts, videos] = await Promise.all([json('data/canais.json'), json('data/canal.json'), json('data/agenda.json'), json('data/produtos.json'), json('posts/index.json'), json('data/videos.json')]);
  const games = await gamesData();
  const cortes = cortesUrl(canais);
  const main = (canal.channel && canal.channel.url) || YT_MAIN;
  const cortesLine = cortes
    ? `- [Cortes do Flloydinn (YouTube)](${cortes}): melhores momentos das gameplays e lives em clipes curtos.`
    : '- Cortes do Flloydinn: canal anunciado, ainda sem endereço oficial no YouTube ("em breve"). Enquanto isso, os momentos rápidos ficam em [cortes.html](' + SITE + '/cortes.html).';

  const resumo = [
    '# Flloydinn',
    '',
    '> Flloydinn é o projeto do canal de YouTube **Flloydinn Gameplay** (' + (canal.channel && canal.channel.handle || '@flloydinn') + '): gameplays leves, lives e clipes com a comunidade, em português do Brasil. O site flloydinn.netlify.app é o hub que reúne o canal, a TV 24/7, o Arcade com jogos 3D grátis no navegador, a agenda de lives, o blog e a loja.',
    '',
    'Fatos rápidos: idioma pt-BR; horários sempre em horário de Brasília (UTC−3); jogos grátis e sem login; recordes e conquistas ficam só no navegador de quem joga (localStorage).',
    '',
    '## Canais oficiais',
    `- [Flloydinn Gameplay (YouTube)](${main}): canal principal, gameplays, lives e clipes.`,
    `- [Flloydinn Esporte Clube (YouTube)](${YT_ESPORTE}): futebol, Fórmula 1, NBA, Super Bowl e Olimpíadas.`,
    cortesLine,
    '',
    '## Site (páginas principais)',
    ...PAGES.map(([f, t, d]) => `- [${t}](${SITE}/${f === 'index.html' ? '' : f}): ${d}`),
    '',
    '## Arcade: jogos 3D no navegador (grátis)',
    ...games.map(g => `- [${g.name}](${g.url}): ${g.desc}`),
    `- [Minijogos do Arcade](${SITE}/arcade.html): ${MINI.map(m => m.name).join(', ')}.`,
    '',
    '## Dados estruturados e versão completa',
    `- [llms-full.txt](${SITE}/llms-full.txt): catálogo completo (canais, agenda, produtos, artigos e vídeos) gerado a partir dos arquivos de dados do site.`,
    `- [sitemap.xml](${SITE}/sitemap.xml): todas as páginas públicas.`,
    '',
  ].join('\n');

  const upcoming = agenda.events.filter(e => e.type !== 'rec');
  const full = [
    resumo.replace('## Dados estruturados e versão completa', '## Versão curta e mapa do site'),
    '---',
    '',
    '# Catálogo completo (gerado de data/*.json e posts/index.json)',
    '',
    '## Canais (data/canais.json e data/canal.json)',
    `- Flloydinn Gameplay — ${main} — handle ${canal.channel && canal.channel.handle} — canal principal.`,
    `- Flloydinn Esporte Clube — ${YT_ESPORTE} — futebol, Fórmula 1, NBA, Super Bowl, Olimpíadas.`,
    cortes ? `- ${(canais.cortes && canais.cortes.name) || 'Cortes do Flloydinn'} — ${cortes} — melhores momentos em clipes curtos.` : '- Cortes do Flloydinn — ainda sem URL oficial (data/canais.json → cortes.url vazio).',
    '',
    '## TV 24/7',
    `- [tv.html](${SITE}/tv.html): a grade é calculada pelo relógio a partir de uma playlist de vídeos do canal; todo mundo vê o mesmo vídeo no mesmo ponto. Horários exibidos em horário de Brasília.`,
    '',
    '## Arcade',
    ...games.map(g => `- ${g.name} — ${g.url} — ${g.play === 'MultiPlayer' ? 'multiplayer' : 'um jogador'} — ${g.desc}`),
    ...MINI.map(m => `- ${m.name} — ${SITE}/arcade.html#${m.id} — ${m.desc}`),
    '- Conquistas e recordes: salvos apenas no navegador (localStorage); nada é enviado a servidores.',
    '',
    `## Agenda (data/agenda.json, atualizada em ${agenda.updated}) — horário de Brasília`,
    ...upcoming.map(e => `- ${brDate(e.start)} a ${brDate(e.end).slice(-5)} — ${e.title} (${e.type}; ${e.game}) — ${e.where}. ${e.desc} — ${SITE}/agenda.html#${e.id}`),
    '',
    `## Produtos da loja (data/produtos.json, moeda ${produtos.currency}) — ${SITE}/loja.html`,
    ...produtos.products.map(p => `- ${p.title} — ${brl(p.price)} — ${p.category}${p.digital ? ' (digital)' : ''} — ${p.desc}`),
    '',
    '## Artigos do blog (posts/index.json)',
    ...posts.posts.map(p => `- [${p.title}](${SITE}/post.html?slug=${p.slug}) — ${p.dateISO} — ${p.category}${p.game ? ' — ' + p.game : ''}: ${p.excerpt}`),
    '',
    `## Vídeos do catálogo (data/videos.json, ${videos.videos.length} itens) — mais recentes primeiro`,
    ...[...videos.videos].sort((a, b) => String(b.published).localeCompare(String(a.published))).map(v => `- [${v.title.replace(/\s+/g, ' ').trim()}](https://www.youtube.com/watch?v=${v.id}) — ${v.published} — ${v.type} — ${fmtDur(v.dur)} — ${v.game}`),
    '',
  ].join('\n');
  return { 'llms.txt': resumo, 'llms-full.txt': full };
}

// ---------------- JSON-LD estático (videos, arcade) ----------------
const wrapLd = (id, data) => `<script type="application/ld+json" id="${id}">\n${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n</script>`;
async function videosLd() {
  const d = await json('data/videos.json');
  const list = [...d.videos].filter(v => /^[\w-]{11}$/.test(v.id) && v.published).sort((a, b) => String(b.published).localeCompare(String(a.published))).slice(0, 12);
  const items = list.map((v, i) => ({
    '@type': 'ListItem', position: i + 1,
    item: {
      '@type': 'VideoObject', '@id': `https://www.youtube.com/watch?v=${v.id}`,
      name: v.title.replace(/\s+/g, ' ').trim(), description: (v.description || v.title).replace(/\s+/g, ' ').trim(),
      thumbnailUrl: [`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`], uploadDate: String(v.published).slice(0, 10), duration: isoDur(v.dur),
      ...(v.embeddable !== false ? { embedUrl: `https://www.youtube.com/embed/${v.id}` } : {}),
      url: `https://www.youtube.com/watch?v=${v.id}`, inLanguage: 'pt-BR',
      publisher: { '@id': SITE + '/#org' },
    },
  }));
  return wrapLd('ld-videos', { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Vídeos do canal Flloydinn Gameplay', url: SITE + '/videos.html', numberOfItems: items.length, itemListElement: items });
}
async function gamesLd() {
  const g3 = await gamesData();
  const items = [
    ...g3.map(g => ({
      '@type': 'VideoGame', name: g.name, url: g.url, description: g.desc, ...(g.image ? { image: g.image } : {}),
      applicationCategory: 'Game', gamePlatform: 'Web browser', operatingSystem: 'Navegador com WebGL', playMode: g.play, inLanguage: 'pt-BR',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', availability: 'https://schema.org/InStock' },
      publisher: { '@id': SITE + '/#org' },
    })),
    ...MINI.map(m => ({
      '@type': 'VideoGame', name: m.name, url: `${SITE}/arcade.html#${m.id}`, description: m.desc,
      applicationCategory: 'Game', gamePlatform: 'Web browser', playMode: 'SinglePlayer', inLanguage: 'pt-BR',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', availability: 'https://schema.org/InStock' },
      publisher: { '@id': SITE + '/#org' },
    })),
  ].map((item, i) => ({ '@type': 'ListItem', position: i + 1, item }));
  return wrapLd('ld-games', { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Jogos grátis do Arcade Flloydinn', url: SITE + '/arcade.html', numberOfItems: items.length, itemListElement: items });
}
function patchBlock(html, key, block) {
  const a = `<!--GEO:${key}:start-->`, b = `<!--GEO:${key}:end-->`;
  const re = new RegExp(`${a}[\\s\\S]*?${b}`);
  const full = `${a}\n  ${block.replace(/\n/g, '\n  ')}\n  ${b}`;
  if (re.test(html)) return html.replace(re, () => full);
  return html.replace('</head>', () => `  ${full}\n</head>`);
}

// ---------------- sincronização do nó Organization ----------------
function patchOrg(html, org) {
  const re = /(<script type="application\/ld\+json" id="ld-main">)([\s\S]*?)(<\/script>)/;
  const m = re.exec(html); if (!m) return html;
  let j; try { j = JSON.parse(m[2]); } catch { return html; }
  const g = j['@graph']; if (!Array.isArray(g)) return html;
  const i = g.findIndex(n => n && n['@type'] === 'Organization' && n['@id'] === SITE + '/#org');
  if (i < 0) return html;
  g[i] = org;
  return html.replace(re, (_, a, _b, c) => `${a}\n${JSON.stringify(j, null, 2)}\n  ${c}`);
}

// ---------------- execução ----------------
export async function gerar({ write = true } = {}) {
  const stale = [];
  const put = async (file, content) => {
    let cur = null; try { cur = await read(file); } catch {}
    if (cur !== content) { stale.push(file); if (write) await writeFile(path.join(ROOT, file), content, 'utf8'); }
  };
  const llms = await buildLlms();
  for (const [f, c] of Object.entries(llms)) await put(f, c);

  const [canais, canal] = await Promise.all([json('data/canais.json'), json('data/canal.json')]);
  const org = orgNode(canais, canal);
  const files = (await readdir(ROOT)).filter(f => f.endsWith('.html'));
  for (const f of files) {
    let html = await read(f), next = patchOrg(html, org);
    if (f === 'videos.html') next = patchBlock(next, 'videos', await videosLd());
    if (f === 'arcade.html') next = patchBlock(next, 'games', await gamesLd());
    if (next !== html) { stale.push(f); if (write) await writeFile(path.join(ROOT, f), next, 'utf8'); }
  }
  return stale;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = await gerar({ write: !check });
  if (check) {
    if (stale.length) { console.error('✗ GEO desatualizado: ' + stale.join(', ') + '\n  Rode: node scripts/gerar-geo.mjs'); process.exit(1); }
    console.log('✓ llms.txt, llms-full.txt e o JSON-LD da Organization/vídeos/jogos estão em dia.');
  } else console.log(stale.length ? 'Atualizados: ' + stale.join(', ') : 'Nada a atualizar (tudo em dia).');
}
