const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const licensedPlumberProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    yearsOfService: {
      type: String,
      default: '',
    },
    serviceLocations: {
      type: [String],
      default: [],
    },
    servicesOffered: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

licensedPlumberProfileSchema.plugin(toJSON);

const LicensedPlumberProfile = mongoose.model(
  'LicensedPlumberProfile',
  licensedPlumberProfileSchema,
);

module.exports = LicensedPlumberProfile;
