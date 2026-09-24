const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const aiPromptSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    targetRole: {
      type: String,
      enum: ['all', 'home-owner', 'apprentice', 'licensed-plumber'],
      default: 'all',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

aiPromptSchema.plugin(toJSON);
aiPromptSchema.plugin(paginate);

const AiPrompt = mongoose.model('AiPrompt', aiPromptSchema);

module.exports = AiPrompt;
