require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Client, Databases, Query } = require('node-appwrite');
const config = require('./config');

const {
  BOT_TOKEN,
  WEBHOOK_URL,
  ITEMS,
  MESSAGES,
  ADMIN_CHAT_IDS,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_ID,
} = config;

const app = express();
app.use(express.json());

const bot = new Telegraf(BOT_TOKEN);
const STATS = { purchases: {} };

// Initialize Appwrite client
const awClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(awClient);

// Build keyboard
function buildUpgradeKeyboard() {
  return Markup.inlineKeyboard(
    Object.entries(ITEMS).map(([id, item]) => [
      Markup.button.callback(item.name, id)
    ])
  );
}

bot.start(ctx => ctx.reply(MESSAGES.welcome, buildUpgradeKeyboard()));
bot.command('upgrade', ctx => ctx.reply('Choose an upgrade:', buildUpgradeKeyboard()));

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
      provider_token: '',
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
  ctx.answerPreCheckoutQuery(!!ITEMS[ctx.preCheckoutQuery.invoice_payload]);
});

bot.on('successful_payment', async ctx => {
  const payment = ctx.message.successful_payment;
  const itemId = payment.invoice_payload;
  const item = ITEMS[itemId];
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  // CORRECTED Appwrite call
  let userDoc;
  try {
    const found = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      [
        Query.equal('telegram_id', String(userId)),
        Query.limit(1)
      ]
    );

    if (found.total > 0) userDoc = found.documents[0];
    else console.warn(`User ${userId} not found in DB`);
  } catch (err) {
    console.error('Appwrite error:', err);
    return ctx.reply('Database error. Please contact support.');
  }

  // Update mining power
  if (userDoc) {
    try {
      const newPower = (userDoc.mining_power || 1) + item.powerIncrement;
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_ID,
        userDoc.$id,
        { mining_power: newPower }
      );
    } catch (err) {
      console.error('Update error:', err);
    }
  }

  // Notify user
  await ctx.reply(
    `🎉 Purchased "${item.name}" successfully!\n` +
    `Your mining power increased by +${item.powerIncrement}×\n` +
    `Changes apply within 5 minutes`
  );

  // Notify admins
  for (const adminId of ADMIN_CHAT_IDS) {
    await bot.telegram.sendMessage(
      adminId,
      `*New Purchase*\nUser: ${username} (${userId})\n` +
      `Pack: ${item.name}\nCost: ${item.price} ⭐️\n` +
      `Charge ID: ${payment.telegram_payment_charge_id}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Server setup
app.post('/webhook', (req, res) => bot.handleUpdate(req.body, res));
app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log(`Webhook configured: ${WEBHOOK_URL}/webhook`);
  } catch (err) {
    console.error('Webhook setup failed:', err);
  }
});
