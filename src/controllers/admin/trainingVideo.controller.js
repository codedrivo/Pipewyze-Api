const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/trainingVideo.service');

const createTrainingVideo = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.thumbnail = req.file.location;
  }
  const video = await service.createTrainingVideo(data);
  res.status(201).json({
    status: 201,
    message: 'Training video created successfully',
    video,
  });
});

const getTrainingVideos = catchAsync(async (req, res) => {
  const search = req.query.search || '';
  const targetAudience = req.query.targetAudience || '';
  const isAiVideo = req.query.isAiVideo;
  const query = {};
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }
  if (targetAudience) {
    query.targetAudience = targetAudience;
  }
  if (isAiVideo !== undefined) {
    query.isAiVideo = isAiVideo === 'true';
  }
  const videos = await service.getTrainingVideos(query);
  res.status(200).json({
    status: 200,
    videos,
  });
});

const getTrainingVideo = catchAsync(async (req, res) => {
  const video = await service.getTrainingVideoById(req.params.id);
  res.status(200).json({
    status: 200,
    video,
  });
});

const updateTrainingVideo = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.thumbnail = req.file.location;
  }
  const video = await service.updateTrainingVideoById(req.params.id, data);
  res.status(200).json({
    status: 200,
    message: 'Training video updated successfully',
    video,
  });
});

const deleteTrainingVideo = catchAsync(async (req, res) => {
  await service.deleteTrainingVideoById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Training video deleted successfully',
  });
});

module.exports = {
  createTrainingVideo,
  getTrainingVideos,
  getTrainingVideo,
  updateTrainingVideo,
  deleteTrainingVideo,
};
