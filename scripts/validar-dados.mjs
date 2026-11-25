#!/usr/bin/env node
/* Valida os dados do site (Node 18+, sem dependências).
 *   node scripts/validar-dados.mjs
 * Sai com 0 se tudo estiver válido e 1 (listando arquivo + erro) se algo estiver errado.
 * Também é importado por scripts/publicar.mjs. */
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gerar } from './gerar-geo.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EVENT_TYPES = ['live', 'launch', 'tour', 'rec'];
const ID_RE = /^[\w-]{1,60}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_BR = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?-03:00$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SAFE_PATH = /^assets\/[\w\/.-]+$/;
const YT_URL = /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]+$/i;

const isStr = v => typeof v === 'string' && v.trim() !== '';
const exists = p => access(path.join(ROOT, p)).then(() => true, () => false);

/** data/hora real? (rejeita 2026-02-31, 25:00 etc.) */
function validDate(y, mo, d, h = 0, mi = 0) {
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +mo - 1 && dt.getUTCDate() === +d && +h < 24 && +mi < 60;
}
export function isoBr(v) {
  const m = ISO_BR.exec(String(v));
  return !!m && validDate(m[1], m[2], m[3], m[4], m[5]) && (m[6] === undefined || +m[6] < 60);
}
export function isoDate(v) {
  const m = ISO_DATE.exec(String(v));
  return !!m && validDate(m[1], m[2], m[3]);
}

async function readJson(file, errs) {
  try { return JSON.parse((await readFile(path.join(ROOT, file), 'utf8')).replace(/^﻿/, '')); }
  catch (e) { errs.push(`${file}: ${e.code === 'ENOENT' ? 'arquivo não encontrado' : 'JSON inválido (' + e.message + ')'}`); return null; }
}

async function checkAgenda(errs) {
  const f = 'data/agenda.json';
  const d = await readJson(f, errs); if (!d) return;
  if (!Array.isArray(d.events) || !d.events.length) return errs.push(`${f}: "events" deve ser uma lista com ao menos 1 evento`);
  const ids = new Set(); let prev = -Infinity;
  d.events.forEach((e, i) => {
    const at = `${f}: events[${i}]${e && e.id ? ` (${e.id})` : ''}`;
    if (!e || typeof e !== 'object') return errs.push(`${at}: não é um objeto`);
    if (!ID_RE.test(String(e.id))) errs.push(`${at}: "id" ausente ou inválido (use letras, números, - e _)`);
    else if (ids.has(e.id)) errs.push(`${at}: "id" duplicado`); else ids.add(e.id);
    for (const k of ['title', 'game', 'where', 'desc']) if (!isStr(e[k])) errs.push(`${at}: "${k}" ausente ou vazio`);
    if (!EVENT_TYPES.includes(e.type)) errs.push(`${at}: "type" deve ser ${EVENT_TYPES.join(' | ')} (veio ${JSON.stringify(e.type)})`);
    if (!EVENT_TYPES.includes(e.color)) errs.push(`${at}: "color" deve ser ${EVENT_TYPES.join(' | ')} (veio ${JSON.stringify(e.color)})`);
    const okS = isoBr(e.start), okE = isoBr(e.end);
    if (!okS) errs.push(`${at}: "start" deve ser ISO com fuso -03:00, ex. 2026-12-05T20:00:00-03:00 (veio ${JSON.stringify(e.start)})`);
    if (!okE) errs.push(`${at}: "end" deve ser ISO com fuso -03:00, ex. 2026-12-05T22:00:00-03:00 (veio ${JSON.stringify(e.end)})`);
    if (okS && okE) {
      const s = Date.parse(e.start), en = Date.parse(e.end);
      if (!(en > s)) errs.push(`${at}: "end" deve ser posterior a "start"`);
      if (s < prev) errs.push(`${at}: fora de ordem cronológica (start anterior ao evento acima)`);
      prev = Math.max(prev, s);
    }
  });
  if (!isoDate(d.updated)) errs.push(`${f}: "updated" deve ser AAAA-MM-DD`);
}

async function checkCanais(errs) {
  const f = 'data/canais.json';
  const d = await readJson(f, errs); if (!d) return;
  if (!d.cortes || typeof d.cortes !== 'object') return errs.push(`${f}: falta o objeto "cortes"`);
  const u = d.cortes.url;
  if (typeof u !== 'string') errs.push(`${f}: cortes.url deve ser texto ("" ou URL https do YouTube)`);
  else if (u !== '') {
    if (u !== u.trim()) errs.push(`${f}: cortes.url tem espaços nas pontas`);
    else if (!YT_URL.test(u)) errs.push(`${f}: cortes.url inválida (${u}) — use https://www.youtube.com/@handle`);
    else { try { new URL(u); } catch { errs.push(`${f}: cortes.url não é uma URL válida (${u})`); } }
  }
}

async function checkCanal(errs) {
  const f = 'data/canal.json';
  const d = await readJson(f, errs); if (!d) return;
  if (!d.channel || !isStr(d.channel.id) || !isStr(d.channel.handle)) errs.push(`${f}: "channel.id" e "channel.handle" são obrigatórios`);
  else if (d.channel.url && !YT_URL.test(d.channel.url)) errs.push(`${f}: channel.url inválida (${d.channel.url})`);
  if (!d.stats || typeof d.stats !== 'object') errs.push(`${f}: falta "stats"`);
}

