const SubscriptionPlan = require('../../models/subscriptionPlan.model');
const catchAsync = require('../../helpers/asyncErrorHandler');
const ApiError = require('../../helpers/apiErrorConverter');

const DEFAULT_PLANS = [
  {
    name: '$1 One-Time Test Plan',
    tier: 'standard',
    description: 'Static $1.00 one-time checkout test plan for transaction verification.',
    monthlyPrice: 1.00,
    yearlyPrice: 1.00,
    trialDays: 0,
    features: [
      '$1 One-Time payment test',
      'Instant access verification',
      'Transaction testing',
    ],
    accessibleFeatures: [
      { key: 'equipment', label: 'Equipment & Parts Directory', enabled: false },
      { key: 'essential_tools', label: 'Essential Tools & Recommendations', enabled: false },
      { key: 'maintenance_guides', label: 'Maintenance Guides', enabled: false },
      { key: 'plumbing_codes', label: 'Plumbing Code Reference', enabled: false },
      { key: 'training_videos', label: 'Training Videos Library', enabled: false },
    ],
    isActive: true,
    order: 1,
  },
  {
    name: '$1/day Recurring Test Plan',
    tier: 'professional',
    description: 'Static $1.00/day daily recurring subscription test plan for transaction verification.',
    monthlyPrice: 1.00,
    yearlyPrice: 365.00,
    trialDays: 0,
    features: [
      '$1/day daily recurring subscription test',
      'Daily billing verification',
      'Transaction testing',
    ],
    accessibleFeatures: [
      { key: 'equipment', label: 'Equipment & Parts Directory', enabled: false },
      { key: 'essential_tools', label: 'Essential Tools & Recommendations', enabled: false },
      { key: 'maintenance_guides', label: 'Maintenance Guides', enabled: false },
      { key: 'plumbing_codes', label: 'Plumbing Code Reference', enabled: false },
      { key: 'training_videos', label: 'Training Videos Library', enabled: false },
    ],
    isActive: true,
    order: 2,
  },
];

const seedPlansIfEmpty = async () => {
  try {
    await SubscriptionPlan.collection.dropIndex('tier_1').catch(() => {});
  } catch (err) {
    // index already dropped or collection does not exist yet
  }

  const count = await SubscriptionPlan.countDocuments();
  if (count === 0) {
    await SubscriptionPlan.insertMany(DEFAULT_PLANS);
    console.log('[SubscriptionPlan] Default $1 Test plans seeded.');
  } else {
    // Ensure $1 static test plans exist for testing transactions
    const oneTimeTest = await SubscriptionPlan.findOne({ name: '$1 One-Time Test Plan' });
    if (!oneTimeTest) {
      await SubscriptionPlan.create(DEFAULT_PLANS[0]);
    }
    const dailyTest = await SubscriptionPlan.findOne({
      $or: [{ name: '$1/day Recurring Test Plan' }, { name: '$1/mo Recurring Test Plan' }],
    });
    if (!dailyTest) {
      await SubscriptionPlan.create(DEFAULT_PLANS[1]);
    } else {
      dailyTest.name = '$1/day Recurring Test Plan';
      dailyTest.description = 'Static $1.00/day daily recurring subscription test plan for transaction verification.';
      dailyTest.features = [
        '$1/day daily recurring subscription test',
        'Daily billing verification',
        'Transaction testing',
      ];
      if (!dailyTest.accessibleFeatures || dailyTest.accessibleFeatures.length === 0) {
        dailyTest.accessibleFeatures = DEFAULT_PLANS[1].accessibleFeatures;
      }
      await dailyTest.save();
    }
  }
};

const getPlans = catchAsync(async (req, res) => {
  await seedPlansIfEmpty();
  const plans = await SubscriptionPlan.find().sort({ order: 1 });
  res.status(200).json({
    status: 200,
    plans,
  });
});

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

  const plan = await SubscriptionPlan.create({
    name,
    tier,
    description: description || '',
    monthlyPrice: Number(monthlyPrice) || 0,
    yearlyPrice: Number(yearlyPrice) || 0,
    trialDays: Number(trialDays) || 0,
    features: Array.isArray(features) ? features : [],
    accessibleFeatures: Array.isArray(accessibleFeatures) ? accessibleFeatures : [],
    stripeMonthlyPriceId: stripeMonthlyPriceId || '',
    stripeYearlyPriceId: stripeYearlyPriceId || '',
    isActive: isActive !== undefined ? isActive : true,
    order: Number(order) || 0,
  });

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
  if (trialDays !== undefined) plan.trialDays = Number(trialDays);
  if (features !== undefined) plan.features = Array.isArray(features) ? features : [];
  if (accessibleFeatures !== undefined) {
    plan.accessibleFeatures = Array.isArray(accessibleFeatures) ? accessibleFeatures : [];
  }
  if (stripeMonthlyPriceId !== undefined) plan.stripeMonthlyPriceId = stripeMonthlyPriceId;
  if (stripeYearlyPriceId !== undefined) plan.stripeYearlyPriceId = stripeYearlyPriceId;
  if (isActive !== undefined) plan.isActive = isActive;
  if (order !== undefined) plan.order = Number(order);

  await plan.save();

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
