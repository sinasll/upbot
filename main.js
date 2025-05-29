require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');

const {
  BOT_TOKEN,
  WEBHOOK_URL,
  ITEMS,
  MESSAGES,
  ADMIN_CHAT_IDS,
  APPWRITE_FUNCTION_URL
} = require('./config');

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const STATS = { purchases: {} };

app.use(express.json());

function buildUpgradeKeyboard() {
  return Markup.inlineKeyboard(
    Object.entries(ITEMS).map(([id, item]) => [Markup.button.callback(item.name, id)])
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
  const userId = ctx.from.id;

  if (!item) {
    return ctx.answerCbQuery('Invalid option', { show_alert: true });
  }

  await ctx.answerCbQuery();

  try {
    // Send invoice for paid upgrades
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
  ctx.answerPreCheckoutQuery(
    !!ITEMS[payload],
    ITEMS[payload] ? undefined : 'Invalid payload'
  );
});

bot.on('successful_payment', async ctx => {
  const payment = ctx.message.successful_payment;
  const itemId = payment.invoice_payload;
  const item = ITEMS[itemId];
  const userId = ctx.from.id;

  STATS.purchases[userId] = (STATS.purchases[userId] || 0) + 1;
  console.log(`Purchase by ${userId}: ${itemId}`);

  // Apply upgrade via Appwrite
  try {
    const response = await fetch(APPWRITE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'apply_upgrade',
        telegramId: userId.toString(),
        upgradeId: itemId
      })
    });

    // Read raw text and parse JSON safely
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('Appwrite function returned non-JSON:', text);
      throw new Error(`Invalid function response: ${text}`);
    }

    if (result.error) throw new Error(result.message);

    await ctx.reply(
      `Purchased successfully!\n\n` +
      `Your mining power has been permanently upgraded to ${result.mining_power}x.\n` +
      `If your Mining Power doesn’t update, contact support.`
    );
  } catch (err) {
    console.error('Upgrade error:', err);
    await ctx.reply(
      `Payment succeeded but upgrade failed: ${err.message}\n` +
      `Please contact support with transaction ID: ${payment.telegram_payment_charge_id}`
    );
  }

  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
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
