const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Client, Databases, Query } = require('node-appwrite');
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
  APPWRITE_COLLECTION_ID
} = require('./config');

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Initialize Appwrite client
const awClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(awClient);

// Build the inline keyboard for upgrades
function buildUpgradeKeyboard() {
  return Markup.inlineKeyboard(
    Object.entries(ITEMS).map(([id, item]) => [
      Markup.button.callback(item.name, id)
    ])
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
  if (!item) {
    return ctx.answerCbQuery('Invalid option', { show_alert: true });
  }

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
  const payload = ctx.preCheckoutQuery.invoice_payload;
  ctx.answerPreCheckoutQuery(!!ITEMS[payload], ITEMS[payload] ? undefined : 'Invalid payload');
});

bot.on('successful_payment', async ctx => {
  const payment = ctx.message.successful_payment;
  const itemId = payment.invoice_payload;
  const item = ITEMS[itemId];
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  // 1) Update mining_power in Appwrite
  try {
    // Find the user document by telegram_id
    const found = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      [
        Query.equal('telegram_id', String(userId)),
        Query.limit(1)
      ]
    );

    if (found.total > 0) {
      const userDoc = found.documents[0];
      const newPower = (userDoc.mining_power || 1) + item.powerIncrement;

      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_ID,
        userDoc.$id,
        { mining_power: newPower }
      );
    }
  } catch (err) {
    console.error('Appwrite update error:', err);
    // (Optional) notify the user/admin of a sync failure
  }

  // 2) Acknowledge the user
  STATS.purchases[userId] = (STATS.purchases[userId] || 0) + 1;
  await ctx.reply(
    `🎉 Purchased "${item.name}" successfully!\n\n` +
    `Your mining power has been increased by +${item.powerIncrement}×.\n` +
    `If you don’t see the change in-game within a few minutes, please contact support.`
  );

  // 3) Notify admins
  for (const adminId of ADMIN_CHAT_IDS) {
    await bot.telegram.sendMessage(
      adminId,
      `*New Purchase*\n` +
      `User: ${username} (\`${userId}\`)\n` +
      `Pack: *${item.name}*\n` +
      `Cost: \`${item.price} ⭐️\`\n` +
      `Charge ID: \`${payment.telegram_payment_charge_id}\``,
      { parse_mode: 'Markdown' }
    );
  }
});

bot.catch(err => console.error('Bot error', err));

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