#!/usr/bin/env node
/* Auditoria de produção do site (Node 18+, sem dependências).
 *   node scripts/auditar-producao.mjs                         # https://flloydinn.netlify.app
 *   node scripts/auditar-producao.mjs http://localhost:8765   # servidor local
 *   node scripts/auditar-producao.mjs --lighthouse            # + Lighthouse mobile/desktop (usa npx lighthouse e Chrome/Edge)
 *   node scripts/auditar-producao.mjs URL --lighthouse --paginas index.html,loja.html
 * Verifica: status HTTP, _redirects, _headers, SEO técnico, Open Graph e JSON-LD.
 * Em servidor local (sem Netlify) as checagens de _headers/_redirects são puladas.
 * Sai com 1 se alguma checagem falhar. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const base = (args.find(a => /^https?:\/\//.test(a)) || 'https://flloydinn.netlify.app').replace(/\/+$/, '');
const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(base);
const PAGES = ['index.html', 'tv.html', 'videos.html', 'arcade.html', 'loja.html', 'agenda.html', 'blog.html', 'canais.html', 'cortes.html', 'sobre.html', 'faq.html', 'parcerias.html', 'post.html?slug=como-funciona-o-site-do-flloydinn'];
const LH_PAGES = (opt('--paginas') || 'index.html,tv.html,videos.html,arcade.html,canais.html,loja.html').split(',');
const PLACEHOLDER = /HANDLE_DO_CANAL|@HANDLE|TODO|FIXME|lorem ipsum|example\.com|\[object Object\]|undefined/;

let fails = 0, warns = 0;
const rows = [];
const ok = (grp, msg) => rows.push(['✓', grp, msg]);
const bad = (grp, msg) => { fails++; rows.push(['✗', grp, msg]); };
const warn = (grp, msg) => { warns++; rows.push(['!', grp, msg]); };
const skip = (grp, msg) => rows.push(['-', grp, msg]);

async function get(p, o = {}) {
  try { return await fetch(base + p, { redirect: 'manual', headers: { 'User-Agent': 'flloydinn-audit/1.0' }, ...o }); }
  catch (e) { return { status: 0, error: e.message, headers: new Headers(), text: async () => '' }; }
}

// ---------- 1. Status e redirecionamentos ----------
async function checkStatus() {
  for (const p of PAGES) {
    const r = await get('/' + p);
    r.status === 200 ? ok('status', `/${p} → 200`) : bad('status', `/${p} → ${r.status}${r.error ? ' ' + r.error : ''} (esperado 200)`);
  }
  if (local) { skip('redirects', 'servidor local não aplica _redirects (oblog, 404, paths restritos)'); return; }
  const o = await get('/oblog.html');
  const loc = o.headers.get('location') || '';
  o.status === 301 && /\/blog\.html$/.test(loc) ? ok('redirects', '/oblog.html → 301 /blog.html') : bad('redirects', `/oblog.html → ${o.status} ${loc} (esperado 301 /blog.html)`);
  const nx = await get('/rota-que-nao-existe-' + Date.now());
  const nxBody = await nx.text();
  nx.status === 404 && /<html/i.test(nxBody) ? ok('redirects', 'rota inexistente → 404 com página 404.html') : bad('redirects', `rota inexistente → ${nx.status} (esperado 404 com HTML)`);
  for (const p of ['/scripts/validar-dados.mjs', '/scripts/LEIAME.md', '/posts/MODELO.md', '/tv/tv.config.json', '/tv/LEIAME.md', '/.github/workflows/tv-playlist.yml']) {
    const r = await get(p);
    r.status === 404 ? ok('restritos', `${p} → 404`) : bad('restritos', `${p} → ${r.status} (deveria ser 404: path interno exposto)`);
  }
}

// ---------- 2. Cabeçalhos ----------
async function checkHeaders() {
  if (local) { skip('headers', 'servidor local não aplica _headers'); return; }
  const r = await get('/index.html');
  const h = n => r.headers.get(n);
  const need = { 'x-frame-options': /SAMEORIGIN|DENY/i, 'x-content-type-options': /nosniff/i, 'referrer-policy': /./, 'permissions-policy': /./ };
  for (const [n, re] of Object.entries(need)) h(n) && re.test(h(n)) ? ok('headers', `${n}: ${h(n)}`) : bad('headers', `${n} ausente/incorreto em /index.html (${h(n)})`);
  h('strict-transport-security') ? ok('headers', 'strict-transport-security presente') : warn('headers', 'strict-transport-security ausente');
  const a = await get('/assets/og-flloydinn.jpg');
  /max-age=\d+/.test(a.headers.get('cache-control') || '') && !/max-age=0\b/.test(a.headers.get('cache-control')) ? ok('cache', `/assets/*: ${a.headers.get('cache-control')}`) : bad('cache', `/assets/* sem cache longo (${a.headers.get('cache-control')})`);
  for (const f of ['/css/styles.css', '/js/layout.js', '/data/agenda.json']) {
    const x = await get(f); const cc = x.headers.get('cache-control') || '';
    /max-age=0|no-cache|must-revalidate/.test(cc) ? ok('cache', `${f}: ${cc}`) : warn('cache', `${f} sem revalidação (${cc})`);
  }
  const idx = await get('/posts/index.json'); const slug0 = (JSON.parse(await idx.text()).posts[0] || {}).slug;
  const md = await get('/posts/' + slug0 + '.md');
  /noindex/i.test(md.headers.get('x-robots-tag') || '') ? ok('headers', 'posts/*.md: X-Robots-Tag noindex') : bad('headers', `posts/*.md sem X-Robots-Tag noindex (${md.headers.get('x-robots-tag')})`);
}

// ---------- 3. SEO / Open Graph / JSON-LD ----------
const meta = (html, re) => (re.exec(html) || [])[1];
const attr = (html, key, val, get_) => { const m = new RegExp(`<meta[^>]*${key}=["']${val}["'][^>]*>`, 'i').exec(html); if (!m) return undefined; return (new RegExp(`${get_}=["']([^"']*)["']`, 'i').exec(m[0]) || [])[1]; };
async function checkSeo() {
  const imgs = new Map();
  for (const p of PAGES) {
    const g = 'seo ' + p.replace('?slug=como-funciona-o-site-do-flloydinn', '');
    const r = await get('/' + p); if (r.status !== 200) continue;
    const html = await r.text();
    const title = meta(html, /<title[^>]*>([^<]*)<\/title>/i);
    title && title.trim().length >= 10 && title.length <= 80 ? ok(g, `title (${title.length} car.)`) : (title ? warn(g, `title com ${title.length} caracteres: "${title}"`) : bad(g, '<title> ausente'));
    const desc = attr(html, 'name', 'description', 'content');
    desc && desc.length >= 50 ? ok(g, `description (${desc.length} car.)`) : bad(g, `meta description ausente ou curta (${desc ? desc.length : 0})`);
    const canon = meta(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const dyn = p.startsWith('post.html'); // post.html define canonical/og:url por JS, conforme o slug
    canon && /^https:\/\//.test(canon) ? ok(g, `canonical ${canon}`) : dyn ? ok(g, 'canonical definido por JS (por slug)') : bad(g, 'canonical ausente ou não absoluta');
    for (const k of ['og:title', 'og:description', 'og:image', ...(dyn ? [] : ['og:url'])]) attr(html, 'property', k, 'content') ? 0 : bad(g, `${k} ausente`);
    const oi = attr(html, 'property', 'og:image', 'content');
    if (oi) { if (!/^https:\/\//.test(oi)) bad(g, `og:image deve ser URL absoluta (${oi})`); else if (!imgs.has(oi)) imgs.set(oi, g); }
    if (!/<html[^>]*\blang=/i.test(html)) bad(g, '<html lang> ausente');
    if (!/<meta[^>]*name=["']viewport["']/i.test(html)) bad(g, 'meta viewport ausente');
    const robots = attr(html, 'name', 'robots', 'content');
    if (robots && /noindex/i.test(robots) && !p.startsWith('post.html')) bad(g, `página com noindex: ${robots}`);
    const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    if (!blocks.length && !/^(post|agenda|loja)\.html/.test(p)) warn(g, 'sem JSON-LD no HTML estático');
    blocks.forEach((b, i) => {
      try { const j = JSON.parse(b); (j['@graph'] || []).filter(n => n['@type'] === 'Organization' && /#org$/.test(n['@id'] || '')).forEach(n => { n.brand && n.brand['@id'] && Array.isArray(n.sameAs) && n.sameAs.some(u => /youtube\.com\/@flloydinn$/.test(u)) && Array.isArray(n.subOrganization) ? 0 : bad(g, 'Organization #org sem brand/sameAs/subOrganization (rode node scripts/gerar-geo.mjs)'); }); const types = (j['@graph'] || [j]).map(n => n['@type']).join(','); PLACEHOLDER.test(b) ? bad(g, `JSON-LD #${i + 1} com placeholder: ${PLACEHOLDER.exec(b)[0]}`) : ok(g, `JSON-LD #${i + 1} válido (${types})`); }
      catch (e) { bad(g, `JSON-LD #${i + 1} inválido: ${e.message}`); }
    });
    const vis = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    if (PLACEHOLDER.test(vis)) bad(g, `placeholder visível no HTML: ${PLACEHOLDER.exec(vis)[0]}`);
  }
  for (const [url, from] of imgs) {
    let r; try { r = await fetch(url); } catch (e) { r = { status: 0, headers: new Headers() }; }
    r.status === 200 && /^image\//.test(r.headers.get('content-type') || '') ? ok('og:image', `${url} → 200 ${r.headers.get('content-type')}`) : bad('og:image', `${url} (usada em ${from}) → ${r.status} ${r.headers.get('content-type') || ''}`);
  }
  // capas próprias dos posts (assets/blog/<slug>.png): precisam ser servidas como PNG
  { const ix = JSON.parse(await (await get('/posts/index.json')).text()).posts || []; const proprias = ix.filter(p => /^assets\/blog\//.test(p.cover || ''));
    for (const p of proprias) { const r = await get('/' + p.cover); r.status === 200 && /^image\/png/.test(r.headers.get('content-type') || '') ? ok('capa', `/${p.cover} → 200 image/png`) : bad('capa', `/${p.cover} → ${r.status} ${r.headers.get('content-type') || ''}`); }
    if (!proprias.length) ok('capa', 'nenhum post com capa própria ainda (usam a imagem padrão)'); }
  const rob = await get('/robots.txt');
  if (rob.status === 200) {
    const t = await rob.text(); ok('seo', 'robots.txt 200');
    for (const bot of ['Googlebot', 'Google-Extended', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Bingbot']) new RegExp('User-agent:\\s*' + bot, 'i').test(t) ? 0 : bad('robots', `robots.txt sem regra para ${bot}`);
    /Disallow:\s*\/scripts\//.test(t) && /Disallow:\s*\/\.github\//.test(t) ? ok('robots', 'bots de IA/busca liberados; /scripts/ e /.github/ bloqueados') : bad('robots', 'robots.txt deve bloquear /scripts/ e /.github/');
    /Sitemap:\s*https:\/\//.test(t) ? 0 : bad('robots', 'robots.txt sem Sitemap');
    /^\s*Disallow:\s*\/\s*$/m.test(t) ? bad('robots', 'robots.txt bloqueia o site inteiro (Disallow: /)') : 0;
  } else bad('seo', `robots.txt → ${rob.status}`);
  // GEO: arquivos para LLMs
  for (const f of ['/llms.txt', '/llms-full.txt']) {
    const r = await get(f); const body = r.status === 200 ? await r.text() : '';
    r.status === 200 && /^# \S/.test(body) ? ok('llms', `${f} → 200 (${body.length} bytes)`) : bad('llms', `${f} → ${r.status} (precisa começar com "# Título")`);
    if (!local) {
      /^text\/plain;\s*charset=utf-8$/i.test(r.headers.get('content-type') || '') ? ok('llms', `${f} Content-Type ${r.headers.get('content-type')}`) : bad('llms', `${f} Content-Type deveria ser text/plain; charset=utf-8 (veio ${r.headers.get('content-type')})`);
      /noindex/i.test(r.headers.get('x-robots-tag') || '') ? bad('llms', `${f} com X-Robots-Tag noindex`) : ok('llms', `${f} indexável`);
    }
    if (PLACEHOLDER.test(body)) bad('llms', `${f} com placeholder: ${PLACEHOLDER.exec(body)[0]}`);
    for (const u of new Set([...body.matchAll(/\]\((https:\/\/flloydinn\.netlify\.app[^)\s]*)\)/g)].map(m => m[1]))) { const p = new URL(u).pathname + new URL(u).search; const rr = await get(p); rr.status === 200 ? 0 : bad('llms', `${f}: link ${u} → ${rr.status}`); }
  }
  const sm = await get('/sitemap.xml');
  if (sm.status === 200) {
    const xml = await sm.text(); const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    ok('seo', `sitemap.xml 200 (${urls.length} URLs)`);
    for (const u of urls) { const p = new URL(u).pathname; const r = await get(p === '/' ? '/' : p); if (r.status !== 200) bad('sitemap', `${u} → ${r.status}`); }
  } else bad('seo', `sitemap.xml → ${sm.status}`);
}

// ---------- 4. Lighthouse (opcional) ----------
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);
}
function lighthouse() {
  const chrome = findChrome();
  if (!chrome) { warn('lighthouse', 'Chrome/Edge não encontrado (defina CHROME_PATH)'); return; }
  const dir = mkdtempSync(path.join(tmpdir(), 'lh-'));
  console.log(`\nLighthouse em ${base} (${chrome})\n`);
  const table = [['Página', 'Perfil', 'Perf', 'A11y', 'Boas práticas', 'SEO', 'LCP', 'CLS', 'TBT']];
  for (const p of LH_PAGES) for (const prof of ['mobile', 'desktop']) {
    const out = path.join(dir, `${p.replace(/\W+/g, '_')}-${prof}.json`);
    const a = ['--yes', 'lighthouse', `${base}/${p === 'index.html' ? '' : p}`, '--output=json', `--output-path=${out}`, '--quiet', '--only-categories=performance,accessibility,best-practices,seo',
      `--chrome-flags=--headless=new --no-sandbox`, ...(prof === 'desktop' ? ['--preset=desktop'] : [])];
    const r = spawnSync('npx', a, { env: { ...process.env, CHROME_PATH: chrome }, shell: true, encoding: 'utf8', timeout: 240000 });
    if (!existsSync(out)) { warn('lighthouse', `${p} ${prof}: falhou (${(r.stderr || '').split('\n').filter(Boolean).pop() || 'sem saída'})`); continue; }
    const j = JSON.parse(readFileSync(out, 'utf8')); const c = j.categories, au = j.audits;
    const s = k => Math.round(c[k].score * 100);
    table.push([p, prof, s('performance'), s('accessibility'), s('best-practices'), s('seo'), au['largest-contentful-paint'].displayValue, au['cumulative-layout-shift'].displayValue, au['total-blocking-time'].displayValue]);
    const issues = Object.values(au).filter(x => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual').map(x => x.id);
    if (issues.length) console.log(`  ${p} (${prof}) atenção: ${issues.slice(0, 12).join(', ')}`);
  }
  console.log('\n' + table.map(r => r.join(' | ')).join('\n'));
}

console.log(`Auditando ${base}${local ? ' (servidor local)' : ''}\n`);
await checkStatus(); await checkHeaders(); await checkSeo();
const groups = new Map();
for (const [s, g, m] of rows) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push([s, m]); }
for (const [g, items] of groups) {
  const f = items.filter(i => i[0] === '✗').length, w = items.filter(i => i[0] === '!').length;
  console.log(`${f ? '✗' : w ? '!' : items[0][0] === '-' ? '-' : '✓'} ${g}: ${items.length} checagem(ns)${f ? `, ${f} falha(s)` : ''}${w ? `, ${w} aviso(s)` : ''}`);
  for (const [s, m] of items) if (s !== '✓') console.log(`    ${s} ${m}`);
}
console.log(`\nResultado: ${fails ? `✗ ${fails} falha(s)` : '✓ sem falhas'}${warns ? `, ${warns} aviso(s)` : ''}`);
if (flag('--lighthouse')) lighthouse();
process.exit(fails ? 1 : 0);
