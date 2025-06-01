require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  ITEMS: {
    basic: { name: '+0.2× Mining Power — 40 ⭐️', price: 40, description: 'Upgrade your mining power by +0.2×' },
    advanced: { name: '+0.4× Mining Power — 80 ⭐️', price: 80, description: 'Upgrade your mining power by +0.4×' },
    recommended: { name: '+0.6× Mining Power — 120 ⭐️', price: 120, description: 'Upgrade your mining power by +0.6×' },
    ultra: { name: '+0.8× Mining Power — 160 ⭐️', price: 160, description: 'Upgrade your mining power by +0.8×' },
    ultimate: { name: '+1.0× Mining Power — 200 ⭐️', price: 200, description: 'Upgrade your mining power by +1.0×' }
  },
  MESSAGES: {
    welcome: `Welcome to the $BLACK Upgrade Center

Get a permanent boost using Telegram stars ⭐️ and mine more $BLACK.

• Maximum Mining Power: 10×  
• Special Offer: 50% off all upgrades!  
• Spend over 200 ⭐️ and receive a **Bonus Boost** of permanent +0.5× Mining Power.

Choose an upgrade:`
  },
  ADMIN_CHAT_IDS: process.env.ADMIN_CHAT_IDS?.split(',').map(id => parseInt(id, 10)) || [],
  APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY: process.env.APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_ID: process.env.APPWRITE_COLLECTION_ID
};
