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

  const tierRegex = new RegExp(
    `^${String(tier).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i',
  );

  // If no active subscription plan object found, fetch the db plan for this tier or default freemium
  if (!activePlan) {
    activePlan = await SubscriptionPlan.findOne({
      tier: { $regex: tierRegex },
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
      tier: { $regex: tierRegex },
      isActive: true,
    }).sort({ order: 1 });
    if (fallbackPlan) {
      activePlan = fallbackPlan;
    }
  }

  const normalizedTier = String(tier || 'freemium').trim().toLowerCase();
  const isFreemium = normalizedTier === 'freemium';

  if (!activePlan && isFreemium) {
    activePlan = await SubscriptionPlan.findOne({
      tier: { $regex: /^freemium$/i },
      isActive: true,
    }).sort({ order: 1 });
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

  const now = new Date();

  const trialStartDate = user?.trialStartDate
    ? new Date(user.trialStartDate)
    : user?.createdAt
    ? new Date(user.createdAt)
    : now;
  const trialEndDate = user?.trialEndDate
    ? new Date(user.trialEndDate)
    : new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const hasCanceledPaidSub =
    isFreemium && latestSubscription && latestSubscription.status === 'canceled';

  const isTrialActive = isFreemium
    ? !hasCanceledPaidSub && now < trialEndDate
    : sub?.status === 'trialing';

  const isTrialExpired = isFreemium
    ? hasCanceledPaidSub || now >= trialEndDate
    : false;

  const trialDaysRemaining = isFreemium
    ? isTrialActive
      ? Math.max(
          1,
          Math.ceil(
            (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          ),
        )
      : 0
    : sub?.status === 'trialing' && sub?.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(sub.currentPeriodEnd).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : 0;

  const requiresPlanSelection = isFreemium && isTrialExpired;

  // Only fall back to true during an active 7-day trial if no freemium plan exists in DB,
  // or for an active paid plan if no accessibleFeatures array was configured yet.
  const hasConfiguredFeatures =
    activePlan &&
    Array.isArray(activePlan.accessibleFeatures) &&
    activePlan.accessibleFeatures.length > 0;

  if (
    (isFreemium &&
      isTrialActive &&
      (!activePlan ||
        String(activePlan.tier || '').trim().toLowerCase() !== 'freemium')) ||
    (!isFreemium && !hasConfiguredFeatures)
  ) {
    Object.keys(permissions).forEach((key) => {
      permissions[key] = true;
    });
  }

  let resolvedStatus = sub ? sub.status : 'inactive';
  if (isFreemium) {
    if (hasCanceledPaidSub) {
      resolvedStatus = 'canceled';
    } else if (isTrialActive) {
      resolvedStatus = 'trialing';
    } else {
      resolvedStatus = 'expired';
    }
  }

  return {
    tier: normalizedTier,
    status: resolvedStatus,
    orderId: sub?.orderId || null,
    startDate: isFreemium ? null : sub?.startDate || null,
    currentPeriodStart: isFreemium ? null : sub?.currentPeriodStart || null,
    currentPeriodEnd: isFreemium ? null : sub?.currentPeriodEnd || null,
    trialStartDate,
    trialEndDate,
    trialDaysRemaining,
    isTrialActive,
    isTrialExpired,
    requiresPlanSelection,
    canCancel: isFreemium
      ? false
      : ['active', 'trialing', 'past_due'].includes(sub?.status) &&
        sub?.cancelAtPeriodEnd !== true,
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
