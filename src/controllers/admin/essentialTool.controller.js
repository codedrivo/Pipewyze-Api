const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/essentialTool.service');

const createEssentialTool = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const tool = await service.createEssentialTool(data);
  res.status(201).json({
    status: 201,
    message: 'Essential tool created successfully',
    tool,
  });
});

const getEssentialTools = catchAsync(async (req, res) => {
  const tools = await service.getEssentialTools();
  res.status(200).json({
    status: 200,
    tools,
  });
});

const getEssentialTool = catchAsync(async (req, res) => {
  const tool = await service.getEssentialToolById(req.params.id);
  res.status(200).json({
    status: 200,
    tool,
  });
});

const updateEssentialTool = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const tool = await service.updateEssentialToolById(req.params.id, data);
  res.status(200).json({
    status: 200,
    message: 'Essential tool updated successfully',
    tool,
  });
});

const deleteEssentialTool = catchAsync(async (req, res) => {
  await service.deleteEssentialToolById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Essential tool deleted successfully',
  });
});

module.exports = {
  createEssentialTool,
  getEssentialTools,
  getEssentialTool,
  updateEssentialTool,
  deleteEssentialTool,
};
