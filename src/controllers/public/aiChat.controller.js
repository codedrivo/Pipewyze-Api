const AiChat = require('../../models/aiChat.model');
const catchAsync = require('../../helpers/asyncErrorHandler');

const getHistory = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;

  const history = await AiChat.find({ userId })
    .sort({ createdAt: 1 }); // Sort oldest to newest or -1 for newest first. Let's do oldest first or chronological order so client can load it sequentially.

  res.status(200).json({
    status: 200,
    history,
  });
});

module.exports = {
  getHistory,
};
