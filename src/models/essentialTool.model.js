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
  },
  {
    timestamps: true,
  },
);

essentialToolSchema.plugin(toJSON);

const EssentialTool = mongoose.model('EssentialTool', essentialToolSchema);

module.exports = EssentialTool;
