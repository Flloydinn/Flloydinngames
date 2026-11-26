# Como funciona o site do Flloydinn por dentro

O site do Flloydinn é o ponto de encontro dos canais **Flloydinn Gameplay** e **Flloydinn Esporte Clube**, e também da TV 24/7, do Arcade com jogos 3D, da agenda, do blog e da loja. Este texto explica, sem rodeios, como ele foi montado.

## Um site estático, sem login
Todas as páginas são arquivos HTML publicados na Netlify. Não existe conta de usuário nem banco de dados: o que muda com o tempo (agenda, produtos, vídeos, artigos) fica em arquivos JSON dentro das pastas `data/` e `posts/`. Quando um desses arquivos é atualizado, o site acompanha.

## O que fica salvo no seu navegador
Recordes dos jogos, favoritos, histórico de navegação e conquistas ficam só no seu aparelho, no armazenamento local do navegador. Nada disso é enviado para um servidor. Se o navegador bloquear esse armazenamento (modo privado, por exemplo), o site continua funcionando e guarda os dados apenas enquanto a página estiver aberta.

## Instalável e com versão offline
O site é um PWA: dá para instalá-lo no celular ou no computador. Um service worker guarda uma cópia das páginas já visitadas, então elas ainda abrem sem internet. Vídeo do YouTube, claro, continua precisando de conexão.

## Feito para ser encontrado
Cada página tem título, descrição, Open Graph e dados estruturados (JSON-LD). Também existem os arquivos `llms.txt` e `llms-full.txt`, que resumem o site em texto simples para mecanismos de resposta e assistentes de IA. Esses arquivos são gerados por um script a partir dos mesmos dados que alimentam as páginas, para não ficarem desatualizados.

## Cuidado na rotina de publicação
Antes de publicar, um validador confere datas, ids, imagens e a consistência desses arquivos gerados. Um assistente de linha de comando cria posts e eventos já no formato certo.

> O site é um projeto em evolução. Quer sugerir um jogo, um recurso ou uma correção? Use o contato.
