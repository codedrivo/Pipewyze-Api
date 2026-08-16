const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const savedResourceSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'resourceType',
    },
    resourceType: {
      type: String,
      required: true,
      enum: [
        'MaintenanceGuide',
        'PlumbingCode',
        'EssentialTool',
        'LibraryTools',
      ],
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate saves of the same resource by a user
savedResourceSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

savedResourceSchema.plugin(toJSON);

const SavedResource = mongoose.model('SavedResource', savedResourceSchema);

module.exports = SavedResource;
