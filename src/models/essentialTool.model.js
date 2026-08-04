const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const essentialToolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
      default: '',
    },
    recommendationLink: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    purpose: {
      type: String,
      trim: true,
      default: '',
    },
    bestUsedFor: [
      {
        type: String,
        trim: true,
      },
    ],
    howToUse: [
      {
        type: String,
        trim: true,
      },
    ],
    safetyTips: [
      {
        type: String,
        trim: true,
      },
    ],
    recommendedVideo: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

essentialToolSchema.plugin(toJSON);

const EssentialTool = mongoose.model('EssentialTool', essentialToolSchema);

module.exports = EssentialTool;
