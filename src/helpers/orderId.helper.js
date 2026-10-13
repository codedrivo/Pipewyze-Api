const crypto = require('crypto');
const Subscription = require('../models/subscription.model');

const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a random 5-character alphanumeric string (e.g. "9K2MF")
 * @param {number} length
 * @returns {string}
 */
const generateRandomAlphanumeric = (length = 5) => {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC_CHARS[bytes[i] % ALPHANUMERIC_CHARS.length];
  }
  return result;
};

/**
 * Generate a unique 5-character alphanumeric order ID prefixed with ORD- (e.g. ORD-9K2MF)
 * Guarantees uniqueness in the Subscription collection.
 * @returns {Promise<string>}
 */
const generateUniqueOrderId = async () => {
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRandomAlphanumeric(5);
    const orderId = `ORD-${code}`;

    // Ensure this order ID does not collide with any existing order in the database
    const exists = await Subscription.findOne({ orderId }).lean();
    if (!exists) {
      return orderId;
    }
  }

  // Fallback if loop exceeded
  const fallback = crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
  return `ORD-${fallback}`;
};

module.exports = {
  generateRandomAlphanumeric,
  generateUniqueOrderId,
};
