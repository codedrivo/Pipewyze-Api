const catchAsync = require('../../../helpers/asyncErrorHandler');
const Equipment = require('../../../models/equipment.model');
const User = require('../../../models/user.model');
const moment = require('moment-timezone');

const getDashboardSummary = catchAsync(async (req, res) => {
  const homeownerId = req.user._id;

  // 1. Get equipment count
  const equipmentCount = await Equipment.countDocuments({
    ownerId: homeownerId,
  });

  const now = moment().startOf('day').toDate();
  const targetDateEnd = moment().add(4, 'days').endOf('day').toDate();

  // 2. Get upcoming/near services/maintenance (within 4 days)
  const upcomingServices = await Equipment.find({
    ownerId: homeownerId,
    nextServiceDate: { $gte: now, $lte: targetDateEnd },
  })
    .sort({ nextServiceDate: 1 })
    .limit(5);

  // 3. Count nearby active plumbers (for now count all registered licensed-plumbers)
  const plumberCount = await User.countDocuments({ role: 'licensed-plumber' });

  const recentReminder =
    upcomingServices.length > 0 ? upcomingServices[0] : null;

  res.status(200).send({
    status: 200,
    data: {
      equipmentCount,
      upcomingServices,
      recentReminder,
      plumberCount,
    },
  });
});

const getRecentReminder = catchAsync(async (req, res) => {
  const homeownerId = req.user._id;

  const now = moment().startOf('day').toDate();
  const targetDateEnd = moment().add(4, 'days').endOf('day').toDate();

  const reminders = await Equipment.find({
    ownerId: homeownerId,
    nextServiceDate: { $gte: now, $lte: targetDateEnd },
  })
    .populate('plumberId', 'fullName email phone profileimageurl')
    .sort({ nextServiceDate: 1 });

  res.status(200).send({
    status: 200,
    data: reminders,
  });
});

module.exports = {
  getDashboardSummary,
  getRecentReminder,
};
