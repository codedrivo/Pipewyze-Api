const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    sitelogo: {
      type: String,
      default: '',
    },
    footerlogo: {
      type: String,
      default: '',
    },
    copyright: {
      type: String,
    },
    adminEmail: {
      type: String,
      default: '',
    },
    twitterUrl: {
      type: String,
      default: '',
    },
    instagramUrl: {
      type: String,
      default: '',
    },
    linkedinUrl: {
      type: String,
      default: '',
    },
    tiktok: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

const Settings = mongoose.model('setting', settingsSchema);
module.exports = Settings;
