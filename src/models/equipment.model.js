const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const equipmentSchema = new mongoose.Schema(
  {
    plumberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'Water Heaters',
        'Pressure Reducing Valves',
        'Shut-off Valves',
        'Water Softeners',
        'Whole-house Filters',
        'Toilets',
        'Faucets',
        'Showerheads',
      ],
      required: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    installationDate: {
      type: Date,
    },
    nextServiceDate: {
      type: Date,
    },
    image: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

equipmentSchema.plugin(toJSON);

const Equipment = mongoose.model('Equipment', equipmentSchema);

module.exports = Equipment;
