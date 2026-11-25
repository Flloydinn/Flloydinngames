#!/usr/bin/env node
/* Assistente para publicar post no blog ou evento na agenda (Node 18+, sem dependências).
 *   node scripts/publicar.mjs
 * Depois de gravar, roda a mesma validação de scripts/validar-dados.mjs. */
import { readFile, writeFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { ROOT, EVENT_TYPES, validar, isoDate } from './validar-dados.mjs';

const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator](); // lê linha a linha (funciona no terminal e com entrada redirecionada)
const ask = async (q, def = '') => {
  process.stdout.write(def ? `${q} [${def}]: ` : `${q}: `);
  const { value, done } = await lines.next();
  if (done) { console.log(); throw new Error('entrada encerrada antes de terminar'); }
  return String(value).trim() || def;
};
const askReq = async (q, def = '') => { for (;;) { const v = await ask(q, def); if (v) return v; console.log('  (obrigatório)'); } };
const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // data em Brasília
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const exists = p => access(path.join(ROOT, p)).then(() => true, () => false);
const readJson = async f => JSON.parse((await readFile(path.join(ROOT, f), 'utf8')).replace(/^﻿/, ''));
const saveJson = (f, d) => writeFile(path.join(ROOT, f), JSON.stringify(d, null, 2) + '\n', 'utf8');

async function askDate(q, def) { for (;;) { const v = await ask(q, def); if (isoDate(v)) return v; console.log('  use AAAA-MM-DD, ex. 2026-12-05'); } }
async function askTime(q, def) { for (;;) { const v = await ask(q, def); const m = /^(\d{1,2}):(\d{2})$/.exec(v); if (m && +m[1] < 24 && +m[2] < 60) return `${m[1].padStart(2, '0')}:${m[2]}`; console.log('  use HH:MM, ex. 20:00'); } }

async function novoPost() {
  const idx = await readJson('posts/index.json');
  const title = await askReq('Título');
  let slug;
  for (;;) {
    slug = await ask('Slug', slugify(title));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) console.log('  slug inválido (minúsculas, números e hífens)');
    else if (idx.posts.some(p => p.slug === slug) || await exists(`posts/${slug}.md`)) console.log('  esse slug já existe');
    else break;
  }
  const excerpt = await askReq('Resumo (1–2 frases)');
  const category = await ask('Categoria', 'Análises');
  const tags = (await ask('Tags (separadas por vírgula)', '')).split(',').map(t => t.trim()).filter(Boolean);
  const game = await askReq('Jogo/assunto');
  const platform = await ask('Plataforma', 'PC');
  const dateISO = await askDate('Data (AAAA-MM-DD)', today());
  const readMin = Math.max(1, parseInt(await ask('Tempo de leitura (min)', '5'), 10) || 5);
  let cover;
  for (;;) {
    cover = await ask('Capa (caminho, ex. assets/capa-' + slug + '.jpg)', 'assets/capa-' + slug + '.jpg');
    if (!/^assets\/[\w\/.-]+$/.test(cover)) console.log('  use um caminho dentro de assets/');
    else if (!(await exists(cover))) { console.log(`  ${cover} ainda não existe. Coloque a imagem lá antes de publicar.`); if ((await ask('Continuar mesmo assim? (s/N)', 'n')).toLowerCase() === 's') break; }
    else break;
  }
  const modelo = await readFile(path.join(ROOT, 'posts/MODELO.md'), 'utf8');
  const corpo = modelo.slice(modelo.indexOf('Parágrafo de abertura'));
  const md = `# ${title}\n\n${corpo}`;
  await writeFile(path.join(ROOT, `posts/${slug}.md`), md, 'utf8');
  idx.posts.unshift({ slug, title, excerpt, dateISO, readMin, views: 0, category, tags, game, platform, author: 'Flloydinn', cover, file: `${slug}.md` });
  await saveJson('posts/index.json', idx);
  console.log(`\nCriado posts/${slug}.md e entrada em posts/index.json. Edite o texto e confira em post.html?slug=${slug}`);
}

async function novoEvento() {
  const ag = await readJson('data/agenda.json');
  const title = await askReq('Título');
  let id;
  for (;;) {
    id = await ask('ID (único)', slugify(title));
    if (!/^[\w-]{1,60}$/.test(id)) console.log('  id inválido');
    else if (ag.events.some(e => e.id === id)) console.log('  esse id já existe');
    else break;
  }
  let type;
  for (;;) { type = await ask(`Tipo (${EVENT_TYPES.join('/')})`, 'live'); if (EVENT_TYPES.includes(type)) break; console.log('  tipo inválido'); }
  const game = await askReq('Jogo/tema');
  const date = await askDate('Data (AAAA-MM-DD)', today());
  const t1 = await askTime('Início (HH:MM, Brasília)', '20:00');
  let end, endDate = date;
  for (;;) {
    const t2 = await askTime('Fim (HH:MM, Brasília)', '22:00');
    const next = (await ask('Termina no dia seguinte? (s/N)', 'n')).toLowerCase() === 's';
    endDate = next ? new Date(Date.parse(date + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10) : date;
    end = `${endDate}T${t2}:00-03:00`;
    if (Date.parse(end) > Date.parse(`${date}T${t1}:00-03:00`)) break;
    console.log('  o fim precisa ser depois do início');
  }
  const where = await ask('Local', 'YouTube @flloydinn');
  const desc = await askReq('Descrição');
  ag.events.push({ id, title, type, game, start: `${date}T${t1}:00-03:00`, end, where, desc, color: type });
  ag.events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  ag.updated = today();
  await saveJson('data/agenda.json', ag);
  console.log(`\nEvento "${title}" inserido em data/agenda.json (ordem cronológica).`);
}

try {
  console.log('Publicar no site Flloydinn\n  1) Novo post no blog\n  2) Novo evento na agenda');
  const op = await ask('Escolha', '1');
  if (op === '1') await novoPost(); else if (op === '2') await novoEvento(); else { console.log('Opção inválida.'); process.exitCode = 1; }
  if (op === '1' || op === '2') {
    const errs = await validar();
    if (errs.length) { console.error(`\n✗ Validação encontrou ${errs.length} problema(s):\n` + errs.map(e => '  - ' + e).join('\n')); process.exitCode = 1; }
    else console.log('✓ Validação: tudo certo.');
  }
} catch (e) { console.error('✗ ' + e.message); process.exitCode = 1; } finally { rl.close(); }
