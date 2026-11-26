# Avisos de novos vídeos (notificações)

## O que já funciona (só front-end, sem servidor)
- Botão **"Ativar avisos de vídeos"** em `videos.html` e `canais.html` (`js/notificacoes.js`).
- A permissão é pedida só quando a pessoa clica. A preferência fica em `FlloydStore` (`fll_notif_on`).
- **Modo local:** a cada abertura do site (no máximo 1 vez por hora, `checkIntervalMin`), o navegador compara
  `data/videos.json` com os vídeos já vistos (`fll_notif_seen`). Se houver vídeo novo, mostra a notificação.
  Ao ativar, os vídeos que já existem são marcados como vistos (nada de aviso de vídeo antigo).
- `sw.js` trata `push` e `notificationclick`: o clique abre o vídeo (`/videos.html?v=ID`) ou `/videos.html`.
  Só links do próprio site ou do YouTube são abertos.
- Estados tratados com mensagem clara: permitido, negado/bloqueado (com passo a passo), sem suporte
  a `Notification`/service worker e contexto sem https.

**Limite real:** no modo local o aviso só aparece **quando a pessoa abre o site**. Um site estático não consegue
acordar o navegador sozinho. Para avisar com o site fechado é preciso Push + um servidor (abaixo).
No iPhone/iPad, notificações web só existem com o site instalado na Tela de Início (iOS 16.4+).

## O que falta para avisar com o site fechado (depende de você)
Nada abaixo está pronto nem tem chave, endpoint ou URL no repositório.

1. **Chaves VAPID:** `node scripts/gerar-vapid.mjs`.
   - Chave pública → `data/notificacoes.json` → `vapidPublicKey`.
   - Chave privada → secret (GitHub Actions e/ou variável da função). Nunca no repositório.
2. **Endpoint que guarda as inscrições** (`subscribeEndpoint`, URL `https`). Recebe `POST` com
   `{ "subscription": { endpoint, keys }, "channel": "@flloydinn" }` e salva a inscrição num armazenamento
   (por exemplo uma Netlify Function + Netlify Blobs, ou um banco gerenciado). Deve aceitar só a origem do site
   e não pode confiar no conteúdo recebido.
3. **Gatilho de vídeo novo:** o workflow `.github/workflows/tv-playlist.yml` já roda todo dia às 06:17 (BRT) e atualiza
   `data/videos.json`. Acrescente um passo que, quando houver id novo, leia as inscrições e envie o push
   (biblioteca `web-push` do npm, usando as chaves VAPID e um e-mail de contato `mailto:`). Para avisos mais rápidos
   que 1 dia, aumente a frequência do cron (ou use o WebSub/PubSubHubbub do YouTube apontando para uma função).
4. **Limpeza:** remova inscrições que respondam 404/410.
5. Preencha os dois campos em `data/notificacoes.json` e rode `node scripts/validar-dados.mjs`.

### Formato do push que o `sw.js` espera
```json
{ "title": "Vídeo novo no Flloydinn", "body": "Título do vídeo", "url": "/videos.html?v=ID_DO_VIDEO", "tag": "novo-video" }
```
Sem os dois campos preenchidos, o site **não envia nada para fora do navegador**.

## Testar
- No site: ative os avisos e use **"Enviar teste"** (aparece depois de ativar). Clicar na notificação abre `/videos.html`.
- Para simular vídeo novo: apague o id mais recente da lista salva (`fll_notif_seen`) e chame `FlloydNotify.check()` no console.
