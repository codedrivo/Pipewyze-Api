const catchAsync = require('../../../helpers/asyncErrorHandler');
const Equipment = require('../../../models/equipment.model');
const User = require('../../../models/user.model');

const getDashboardSummary = catchAsync(async (req, res) => {
  const homeownerId = req.user._id;

  // 1. Get equipment count
  const equipmentCount = await Equipment.countDocuments({ ownerId: homeownerId });

  // 2. Get upcoming services/maintenance (nextServiceDate in the future)
  const now = new Date();
  const upcomingServices = await Equipment.find({
    ownerId: homeownerId,
    nextServiceDate: { $gt: now }
  })
  .sort({ nextServiceDate: 1 })
  .limit(5);

  // 3. Count nearby active plumbers (for now count all registered licensed-plumbers)
  const plumberCount = await User.countDocuments({ role: 'licensed-plumber' });

  res.status(200).send({
    status: 200,
    data: {
      equipmentCount,
      upcomingServices,
      plumberCount,
    }
  });
});

module.exports = {
  getDashboardSummary,
};
