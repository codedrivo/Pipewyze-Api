const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/aiVideo.service');

// --- Question Controller ---

const createQuestion = catchAsync(async (req, res) => {
  const question = await service.createQuestion(req.body);
  res.status(201).json({
    status: 201,
    message: 'AI Video Question created successfully',
    question,
  });
});

const getQuestions = catchAsync(async (req, res) => {
  const search = req.query.search || '';
  const query = {};
  if (search) {
    query.question = { $regex: search, $options: 'i' };
  }
  const questions = await service.getQuestions(query);
  res.status(200).json({
    status: 200,
    questions,
  });
});

const getQuestionById = catchAsync(async (req, res) => {
  const question = await service.getQuestionById(req.params.id);
  res.status(200).json({
    status: 200,
    question,
  });
});

const updateQuestion = catchAsync(async (req, res) => {
  const question = await service.updateQuestionById(req.params.id, req.body);
  res.status(200).json({
    status: 200,
    message: 'AI Video Question updated successfully',
    question,
  });
});

const deleteQuestion = catchAsync(async (req, res) => {
  await service.deleteQuestionById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'AI Video Question and related videos deleted successfully',
  });
});

// --- Video Controller ---

const createVideo = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.thumbnail = req.file.location;
  }
  const video = await service.createVideo(data);
  res.status(201).json({
    status: 201,
    message: 'AI Video created successfully',
    video,
  });
});

const getVideos = catchAsync(async (req, res) => {
  const { questionId, targetAudience, search } = req.query;
  const query = {};
  if (questionId) {
    query.questionId = questionId;
  }
  if (targetAudience) {
    query.targetAudience = targetAudience;
  }
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }
  const videos = await service.getVideos(query);
  res.status(200).json({
    status: 200,
    videos,
  });
});

const getVideoById = catchAsync(async (req, res) => {
  const video = await service.getVideoById(req.params.id);
  res.status(200).json({
    status: 200,
    video,
  });
});

const updateVideo = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.thumbnail = req.file.location;
  }
  const video = await service.updateVideoById(req.params.id, data);
  res.status(200).json({
    status: 200,
    message: 'AI Video updated successfully',
    video,
  });
});

const deleteVideo = catchAsync(async (req, res) => {
  await service.deleteVideoById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'AI Video deleted successfully',
  });
});

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  createVideo,
  getVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
};
