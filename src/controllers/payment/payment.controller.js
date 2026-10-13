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

  // 1. Retrieve the PaymentMethod
  let paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  // 2. If it is attached to a different customer, detach it first
  if (paymentMethod.customer && paymentMethod.customer !== customerId) {
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
    } catch (detachErr) {
      console.warn('[Stripe attachCard] Could not detach from old customer:', detachErr.message);
    }
  }

  // 3. Attach PaymentMethod to the target customer if not already attached
  if (paymentMethod.customer !== customerId) {
    try {
      paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (attachErr) {
      console.warn('[Stripe attachCard] Attach warning:', attachErr.message);
      // Re-retrieve to check if it got attached anyway
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    }
  }

  // 4. Update customer default payment method safely
  let isDefault = false;
  if (paymentMethod.customer === customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    const currentDefault = customer.invoice_settings?.default_payment_method;

    if (setAsDefault || !currentDefault) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
        isDefault = true;
      } catch (updateErr) {
        console.warn('[Stripe attachCard] Could not set default_payment_method:', updateErr.message);
        isDefault = false;
      }
    } else {
      isDefault = currentDefault === paymentMethodId;
    }
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
  const customerId = await getOrCreateStripeCustomer(req.user);

  // Retrieve payment method to verify ownership
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (!paymentMethod || paymentMethod.customer !== customerId) {
    throw new ApiError('Card not found for this user', 404);
  }

  // Detach card from Stripe customer
  await stripe.paymentMethods.detach(paymentMethodId);

  // If the deleted card was the default, assign next available card as default
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.invoice_settings?.default_payment_method === paymentMethodId) {
    const remainingCards = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    const nextDefault = remainingCards.data?.[0]?.id || '';
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: nextDefault,
      },
    });
  }

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

const { syncUserSubscriptionTier } = require('../../services/subscriptionTier.service');
const { generateUniqueOrderId } = require('../../helpers/orderId.helper');

/**
 * Pay / Subscribe to a plan using user's saved card or specified paymentMethodId
 */
