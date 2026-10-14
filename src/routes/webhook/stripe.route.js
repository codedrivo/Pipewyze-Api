const express = require('express');
const router = express.Router();
const stripeController = require('../../controllers/webhook/stripe.controller');

// Raw body parser middleware for Stripe signature verification
router.post(
  '/',
  express.raw({ type: '*/*' }),
  stripeController.handleStripeWebhook,
);

module.exports = router;