async function checkProdutos(errs) {
  const f = 'data/produtos.json';
  const d = await readJson(f, errs); if (!d) return;
  if (d.currency !== 'BRL') errs.push(`${f}: "currency" deve ser "BRL"`);
  if (!Array.isArray(d.products) || !d.products.length) return errs.push(`${f}: "products" deve ser uma lista com ao menos 1 item`);
  const ids = new Set();
  for (const [i, p] of d.products.entries()) {
    const at = `${f}: products[${i}]${p && p.id ? ` (${p.id})` : ''}`;
    if (!p || typeof p !== 'object') { errs.push(`${at}: não é um objeto`); continue; }
    if (!/^[\w-]{1,40}$/.test(String(p.id))) errs.push(`${at}: "id" ausente ou inválido`);
    else if (ids.has(p.id)) errs.push(`${at}: "id" duplicado`); else ids.add(p.id);
    for (const k of ['title', 'desc', 'category']) if (!isStr(p[k])) errs.push(`${at}: "${k}" ausente ou vazio`);
    if (typeof p.price !== 'number' || !(p.price > 0) || Math.round(p.price * 100) / 100 !== p.price) errs.push(`${at}: "price" deve ser número > 0 com no máximo 2 casas (veio ${JSON.stringify(p.price)})`);
    if (!isStr(p.img) || !SAFE_PATH.test(p.img)) errs.push(`${at}: "img" deve ser um caminho assets/... (veio ${JSON.stringify(p.img)})`);
    else if (!(await exists(p.img))) errs.push(`${at}: imagem não existe no disco: ${p.img}`);
    if (p.options !== undefined) {
      for (const k of ['tamanho', 'cor']) if (p.options[k] !== undefined && (!Array.isArray(p.options[k]) || !p.options[k].length || !p.options[k].every(isStr))) errs.push(`${at}: options.${k} deve ser lista de textos não vazios`);
    }
  }
}

async function checkPosts(errs) {
  const f = 'posts/index.json';
  const d = await readJson(f, errs); if (!d) return;
  if (!Array.isArray(d.posts)) return errs.push(`${f}: "posts" deve ser uma lista`);
  const slugs = new Set();
  for (const [i, p] of d.posts.entries()) {
    const at = `${f}: posts[${i}]${p && p.slug ? ` (${p.slug})` : ''}`;
    if (!p || typeof p !== 'object') { errs.push(`${at}: não é um objeto`); continue; }
    if (!SLUG_RE.test(String(p.slug))) errs.push(`${at}: "slug" inválido (minúsculas, números e hífens)`);
    else if (slugs.has(p.slug)) errs.push(`${at}: "slug" duplicado`); else slugs.add(p.slug);
    for (const k of ['title', 'excerpt', 'category', 'game', 'platform', 'author']) if (!isStr(p[k])) errs.push(`${at}: "${k}" ausente ou vazio`);
    if (!isoDate(p.dateISO)) errs.push(`${at}: "dateISO" deve ser AAAA-MM-DD válido (veio ${JSON.stringify(p.dateISO)})`);
    if (!Number.isInteger(p.readMin) || p.readMin < 1) errs.push(`${at}: "readMin" deve ser inteiro >= 1`);
    if (!Number.isInteger(p.views) || p.views < 0) errs.push(`${at}: "views" deve ser inteiro >= 0`);
    if (!Array.isArray(p.tags) || !p.tags.every(isStr)) errs.push(`${at}: "tags" deve ser lista de textos`);
    if (!isStr(p.cover) || !SAFE_PATH.test(p.cover)) errs.push(`${at}: "cover" deve ser um caminho assets/...`);
    else if (!(await exists(p.cover))) errs.push(`${at}: capa não existe no disco: ${p.cover}`);
    if (!isStr(p.file) || !/^[\w-]+\.md$/.test(p.file)) errs.push(`${at}: "file" deve ser um nome .md simples (veio ${JSON.stringify(p.file)})`);
    else if (!(await exists('posts/' + p.file))) errs.push(`${at}: arquivo não existe no disco: posts/${p.file}`);
  }
}

/** Retorna a lista de erros (vazia = tudo válido). */
export async function validar() {
  const errs = [];
  await checkAgenda(errs); await checkCanais(errs); await checkCanal(errs); await checkProdutos(errs); await checkPosts(errs);
  // GEO/AEO: llms.txt, llms-full.txt e JSON-LD (Organization, vídeos, jogos) precisam refletir os dados atuais
  if (!errs.length) { try { const stale = await gerar({ write: false }); if (stale.length) errs.push(`GEO desatualizado (${stale.join(', ')}): rode node scripts/gerar-geo.mjs`); } catch (e) { errs.push('gerar-geo: ' + e.message); } }
  return errs;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errs = await validar();
  if (errs.length) { console.error(`✗ ${errs.length} problema(s) encontrado(s):\n` + errs.map(e => '  - ' + e).join('\n')); process.exit(1); }
  console.log('✓ data/agenda.json, data/canais.json, data/canal.json, data/produtos.json e posts/index.json estão válidos.');
}
