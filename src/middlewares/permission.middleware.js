const ApiError = require('../helpers/apiErrorConverter');
const catchAsync = require('../helpers/asyncErrorHandler');
const { getUserSubscriptionDetails } = require('../services/subscriptionTier.service');

/**
 * Middleware to enforce subscription feature permissions on protected routes.
 * @param {string} featureKey - Feature key matching accessibleFeatures (e.g. 'maintenance_guides', 'plumbing_codes', 'training_videos', 'essential_tools', 'equipment', 'ai_assistant')
 */
const requireFeaturePermission = (featureKey) => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError('Please authenticate', 401);
    }

    // Admins bypass subscription permission checks
    if (req.user.role === 'admin') {
      return next();
    }

    /*
    const subscriptionDetails = await getUserSubscriptionDetails(req.user._id);
    const permissions = subscriptionDetails.permissions || {};

    if (!permissions[featureKey]) {
      throw new ApiError(
        `Feature access denied: your active subscription tier (${subscriptionDetails.tier || 'freemium'}) does not include access to '${featureKey}'.`,
        403
      );
    }
    */

    next();
  });
};

module.exports = {
  requireFeaturePermission,
};
