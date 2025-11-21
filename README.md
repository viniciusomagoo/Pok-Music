# Discord Music Bot (yt-dlp + ffmpeg)

Um bot Discord moderno em **discord.js** v14 com suporte a **slash commands** e **comandos prefixo**, streaming de áudio via `yt-dlp` e `ffmpeg`.

## Recursos

- ✅ **Slash commands** modernos (`/play`, `/skip`, `/stop`, `/queue`)
- ✅ **Comandos prefixo** (`!play`, `!skip`, `!stop`, `!queue`)
- ✅ **Extração de metadata** com `yt-dlp -j` (título, duração, etc.)
- ✅ **Persistência de filas** (`queues.json` - carrega filas ao iniciar)
- ✅ **Suporte a múltiplas fontes**: YouTube, Spotify, Apple Music, Deezer (via fallback `ytsearch1`)
- ✅ **Transcodificação de áudio** com `ffmpeg`

## Setup Rápido (Windows / PowerShell)

### 1. Dependências do Sistema

Instale `ffmpeg` e `yt-dlp` e adicione ao `PATH`:

``powershell
# Instalar yt-dlp (via pip)
python -m pip install -U yt-dlp

# Instalar ffmpeg
# Baixe de: https://ffmpeg.org/download.html ou use scoop:
scoop install ffmpeg
``

### 2. Dependências do Node

``powershell
cd "d:\Projetos\BOTS DO DISCORD"
npm install
``

### 3. Configurar Token

Edite `config.json` e substitua `YOUR_BOT_TOKEN_HERE` com seu token real:

``json
{
  "clientId": "1441236789539901470",
  "token": "seu_token_aqui",
  "prefix": "!"
}
``

### 4. Registrar Slash Commands (primeira execução)

``powershell
npm run build
npm run register-commands
``

### 5. Iniciar o Bot

``powershell
npm start
``

## Uso

### Via Slash Commands

``
/play <query>    — Procura e reproduz uma faixa
/skip            — Pula a faixa atual
/stop            — Para a reprodução
/queue           — Mostra as próximas faixas
``

### Via Comandos Prefixo

``
!play <query>    — Procura e reproduz uma faixa
!skip            — Pula a faixa atual
!stop            — Para a reprodução
!queue           — Mostra as próximas faixas
``

## Notas

- **DRM**: Serviços como Spotify / Apple Music / Deezer usam DRM. O bot tenta extrair via `yt-dlp` e faz fallback para pesquisa no YouTube (`ytsearch1:`).
- **Filas persistem**: As filas são salvas em `queues.json` e recarregadas ao iniciar.
- **Segurança**: Não compartilhe seu token publicamente.

## Estrutura

``
bot.ts                  — Código principal do bot
register-commands.ts    — Script para registrar slash commands
config.json             — Configuração (token, clientId, prefix)
queues.json             — Filas persistidas
tsconfig.json          — Config TypeScript
package.json           — Dependências
``

## Troubleshooting

- **"yt-dlp not found"**: Certifique-se de que `yt-dlp` está no PATH.
- **"ffmpeg not found"**: Certifique-se de que `ffmpeg` está no PATH.
- **"Unable to extract playable URL"**: A URL/query é inválida ou o serviço está bloqueando.
