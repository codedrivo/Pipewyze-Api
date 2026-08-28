const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: Map,
      of: String,
      default: {},
    },
    type: {
      type: String,
      enum: ['system', 'chat', 'ai_chat', 'maintenance'],
      default: 'system',
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.plugin(toJSON);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
