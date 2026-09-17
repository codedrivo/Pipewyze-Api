const mongoose = require('mongoose');

const aiCacheSchema = new mongoose.Schema(
  {
    queryHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    rawQuery: {
      type: String,
      required: true,
    },
    response: {
      type: String,
      required: true,
    },
    suggestedVideo: {
      type: Object,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000, // 30 days in seconds TTL
    },
  },
  {
    timestamps: true,
  },
);

const AiCache = mongoose.model('AiCache', aiCacheSchema);

module.exports = AiCache;
