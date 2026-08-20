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
    audience: {
      type: String,
      enum: ['home-owner', 'apprentice', 'licensed-plumber'],
      default: 'home-owner',
    },
  },
  {
    timestamps: true,
  },
);

essentialToolSchema.plugin(toJSON);

const EssentialTool = mongoose.model('EssentialTool', essentialToolSchema);
mongoose.model('LibraryTools', essentialToolSchema, 'essentialtools');

module.exports = EssentialTool;
