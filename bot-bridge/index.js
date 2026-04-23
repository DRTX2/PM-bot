require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || "http://localhost:5678/webhook/discord-chat";

if (!DISCORD_BOT_TOKEN) {
  throw new Error('Missing DISCORD_BOT_TOKEN environment variable.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('clientReady', () => {
  console.log(`[BOT] Logged in as ${client.user.tag} (id ${client.user.id})`);
  console.log(`[BOT] Webhook target: ${N8N_WEBHOOK}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  console.log(`[MSG] from=${message.author.username} content="${message.content}" channel=${message.channel.id}`);

  try {
    const res = await axios.post(N8N_WEBHOOK, {
      content: message.content,
      user: message.author.username
    }, { timeout: 30000 });

    console.log(`[N8N] status=${res.status} data=${JSON.stringify(res.data).slice(0, 200)}`);

    const replyText = typeof res.data === 'string'
      ? res.data
      : (res.data?.text || res.data?.message || 'Procesando...');

    await message.reply(replyText || '(respuesta vacia)');

  } catch (error) {
    console.error('[ERR]', error.response?.status, error.response?.data || error.message);
    try { await message.reply("Error conectando con n8n"); } catch (e) { console.error('[REPLY-ERR]', e.message); }
  }
});

client.on('error', (e) => console.error('[CLIENT-ERR]', e));

client.login(DISCORD_BOT_TOKEN).catch(e => console.error('[LOGIN-ERR]', e.message));