const catchAsync = require('../../helpers/asyncErrorHandler');
const userService = require('../../services/admin/user.service');
const User = require('../../models/user.model');
const Subscription = require('../../models/subscription.model');
const SubscriptionPlan = require('../../models/subscriptionPlan.model');

const getDashboardData = catchAsync(async (req, res, next) => {
  const totalUsers = await userService.getUsersCount();

  // Tier breakdown from User model
  const freemiumUsers = await User.countDocuments({
    $or: [{ subscriptionTier: 'freemium' }, { subscriptionTier: { $exists: false } }, { subscriptionTier: null }],
  });
  const standardUsers = await User.countDocuments({ subscriptionTier: 'standard' });
  const professionalUsers = await User.countDocuments({ subscriptionTier: 'professional' });

  // Recent Subscriptions/Transactions
  const recentTransactions = await Subscription.find()
    .populate('userId', 'firstName lastName email subscriptionTier profileimageurl')
    .populate('planId', 'name monthlyPrice yearlyPrice tier')
    .sort({ createdAt: -1 })
    .limit(100);

  const totalTransactions = await Subscription.countDocuments();

  // Monthly Revenue Calculation (last 6 months)
  const now = new Date();
  const months = [];
  const revenueData = [];
  const ordersData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString('default', { month: 'short' });
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    months.push(monthName);

    const subCount = await Subscription.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    });
    ordersData.push(subCount);

    // Calculate sum of active/paid subscriptions in this period
    const subsInMonth = await Subscription.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).populate('planId');

    let sumRevenue = 0;
    subsInMonth.forEach((s) => {
      if (s.planId) {
        sumRevenue += s.planId.monthlyPrice || 0;
      }
    });

    revenueData.push(sumRevenue);
  }

  res.status(200).json({
    status: 200,
    data: {
      totalUsers,
      totalTransactions,
      tierStats: {
        freemium: freemiumUsers,
        standard: standardUsers,
        professional: professionalUsers,
      },
      recentTransactions,
      revenueChart: {
        labels: months,
        data: revenueData,
      },
      ordersChart: {
        labels: months,
        data: ordersData,
      },
      tierChart: {
        labels: ['Free Tier', 'Standard Tier', 'Premium (Professional) Tier'],
        data: [freemiumUsers, standardUsers, professionalUsers],
      },
    },
  });
});

module.exports = {
  getDashboardData,
};
