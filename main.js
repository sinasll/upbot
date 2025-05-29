const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const {
  BOT_TOKEN,
  ITEMS,
  MESSAGES,
  ADMIN_CHAT_IDS,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_ID,
  UPGRADE_VALUES
} = require('./config');
const { Client, Databases, Query } = require('node-appwrite');

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Initialize Appwrite client
const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

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
  
  if (!UPGRADE_VALUES[itemId]) {
    console.error('Unknown item ID:', itemId);
    return ctx.reply('❌ Error: Unknown upgrade type. Please contact support.');
  }
  
  const upgradeValue = UPGRADE_VALUES[itemId];
  
  try {
    // Find user in Appwrite
    const result = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      [Query.equal('telegram_id', String(userId))]
    );

    if (result.total === 0) {
      throw new Error('User not found in database');
    }

    const user = result.documents[0];
    
    // Calculate new values
    const newPurchasedUpgrade = (user.purchased_upgrade || 0) + upgradeValue;
    const newMiningPower = 1.0 + 
      newPurchasedUpgrade + 
      (user.code_bonus || 0) + 
      (user.referral_bonus || 0);

    // Update user document
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      user.$id,
      {
        purchased_upgrade: newPurchasedUpgrade,
        mining_power: newMiningPower
      }
    );

    // Send success message
    await ctx.reply(MESSAGES.purchase_success(upgradeValue, newMiningPower));

    // Admin notification
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const shortChargeId = payment.telegram_payment_charge_id.substring(0, 8);
    
    for (const adminId of ADMIN_CHAT_IDS) {
      try {
        await bot.telegram.sendMessage(
          adminId,
          `*New Purchase*\n` +
          `User: ${username} (\`${userId}\`)\n` +
          `Pack: *${item.name}*\n` +
          `Value: +${upgradeValue}x mining power\n` +
          `Total Purchased: ${newPurchasedUpgrade.toFixed(1)}x\n` +
          `Charge ID: \`${shortChargeId}\``,
          { parse_mode: 'Markdown' }
        );
      } catch (adminErr) {
        console.error('Failed to notify admin:', adminErr);
      }
    }

  } catch (err) {
    console.error('Purchase processing error:', err);
    
    const shortChargeId = payment.telegram_payment_charge_id.substring(0, 8);
    await ctx.reply(MESSAGES.purchase_error(`PAY-${shortChargeId}`));
    
    // Critical error notification
    for (const adminId of ADMIN_CHAT_IDS) {
      try {
        await bot.telegram.sendMessage(
          adminId,
          `❌ *PURCHASE PROCESSING FAILED*\n` +
          `User: ${userId}\n` +
          `Item: ${itemId}\n` +
          `Error: ${err.message}\n` +
          `Charge ID: \`${shortChargeId}\``,
          { parse_mode: 'Markdown' }
        );
      } catch (adminErr) {
        console.error('Failed to send error alert:', adminErr);
      }
    }
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