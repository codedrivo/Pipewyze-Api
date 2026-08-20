/* eslint-disable no-console */
const TrainingVideo = require('../../models/trainingVideo.model');
const ApiError = require('../../helpers/apiErrorConverter');
const notificationService = require('../notification.service');

const createTrainingVideo = async (data) => {
  const video = await TrainingVideo.create(data);

  // Send push notification to apprentice role
  notificationService
    .sendToRole(
      'apprentice',
      'New Training Video Added',
      `A new training video "${video.title}" is now available.`,
      { videoId: video._id.toString() },
    )
    .catch((err) =>
      console.error('Failed sending notification to apprentice:', err.message),
    );

  // Send push notification to licensed-plumber role
  notificationService
    .sendToRole(
      'licensed-plumber',
      'New Training Video Added',
      `A new training video "${video.title}" is now available.`,
      { videoId: video._id.toString() },
    )
    .catch((err) =>
      console.error('Failed sending notification to plumber:', err.message),
    );

  return video;
};

const getTrainingVideos = async (query = {}) => {
  const videos = await TrainingVideo.find(query).sort({ createdAt: -1 });
  return videos;
};

const getTrainingVideoById = async (id) => {
  const video = await TrainingVideo.findById(id);
  if (!video) {
    throw new ApiError('Training video not found', 404);
  }
  return video;
};

const updateTrainingVideoById = async (id, data) => {
  const video = await getTrainingVideoById(id);
  Object.assign(video, data);
  await video.save();
  return video;
};

const deleteTrainingVideoById = async (id) => {
  const video = await getTrainingVideoById(id);
  await TrainingVideo.deleteOne({ _id: id });
  const SavedResource = require('../../models/savedResource.model');
  await SavedResource.deleteMany({ resourceId: id });
  return video;
};

module.exports = {
  createTrainingVideo,
  getTrainingVideos,
  getTrainingVideoById,
  updateTrainingVideoById,
  deleteTrainingVideoById,
};
