const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');

/**
 * Resolves the active subscription tier and plan details for a user.
 */
const getUserSubscriptionDetails = async (userId) => {
  const activeSubscription = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trialing'] },
  }).populate('planId');

  let activePlan = null;
  let tier = 'freemium';

  if (activeSubscription) {
    if (activeSubscription.planId) {
      activePlan = activeSubscription.planId;
      tier = activeSubscription.planId.tier || activeSubscription.tier || 'standard';
    } else if (activeSubscription.tier) {
      tier = activeSubscription.tier;
    }
  }

  // If no active subscription plan object found, fetch the db plan for this tier or default freemium
  if (!activePlan) {
    activePlan = await SubscriptionPlan.findOne({ tier, isActive: true }).sort({ order: 1 });
  }

  if (!activePlan) {
    activePlan = await SubscriptionPlan.findOne({ tier: 'freemium', isActive: true });
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

  return {
    tier,
    subscription: activeSubscription || null,
    plan: activePlan || null,
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
