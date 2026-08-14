const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const trendingVideoSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  },
);

trendingVideoSchema.plugin(toJSON);

const TrendingVideo = mongoose.model('TrendingVideo', trendingVideoSchema);

module.exports = TrendingVideo;
