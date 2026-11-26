#!/usr/bin/env node
/* Gera um par de chaves VAPID (Web Push) sem dependências.
 *   node scripts/gerar-vapid.mjs
 * - A chave PÚBLICA vai em data/notificacoes.json (campo vapidPublicKey).
 * - A chave PRIVADA fica só no seu servidor / secret do GitHub. NUNCA a coloque no repositório.
 * Este script apenas imprime as chaves no terminal; não grava nada em disco. */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const prv = privateKey.export({ format: 'jwk' });
const b64u = b => Buffer.from(b).toString('base64url');
const publicRaw = Buffer.concat([Buffer.from([0x04]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]); // ponto não comprimido (65 bytes)

console.log('VAPID_PUBLIC_KEY  (vai em data/notificacoes.json -> vapidPublicKey):');
console.log(b64u(publicRaw));
console.log('\nVAPID_PRIVATE_KEY (guarde como SECRET; não commite):');
console.log(prv.d);
console.log('\nPróximos passos: scripts/NOTIFICACOES.md');
