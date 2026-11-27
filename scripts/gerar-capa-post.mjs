#!/usr/bin/env node
/* Gera a capa (og:image, 1200x630 PNG) de um post do blog com a identidade do Flloydinn.
 *
 *   import { gerarCapa } from './gerar-capa-post.mjs';
 *   await gerarCapa({ slug, title, category, dateFormatted });   // grava assets/blog/<slug>.png e devolve 'assets/blog/<slug>.png'
 *
 *   node scripts/gerar-capa-post.mjs <slug> "Título" "Categoria" "27 nov 2026"   # teste manual
 *
 * O desenho é um SVG renderizado pelo `sharp`. Como o texto é desenhado pelo sistema, a fonte vem da lista
 * "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" (no Ubuntu do GitHub Actions existem DejaVu/Liberation;
 * o workflow ainda instala fonts-dejavu-core e fonts-liberation para garantir). Sem dependências além do sharp. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CAPAS_DIR = 'assets/blog';
export const LARGURA = 1200, ALTURA = 630;
const FONTE = "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** escapa os 5 caracteres especiais do XML e remove caracteres de controle */
export const esc = s => String(s == null ? '' : s)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** largura estimada (px) de um texto em negrito: letras largas/maiúsculas pesam mais. Conservadora, para nunca estourar a margem. */
function largura(txt, px) {
  let w = 0;
  for (const ch of txt) {
    if (/[ijlI.,:;!'|]/.test(ch)) w += 0.34;
    else if (ch === ' ') w += 0.36;
    else if (/[MWmw@%]/.test(ch)) w += 0.98;
    else if (/[A-Z0-9]/.test(ch)) w += 0.80;
    else w += 0.68;                                              // DejaVu Sans Bold (a mais larga da lista) como referência
  }
  return w * px;
}

/** quebra o título em linhas que cabem em `max` px; devolve null se passar de `maxLinhas` */
function quebrar(titulo, px, max, maxLinhas) {
  const palavras = titulo.split(/\s+/).filter(Boolean);
  const linhas = []; let atual = '';
  for (const p of palavras) {
    const teste = atual ? atual + ' ' + p : p;
    if (largura(teste, px) <= max) { atual = teste; continue; }
    if (atual) linhas.push(atual);
    atual = p;                                                    // palavra gigante sozinha: cortada abaixo
    while (largura(atual, px) > max && atual.length > 1) atual = atual.slice(0, -1);
  }
  if (atual) linhas.push(atual);
  return linhas.length <= maxLinhas ? linhas : null;
}

/** escolhe o maior tamanho de fonte que deixa o título em até 4 linhas; se nem o menor couber, corta com reticências */
export function ajustarTitulo(titulo, max = 1056) {
  const t = String(titulo || '').replace(/\s+/g, ' ').trim() || 'Blog Flloydinn';
  for (const px of [72, 64, 58, 52, 46]) {
    const l = quebrar(t, px, max, px >= 58 ? 3 : 4);
    if (l) return { px, linhas: l };
  }
  const px = 46;
  const l = quebrar(t, px, max, 999).slice(0, 4);
  while (l.length && largura(l[3] + '…', px) > max) l[3] = l[3].slice(0, -1).trimEnd();
  l[3] = (l[3] || '') + '…';
  return { px, linhas: l };
}

/** monta o SVG (puro; não grava nada). Exportado para testes. */
export function montarSvg({ title, category, dateFormatted }) {
  const { px, linhas } = ajustarTitulo(title);
  const lh = Math.round(px * 1.16);
  const blocoAltura = lh * linhas.length;
  const yIni = 150 + 330 / 2 - blocoAltura / 2 + px * 0.82;        // centraliza o bloco do título na área central (150..480)
  const badge = `${String(category || 'Blog').toUpperCase()} • BLOG FLLOYDINN`.slice(0, 40);
  const larguraBadge = Math.round(largura(badge, 22) * 0.92 + 48);

  // filmstrip: faixa escura com furos (perfurações), em cima e embaixo
  const furos = (y) => {
    let s = '';
    for (let x = 18; x < LARGURA; x += 44) s += `<rect x="${x}" y="${y}" width="22" height="14" rx="3" fill="#0a0a0a" stroke="#2a2a2a" stroke-width="1"/>`;
    return s;
  };
  const linhasSvg = linhas.map((l, i) =>
    `<text x="72" y="${Math.round(yIni + i * lh)}" font-family="${FONTE}" font-weight="bold" font-size="${px}" fill="#ffffff">${esc(l)}</text>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}" viewBox="0 0 ${LARGURA} ${ALTURA}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a0a0a"/><stop offset="1" stop-color="#141414"/></linearGradient>
    <radialGradient id="glow" cx="1" cy="1" r="0.75"><stop offset="0" stop-color="#990000" stop-opacity="0.38"/><stop offset="1" stop-color="#990000" stop-opacity="0"/></radialGradient>
    <pattern id="tex" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1" height="8" fill="#ffffff" fill-opacity="0.025"/></pattern>
    <linearGradient id="barra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cc0000"/><stop offset="1" stop-color="#990000"/></linearGradient>
  </defs>
  <rect width="${LARGURA}" height="${ALTURA}" fill="url(#bg)"/>
  <rect width="${LARGURA}" height="${ALTURA}" fill="url(#tex)"/>
  <rect width="${LARGURA}" height="${ALTURA}" fill="url(#glow)"/>
  <!-- filmstrip superior e inferior -->
  <rect x="0" y="0" width="${LARGURA}" height="50" fill="#101010"/>
  <rect x="0" y="49" width="${LARGURA}" height="2" fill="#990000"/>
  ${furos(18)}
  <rect x="0" y="${ALTURA - 50}" width="${LARGURA}" height="50" fill="#101010"/>
  <rect x="0" y="${ALTURA - 51}" width="${LARGURA}" height="2" fill="#990000"/>
  ${furos(ALTURA - 32)}
  <!-- barra lateral vermelha e borda -->
  <rect x="0" y="51" width="14" height="${ALTURA - 102}" fill="url(#barra)"/>
  <rect x="1.5" y="1.5" width="${LARGURA - 3}" height="${ALTURA - 3}" fill="none" stroke="#990000" stroke-opacity="0.55" stroke-width="3"/>
  <!-- badge da categoria -->
  <rect x="72" y="84" width="${larguraBadge}" height="44" rx="6" fill="#cc0000"/>
  <text x="${72 + larguraBadge / 2}" y="114" text-anchor="middle" font-family="${FONTE}" font-weight="bold" font-size="22" letter-spacing="1" fill="#ffffff">${esc(badge)}</text>
  <!-- título -->
  ${linhasSvg}
  <!-- rodapé -->
  <rect x="72" y="${ALTURA - 112}" width="120" height="4" fill="#cc0000"/>
  <text x="72" y="${ALTURA - 72}" font-family="${FONTE}" font-weight="bold" font-size="26" fill="#ffffff">FLLOYDINN <tspan fill="#cc0000">•</tspan> flloydinn.netlify.app</text>
  ${dateFormatted ? `<text x="${LARGURA - 72}" y="${ALTURA - 72}" text-anchor="end" font-family="${FONTE}" font-weight="bold" font-size="24" fill="#bdbdbd">${esc(dateFormatted)}</text>` : ''}
</svg>`;
}

/** "2026-11-27" -> "27 nov 2026" */
export function formatarData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${+m[3]} ${meses[+m[2] - 1] || ''} ${m[1]}`;
}

/** Gera assets/blog/<slug>.png. Devolve o caminho relativo ao site. Lança erro se o slug for inválido ou o PNG não sair. */
export async function gerarCapa({ slug, title, category, dateFormatted }) {
  if (!SLUG_RE.test(String(slug))) throw new Error(`slug inválido para a capa: ${JSON.stringify(slug)}`);
  const rel = `${CAPAS_DIR}/${slug}.png`;
  const { default: sharp } = await import('sharp');   // carregado só aqui: --dry-run e as validações não precisam do sharp instalado
  const png = await sharp(Buffer.from(montarSvg({ title, category, dateFormatted }))).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== LARGURA || meta.height !== ALTURA) throw new Error(`capa com tamanho inesperado (${meta.width}x${meta.height})`);
  await mkdir(path.join(ROOT, CAPAS_DIR), { recursive: true });
  await writeFile(path.join(ROOT, rel), png);
  return rel;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [slug, title, category, data] = process.argv.slice(2);
  if (!slug || !title) { console.error('uso: node scripts/gerar-capa-post.mjs <slug> "Título" "Categoria" "27 nov 2026"'); process.exit(1); }
  gerarCapa({ slug, title, category: category || 'Games', dateFormatted: data || '' })
    .then(p => console.log('✓ capa gerada:', p)).catch(e => { console.error('✗', e.message); process.exit(1); });
}
