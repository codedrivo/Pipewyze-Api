const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/support.service');

const getSupportRequests = catchAsync(async (req, res) => {
  const requests = await service.getSupportRequests();
  res.status(200).json({
    status: 200,
    requests,
    data: { requests },
  });
});

const resolveSupportRequest = catchAsync(async (req, res) => {
  const { adminReply } = req.body;
  const request = await service.resolveSupportRequest(
    req.params.id,
    adminReply,
  );
  res.status(200).json({
    status: 200,
    message: 'Support request resolved and reply email sent successfully',
    request,
  });
});

module.exports = {
  getSupportRequests,
  resolveSupportRequest,
};
