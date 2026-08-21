const SavedResource = require('../../models/savedResource.model');
const ApiError = require('../../helpers/apiErrorConverter');

// Pre-register referenced schemas to ensure populate works without lazy-loading issues
require('../../models/essentialTool.model');
require('../../models/maintenanceGuide.model');
require('../../models/plumbingCode.model');
require('../../models/trainingVideo.model');

const resolveResourceType = async (userId, resourceId, originalType) => {
  const mongoose = require('mongoose');

  // Check if it exists in TrainingVideo
  const isVideo = await mongoose
    .model('TrainingVideo')
    .exists({ _id: resourceId });
  if (isVideo) {
    return 'TrainingVideo';
  }

  // Check if it exists in EssentialTool
  const isTool = await mongoose
    .model('EssentialTool')
    .exists({ _id: resourceId });
  if (isTool) {
    const User = require('../../models/user.model');
    const user = await User.findById(userId);
    const role = user ? user.role : 'home-owner';
    if (role === 'apprentice' || role === 'licensed-plumber') {
      return 'LibraryTools';
    }
    return 'EssentialTool';
  }

  // Check if it exists in MaintenanceGuide
  const isGuide = await mongoose
    .model('MaintenanceGuide')
    .exists({ _id: resourceId });
  if (isGuide) {
    return 'MaintenanceGuide';
  }

  // Check if it exists in PlumbingCode
  const isCode = await mongoose
    .model('PlumbingCode')
    .exists({ _id: resourceId });
  if (isCode) {
    return 'PlumbingCode';
  }

  return originalType;
};

/**
 * Save a resource (EssentialTool, MaintenanceGuide, or PlumbingCode) for a user
 * @param {string} userId
 * @param {string} resourceId
 * @param {string} resourceType
 * @returns {Promise<SavedResource>}
 */
const saveResource = async (userId, resourceId, resourceType) => {
  const mappedType = await resolveResourceType(
    userId,
    resourceId,
    resourceType,
  );
  const existing = await SavedResource.findOne({ userId, resourceId });
  if (existing) {
    throw new ApiError('Resource already saved', 400);
  }
  return await SavedResource.create({
    userId,
    resourceId,
    resourceType: mappedType,
  });
};

/**
 * Unsave a resource for a user
 * @param {string} userId
 * @param {string} resourceId
 * @returns {Promise<object>}
 */
const unsaveResource = async (userId, resourceId) => {
  const result = await SavedResource.deleteOne({ userId, resourceId });
  if (result.deletedCount === 0) {
    throw new ApiError('Saved resource not found', 404);
  }
  return { message: 'Resource unsaved successfully' };
};

/**
 * Get all saved resources for a user
 * @param {string} userId
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<object>}
 */
const getSavedResources = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = { userId };
  const totalResults = await SavedResource.countDocuments(query);

  const savedItems = await SavedResource.find(query)
    .populate('resourceId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const mappedItems = savedItems.map((item) => {
    return item.toJSON ? item.toJSON() : item;
  });

  return {
    results: mappedItems,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

module.exports = {
  saveResource,
  unsaveResource,
  getSavedResources,
};
