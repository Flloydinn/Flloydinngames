#!/usr/bin/env node
/* =====================================================================
 * Vídeos do canal -> arquivos estáticos do site (Node 18+, sem dependências)
 *
 * Uma única busca no YouTube gera dois arquivos:
 *   tv/playlist.json  -> grade da TV 24/7 (tv.html): só vídeos que tocam no player (sem Shorts)
 *   data/videos.json  -> catálogo do canal (videos.html e destaque do index.html)
 *
 *   node scripts/tv-playlist.mjs sync              # atualiza os dois arquivos
 *   node scripts/tv-playlist.mjs sync --dry        # mostra o resultado sem gravar
 *   node scripts/tv-playlist.mjs sync --only tv    # (ou --only videos) atualiza só um
 *   node scripts/tv-playlist.mjs sync --stats      # grava também se só as visualizações mudaram
 *   node scripts/tv-playlist.mjs check             # valida os dois arquivos (offline)
 *   node scripts/tv-playlist.mjs check --online    # confere se os vídeos da TV existem e permitem incorporação
 *
 * Fonte dos dados (automática):
 *   - YouTube Data API  -> se YOUTUBE_API_KEY existir (recomendado: todos os uploads, duração exata,
 *                          visualizações, tags; filtra privados/lives/sem incorporação/restrição de idade)
 *   - RSS público       -> sem chave: os 15 uploads mais recentes + duração lida da página pública
 *                          de cada vídeo novo (best-effort). Vídeos já conhecidos são mantidos.
 *   Force com --source api|rss.
 *
 * A chave NUNCA vai para o site: fica só no ambiente (ou no secret do GitHub Actions).
 * Se a busca falhar ou vier vazia, os arquivos atuais NÃO são alterados (exit 2).
 * Configuração: tv/tv.config.json
 * ===================================================================== */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  tv: path.join(ROOT, 'tv', 'playlist.json'),
  videos: path.join(ROOT, 'data', 'videos.json'),
  config: path.join(ROOT, 'tv', 'tv.config.json'),
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const args = process.argv.slice(2);
const cmd = args[0] || 'help';
const flag = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : undefined; };

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const isValidId = id => ID_RE.test(id) && !/^(.)\1{10}$/.test(id);
const log = (...a) => console.log('[canal]', ...a);
const fail = (code, msg) => { console.error('[canal] ERRO:', msg); process.exit(code); };
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const fmtDur = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
export const thumbOf = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// ---------------------------------------------------------------------
async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw new Error(`${rel(file)}: ${e.message}`); }
}
const videosOf = d => Array.isArray(d) ? d : (d && Array.isArray(d.videos) ? d.videos : []);

function validate(data, label) {
  const errors = [], warnings = [], seen = new Set();
  const list = videosOf(data);
  if (!Array.isArray(data) && !(data && Array.isArray(data.videos))) errors.push(`${label}: formato inválido (esperado {"videos": [...]})`);
  list.forEach((v, i) => {
    const where = `${label} videos[${i}]${v && v.title ? ` "${String(v.title).slice(0, 40)}"` : ''}`;
    if (!v || typeof v !== 'object') return errors.push(`${where}: item inválido`);
    if (!isValidId(String(v.id || ''))) errors.push(`${where}: ID inválido/placeholder (${v.id})`);
    if (!(Number.isInteger(v.dur) && v.dur > 0)) errors.push(`${where}: "dur" deve ser inteiro em segundos (${v.dur})`);
    if (!v.title) warnings.push(`${where}: sem título`);
    if (seen.has(v.id)) warnings.push(`${where}: ID repetido (${v.id})`);
    seen.add(v.id);
  });
  if (!list.length) errors.push(`${label}: nenhum vídeo`);
  return { errors, warnings, list };
}

