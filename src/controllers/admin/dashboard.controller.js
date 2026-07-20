const catchAsync = require('../../helpers/asyncErrorHandler');
const userService = require('../../services/admin/user.service');

const getDashboardData = catchAsync(async (req, res, next) => {
  const totalUsers = await userService.getUsersCount();

  res.status(200).json({
    status: 200,
    data: {
      totalUsers,
      totalTransactions: 0,
      totalSupportRequests: 0,
      totalReports: 0,
      ordersChart: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        data: [0, 0, 0, 0, 0, 0],
      },
      revenueChart: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        data: [0, 0, 0, 0, 0, 0],
      },
    },
  });
});

module.exports = {
  getDashboardData,
};
