const AiChat = require('../../models/aiChat.model');
const catchAsync = require('../../helpers/asyncErrorHandler');

const getHistory = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const role = req.user.role || 'unknown';

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 100;
  const skip = (page - 1) * limit;

  console.log(
    `\n[AI VIDEO HISTORY] Request received for userId: ${userId} | role: ${role}`,
  );
  console.log(`[AI VIDEO HISTORY] Query: page=${page}, limit=${limit}`);

  // Prevent HTTP Caching for this dynamic route
  res.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const history = await AiChat.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await AiChat.countDocuments({ userId });

  console.log(
    `[AI VIDEO HISTORY] Result count: ${history.length} (Total: ${total})`,
  );
  if (history.length > 0) {
    console.log(
      `[AI VIDEO HISTORY] Latest record createdAt: ${history[0].createdAt}`,
    );
  }

  res.status(200).json({
    status: 200,
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });

  console.log(`[AI VIDEO HISTORY] Response sent\n`);
});

module.exports = {
  getHistory,
};
