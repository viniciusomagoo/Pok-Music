import { spawn } from 'child_process';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import {
  Client,
  GatewayIntentBits,
  Message,
  BaseInteraction,
  EmbedBuilder,
  ActivityType,
  PresenceUpdateStatus,
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  VoiceConnection,
  AudioPlayer,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';

import config from './config.json';

type QueueItem = {
  title: string;
  url: string;
  requestedBy: string;
  thumbnail?: string;
  duration?: number;
  source?: string;
};

type GuildQueue = {
  connection: VoiceConnection | null;
  player: AudioPlayer;
  songs: QueueItem[];
  currentSong?: QueueItem;
};

const QUEUES_FILE = 'queues.json';

// Mensagens temáticas
const MESSAGES = {
  searching: [
    '* Pikachu está procurando sua música...',
    '* Sans está dando uma olhada... heh heh.',
    '* Charmander está aquecendo os servidores...',
    '* Papyrus está PROCURANDO COM TODA SUA MAGNIFICÊNCIA!',
    '* Meowth está farejando sua música...',
    '* Flowey está... sendo útil? Que estranho.',
  ],
  added: [
    '* A wild music appeared!',
    '* Música capturada com sucesso!',
    '* Você ganhou 100 EXP! Ah não, espera... é só uma música.',
    '* Tem um bom gosto, humano.',
    '* NYEH HEH HEH! MÚSICA ADICIONADA!',
    '* Sua música foi salva!',
  ],
  skipped: [
    '* Música usou Fuga! Foi efetivo!',
    '* você não vai ter um tempo ruim... com esta música.',
    '* PRÓXIMA!',
    '* Geodude! Use Rock Slide! Ops, música errada.',
    '* A música anterior foi poupada.',
  ],
  stopped: [
    '* Todos os Pokémons retornaram para a Pokébola!',
    '* você sente seus pecados rastejando em suas costas...',
    '* O jogo foi salvo. Reprodução parada.',
    '* MTT Brand Music Player™ foi desligado!',
    '* Sistema de som desativado. Silêncio...',
  ],
  empty: [
    '* A fila está vazia... Mas ninguém veio.',
    '* Não há nada aqui, apenas o vazio.',
    '* A tall slot awaits... wait, wrong game.',
    '* Parece que a festa acabou.',
  ],
  nowPlaying: [
    '* Tocando agora:',
    '* Um som selvagem apareceu!',
    '* No rádio do Professor Carvalho:',
    '* MTT apresenta:',
    '* A rádio de Lavender Town toca:',
  ],
  voiceError: [
    '* Entre em um canal de voz primeiro, treinador!',
    '* Ei, você precisa estar em um canal de voz!',
    '* ... você realmente precisa estar em um canal de voz.',
    '* VOCÊ DEVE ESTAR EM UM CANAL DE VOZ, HUMANO!',
  ],
};

// Status para Rich Presence
const PRESENCE_STATUS = [
  { name: '* Kyu? Esse é outro bot, não sou ele não. Hihi.', type: ActivityType.Custom },
  { name: 'Pokémon Theme', type: ActivityType.Listening },
  { name: 'Megalovania', type: ActivityType.Listening },
  { name: 'com Pikachu', type: ActivityType.Playing },
  { name: 'Undertale OST', type: ActivityType.Listening },
  { name: 'você ter um tempo ruim', type: ActivityType.Watching },
  { name: 'Lavender Town', type: ActivityType.Listening },
  { name: '!play para começar', type: ActivityType.Listening },
  { name: 'MTT Brand Music™', type: ActivityType.Playing },
  { name: 'a Torre Pokémon', type: ActivityType.Watching },
];

let currentPresenceIndex = 0;

function randomMessage(category: keyof typeof MESSAGES): string {
  const messages = MESSAGES[category];
  return messages[Math.floor(Math.random() * messages.length)];
}

function updatePresence(client: Client) {
  if (!client.user) return;
  
  const status = PRESENCE_STATUS[currentPresenceIndex];
  currentPresenceIndex = (currentPresenceIndex + 1) % PRESENCE_STATUS.length;
  
  client.user.setPresence({
    activities: [{
      name: status.name,
      type: status.type,
    }],
    status: PresenceUpdateStatus.Online,
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const queues: Map<string, GuildQueue> = new Map();

// ============ Utility Functions ============

function ensureQueue(guildId: string): GuildQueue {
  if (!queues.has(guildId)) {
    const player = createAudioPlayer();
    queues.set(guildId, { connection: null, player, songs: [], currentSong: undefined });
  }
  return queues.get(guildId)!;
}

function detectSource(query: string): string {
  if (query.includes('spotify.com')) return 'Spotify';
  if (query.includes('deezer.com')) return 'Deezer';
  if (query.includes('music.youtube.com')) return 'YouTube Music';
  if (query.includes('youtube.com') || query.includes('youtu.be')) return 'YouTube';
  return 'Busca';
}

function getDirectUrl(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-g', '--no-playlist', '--quiet'];
    
    try {
      if (require('fs').existsSync('./cookies.txt')) {
        args.push('--cookies', './cookies.txt');
      }
    } catch {}
    
    args.push(query);
    
    const y = spawn('yt-dlp', args);
    let out = '';
    
    y.stdout.on('data', (c) => (out += c.toString()));
    y.stderr.on('data', () => {});
    y.on('error', (e) => reject(e));
    y.on('close', () => {
      const candidate = out.split(/\r?\n/)[0];
      if (candidate && candidate.startsWith('http')) {
        return resolve(candidate);
      }

      const searchArgs = ['-g', '--no-playlist', '--quiet', `ytsearch1:${query}`];
      const s = spawn('yt-dlp', searchArgs);
      let o2 = '';
      
      s.stdout.on('data', (c) => (o2 += c.toString()));
      s.on('error', (e) => reject(e));
      s.on('close', () => {
        const c2 = o2.split(/\r?\n/)[0];
        if (c2 && c2.startsWith('http')) {
          return resolve(c2);
        }
        reject(new Error('Não foi possível extrair URL. Verifique se yt-dlp está instalado.'));
      });
    });
  });
}

function fetchMetadata(query: string): Promise<{
  title: string;
  duration?: number;
  webpage_url?: string;
  url?: string;
  thumbnail?: string;
  uploader?: string;
}> {
  return new Promise((resolve, reject) => {
    const args = ['-j', '--no-playlist', '--quiet'];
    
    try {
      if (require('fs').existsSync('./cookies.txt')) {
        args.push('--cookies', './cookies.txt');
      }
    } catch {}
    
    args.push(query);
    
    const j = spawn('yt-dlp', args);
    let out = '';
    
    j.stdout.on('data', (c) => (out += c.toString()));
    j.stderr.on('data', () => {});
    j.on('error', (e) => reject(e));
    j.on('close', async () => {
      try {
        const lines = out.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) {
          return reject(new Error('Nenhum metadado retornado'));
        }
        
        const info = JSON.parse(lines[0]);
        const title = info.title || query;
        const duration = info.duration;
        const webpage_url = info.webpage_url || info.url;
        const thumbnail = info.thumbnail;
        const uploader = info.uploader || info.channel;
        
        try {
          const url = await getDirectUrl(query);
          resolve({ title, duration, webpage_url, url, thumbnail, uploader });
        } catch (_) {
          resolve({ title, duration, webpage_url, thumbnail, uploader });
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '???';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function saveQueues() {
  const data: Record<string, QueueItem[]> = {};
  for (const [guildId, q] of queues.entries()) {
    data[guildId] = q.songs;
  }
  try {
    await fs.writeFile(QUEUES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('* Erro ao salvar filas:', err);
  }
}

async function loadQueues() {
  try {
    const raw = await fs.readFile(QUEUES_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, QueueItem[]>;
    for (const [guildId, songs] of Object.entries(parsed)) {
      const player = createAudioPlayer();
      queues.set(guildId, { connection: null, player, songs: songs || [], currentSong: undefined });
    }
    console.log('* Filas carregadas! Save file loaded.');
  } catch (err) {
    console.log('* Nenhuma fila salva encontrada. Starting fresh!');
  }
}

async function playNext(guildId: string) {
  const q = queues.get(guildId);
  if (!q) return;
  
  const song = q.songs.shift();
  q.currentSong = song;
  await saveQueues();
  
  if (!song) {
    if (q.connection) {
      try {
        q.connection.destroy();
      } catch {}
    }
    queues.delete(guildId);
    return;
  }

  try {
    const direct = song.url;
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-re',
        '-i', direct,
        '-analyzeduration', '0',
        '-loglevel', 'quiet',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      ],
      { windowsHide: true }
    );

    const resource = createAudioResource(ffmpeg.stdout as unknown as Readable, {
      inputType: StreamType.Raw,
    });
    
    q.player.play(resource);

    q.player.once(AudioPlayerStatus.Idle, () => {
      playNext(guildId);
    });
  } catch (err) {
    console.error('* Erro em playNext:', err);
    playNext(guildId);
  }
}

// ============ Command Handlers ============

async function handlePlay(
  query: string,
  guildId: string,
  channelId: string,
  memberId: string,
  memberTag: string
): Promise<{ content?: string; embeds?: EmbedBuilder[] }> {
  const q = ensureQueue(guildId);
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { content: '* Servidor não encontrado... isso é estranho.' };

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) {
    return { content: '* Este não é um canal de voz válido!' };
  }

  if (!q.connection) {
    try {
      q.connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: (guild as any).voiceAdapterCreator,
      });

      await entersState(q.connection, VoiceConnectionStatus.Ready, 30_000);
      q.connection.subscribe(q.player);

      q.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(q.connection!, VoiceConnectionStatus.Signalling, 5_000),
            entersState(q.connection!, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          q.connection?.destroy();
        }
      });
    } catch (error) {
      console.error('* Erro ao conectar ao canal de voz:', error);
      return {
        content: '* Não consegui me conectar ao canal de voz! Verifique minhas permissões.',
      };
    }
  }

  try {
    const source = detectSource(query);
    const meta = await fetchMetadata(query);
    let direct = meta.url;
    
    if (!direct) {
      direct = await getDirectUrl(query);
    }
    
    const title = meta.title || query;
    const queueItem: QueueItem = {
      title,
      url: direct,
      requestedBy: memberTag,
      thumbnail: meta.thumbnail,
      duration: meta.duration,
      source,
    };
    
    q.songs.push(queueItem);
    await saveQueues();
    
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const embed = new EmbedBuilder()
      .setColor(randomColor)
      .setTitle(randomMessage('added'))
      .setDescription(`**${title}**`)
      .addFields(
        { name: 'Tipo', value: source, inline: true },
        { name: 'Duracao', value: formatDuration(meta.duration), inline: true },
        { name: 'Treinador', value: memberTag, inline: true }
      )
      .setFooter({ text: '* (Voce encheu-se de determinacao.)' })
      .setTimestamp();
    
    if (meta.thumbnail) {
      embed.setThumbnail(meta.thumbnail);
    }
    
    if (q.player.state.status !== AudioPlayerStatus.Playing) {
      playNext(guildId);
    }
    
    return { embeds: [embed] };
  } catch (err: any) {
    console.error('* Erro em handlePlay:', err);
    return {
      content: `* O ataque falhou! Erro: ${err.message}\n\n* Certifique-se de que yt-dlp esta instalado: \`yt-dlp -U\``,
    };
  }
}

async function handleSkip(guildId: string): Promise<{ embeds: EmbedBuilder[] }> {
  const q = queues.get(guildId);
  if (!q) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setDescription(randomMessage('empty'));
    return { embeds: [embed] };
  }
  
  q.player.stop();
  await saveQueues();
  
  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setDescription(randomMessage('skipped'));
  
  return { embeds: [embed] };
}

async function handleStop(guildId: string): Promise<{ embeds: EmbedBuilder[] }> {
  const q = queues.get(guildId);
  if (!q) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setDescription(randomMessage('empty'));
    return { embeds: [embed] };
  }
  
  q.songs = [];
  q.currentSong = undefined;
  q.player.stop();
  
  try {
    q.connection?.destroy();
  } catch {}
  
  queues.delete(guildId);
  await saveQueues();
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setDescription(randomMessage('stopped'))
    .setFooter({ text: '* O jogo foi salvo.' });
  
  return { embeds: [embed] };
}

function handleQueue(guildId: string): { embeds: EmbedBuilder[] } {
  const q = queues.get(guildId);
  
  if (!q || (q.songs.length === 0 && !q.currentSong)) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setDescription(randomMessage('empty'));
    return { embeds: [embed] };
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('[ FILA DE MUSICAS ]')
    .setTimestamp();
  
  if (q.currentSong) {
    embed.addFields({
      name: '>>> ' + randomMessage('nowPlaying'),
      value: `**${q.currentSong.title}**\nDuracao: ${formatDuration(q.currentSong.duration)} | Treinador: ${q.currentSong.requestedBy}`,
    });
  }
  
  if (q.songs.length > 0) {
    const list = q.songs
      .slice(0, 10)
      .map((s, i) => {
        const badges = ['*', '+', '-', '~', '>', '<', '='];
        const badge = badges[i % badges.length];
        return `${badge} **${i + 1}.** ${s.title}\n   Duracao: ${formatDuration(s.duration)} | ${s.requestedBy}`;
      })
      .join('\n\n');
    
    embed.addFields({
      name: `--- Proximas (${q.songs.length}) ---`,
      value: list,
    });
    
    if (q.songs.length > 10) {
      embed.setFooter({ text: `* E mais ${q.songs.length - 10} musica(s) esperando...` });
    }
  }
  
  return { embeds: [embed] };
}

function handleNowPlaying(guildId: string): { embeds: EmbedBuilder[] } {
  const q = queues.get(guildId);
  
  if (!q || !q.currentSong) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setDescription('* Nenhuma musica esta tocando no momento.');
    return { embeds: [embed] };
  }
  
  const song = q.currentSong;
  
  const types = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug'
  ];
  const randomType = types[Math.floor(Math.random() * types.length)];
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(randomMessage('nowPlaying'))
    .setDescription(`**${song.title}**`)
    .addFields(
      { name: 'Tipo', value: song.source || 'Unknown', inline: true },
      { name: 'Duracao', value: formatDuration(song.duration), inline: true },
      { name: 'Treinador', value: song.requestedBy, inline: true },
      { name: 'Elemento', value: randomType, inline: true }
    )
    .setFooter({ text: '* (A musica esta cheia de determinacao.)' })
    .setTimestamp();
  
  if (song.thumbnail) {
    embed.setThumbnail(song.thumbnail);
  }
  
  return { embeds: [embed] };
}

