const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const maintenanceGuideSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    brandModel: {
      type: String,
      trim: true,
      default: '',
    },
    expectedLife: {
      type: String,
      trim: true,
      default: '',
    },
    difficulty: {
      type: String,
      trim: true,
      default: 'Intermediate',
    },
    overview: {
      type: String,
      trim: true,
      default: '',
    },
    checklist: [
      {
        task: {
          type: String,
          required: true,
        },
        frequency: {
          type: String,
          required: true,
        },
      },
    ],
    requiredTools: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EssentialTool',
      },
    ],
    relatedCodes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlumbingCode',
      },
    ],
    recommendedVideo: {
      type: String,
      trim: true,
      default: '',
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

maintenanceGuideSchema.plugin(toJSON);

const MaintenanceGuide = mongoose.model(
  'MaintenanceGuide',
  maintenanceGuideSchema,
);

module.exports = MaintenanceGuide;
