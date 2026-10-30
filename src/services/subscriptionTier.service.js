const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');

/**
 * Resolves the active subscription tier and plan details for a user.
 */
const getUserSubscriptionDetails = async (userId) => {
  const [user, activeSubscription, latestSubscription] = await Promise.all([
    User.findById(userId).lean(),
    Subscription.findOne({
      userId,
      status: { $in: ['active', 'trialing'] },
    })
      .sort({ createdAt: -1 })
      .populate('planId'),
    Subscription.findOne({ userId }).sort({ createdAt: -1 }).populate('planId'),
  ]);

  let activePlan = null;
  let tier = 'freemium';

  if (activeSubscription) {
    if (activeSubscription.planId) {
      activePlan = activeSubscription.planId;
      tier =
        activeSubscription.planId.tier || activeSubscription.tier || 'standard';
    } else if (activeSubscription.tier) {
      tier = activeSubscription.tier;
    }
  }

  // If no active subscription plan object found, fetch the db plan for this tier or default freemium
  if (!activePlan) {
    activePlan = await SubscriptionPlan.findOne({
      tier,
      isActive: true,
    }).sort({ order: 1 });
  }

  // If the plan has no accessibleFeatures or is marked inactive, fall back to current active plan for this tier
  if (
    !activePlan ||
    !Array.isArray(activePlan.accessibleFeatures) ||
    activePlan.accessibleFeatures.length === 0 ||
    activePlan.isActive === false
  ) {
    const fallbackPlan = await SubscriptionPlan.findOne({
      tier,
      isActive: true,
    }).sort({ order: 1 });
    if (fallbackPlan) {
      activePlan = fallbackPlan;
    }
  }

  if (!activePlan) {
    activePlan = await SubscriptionPlan.findOne({
      tier: 'freemium',
      isActive: true,
    });
  }

  // Build key-value feature permissions map for easy consumption on mobile client
  const permissions = {
    equipment: false,
    essential_tools: false,
    maintenance_guides: false,
    plumbing_codes: false,
    training_videos: false,
    ai_assistant: false,
  };

  if (activePlan && Array.isArray(activePlan.accessibleFeatures)) {
    activePlan.accessibleFeatures.forEach((feat) => {
      if (feat && feat.key) {
        permissions[feat.key] = feat.enabled === true;
      }
    });
  }

  const isPaymentFailed =
    latestSubscription?.status === 'past_due' ||
    latestSubscription?.status === 'unpaid' ||
    latestSubscription?.status === 'incomplete';

  const sub = activeSubscription || latestSubscription || null;

  const planDetail = activePlan
    ? {
        id: activePlan._id ? activePlan._id.toString() : activePlan.id,
        name: activePlan.name,
        tier: activePlan.tier,
        description: activePlan.description || '',
        price:
          activePlan.monthlyPrice !== undefined
            ? activePlan.monthlyPrice
            : activePlan.yearlyPrice || 0,
        features: activePlan.features || [],
      }
    : null;

  const isFreemium = tier === 'freemium';

  return {
    tier,
    status: sub ? sub.status : 'inactive',
    orderId: sub?.orderId || null,
    startDate: isFreemium ? null : sub?.startDate || null,
    currentPeriodStart: isFreemium ? null : sub?.currentPeriodStart || null,
    currentPeriodEnd: isFreemium ? null : sub?.currentPeriodEnd || null,
    canCancel: isFreemium
      ? false
      : sub?.canCancel !== undefined
      ? sub.canCancel
      : sub?.status === 'active',
    plan: planDetail,
    permissions,
  };
};

const getUserSubscriptionTier = async (userId) => {
  const details = await getUserSubscriptionDetails(userId);
  return details.tier;
};

/**
 * Syncs the subscriptionTier flag on the User document.
 */
const syncUserSubscriptionTier = async (userId) => {
  const details = await getUserSubscriptionDetails(userId);
  await User.findByIdAndUpdate(userId, { subscriptionTier: details.tier });
  return details.tier;
};

module.exports = {
  getUserSubscriptionDetails,
  getUserSubscriptionTier,
  syncUserSubscriptionTier,
};
