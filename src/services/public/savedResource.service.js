const SavedResource = require('../../models/savedResource.model');
const ApiError = require('../../helpers/apiErrorConverter');

// Pre-register referenced schemas to ensure populate works without lazy-loading issues
require('../../models/essentialTool.model');
require('../../models/maintenanceGuide.model');
require('../../models/plumbingCode.model');

/**
 * Save a resource (EssentialTool, MaintenanceGuide, or PlumbingCode) for a user
 * @param {string} userId
 * @param {string} resourceId
 * @param {string} resourceType
 * @returns {Promise<SavedResource>}
 */
const saveResource = async (userId, resourceId, resourceType) => {
  const existing = await SavedResource.findOne({ userId, resourceId });
  if (existing) {
    throw new ApiError('Resource already saved', 400);
  }
  return await SavedResource.create({ userId, resourceId, resourceType });
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

  return {
    results: savedItems,
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
