const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    response: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      default: '',
    },
    fileType: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    suggestedVideo: {
      id: { type: String, default: null },
      title: { type: String, default: '' },
      videoUrl: { type: String, default: '' },
      description: { type: String, default: '' },
      thumbnail: { type: String, default: '' },
      isYoutube: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  },
);

aiChatSchema.plugin(toJSON);

const AiChat = mongoose.model('AiChat', aiChatSchema);

module.exports = AiChat;
