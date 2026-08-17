const AiVideoQuestion = require('../../models/aiVideoQuestion.model');
const AiVideo = require('../../models/aiVideo.model');
const ApiError = require('../../helpers/apiErrorConverter');

// --- Question Service Methods ---

const createQuestion = async (data) => {
  const question = await AiVideoQuestion.create(data);
  return question;
};

const getQuestions = async (query = {}) => {
  const questions = await AiVideoQuestion.find(query).sort({ createdAt: -1 });
  return questions;
};

const getQuestionById = async (id) => {
  const question = await AiVideoQuestion.findById(id);
  if (!question) {
    throw new ApiError('AI Video Question not found', 404);
  }
  return question;
};

const updateQuestionById = async (id, data) => {
  const question = await getQuestionById(id);
  Object.assign(question, data);
  await question.save();
  return question;
};

const deleteQuestionById = async (id) => {
  const question = await getQuestionById(id);
  // Delete all nested videos
  await AiVideo.deleteMany({ questionId: id });
  // Delete the question
  await AiVideoQuestion.deleteOne({ _id: id });
  return question;
};

// --- Video Service Methods ---

const createVideo = async (data) => {
  let question = await AiVideoQuestion.findOne({ question: data.question.trim() });
  if (!question) {
    question = await AiVideoQuestion.create({ question: data.question.trim() });
  }
  const videoData = {
    ...data,
    questionId: question._id,
  };
  const video = await AiVideo.create(videoData);
  return video;
};

const getVideos = async (query = {}) => {
  const videos = await AiVideo.find(query).populate('questionId').sort({ createdAt: -1 });
  return videos;
};

const getVideoById = async (id) => {
  const video = await AiVideo.findById(id).populate('questionId');
  if (!video) {
    throw new ApiError('AI Video not found', 404);
  }
  return video;
};

const updateVideoById = async (id, data) => {
  const video = await getVideoById(id);
  let questionId = video.questionId;
  if (data.question) {
    let question = await AiVideoQuestion.findOne({ question: data.question.trim() });
    if (!question) {
      question = await AiVideoQuestion.create({ question: data.question.trim() });
    }
    questionId = question._id;
  }
  const updateData = {
    ...data,
    questionId,
  };
  Object.assign(video, updateData);
  await video.save();
  return video;
};

const deleteVideoById = async (id) => {
  const video = await getVideoById(id);
  await AiVideo.deleteOne({ _id: id });
  return video;
};

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestionById,
  deleteQuestionById,
  createVideo,
  getVideos,
  getVideoById,
  updateVideoById,
  deleteVideoById,
};
