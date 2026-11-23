# Playlist da TV 24/7 (`tv/playlist.json`)

Formato (JSON puro, sem comentários):

```json
[
  { "id": "CYbAoKRh8JA", "title": "Trailer do Canal", "dur": 120 }
]
```

- `id`: ID do vídeo no YouTube (11 caracteres, ex.: `youtube.com/watch?v=`**`CYbAoKRh8JA`**).
- `title`: título exibido na grade.
- `dur`: duração **exata em segundos** (ex.: 14min05s = 845). Se estiver errada, a grade "pula" ou corta o fim do vídeo.

Itens com ID inválido ou placeholder (ex.: `xxxxxxxxxxx`) ou sem `dur` são ignorados e geram um aviso no console.
A programação é calculada a partir de `EPOCH` em `tv.html`; todos os visitantes veem o mesmo vídeo no mesmo instante, em qualquer fuso.
Alterações no arquivo são recarregadas automaticamente a cada 5 minutos.
