const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    'Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are required.',
  );
}

const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.cert({
    projectId,
    clientEmail,
    privateKey: formattedPrivateKey,
  }),
});

console.log('Firebase Admin SDK initialized successfully.');

/**
 * Removes an invalid FCM token from a user's token list
 * @param {string} userId
 * @param {string} token
 */
const cleanInvalidToken = async (userId, token) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: token },
    });
    console.log(`Cleaned invalid FCM token for user ${userId}`);
  } catch (error) {
    console.error(
      `Failed to clean invalid FCM token for user ${userId}:`,
      error.message,
    );
  }
};

/**
 * Sends a notification to a specific list of FCM tokens associated with a user
 * @param {string} userId
 * @param {string[]} tokens
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
const sendToTokens = async (userId, tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return;

  // Ensure all data values are string type for FCM payload structure
  const stringifiedData = {};
  Object.keys(data).forEach((key) => {
    stringifiedData[key] = String(data[key]);
  });

  const message = {
    notification: {
      title,
      body,
    },
    data: stringifiedData,
    tokens,
  };

  try {
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          console.warn(
            `FCM message send failure to token ${tokens[idx]}:`,
            error.message,
          );
          // If token is inactive or invalid, remove it
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            cleanInvalidToken(userId, tokens[idx]);
          }
        }
      });
    }
  } catch (error) {
    console.error(`FCM multicast failed for user ${userId}:`, error.message);
  }
};

/**
 * Sends notifications to specific users
 * @param {string[]} userIds
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
const sendToUsers = async (userIds, title, body, data = {}) => {
  try {
    const users = await User.find({ _id: { $in: userIds } });
    const promises = users.map(async (user) => {
      // Save notification to DB
      try {
        await Notification.create({
          userId: user._id,
          title,
          body,
          data,
          type: data.type || (data.roomId ? 'chat' : 'system'),
        });
      } catch (dbErr) {
        console.error('Failed saving notification to DB:', dbErr.message);
      }

      if (user.fcmTokens && user.fcmTokens.length > 0) {
        return sendToTokens(
          user._id.toString(),
          user.fcmTokens,
          title,
          body,
          data,
        );
      }
    });
    await Promise.all(promises);
  } catch (error) {
    console.error('Failed sending notifications to users:', error.message);
  }
};

/**
 * Sends notifications to all users of a specific role (e.g. 'home-owner')
 * @param {string} role
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
const sendToRole = async (role, title, body, data = {}) => {
  try {
    const users = await User.find({ role });
    const promises = users.map(async (user) => {
      // Save notification to DB
      try {
        await Notification.create({
          userId: user._id,
          title,
          body,
          data,
          type: data.type || (data.roomId ? 'chat' : 'system'),
        });
      } catch (dbErr) {
        console.error('Failed saving notification to DB:', dbErr.message);
      }

      if (user.fcmTokens && user.fcmTokens.length > 0) {
        return sendToTokens(
          user._id.toString(),
          user.fcmTokens,
          title,
          body,
          data,
        );
      }
    });
    await Promise.all(promises);
  } catch (error) {
    console.error(
      `Failed sending notifications to role ${role}:`,
      error.message,
    );
  }
};

module.exports = {
  sendToUsers,
  sendToRole,
  cleanInvalidToken,
};
