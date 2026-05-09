require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const winston = require('winston');
const express = require('express');

// Config
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || "http://localhost:5678/webhook/discord-chat";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
const PORT = process.env.PORT || 3000;

if (!DISCORD_BOT_TOKEN) {
  throw new Error('Missing DISCORD_BOT_TOKEN environment variable.');
}

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
  const { content, user, channelId, messageId } = job.data;
  logger.info('Processing job', { jobId: job.id, user, channelId });

  try {
    const res = await axios.post(N8N_WEBHOOK, { content, user }, { timeout: 30000 });
    const replyText = typeof res.data === 'string'
      ? res.data
      : (res.data?.text || res.data?.message || 'Procesando...');
    
    // Fetch channel and reply
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ content: replyText, reply: { messageReference: messageId } });
    }
  } catch (error) {
    logger.error('Error connecting to n8n', { 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data
    });
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ content: "Error conectando con n8n", reply: { messageReference: messageId } });
    }
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

  // Enqueue message
  await messageQueue.add('process-message', {
    content: message.content,
    user: message.author.username,
    channelId: message.channel.id,
    messageId: message.id
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false
  });
});

client.on('error', (e) => logger.error('Discord Client Error', { error: e.message }));

client.login(DISCORD_BOT_TOKEN).catch(e => logger.error('Login Error', { error: e.message }));

// Healthcheck Server
const app = express();
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    discord: client.isReady() ? 'connected' : 'disconnected',
    queue: 'active'
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