// ---------------------------------------------------------------------
// Metadados derivados
/** "TÍTULO | Jogo" -> "Jogo". Sem barra: "Outros". */
function gameOf(title) {
  const parts = String(title).split('|').map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].replace(/\s*\[[^\]]*\]\s*$/, '').trim() : 'Outros';
}
const hashtags = s => [...String(s || '').matchAll(/#([\p{L}\p{N}_]{2,40})/gu)].map(m => m[1].toLowerCase());
const shortText = (s, n = 280) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const uniq = a => [...new Set(a)];

// ---------------------------------------------------------------------
async function http(url, { json = true, headers = {} } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', ...headers } });
  const safeUrl = url.replace(/key=[^&]+/, 'key=***');
  if (!res.ok) {
    let detail = ''; try { const j = await res.json(); detail = j.error?.message || ''; } catch {}
    throw new Error(`HTTP ${res.status} em ${safeUrl}${detail ? ' — ' + detail : ''}`);
  }
  return json ? res.json() : res.text();
}
const isoDur = s => { const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(s || ''); return m ? (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0)) : 0; };
const decodeXml = s => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/**
 * Item comum (antes de virar playlist/catálogo):
 * { id, title, published, dur, type: 'video'|'short'|'live', embeddable, ageRestricted, views?, description, tags[] }
 */

/** Fonte 1: YouTube Data API v3 (≈ 1 + páginas + lotes de 50 unidades de cota; a cota grátis é 10.000/dia). */
async function fromApi(cfg, key) {
  const API = 'https://www.googleapis.com/youtube/v3';
  const ch = await http(`${API}/channels?part=contentDetails,snippet&${cfg.channelId ? 'id=' + cfg.channelId : 'forHandle=' + encodeURIComponent(cfg.handle)}&key=${key}`);
  const channel = ch.items?.[0];
  if (!channel) throw new Error('canal não encontrado (confira channelId/handle em tv/tv.config.json)');
  const uploads = channel.contentDetails.relatedPlaylists.uploads;

  const ids = []; let page = '';
  do {
    const pl = await http(`${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${page ? '&pageToken=' + page : ''}&key=${key}`);
    pl.items.forEach(it => ids.push(it.contentDetails.videoId));
    page = pl.nextPageToken || '';
  } while (page && ids.length < 1000);
  for (const inc of cfg.include) { const id = typeof inc === 'string' ? inc : inc.id; if (isValidId(id) && !ids.includes(id)) ids.push(id); }

  const items = [], skipped = [];
  for (let i = 0; i < ids.length; i += 50) {
    const vs = await http(`${API}/videos?part=contentDetails,status,snippet,statistics,liveStreamingDetails&id=${ids.slice(i, i + 50).join(',')}&key=${key}`);
    for (const v of vs.items) {
      const dur = isoDur(v.contentDetails.duration);
      if (v.status.privacyStatus !== 'public') { skipped.push(`${v.id} ${v.snippet.title.slice(0, 40)} — não é público`); continue; }
      if (v.snippet.liveBroadcastContent !== 'none') { skipped.push(`${v.id} ${v.snippet.title.slice(0, 40)} — live/agendado`); continue; }
      if (!dur) { skipped.push(`${v.id} — sem duração`); continue; }
      const text = v.snippet.title + ' ' + (v.snippet.description || '');
      items.push({
        id: v.id, title: v.snippet.title, published: v.snippet.publishedAt.slice(0, 10), dur,
        type: v.liveStreamingDetails ? 'live' : (dur <= 60 || /#shorts?\b/i.test(text) ? 'short' : 'video'),
        embeddable: !!v.status.embeddable,
        ageRestricted: v.contentDetails.contentRating?.ytRating === 'ytAgeRestricted',
        views: v.statistics?.viewCount != null ? Number(v.statistics.viewCount) : undefined,
        description: shortText(v.snippet.description),
        tags: uniq([...(v.snippet.tags || []).map(t => t.toLowerCase()), ...hashtags(text)]).slice(0, 10),
      });
    }
  }
  return { items, skipped, channelTitle: channel.snippet.title, complete: true };
}

/** Fonte 2: RSS público + duração da página pública do vídeo (sem chave; best-effort). */
async function fromRss(cfg, known) {
  if (!cfg.channelId) throw new Error('modo RSS precisa de "channelId" em tv/tv.config.json');
  const xml = await http(`https://www.youtube.com/feeds/videos.xml?channel_id=${cfg.channelId}`, { json: false });
  const channelTitle = decodeXml((/<title>([^<]*)<\/title>/.exec(xml) || [])[1] || '');
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => {
    const e = m[1]; const get = re => (re.exec(e) || [])[1] || '';
    return {
      id: get(/<yt:videoId>([^<]+)</), published: get(/<published>([^<]+)</).slice(0, 10),
      title: decodeXml(get(/<title>([^<]*)</)), short: /\/shorts\//.test(get(/<link rel="alternate" href="([^"]+)"/)),
      description: decodeXml(get(/<media:description>([\s\S]*?)<\/media:description>/)),
      views: get(/<media:statistics views="(\d+)"/),
    };
  });
  if (!entries.length) throw new Error('feed RSS vazio');

  const items = [], skipped = [];
  for (const e of entries) {
    const k = known.get(e.id);
    let dur = k?.dur, embeddable = k?.embeddable ?? true;
    if (!dur || flag('refresh')) {
      try {
        const html = await http(`https://www.youtube.com/watch?v=${e.id}&hl=pt-BR`, { json: false, headers: { Cookie: 'CONSENT=YES+cb; SOCS=CAI' } });
        if (/"isLive":true|"isUpcoming":true/.test(html)) { skipped.push(`${e.id} — live/agendado`); continue; }
        embeddable = !/"playableInEmbed":false/.test(html);
        dur = +((/"lengthSeconds":"(\d+)"/.exec(html) || [])[1] || 0);
      } catch (err) { skipped.push(`${e.id} — duração não obtida (${err.message})`); if (!k) continue; }
    }
    if (!dur) { skipped.push(`${e.id} ${e.title.slice(0, 40)} — duração não encontrada na página`); continue; }
    items.push({
      id: e.id, title: e.title, published: e.published, dur,
      type: e.short ? 'short' : (k?.type === 'live' ? 'live' : 'video'),
      embeddable, ageRestricted: false,
      views: e.views ? Number(e.views) : k?.views,
      description: shortText(e.description),
      tags: uniq([...(k?.tags || []), ...hashtags(e.title + ' ' + e.description)]).slice(0, 10),
    });
  }
  return { items, skipped, channelTitle, complete: false };
}

// ---------------------------------------------------------------------
function buildTv(pool, cfg, skipped) {
  const out = [];
  for (const v of pool) {
    const why = cfg.exclude.includes(v.id) ? 'excluído na config' :
      v.type === 'short' ? 'Short' : !v.embeddable ? 'não permite incorporação' : v.ageRestricted ? 'restrição de idade' :
      v.dur < cfg.minDurationSec ? `curto (${v.dur}s)` : v.dur > cfg.maxDurationSec ? `longo demais (${fmtDur(v.dur)})` : '';
    if (why) { skipped.push(`TV: ${v.id} ${String(v.title).slice(0, 40)} — ${why}`); continue; }
    out.push({ id: v.id, title: v.title, dur: v.dur, published: v.published });
  }
  out.sort((a, b) => (cfg.order === 'oldest' ? 1 : -1) * String(a.published || '').localeCompare(String(b.published || '')));
  return out.slice(0, cfg.maxVideos);
}
function buildCatalog(pool, cfg) {
  const ex = cfg.catalog.exclude || [];
  return pool.filter(v => !ex.includes(v.id))
    .sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')))
    .slice(0, cfg.catalog.maxVideos)
    .map(v => {
      const o = { id: v.id, title: v.title, published: v.published, dur: v.dur, type: v.type,
                  game: (cfg.catalog.games || {})[v.id] || gameOf(v.title), tags: v.tags || [],
                  description: v.description || '', embeddable: v.embeddable !== false, thumb: thumbOf(v.id) };
      if (Number.isFinite(v.views)) o.views = v.views;
      return o;
    });
}

/** grava só se a lista mudou (ignora o carimbo "updated"; visualizações só contam com --stats) */
async function writeIfChanged(file, current, next, keys) {
  const pick = list => JSON.stringify(videosOf(list).map(v => keys.map(k => v[k])));
  const same = pick(current) === pick(next.videos) && current.source === next.source && JSON.stringify(current.channel) === JSON.stringify(next.channel);
  if (same && current.updated) next.updated = current.updated;
  const text = JSON.stringify(next, null, 2) + '\n';
  if (flag('dry')) { console.log(`--- ${rel(file)}\n` + text.slice(0, 1500) + (text.length > 1500 ? '\n…' : '')); return false; }
  if (same) { log(`${rel(file)}: sem mudanças.`); return false; }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, 'utf8');
  log(`${rel(file)}: atualizado.`);
  return true;
}

