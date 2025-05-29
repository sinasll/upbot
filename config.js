require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  ITEMS: {
    basic: { name: '+0.2× Mining Power — 50 ⭐️', price: 50, description: 'Upgrade your mining power by +0.2×' },
    advanced: { name: '+0.4× Mining Power — 100 ⭐️', price: 100, description: 'Upgrade your mining power by +0.4×' },
    recommended: { name: '+0.6× Mining Power — 150 ⭐️', price: 150, description: 'Upgrade your mining power by +0.6×' },
    ultra: { name: '+0.8× Mining Power — 200 ⭐️', price: 200, description: 'Upgrade your mining power by +0.8×' },
    ultimate: { name: '+1.0× Mining Power — 250 ⭐️', price: 250, description: 'Upgrade your mining power by +1.0×' }
  },
  UPGRADE_VALUES: {
    basic: 0.2,
    advanced: 0.4,
    recommended: 0.6,
    ultra: 0.8,
    ultimate: 1.0
  },
  MESSAGES: {
    welcome: `Welcome to the $BLACK Upgrade Center\n\nGet a permanent boost using\nTelegram stars ⭐️ and mine more $BLACK.\n\nChoose an upgrade`,
    purchase_success: (upgrade, total) => `✅ Purchase successful! Your mining power has been permanently increased by ${upgrade}x!\n\n• New mining power: ${total.toFixed(1)}x\n• Total purchased upgrades: ${(total - 1).toFixed(1)}x`,
    purchase_error: ref => `⚠️ Upgrade applied but we encountered an issue updating your account. Please contact @support with this reference: ${ref}`
  },
  ADMIN_CHAT_IDS: process.env.ADMIN_CHAT_IDS?.split(',').map(id => parseInt(id, 10)) || [],
  APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY: process.env.APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_ID: process.env.APPWRITE_COLLECTION_ID
};