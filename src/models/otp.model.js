const mongoose = require('mongoose');
const validator = require('validator');
const { toJSON } = require('./plugins');
const ApiError = require('../helpers/apiErrorConverter');

const otpSchema = new mongoose.Schema(
  {
    otp: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ['email', 'phone'],
      required: true,
    },

    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (this.type === 'email' && !validator.isEmail(value)) {
          throw new ApiError('Invalid email address', 400);
        }

        if (this.type === 'phone' && !validator.isMobilePhone(value, 'any')) {
          throw new ApiError('Invalid phone number', 400);
        }
      },
    },

    is_verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

otpSchema.plugin(toJSON);

const Otp = mongoose.model('Otp', otpSchema);

module.exports = Otp;