async function sync() {
  const cfg = { minDurationSec: 61, maxDurationSec: 10800, maxVideos: 60, order: 'newest', exclude: [], include: [], ...(await readJSON(FILES.config, {})) };
  cfg.catalog = { maxVideos: 500, exclude: [], ...(cfg.catalog || {}) };
  const only = opt('only');
  const curTv = await readJSON(FILES.tv, { videos: [] });
  const curCat = await readJSON(FILES.videos, { videos: [] });

  // tudo o que já conhecemos (catálogo + TV): base para o modo RSS e para não perder vídeos antigos
  const known = new Map();
  for (const v of videosOf(curTv)) if (isValidId(String(v.id)) && v.dur > 0) known.set(v.id, { type: 'video', embeddable: true, ...v });
  for (const v of videosOf(curCat)) if (isValidId(String(v.id)) && v.dur > 0) known.set(v.id, { ...known.get(v.id), ...v });

  const key = process.env.YOUTUBE_API_KEY;
  const source = opt('source') || (key ? 'api' : 'rss');
  if (source === 'api' && !key) fail(2, 'defina a variável YOUTUBE_API_KEY para usar --source api');
  log(`fonte: ${source === 'api' ? 'YouTube Data API' : 'RSS público (sem chave)'} • canal ${cfg.handle || ''} ${cfg.channelId || ''}`);

  let r;
  try { r = source === 'api' ? await fromApi(cfg, key) : await fromRss(cfg, known); }
  catch (e) { fail(2, `não foi possível buscar os vídeos: ${e.message}. Arquivos mantidos como estão.`); }

  // pool final: API = fonte da verdade (+ includes); RSS = recentes + os já conhecidos
  const pool = new Map(r.items.map(v => [v.id, v]));
  if (!r.complete) for (const [id, v] of known) if (!pool.has(id)) pool.set(id, v);
  for (const inc of cfg.include) if (typeof inc === 'object' && isValidId(inc.id) && inc.dur > 0 && !pool.has(inc.id))
    pool.set(inc.id, { type: 'video', embeddable: true, tags: [], description: '', ...inc });
  const all = [...pool.values()];

  const tvVideos = buildTv(all, cfg, r.skipped);
  const catalog = buildCatalog(all, cfg);
  r.skipped.forEach(s => log('  ignorado:', s));

  if (!catalog.length || (!tvVideos.length && only !== 'videos')) fail(2, 'a busca retornou 0 vídeos válidos. Arquivos mantidos como estão.');
  const prevTv = videosOf(curTv).length;
  if (r.complete && prevTv >= 6 && tvVideos.length < prevTv / 2 && !flag('force'))
    fail(2, `a TV teria ${tvVideos.length} vídeos contra ${prevTv} atuais (queda > 50%). Use --force se for intencional.`);

  const channel = { id: cfg.channelId, handle: cfg.handle, title: r.channelTitle || curTv.channel?.title || '' };
  const srcName = source === 'api' ? 'youtube-api' : 'rss';
  const now = new Date().toISOString();
  log(`TV: ${tvVideos.length} vídeos • ${fmtDur(tvVideos.reduce((s, v) => s + v.dur, 0))} • catálogo: ${catalog.length} vídeos`);

  if (only !== 'videos') await writeIfChanged(FILES.tv, curTv, {
    channel, source: srcName, updated: now, count: tvVideos.length,
    totalSeconds: tvVideos.reduce((s, v) => s + v.dur, 0), videos: tvVideos,
  }, ['id', 'title', 'dur']);
  if (only !== 'tv') await writeIfChanged(FILES.videos, curCat, {
    channel, source: srcName, updated: now, count: catalog.length, videos: catalog,
  }, ['id', 'title', 'dur', 'type', 'game', 'embeddable', 'description', ...(flag('stats') ? ['views'] : [])]);
}

