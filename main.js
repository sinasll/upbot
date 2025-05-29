const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Client, Databases, Query } = require('node-appwrite');
const {
  BOT_TOKEN,
  WEBHOOK_URL,
  PROVIDER_TOKEN,
  ITEMS,
  MESSAGES,
  ADMIN_CHAT_IDS,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_ID
} = require('./config');

// --- Appwrite client setup ---
const awClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(awClient);

// --- Bot and server setup ---
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

function buildUpgradeKeyboard() {
  return Markup.inlineKeyboard(
    Object.entries(ITEMS).map(([id, item]) => [ Markup.button.callback(item.name, id) ])
  );
}

bot.start(ctx => {
  ctx.reply(MESSAGES.welcome, buildUpgradeKeyboard());
});

bot.command('upgrade', ctx => {
  ctx.reply('Choose an upgrade:', buildUpgradeKeyboard());
});

bot.on('callback_query', async ctx => {
  const itemId = ctx.callbackQuery.data;
  const item = ITEMS[itemId];
  if (!item) return ctx.answerCbQuery('Invalid option', { show_alert: true });

  await ctx.answerCbQuery();
  try {
    await ctx.replyWithInvoice({
      chat_id: ctx.chat.id,
      title: item.name,
      description: item.description,
      payload: itemId,
      provider_token: PROVIDER_TOKEN,
      currency: 'XTR',
      prices: [{ label: item.name, amount: item.price }],
      start_parameter: 'start',
    });
  } catch (err) {
    console.error('Invoice error:', err);
    ctx.reply('Failed to create invoice.');
  }
});

bot.on('pre_checkout_query', ctx => {
  const payload = ctx.preCheckoutQuery.invoice_payload;
  ctx.answerPreCheckoutQuery(!!ITEMS[payload], ITEMS[payload] ? undefined : 'Invalid payload');
});

// Track purchases in memory for stats
const STATS = { purchases: {} };

bot.on('successful_payment', async ctx => {
  const payment = ctx.message.successful_payment;
  const itemId  = payment.invoice_payload;
  const item    = ITEMS[itemId];
  const userId  = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  // 1) Notify user and admins
  STATS.purchases[userId] = (STATS.purchases[userId] || 0) + 1;
  await ctx.reply(
    `🎉 Purchased "${item.name}" successfully!\n\n` +
    `If your Mining Power doesn’t update within 4 hours, contact support.`
  );
  for (const adminId of ADMIN_CHAT_IDS) {
    await bot.telegram.sendMessage(
      adminId,
      `*New Purchase*\nUser: ${username}\nPack: *${item.name}*\nCost: \`${payment.telegram_payment_charge_id}\``,
      { parse_mode: 'Markdown' }
    );
  }

  // 2) Update Appwrite mining_power
  try {
    const list = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      [ Query.equal('telegram_id', String(userId)), Query.limit(1) ]
    );

    if (list.total === 1) {
      const userDoc = list.documents[0];
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_ID,
        userDoc.$id,
        { mining_power: (userDoc.mining_power || 1) + item.powerIncrement }
      );
      await ctx.reply(`✅ Your mining power has been increased by +${item.powerIncrement}×!`);
    } else {
      console.warn(`Appwrite user not found for Telegram ID ${userId}`);
    }
  } catch (err) {
    console.error('Failed to update mining_power in Appwrite:', err);
  }
});

// Express webhook
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body, res).catch(console.error);
});

app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log(`Webhook set: ${WEBHOOK_URL}/webhook`);
  } catch (err) {
    console.error('Failed to set webhook:', err);
  }
});
