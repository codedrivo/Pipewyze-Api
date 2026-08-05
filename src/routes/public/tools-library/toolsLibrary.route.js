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
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
      ];
    }
    const tools = await EssentialTool.find(filter).sort({ name: 1 });
    res.status(200).json({
      status: 200,
      tools,
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
    res.status(200).json({
      status: 200,
      tool,
    });
  }),
);

module.exports = router;
