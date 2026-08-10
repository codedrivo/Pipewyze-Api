const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const plumbingCodeCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

plumbingCodeCategorySchema.plugin(toJSON);

const PlumbingCodeCategory = mongoose.model(
  'PlumbingCodeCategory',
  plumbingCodeCategorySchema,
);

module.exports = PlumbingCodeCategory;