// ============ Client Events ============

client.on('ready', async () => {
  console.log(`\n=================================`);
  console.log(`* Bot acordou: ${client.user?.tag}`);
  console.log(`* Conectado a ${client.guilds.cache.size} servidor(es)`);
  console.log(`* A wild bot appeared!`);
  console.log(`=================================\n`);
  
  await loadQueues();
  
  // Configurar Rich Presence inicial
  updatePresence(client);
  
  // Atualizar presença a cada 30 segundos
  setInterval(() => {
    updatePresence(client);
  }, 30000);
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;
  
  const prefix = (config as any).prefix || '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (!message.guild) return;

  if (cmd === 'play' || cmd === 'p') {
    const query = args.join(' ');
    if (!query) return message.reply('* Uso: `!play <url ou termo de busca>`');
    
    const memberChannel = message.member?.voice.channel;
    if (!memberChannel) return message.reply(randomMessage('voiceError'));

    await message.reply(randomMessage('searching'));
    const result = await handlePlay(
      query,
      message.guild.id,
      memberChannel.id,
      message.author.id,
      message.author.tag
    );
    
    if (message.channel.isTextBased() && 'send' in message.channel) {
      message.channel.send(result);
    }
  } else if (cmd === 'skip' || cmd === 's') {
    const result = await handleSkip(message.guild.id);
    message.reply(result);
  } else if (cmd === 'stop') {
    const result = await handleStop(message.guild.id);
    message.reply(result);
  } else if (cmd === 'queue' || cmd === 'q') {
    const result = handleQueue(message.guild.id);
    message.reply(result);
  } else if (cmd === 'np' || cmd === 'nowplaying') {
    const result = handleNowPlaying(message.guild.id);
    message.reply(result);
  }
});

