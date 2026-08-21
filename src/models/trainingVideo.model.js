const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const trainingVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    thumbnail: {
      type: String,
      default: '',
    },
    targetAudience: {
      type: String,
      enum: ['apprentice', 'licensed-plumber', 'home-owner'],
      default: 'apprentice',
    },
    isAiVideo: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

trainingVideoSchema.plugin(toJSON);

const TrainingVideo = mongoose.model(
  'TrainingVideo',
  trainingVideoSchema,
  'trendingvideos',
);

module.exports = TrainingVideo;