async function check() {
  let errors = [];
  const tv = validate(await readJSON(FILES.tv), 'tv/playlist.json');
  const cat = validate(await readJSON(FILES.videos, { videos: [] }), 'data/videos.json');
  for (const r of [tv, cat]) { r.warnings.forEach(w => log('aviso:', w)); errors.push(...r.errors); }
  if (flag('online')) {
    for (const v of tv.list) {
      if (!isValidId(String(v.id))) continue;
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v.id)}`, { headers: { 'User-Agent': UA } });
      if (res.status === 401 || res.status === 403) errors.push(`TV ${v.id} "${v.title}": não permite incorporação`);
      else if (!res.ok) errors.push(`TV ${v.id} "${v.title}": não encontrado/indisponível (HTTP ${res.status})`);
    }
  }
  if (errors.length) { errors.forEach(e => console.error('[canal] ERRO:', e)); process.exit(1); }
  const total = tv.list.reduce((s, v) => s + v.dur, 0);
  log(`OK: TV ${tv.list.length} vídeos (${fmtDur(total)})${flag('online') ? ', todos incorporáveis' : ''} • catálogo ${cat.list.length} vídeos`);
}

const cmds = { sync, check };
if (!cmds[cmd]) {
  console.log('uso: node scripts/tv-playlist.mjs <sync|check> [--dry] [--only tv|videos] [--stats] [--online] [--source api|rss] [--refresh] [--force]');
  process.exit(cmd === 'help' ? 0 : 1);
}
cmds[cmd]().catch(e => fail(2, e.message));
