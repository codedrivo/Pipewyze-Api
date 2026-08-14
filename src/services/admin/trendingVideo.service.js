const TrendingVideo = require('../../models/trendingVideo.model');
const ApiError = require('../../helpers/apiErrorConverter');

const createTrendingVideo = async (data) => {
  const video = await TrendingVideo.create(data);
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
