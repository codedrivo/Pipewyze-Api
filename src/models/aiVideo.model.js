const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const aiVideoSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiVideoQuestion',
      required: true,
    },
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
      enum: ['apprentice', 'licensed-plumber'],
      default: 'apprentice',
    },
  },
  {
    timestamps: true,
  },
);

aiVideoSchema.plugin(toJSON);

const AiVideo = mongoose.model('AiVideo', aiVideoSchema);

module.exports = AiVideo;
