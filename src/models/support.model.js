const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const supportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    adminReply: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
    },
  },
  {
    timestamps: true,
  },
);

supportSchema.plugin(toJSON);

const Support = mongoose.model('Support', supportSchema);

module.exports = Support;
