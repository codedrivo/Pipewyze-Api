const router = require('express').Router();
const service = require('../../../services/admin/essentialTool.service');
const catchAsync = require('../../../helpers/asyncErrorHandler');

router.get('/', catchAsync(async (req, res) => {
  const tools = await service.getEssentialTools();
  res.status(200).json({
    status: 200,
    tools,
  });
}));

module.exports = router;
