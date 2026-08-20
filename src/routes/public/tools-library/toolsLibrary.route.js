const router = require('express').Router();
const EssentialTool = require('../../../models/essentialTool.model');
const catchAsync = require('../../../helpers/asyncErrorHandler');
const auth = require('../../../middlewares/auth.middleware');

// Fetch all tools from the library (supports search filtering)
router.get(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const { search } = req.query;
    const filter = {};
    if (
      req.user &&
      ['home-owner', 'apprentice', 'licensed-plumber'].includes(req.user.role)
    ) {
      filter.audience = req.user.role;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
      ];
    }
    const tools = await EssentialTool.find(filter).sort({ name: 1 });
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

// Fetch details for a specific tool in the library
router.get(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const tool = await EssentialTool.findById(req.params.id);
    if (!tool) {
      res.status(404).json({
        status: 404,
        message: 'Tool not found in the library',
      });
      return;
    }
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
