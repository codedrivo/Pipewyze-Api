const catchAsync = require('../../helpers/asyncErrorHandler');
const ApiError = require('../../helpers/apiErrorConverter');
const config = require('../../config/config');
const User = require('../../models/user.model');
const Subscription = require('../../models/subscription.model');

let stripe;
if (config.stripe.secretKey) {
  stripe = require('stripe')(config.stripe.secretKey);
}

/**
 * Get or create a Stripe customer for the user
 * @param {Object} user
 * @returns {Promise<string>} stripeCustomerId
 */
const getOrCreateStripeCustomer = async (user) => {
  if (!stripe) {
    throw new ApiError('Stripe secret key is not configured', 500);
  }

  // 1. Return customer ID if already saved on user object
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // 2. Check if a subscription exists with stripeCustomerId
  const existingSub = await Subscription.findOne({
    userId: user._id,
    stripeCustomerId: { $ne: '' },
  });
  if (existingSub && existingSub.stripeCustomerId) {
    await User.findByIdAndUpdate(user._id, {
      stripeCustomerId: existingSub.stripeCustomerId,
    });
    return existingSub.stripeCustomerId;
  }

  // 3. Create a new Stripe Customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName || '',
    phone: user.phone || undefined,
    metadata: {
      userId: user._id.toString(),
    },
  });

  // Save to database
  await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });
  return customer.id;
};

/**
 * Create SetupIntent and Ephemeral Key for Stripe Mobile PaymentSheet
 */
const createSetupIntent = catchAsync(async (req, res) => {
  if (!stripe) {
    throw new ApiError('Stripe configuration missing', 500);
  }

  const customerId = await getOrCreateStripeCustomer(req.user);

  // Create Ephemeral Key for mobile SDK
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2024-06-20' },
  );

  // Create Setup Intent
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });

  res.status(200).json({
    status: 'success',
    message: 'Setup intent created successfully',
    data: {
      setupIntent: setupIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: config.stripe.publishableKey,
    },
  });
});

/**
 * Attach a payment method (card) to user's Stripe Customer
 */
const attachCard = catchAsync(async (req, res) => {
  if (!stripe) {
    throw new ApiError('Stripe configuration missing', 500);
  }

  const { paymentMethodId, setAsDefault } = req.body;
  const customerId = await getOrCreateStripeCustomer(req.user);

  // Attach PaymentMethod to Customer
  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Fetch current customer to check default payment method
  const customer = await stripe.customers.retrieve(customerId);
  const currentDefault = customer.invoice_settings?.default_payment_method;

  let isDefault = false;
  if (setAsDefault || !currentDefault) {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    isDefault = true;
  } else {
    isDefault = currentDefault === paymentMethodId;
  }

  const card = paymentMethod.card || {};

  res.status(200).json({
    status: 'success',
    message: 'Card added successfully',
    data: {
      id: paymentMethod.id,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      funding: card.funding,
      isDefault,
    },
  });
});

/**
 * List all saved cards for the authenticated user
 */
const listCards = catchAsync(async (req, res) => {
  if (!stripe) {
    throw new ApiError('Stripe configuration missing', 500);
  }

  const customerId = await getOrCreateStripeCustomer(req.user);

  const [paymentMethods, customer] = await Promise.all([
    stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    }),
    stripe.customers.retrieve(customerId),
  ]);

  const defaultPaymentMethodId =
    customer.invoice_settings?.default_payment_method || null;

  const cards = paymentMethods.data.map((pm) => ({
    id: pm.id,
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
    funding: pm.card.funding,
    isDefault: pm.id === defaultPaymentMethodId,
  }));

  res.status(200).json({
    status: 'success',
    message: 'Cards retrieved successfully',
    data: cards,
  });
});

/**
 * Set a card as default payment method
 */
const setDefaultCard = catchAsync(async (req, res) => {
  if (!stripe) {
    throw new ApiError('Stripe configuration missing', 500);
  }

  const { paymentMethodId } = req.body;
  const customerId = await getOrCreateStripeCustomer(req.user);

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  res.status(200).json({
    status: 'success',
    message: 'Default card updated successfully',
  });
});

/**
 * Detach (delete) a card from customer
 */
const deleteCard = catchAsync(async (req, res) => {
  if (!stripe) {
    throw new ApiError('Stripe configuration missing', 500);
  }

  const { paymentMethodId } = req.params;

  await stripe.paymentMethods.detach(paymentMethodId);

  res.status(200).json({
    status: 'success',
    message: 'Card deleted successfully',
  });
});

const SubscriptionPlan = require('../../models/subscriptionPlan.model');
const {
  getUserSubscriptionDetails,
} = require('../../services/subscriptionTier.service');

/**
 * Get available service plans (created in Admin Panel) for mobile
 */
const getServicePlans = catchAsync(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({
    order: 1,
  });
  res.status(200).json({
    status: 'success',
    message: 'Service plans retrieved successfully',
    data: plans,
  });
});

/**
 * Get current authenticated user's active service plan and permissions
 */
const getUserServicePlan = catchAsync(async (req, res) => {
  const details = await getUserSubscriptionDetails(req.user._id);
  res.status(200).json({
    status: 'success',
    message: 'User service plan retrieved successfully',
    data: details,
  });
});

module.exports = {
  createSetupIntent,
  attachCard,
  listCards,
  setDefaultCard,
  deleteCard,
  getServicePlans,
  getUserServicePlan,
};
