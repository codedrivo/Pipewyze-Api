const SubscriptionPlan = require('../../models/subscriptionPlan.model');
const catchAsync = require('../../helpers/asyncErrorHandler');
const ApiError = require('../../helpers/apiErrorConverter');

const getPlans = catchAsync(async (req, res) => {
  const plans = await SubscriptionPlan.find().sort({ order: 1 });
  res.status(200).json({
    status: 200,
    plans,
  });
});

const syncFreemiumUsersTrialEndDate = async (trialDays) => {
  const User = require('../../models/user.model');
  const days = Math.max(0, Number(trialDays) || 0);
  const durationMs = days * 24 * 60 * 60 * 1000;

  const freemiumUsers = await User.find({
    role: { $ne: 'admin' },
    $or: [
      { subscriptionTier: 'freemium' },
      { subscriptionTier: { $exists: false } },
      { subscriptionTier: null },
    ],
  })
    .select('_id createdAt trialStartDate')
    .lean();

  if (freemiumUsers.length === 0) return;

  const bulkOps = freemiumUsers.map((u) => {
    const start = u.trialStartDate
      ? new Date(u.trialStartDate)
      : u.createdAt
      ? new Date(u.createdAt)
      : new Date();
    return {
      updateOne: {
        filter: { _id: u._id },
        update: {
          $set: {
            trialStartDate: start,
            trialEndDate: new Date(start.getTime() + durationMs),
          },
        },
      },
    };
  });
  await User.bulkWrite(bulkOps);
};

const createPlan = catchAsync(async (req, res) => {
  const {
    name,
    tier,
    description,
    monthlyPrice,
    yearlyPrice,
    trialDays,
    features,
    accessibleFeatures,
    stripeMonthlyPriceId,
    stripeYearlyPriceId,
    isActive,
    order,
  } = req.body;

  if (!name || !tier) {
    throw new ApiError('Name and tier are required', 400);
  }

  const existing = await SubscriptionPlan.findOne({ name });
  if (existing) {
    throw new ApiError(`Plan with name '${name}' already exists`, 400);
  }

  const isTrialEligibleTier = ['standard', 'professional'].includes(
    String(tier).trim().toLowerCase(),
  );
  const normalizedTrialDays = isTrialEligibleTier
    ? Math.max(0, Number(trialDays) || 0)
    : 0;

  const plan = await SubscriptionPlan.create({
    name,
    tier,
    description: description || '',
    monthlyPrice: Number(monthlyPrice) || 0,
    yearlyPrice: Number(yearlyPrice) || 0,
    trialDays: normalizedTrialDays,
    features: Array.isArray(features) ? features : [],
    accessibleFeatures: Array.isArray(accessibleFeatures) ? accessibleFeatures : [],
    stripeMonthlyPriceId: stripeMonthlyPriceId || '',
    stripeYearlyPriceId: stripeYearlyPriceId || '',
    isActive: isActive !== undefined ? isActive : true,
    order: Number(order) || 0,
  });

  if (isTrialEligibleTier && plan.isActive !== false && plan.trialDays > 0) {
    await syncFreemiumUsersTrialEndDate(plan.trialDays);
  }

  res.status(201).json({
    status: 201,
    message: 'Subscription plan created successfully',
    plan,
  });
});

const updatePlan = catchAsync(async (req, res) => {
  const { id } = req.params;
  const plan = await SubscriptionPlan.findById(id);

  if (!plan) {
    throw new ApiError('Subscription plan not found', 404);
  }

  const {
    name,
    tier,
    description,
    monthlyPrice,
    yearlyPrice,
    trialDays,
    features,
    accessibleFeatures,
    stripeMonthlyPriceId,
    stripeYearlyPriceId,
    isActive,
    order,
  } = req.body;

  if (name !== undefined) plan.name = name;
  if (tier !== undefined) plan.tier = tier;
  if (description !== undefined) plan.description = description;
  if (monthlyPrice !== undefined) plan.monthlyPrice = Number(monthlyPrice);
  if (yearlyPrice !== undefined) plan.yearlyPrice = Number(yearlyPrice);
  const effectiveIsTrialEligible = ['standard', 'professional'].includes(
    String(plan.tier || '').trim().toLowerCase(),
  );
  if (!effectiveIsTrialEligible) {
    plan.trialDays = 0;
  } else if (trialDays !== undefined) {
    plan.trialDays = Math.max(0, Number(trialDays) || 0);
  }
  if (features !== undefined) plan.features = Array.isArray(features) ? features : [];
  if (accessibleFeatures !== undefined) {
    plan.accessibleFeatures = Array.isArray(accessibleFeatures) ? accessibleFeatures : [];
  }
  if (stripeMonthlyPriceId !== undefined) plan.stripeMonthlyPriceId = stripeMonthlyPriceId;
  if (stripeYearlyPriceId !== undefined) plan.stripeYearlyPriceId = stripeYearlyPriceId;
  if (isActive !== undefined) plan.isActive = isActive;
  if (order !== undefined) plan.order = Number(order);

  await plan.save();

  if (effectiveIsTrialEligible && plan.isActive !== false && plan.trialDays > 0) {
    await syncFreemiumUsersTrialEndDate(plan.trialDays);
  }

  res.status(200).json({
    status: 200,
    message: 'Subscription plan updated successfully',
    plan,
  });
});

const deletePlan = catchAsync(async (req, res) => {
  const { id } = req.params;
  const plan = await SubscriptionPlan.findByIdAndDelete(id);

  if (!plan) {
    throw new ApiError('Subscription plan not found', 404);
  }

  res.status(200).json({
    status: 200,
    message: 'Subscription plan deleted successfully',
  });
});

module.exports = {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
};
