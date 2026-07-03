const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const tokenSchema = mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['access', 'refresh'],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

tokenSchema.plugin(toJSON);

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
