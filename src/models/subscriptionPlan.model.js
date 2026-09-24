const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tier: {
      type: String,
     // enum: ['freemium', 'standard', 'professional'],
      required: true,
     // unique: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    monthlyPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    yearlyPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    trialDays: {
      type: Number,
      default: 0,
    },
    features: {
      type: [String],
      default: [],
    },
    accessibleFeatures: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        enabled: { type: Boolean, default: true },
      },
    ],
    stripeMonthlyPriceId: {
      type: String,
      default: '',
      trim: true,
    },
    stripeYearlyPriceId: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionPlanSchema.plugin(toJSON);
subscriptionPlanSchema.plugin(paginate);

const SubscriptionPlan = mongoose.model(
  'SubscriptionPlan',
  subscriptionPlanSchema,
);

module.exports = SubscriptionPlan;