client.on('interactionCreate', async (interaction: BaseInteraction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    if (cmd === 'play') {
      const query = interaction.options.getString('query', true);
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
      const memberChannel = member?.voice?.channel;
      
      if (!memberChannel) {
        return interaction.reply({
          content: randomMessage('voiceError'),
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const result = await handlePlay(
        query,
        guildId,
        memberChannel.id,
        interaction.user.id,
        interaction.user.tag
      );
      interaction.editReply(result);
    } else if (cmd === 'skip') {
      const result = await handleSkip(guildId);
      interaction.reply(result);
    } else if (cmd === 'stop') {
      const result = await handleStop(guildId);
      interaction.reply(result);
    } else if (cmd === 'queue') {
      const result = handleQueue(guildId);
      interaction.reply(result);
    } else if (cmd === 'nowplaying') {
      const result = handleNowPlaying(guildId);
      interaction.reply(result);
    }
  } catch (err) {
    console.error('* Erro em interactionCreate:', err);
    const reply = { content: '* Um erro ocorreu! Tente novamente.' };
    
    if (interaction.replied || interaction.deferred) {
      interaction.editReply(reply);
    } else {
      interaction.reply(reply);
    }
  }
});

// ============ Login ============

if (!(config as any).token || (config as any).token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('* Por favor, defina seu token em `config.json`.');
  process.exit(1);
}

client.login((config as any).token).catch((e) => {
  console.error('* Erro ao fazer login:', e);
  process.exit(1);
});