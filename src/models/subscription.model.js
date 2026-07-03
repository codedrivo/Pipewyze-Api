const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      default: '',
    },
    stripeSubscriptionId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused',
        'expired',
      ],
      default: 'incomplete',
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
    },
    startDate: {
      type: Date,
      required: true,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    nextBillingDate: {
      type: Date,
    },
    updatedPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
    },
    pausedAt: {
      type: Date,
    },
    resumedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

subscriptionSchema.virtual('canCancel').get(function canCancel() {
  return (
    ['active', 'trialing', 'past_due'].includes(this.status) && !this.canceledAt
  );
});

subscriptionSchema.virtual('canUpdate').get(function canUpdate() {
  return ['active', 'trialing'].includes(this.status) && !this.canceledAt;
});

subscriptionSchema.plugin(toJSON);

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
