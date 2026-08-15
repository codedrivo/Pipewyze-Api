const Support = require('../../models/support.model');
const emailService = require('../email/email.service');
const ApiError = require('../../helpers/apiErrorConverter');

const getSupportRequests = async () => {
  const requests = await Support.find().sort({ createdAt: -1 });
  return requests;
};

const resolveSupportRequest = async (id, adminReply) => {
  const request = await Support.findById(id);
  if (!request) {
    throw new ApiError('Support request not found', 404);
  }

  request.adminReply = adminReply;
  request.status = 'resolved';
  await request.save();

  // Send the template email back to the user
  const fullName = `${request.firstName} ${request.lastName || ''}`.trim() || 'User';
  await emailService.sendTemplateEmail({
    to: request.email,
    subject: `PipeWyze Support: Re: ${request.subject || 'Support Request'}`,
    templateName: 'support-reply',
    variables: {
      name: fullName,
      message: request.message,
      replyMessage: adminReply,
    },
  });

  return request;
};

module.exports = {
  getSupportRequests,
  resolveSupportRequest,
};
