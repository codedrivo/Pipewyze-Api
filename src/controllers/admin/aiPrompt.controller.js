const AiPrompt = require('../../models/aiPrompt.model');
const AiChat = require('../../models/aiChat.model');
const Settings = require('../../models/setting.model');
const Subscription = require('../../models/subscription.model');
const catchAsync = require('../../helpers/asyncErrorHandler');
const ApiError = require('../../helpers/apiErrorConverter');

const getPrompts = catchAsync(async (req, res) => {
  const { role, isActive, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (role) filter.targetRole = { $in: ['all', role] };
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const prompts = await AiPrompt.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  const total = await AiPrompt.countDocuments(filter);

  res.status(200).json({
    status: 200,
    prompts,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

const createPrompt = catchAsync(async (req, res) => {
  const { prompt, category, targetRole, isActive, order } = req.body;

  if (!prompt || !prompt.trim()) {
    throw new ApiError('Prompt text is required', 400);
  }

  const newPrompt = await AiPrompt.create({
    prompt: prompt.trim(),
    category: category || 'General',
    targetRole: targetRole || 'all',
    isActive: isActive !== undefined ? isActive : true,
    order: order || 0,
  });

  res.status(201).json({
    status: 201,
    message: 'AI Prompt created successfully',
    prompt: newPrompt,
  });
});

const updatePrompt = catchAsync(async (req, res) => {
  const { id } = req.params;
  const promptItem = await AiPrompt.findById(id);

  if (!promptItem) {
    throw new ApiError('AI Prompt not found', 404);
  }

  const { prompt, category, targetRole, isActive, order } = req.body;

  if (prompt !== undefined) promptItem.prompt = prompt.trim();
  if (category !== undefined) promptItem.category = category;
  if (targetRole !== undefined) promptItem.targetRole = targetRole;
  if (isActive !== undefined) promptItem.isActive = isActive;
  if (order !== undefined) promptItem.order = order;

  await promptItem.save();

  res.status(200).json({
    status: 200,
    message: 'AI Prompt updated successfully',
    prompt: promptItem,
  });
});

const deletePrompt = catchAsync(async (req, res) => {
  const { id } = req.params;
  const promptItem = await AiPrompt.findByIdAndDelete(id);

  if (!promptItem) {
    throw new ApiError('AI Prompt not found', 404);
  }

  res.status(200).json({
    status: 200,
    message: 'AI Prompt deleted successfully',
  });
});

const getSuggestedPrompts = catchAsync(async (req, res) => {
  const role = req.user ? req.user.role : 'all';

  const prompts = await AiPrompt.find({
    isActive: true,
    targetRole: { $in: ['all', role] },
  })
    .sort({ order: 1, createdAt: -1 })
    .limit(10);

  res.status(200).json({
    status: 200,
    prompts,
  });
});

const getAiUsageStatus = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;

  const usedCount = await AiChat.countDocuments({ userId });

  const subscription = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trialing'] },
  });

  const isSubscribed = !!subscription;

  res.status(200).json({
    status: 200,
    usedCount,
    isSubscribed,
  });
});

const getUserAiUsageReport = catchAsync(async (req, res) => {
  const User = require('../../models/user.model');
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search ? req.query.search.trim() : '';

  const query = { role: { $ne: 'admin' } };
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const total = await User.countDocuments(query);
  const users = await User.find(query, 'fullName email role profileimageurl createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const userIds = users.map((u) => u._id);

  const aiCounts = await AiChat.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);

  const activeSubs = await Subscription.find({
    userId: { $in: userIds },
  }).sort({ createdAt: -1 }).lean();

  const aiCountMap = {};
  aiCounts.forEach((item) => {
    aiCountMap[item._id.toString()] = item.count;
  });

  const subMap = {};
  activeSubs.forEach((sub) => {
    const uStr = sub.userId.toString();
    if (!subMap[uStr]) subMap[uStr] = sub;
  });

  const report = users.map((u) => {
    const uIdStr = u._id.toString();
    const usedCount = aiCountMap[uIdStr] || 0;
    const sub = subMap[uIdStr];
    const isSubscribed = sub && ['active', 'trialing'].includes(sub.status);

    return {
      userId: u._id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      usedCount,
      isSubscribed,
      subscriptionStatus: sub ? sub.status : 'unsubscribed',
      createdAt: u.createdAt,
    };
  });

  res.status(200).json({
    status: 200,
    report,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

module.exports = {
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getSuggestedPrompts,
  getAiUsageStatus,
  getUserAiUsageReport,
};

