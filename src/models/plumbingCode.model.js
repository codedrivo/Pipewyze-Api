const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const plumbingCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    exception: {
      type: String,
      default: '',
    },
    plainLanguageInterpretation: {
      type: String,
      required: true,
    },
    documents: [
      {
        name: String,
        url: String,
      },
    ],
    documentName: {
      type: String,
      default: '',
    },
    documentUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

plumbingCodeSchema.plugin(toJSON);

const PlumbingCode = mongoose.model('PlumbingCode', plumbingCodeSchema);

module.exports = PlumbingCode;
