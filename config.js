require('dotenv').config();

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var ${name}`);
  return val;
}

module.exports = {
  BOT_TOKEN:        requireEnv('BOT_TOKEN'),
  WEBHOOK_URL:      requireEnv('WEBHOOK_URL'),
  PROVIDER_TOKEN:   process.env.PROVIDER_TOKEN || '',
  ADMIN_CHAT_IDS:   (process.env.ADMIN_CHAT_IDS || '')
                      .split(',')
                      .filter(Boolean)
                      .map(Number),

  APPWRITE_ENDPOINT:    requireEnv('APPWRITE_ENDPOINT'),
  APPWRITE_PROJECT_ID:  requireEnv('APPWRITE_PROJECT_ID'),
  APPWRITE_API_KEY:     requireEnv('APPWRITE_API_KEY'),
  APPWRITE_DATABASE_ID: requireEnv('APPWRITE_DATABASE_ID'),
  APPWRITE_COLLECTION_ID: requireEnv('APPWRITE_COLLECTION_ID'),

  ITEMS: {
    basic: {
      name: '+0.2× Mining Power — 1 ⭐️',
      price: 1,
      description: 'Upgrade your mining power by +0.2×',
      powerIncrement: 0.2
    },
    advanced: {
      name: '+0.4× Mining Power — 100 ⭐️',
      price: 100,
      description: 'Upgrade your mining power by +0.4×',
      powerIncrement: 0.4
    },
    recommended: {
      name: '+0.6× Mining Power — 150 ⭐️',
      price: 150,
      description: 'Upgrade your mining power by +0.6×',
      powerIncrement: 0.6
    },
    ultra: {
      name: '+0.8× Mining Power — 200 ⭐️',
      price: 200,
      description: 'Upgrade your mining power by +0.8×',
      powerIncrement: 0.8
    },
    ultimate: {
      name: '+1.0× Mining Power — 250 ⭐️',
      price: 250,
      description: 'Upgrade your mining power by +1.0×',
      powerIncrement: 1.0
    }
  },

  MESSAGES: {
    welcome: `Welcome to the $BLACK Upgrade Center

Get a permanent boost using
Telegram stars ⭐️ and mine more $BLACK.

Choose an upgrade`
  }
};
