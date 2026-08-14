const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/trendingVideo.service');

const createTrendingVideo = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.thumbnail = req.file.location;
  }
  const video = await service.createTrendingVideo(data);
  res.status(201).json({
    status: 201,
    message: 'Trending video created successfully',
    video,
  });
});

const getTrendingVideos = catchAsync(async (req, res) => {
  const search = req.query.search || '';
  const query = {};
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }
  const videos = await service.getTrendingVideos(query);
  res.status(200).json({
    status: 200,
    videos,
  });
});

const getTrendingVideo = catchAsync(async (req, res) => {
  const video = await service.getTrendingVideoById(req.params.id);
  res.status(200).json({
    status: 200,
    video,
  });
});

const updateTrendingVideo = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.thumbnail = req.file.location;
  }
  const video = await service.updateTrendingVideoById(req.params.id, data);
  res.status(200).json({
    status: 200,
    message: 'Trending video updated successfully',
    video,
  });
});

const deleteTrendingVideo = catchAsync(async (req, res) => {
  await service.deleteTrendingVideoById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Trending video deleted successfully',
  });
});

module.exports = {
  createTrendingVideo,
  getTrendingVideos,
  getTrendingVideo,
  updateTrendingVideo,
  deleteTrendingVideo,
};