const subscribePlan = catchAsync(async (req, res) => {
  if (!stripe) {
    throw new ApiError('Stripe configuration missing', 500);
  }

  const { planId, billingCycle = 'monthly', paymentMethodId } = req.body;
  const user = req.user;

  // 1. Fetch Plan
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    throw new ApiError('Subscription plan not found', 404);
  }

  const customerId = await getOrCreateStripeCustomer(user);

  // 2. Determine payment method to charge
  let defaultPaymentMethodId = paymentMethodId;
  if (!defaultPaymentMethodId) {
    const customer = await stripe.customers.retrieve(customerId);
    defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;
  }

  if (!defaultPaymentMethodId) {
    // Check if customer has any saved card
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    if (pms.data && pms.data.length > 0) {
      defaultPaymentMethodId = pms.data[0].id;
    }
  }

  if (!defaultPaymentMethodId) {
    throw new ApiError('No payment method attached. Please add a card first.', 400);
  }

  const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const priceInCents = Math.round(Number(amount) * 100);

  const isOneTime =
    plan.name.toLowerCase().includes('one-time') ||
    plan.name.toLowerCase().includes('onetime');
  const isDaily =
    plan.name.toLowerCase().includes('/day') ||
    plan.name.toLowerCase().includes('daily');

  let interval = 'month';
  if (isDaily) {
    interval = 'day';
  } else if (billingCycle === 'yearly') {
    interval = 'year';
  } else {
    interval = 'month';
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (isDaily) {
    periodEnd.setDate(periodEnd.getDate() + 1);
  } else if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  let paymentIntentId = `pi_local_${Date.now()}`;
  let stripeSubscriptionId = '';

  // 3. Process payment / subscription in Stripe if price > 0
  if (priceInCents > 0) {
    if (isOneTime) {
      // One-time payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: priceInCents,
        currency: 'usd',
        customer: customerId,
        payment_method: defaultPaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Payment for ${plan.name} (${billingCycle})`,
        metadata: {
          userId: user._id.toString(),
          planId: plan._id.toString(),
          tier: plan.tier || 'standard',
        },
      });
      paymentIntentId = paymentIntent.id;
      stripeSubscriptionId = paymentIntent.id;
    } else {
      // Recurring Subscription
      const configuredPriceId =
        billingCycle === 'yearly'
          ? plan.stripeYearlyPriceId
          : plan.stripeMonthlyPriceId;

      let subscriptionItem;
      if (configuredPriceId) {
        subscriptionItem = { price: configuredPriceId };
      } else {
        // Ensure a Stripe Product exists for this plan
        let stripeProduct;
        try {
          const productList = await stripe.products.list({ limit: 50, active: true });
          stripeProduct = productList.data.find((p) => p.name === plan.name);
          if (!stripeProduct) {
            stripeProduct = await stripe.products.create({
              name: plan.name,
              metadata: {
                planId: plan._id.toString(),
                tier: plan.tier || 'standard',
              },
            });
          }
        } catch (prodErr) {
          console.warn('[subscribePlan] Product search/creation warning:', prodErr.message);
          stripeProduct = await stripe.products.create({ name: plan.name });
        }

        subscriptionItem = {
          price_data: {
            currency: 'usd',
            product: stripeProduct.id,
            unit_amount: priceInCents,
            recurring: { interval },
          },
        };
      }

      // Cancel any existing active Stripe recurring subscription for this user
      const existingSub = await Subscription.findOne({
        userId: user._id,
        stripeSubscriptionId: { $regex: /^sub_/ },
      });
      if (existingSub && existingSub.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(existingSub.stripeSubscriptionId);
        } catch (cancelErr) {
          console.warn('[subscribePlan] Note: could not cancel old subscription:', cancelErr.message);
        }
      }

      // Create Stripe Subscription
      const stripeSub = await stripe.subscriptions.create({
        customer: customerId,
        items: [subscriptionItem],
        default_payment_method: defaultPaymentMethodId,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user._id.toString(),
          planId: plan._id.toString(),
          tier: plan.tier || 'standard',
          billingCycle,
          interval,
        },
      });

      stripeSubscriptionId = stripeSub.id;
      paymentIntentId =
        stripeSub.latest_invoice?.payment_intent?.id ||
        stripeSub.latest_invoice?.id ||
        stripeSub.id;
    }
  }

  // 4. Update / Save Subscription in Database with 5-digit unique order ID
  const orderId = await generateUniqueOrderId();

  const subscriptionData = {
    userId: user._id,
    planId: plan._id,
    tier: plan.tier || 'standard',
    orderId,
    stripeCustomerId: customerId,
    stripeSubscriptionId,
    status: 'active',
    startDate: now,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
  };

  let subscription = await Subscription.findOneAndUpdate(
    { userId: user._id },
    subscriptionData,
    { upsert: true, new: true }
  )
    .populate('userId', 'firstName lastName email subscriptionTier profileimageurl')
    .populate('planId', 'name monthlyPrice yearlyPrice tier');

  // Sync user subscription tier
  await syncUserSubscriptionTier(user._id);

  // Retrieve card details that were charged
  let chargedCard = null;
  try {
    const pm = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
    if (pm && pm.card) {
      chargedCard = {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      };
    }
  } catch (pmErr) {
    console.warn('[subscribePlan] Could not retrieve card details:', pmErr.message);
  }

  res.status(200).json({
    status: 'success',
    message: 'Payment completed and subscription activated successfully',
    data: {
      orderId,
      user: {
        id: user._id,
        email: user.email,
        name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        subscriptionTier: plan.tier || 'standard',
      },
      plan: {
        id: plan._id,
        name: plan.name,
        tier: plan.tier,
        billingCycle,
        amount,
      },
      chargedCard,
      paymentIntentId,
      stripeSubscriptionId,
      subscription,
    },
  });
});

/**
 * Cancel the current user's active recurring subscription
 */
const cancelSubscription = catchAsync(async (req, res) => {
  const user = req.user;
  const sub = await Subscription.findOne({
    userId: user._id,
    status: { $in: ['active', 'trialing'] },
  });

  if (!sub) {
    throw new ApiError('No active subscription found to cancel', 404);
  }

  // Cancel in Stripe if recurring subscription exists
  if (stripe && sub.stripeSubscriptionId && sub.stripeSubscriptionId.startsWith('sub_')) {
    try {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (err) {
      console.warn('[cancelSubscription] Stripe cancellation error:', err.message);
    }
  }

  sub.status = 'canceled';
  sub.canceledAt = new Date();
  await sub.save();

  await syncUserSubscriptionTier(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Subscription canceled successfully',
    data: sub,
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
  subscribePlan,
  cancelSubscription,
};
