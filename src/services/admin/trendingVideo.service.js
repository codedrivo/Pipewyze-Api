const TrendingVideo = require('../../models/trendingVideo.model');
const ApiError = require('../../helpers/apiErrorConverter');
const notificationService = require('../notification.service');

const createTrendingVideo = async (data) => {
  const video = await TrendingVideo.create(data);

  // Send push notification to apprentice role
  notificationService
    .sendToRole(
      'apprentice',
      'New Trending Video Added',
      `A new trending video "${video.title}" is now available.`,
      { videoId: video._id.toString() },
    )
    .catch((err) =>
      console.error('Failed sending notification to apprentice:', err.message),
    );

  // Send push notification to licensed-plumber role
  notificationService
    .sendToRole(
      'licensed-plumber',
      'New Trending Video Added',
      `A new trending video "${video.title}" is now available.`,
      { videoId: video._id.toString() },
    )
    .catch((err) =>
      console.error('Failed sending notification to plumber:', err.message),
    );

  return video;
};

const getTrendingVideos = async (query = {}) => {
  const videos = await TrendingVideo.find(query).sort({ createdAt: -1 });
  return videos;
};

const getTrendingVideoById = async (id) => {
  const video = await TrendingVideo.findById(id);
  if (!video) {
    throw new ApiError('Trending video not found', 404);
  }
  return video;
};

const updateTrendingVideoById = async (id, data) => {
  const video = await getTrendingVideoById(id);
  Object.assign(video, data);
  await video.save();
  return video;
};

const deleteTrendingVideoById = async (id) => {
  const video = await getTrendingVideoById(id);
  await TrendingVideo.deleteOne({ _id: id });
  return video;
};

module.exports = {
  createTrendingVideo,
  getTrendingVideos,
  getTrendingVideoById,
  updateTrendingVideoById,
  deleteTrendingVideoById,
};
