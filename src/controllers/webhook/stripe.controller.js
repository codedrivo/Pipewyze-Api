const config = require('../../config/config');
const User = require('../../models/user.model');
const Subscription = require('../../models/subscription.model');
const {
  syncUserSubscriptionTier,
} = require('../../services/subscriptionTier.service');
const { generateUniqueOrderId } = require('../../helpers/orderId.helper');
const logger = require('../../config/logger');

let stripe;
if (config.stripe.secretKey) {
  stripe = require('stripe')(config.stripe.secretKey);
}

const handleStripeWebhook = async (req, res) => {
  const sig = req.headers ? req.headers['stripe-signature'] : undefined;
  let event;

  try {
    if (stripe && config.stripe.webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret,
      );
    } else {
      // Parse JSON body directly for raw unverified / local test calls
      event =
        typeof req.body === 'string' || Buffer.isBuffer(req.body)
          ? JSON.parse(req.body.toString())
          : req.body;
    }
  } catch (err) {
    logger.error(`[Stripe Webhook Signature Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const planId = session.metadata?.planId;
        const tier = session.metadata?.tier || 'standard';

        if (userId) {
          const orderId = await generateUniqueOrderId();
          const subscriptionData = {
            userId,
            planId: planId || undefined,
            tier,
            orderId,
            stripeCustomerId: session.customer || '',
            stripeSubscriptionId: session.subscription || session.id || '',
            status: 'active',
            startDate: new Date(),
          };

          await Subscription.findOneAndUpdate({ userId }, subscriptionData, {
            upsert: true,
            new: true,
          });

          await syncUserSubscriptionTier(userId);
          logger.info(
            `[Stripe Webhook] checkout.session.completed processed for user ${userId} -> tier ${tier}`,
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription ||
          invoice.lines?.data?.[0]?.parent?.subscription_item_details
            ?.subscription;

        if (subscriptionId) {
          const sub = await Subscription.findOne({
            $or: [
              { stripeSubscriptionId: subscriptionId },
              { stripeCustomerId: customerId },
            ],
          }).sort({ createdAt: -1 });

          if (sub) {
            const isInitialCreation =
              invoice.billing_reason === 'subscription_create';

            const periodStart = invoice.lines?.data?.[0]?.period?.start
              ? new Date(invoice.lines.data[0].period.start * 1000)
              : invoice.period_start
              ? new Date(invoice.period_start * 1000)
              : sub.currentPeriodStart || new Date();

            const periodEnd = invoice.lines?.data?.[0]?.period?.end
              ? new Date(invoice.lines.data[0].period.end * 1000)
              : invoice.period_end
              ? new Date(invoice.period_end * 1000)
              : sub.currentPeriodEnd ||
                new Date(Date.now() + 24 * 60 * 60 * 1000);

            // Automatically generate a new Order record for this recurring invoice cycle (must be ORD- with 5 digits)
            // Check if an order for this subscription cycle already exists
            const existingOrderForPeriod = await Subscription.findOne({
              stripeSubscriptionId: subscriptionId,
              currentPeriodStart: periodStart,
              _id: { $ne: sub._id },
            });

            if (!existingOrderForPeriod && !isInitialCreation) {
              const recurringOrderId = await generateUniqueOrderId();
              await Subscription.create({
                userId: sub.userId,
                serviceId: sub.serviceId,
                planId: sub.planId,
                tier: sub.tier,
                orderId: recurringOrderId,
                stripeCustomerId: customerId || sub.stripeCustomerId,
                stripeSubscriptionId: subscriptionId,
                status: 'active',
                startDate: new Date(
                  (invoice.created || Math.floor(Date.now() / 1000)) * 1000,
                ),
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              });
              logger.info(
                `[Stripe Webhook] Generated recurring order ${recurringOrderId} for subscription ${subscriptionId}`,
              );
            }

            // Update active subscription status and billing periods
            sub.status = 'active';
            sub.currentPeriodStart = periodStart;
            sub.currentPeriodEnd = periodEnd;
            if (!sub.stripeSubscriptionId) {
              sub.stripeSubscriptionId = subscriptionId;
            }
            await sub.save();
            await syncUserSubscriptionTier(sub.userId);

            logger.info(
              `[Stripe Webhook] invoice.payment_succeeded processed for subscription: ${subscriptionId}`,
            );
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription ||
          invoice.lines?.data?.[0]?.parent?.subscription_item_details
            ?.subscription;
        const failureReason =
          invoice.last_finalization_error?.message ||
          invoice.payment_intent?.last_payment_error?.message ||
          'Invoice payment attempt failed';

        if (subscriptionId) {
          const sub = await Subscription.findOne({
            $or: [
              { stripeSubscriptionId: subscriptionId },
              { stripeCustomerId: customerId },
            ],
          }).sort({ createdAt: -1 });
          if (sub) {
            sub.status = 'past_due';
            await sub.save();
            await syncUserSubscriptionTier(sub.userId);
            logger.warn(
              `[Stripe Webhook] invoice.payment_failed for subscription ${subscriptionId}: ${failureReason}`,
            );
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const failureReason =
          paymentIntent.last_payment_error?.message ||
          'One-time payment attempt failed';

        const sub = await Subscription.findOne({
          $or: [
            { stripeSubscriptionId: paymentIntent.id },
            { stripeCustomerId: paymentIntent.customer },
          ],
        });

        if (sub) {
          sub.status = 'incomplete';
          await sub.save();
          await syncUserSubscriptionTier(sub.userId);
        }

        logger.warn(
          `[Stripe Webhook] payment_intent.payment_failed for intent ${paymentIntent.id}: ${failureReason}`,
        );
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        logger.info(
          `[Stripe Webhook] payment_intent.succeeded for intent: ${paymentIntent.id}`,
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const sub = await Subscription.findOne({
          $or: [
            { stripeSubscriptionId: subscription.id },
            { stripeCustomerId: subscription.customer },
          ],
        }).sort({ createdAt: -1 });

        if (sub) {
          sub.status = subscription.status;
          sub.cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
          if (subscription.current_period_start) {
            sub.currentPeriodStart = new Date(
              subscription.current_period_start * 1000,
            );
          }
          if (subscription.current_period_end) {
            sub.currentPeriodEnd = new Date(
              subscription.current_period_end * 1000,
            );
          }
          await sub.save();
          await syncUserSubscriptionTier(sub.userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const sub = await Subscription.findOne({
          $or: [
            { stripeSubscriptionId: subscription.id },
            { stripeCustomerId: subscription.customer },
          ],
        });

        if (sub) {
          sub.status = 'canceled';
          sub.canceledAt = new Date();
          await sub.save();

          await User.findByIdAndUpdate(sub.userId, {
            subscriptionTier: 'freemium',
          });
          logger.info(
            `[Stripe Webhook] customer.subscription.deleted -> reset user ${sub.userId} to freemium`,
          );
        }
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error(`[Stripe Webhook Error]: ${err.message}`, err);
    res.status(500).send(`Webhook handler error: ${err.message}`);
  }
};

module.exports = {
  handleStripeWebhook,
};
