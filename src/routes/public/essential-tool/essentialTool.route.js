const router = require('express').Router();
const service = require('../../../services/admin/essentialTool.service');
const catchAsync = require('../../../helpers/asyncErrorHandler');
const auth = require('../../../middlewares/auth.middleware');

router.get(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const query = {};
    if (
      req.user &&
      ['home-owner', 'apprentice', 'licensed-plumber'].includes(req.user.role)
    ) {
      query.audience = req.user.role;
    }
    const tools = await service.getEssentialTools(query);
    let toolsWithSaved = tools;
    if (req.user) {
      const SavedResource = require('../../../models/savedResource.model');
      const savedResources = await SavedResource.find({
        userId: req.user._id,
        resourceType: { $in: ['EssentialTool', 'LibraryTools'] },
        resourceId: { $in: tools.map((t) => t._id) },
      });
      const savedResourceIds = new Set(
        savedResources.map((sr) => sr.resourceId.toString()),
      );
      toolsWithSaved = tools.map((tool) => {
        const toolJson = tool.toJSON ? tool.toJSON() : tool;
        toolJson.isSaved = savedResourceIds.has(tool._id.toString());
        return toolJson;
      });
    }
    res.status(200).json({
      status: 200,
      tools: toolsWithSaved,
    });
  }),
);

router.get(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const tool = await service.getEssentialToolById(req.params.id);
    let toolJson = tool.toJSON ? tool.toJSON() : tool;
    if (req.user) {
      const SavedResource = require('../../../models/savedResource.model');
      const isSaved = await SavedResource.exists({
        userId: req.user._id,
        resourceType: { $in: ['EssentialTool', 'LibraryTools'] },
        resourceId: tool._id,
      });
      toolJson.isSaved = !!isSaved;
    }
    res.status(200).json({
      status: 200,
      tool: toolJson,
    });
  }),
);

module.exports = router;
