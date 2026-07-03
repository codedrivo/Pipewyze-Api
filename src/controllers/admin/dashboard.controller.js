// const catchAsync = require('../../helpers/asyncErrorHandler');
// const userService = require('../../services/admin/user.service');

// const getDashboardData = catchAsync(async (req, res, next) => {
//   // Fetch all required data concurrently
//   const [
//     totalUsers,
//   ] = await Promise.all([
//     userService.getUsersCount(),
//   ]);

//   // Send the response
//   res.status(200).json({
//     status: 200,
//     totalUsers
//   });
// });

// module.exports = {
//   getDashboardData,
// };
const catchAsync = require('../../helpers/asyncErrorHandler');
const userService = require('../../services/admin/user.service');
const orderService = require('../../services/service/order.service');
const supportService = require('../../services/admin/support.service');
const serviceService = require('../../services/admin/service.service');

const getDashboardData = catchAsync(async (req, res, next) => {
  const [
    totalUsers,
    totalTransactions,
    totalSupportRequests,
    totalReports,
    ordersChart,
    revenueChart,
  ] = await Promise.all([
    userService.getUsersCount(),
    orderService.getOrdersCount(),
    supportService.getSupportCount(),
    serviceService.getServicesCount(),
    orderService.getMonthlyOrderStats(),
    orderService.getMonthlyRevenueStats(),
  ]);

  res.status(200).json({
    status: 200,

    data: {
      totalUsers,
      totalTransactions,
      totalSupportRequests,
      totalReports,
      ordersChart,
      revenueChart,
    },
  });
});

module.exports = {
  getDashboardData,
};
