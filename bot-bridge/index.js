require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const winston = require('winston');
const express = require('express');

// Config
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || "http://localhost:5678/webhook/discord-chat-v2";
const N8N_PM_WEBHOOK = process.env.N8N_PM_WEBHOOK || "http://localhost:5678/webhook/pm-discord-entrada";
const PM_FAST_PATH_ENABLED = process.env.PM_FAST_PATH_ENABLED !== 'false';
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
const PORT = process.env.PORT || 3000;
const PM_FAST_TIMEOUT_MS = Number(process.env.PM_FAST_TIMEOUT_MS || 30000);

// Logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const n8n = axios.create({
  timeout: 30000,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 20 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
});

const pmChannelIds = new Set([
  process.env.DISCORD_CHANNEL_PM,
  process.env.DISCORD_CHANNEL_TAREAS,
  process.env.DISCORD_CHANNEL_AVANCES,
  process.env.DISCORD_CHANNEL_BLOQUEOS,
  process.env.DISCORD_CHANNEL_REPORTES,
  process.env.DISCORD_CHANNEL_REUNIONES,
  process.env.DISCORD_CHANNEL_ENTREGABLES,
  process.env.DISCORD_CHANNEL_RIESGOS,
  process.env.DISCORD_CHANNEL_ADMIN,
  ...(process.env.PM_CHANNEL_IDS || '').split(','),
].filter(Boolean).map((value) => String(value).trim()));

function isPmMessage({ content, channelId }) {
  const text = String(content || '').trim();
  const slashCommand = /^\/(?:pm|ayuda|estado|reporte|kpis|pendientes|atrasos|tarea|avance|bloqueo|bloqueos|impedimento|impedimentos|riesgo|riesgos|decision|decisiones|entregable|entregables|retrospectiva|retrospectivas|reunion|reuniones|recordatorio|admin)(\s|$)/i.test(text);
  return slashCommand || pmChannelIds.has(String(channelId || ''));
}

function buildPayload({ content, user, userId, channelId, channelName, messageId, isDm }) {
  return {
    content,
    user,
    user_id: userId,
    channel_id: channelId,
    channel_name: channelName,
    message_id: messageId,
    is_dm: Boolean(isDm),
    source: 'discord',
  };
}

function extractReply(data) {
  if (typeof data === 'string') return data;
  return data?.respuesta || data?.text || data?.message || data?.response || 'Procesando...';
}

async function sendReply({ channelId, messageId, content }) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;
  await channel.send({ content: String(content).slice(0, 2000), reply: { messageReference: messageId } });
}

async function sendMessage({ channelId, content }) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;
  await channel.send({ content: String(content).slice(0, 2000) });
}

async function callN8nAndReply({ webhookUrl, payload, channelId, messageId, timeout }) {
  const res = await n8n.post(webhookUrl, payload, { timeout });
  const targetChannelId = String(res.data?.canal_id || channelId || '').trim();
  const content = extractReply(res.data);
  if (targetChannelId && targetChannelId !== String(channelId || '')) {
    await sendMessage({ channelId: targetChannelId, content });
    return;
  }
  await sendReply({ channelId, messageId, content });
}

// Setup Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Setup Redis & Queue
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const messageQueue = new Queue('discord-messages', { connection });

// Worker
const worker = new Worker('discord-messages', async job => {
  const { content, user, userId, channelId, channelName, messageId, isDm } = job.data;
  logger.info('Processing job', { jobId: job.id, user, channelId });

  try {
    await callN8nAndReply({
      webhookUrl: N8N_WEBHOOK,
      payload: buildPayload({ content, user, userId, channelId, channelName, messageId, isDm }),
      channelId,
      messageId,
      timeout: 30000,
    });
  } catch (error) {
    logger.error('Error connecting to n8n', { 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}, { 
  connection,
  concurrency: 5 
});

worker.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job.id, error: err.message });
});

// Discord Events
client.on('clientReady', () => {
  logger.info('Discord client ready', { tag: client.user.tag, id: client.user.id });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  logger.info('Received message', { 
    user: message.author.username, 
    channel: message.channel.id,
    contentPreview: message.content.slice(0, 50)
  });

  const jobData = {
    content: message.content,
    user: message.author.username,
    userId: message.author.id,
    channelId: message.channel.id,
    channelName: message.channel.name || '',
    messageId: message.id,
    isDm: !message.guildId,
  };

  if (PM_FAST_PATH_ENABLED && isPmMessage(jobData)) {
    try {
      if (message.channel.sendTyping) {
        await message.channel.sendTyping().catch(() => {});
      }
      await callN8nAndReply({
        webhookUrl: N8N_PM_WEBHOOK,
        payload: buildPayload(jobData),
        channelId: jobData.channelId,
        messageId: jobData.messageId,
        timeout: PM_FAST_TIMEOUT_MS,
      });
      return;
    } catch (error) {
      logger.error('Fast PM path failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return;
    }
  }

  // Enqueue message
  await messageQueue.add('process-message', jobData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false
  });
});

client.on('error', (e) => logger.error('Discord Client Error', { error: e.message }));

if (DISCORD_BOT_TOKEN) {
  client.login(DISCORD_BOT_TOKEN).catch(e => logger.error('Login Error', { error: e.message }));
} else {
  logger.warn('DISCORD_BOT_TOKEN is missing. bot-bridge is running in healthcheck-only mode.');
}

// Healthcheck Server
const app = express();
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    discord: DISCORD_BOT_TOKEN ? (client.isReady() ? 'connected' : 'disconnected') : 'disabled_missing_token',
    queue: 'active',
    pmFastPath: PM_FAST_PATH_ENABLED ? 'enabled' : 'disabled',
    pmWebhook: N8N_PM_WEBHOOK,
  });
});

app.listen(PORT, () => {
  logger.info('Healthcheck server listening', { port: PORT });
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully.');
  await worker.close();
  await messageQueue.close();
  client.destroy();
  process.exit(0);
});
