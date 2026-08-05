const catchAsync = require('../../helpers/asyncErrorHandler');
const savedResourceService = require('../../services/public/savedResource.service');

const saveResource = catchAsync(async (req, res) => {
  const { resourceId, resourceType } = req.body;
  const userId = req.user._id;
  const saved = await savedResourceService.saveResource(
    userId,
    resourceId,
    resourceType,
  );
  res.status(201).json({
    status: 201,
    message: 'Resource saved successfully',
    saved,
  });
});

const unsaveResource = catchAsync(async (req, res) => {
  const { resourceId } = req.params;
  const userId = req.user._id;
  const result = await savedResourceService.unsaveResource(userId, resourceId);
  res.status(200).json({
    status: 200,
    ...result,
  });
});

const getSavedResources = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const result = await savedResourceService.getSavedResources(
    userId,
    page,
    limit,
  );
  res.status(200).json({
    status: 200,
    ...result,
  });
});

module.exports = {
  saveResource,
  unsaveResource,
  getSavedResources,
};
