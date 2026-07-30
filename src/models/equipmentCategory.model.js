const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const equipmentCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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

equipmentCategorySchema.plugin(toJSON);

const EquipmentCategory = mongoose.model(
  'EquipmentCategory',
  equipmentCategorySchema,
);

module.exports = EquipmentCategory;
