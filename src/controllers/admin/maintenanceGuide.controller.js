const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/maintenanceGuide.service');

const createMaintenanceGuide = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const guide = await service.createMaintenanceGuide(data);
  res.status(201).json({
    status: 201,
    message: 'Maintenance guide created successfully',
    guide,
  });
});

const getMaintenanceGuides = catchAsync(async (req, res) => {
  const search = req.query.search || '';
  const query = {};
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }
  const guides = await service.getMaintenanceGuides(query);
  res.status(200).json({
    status: 200,
    guides,
  });
});

const getMaintenanceGuide = catchAsync(async (req, res) => {
  const guide = await service.getMaintenanceGuideById(req.params.id);
  res.status(200).json({
    status: 200,
    guide,
  });
});

const updateMaintenanceGuide = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const guide = await service.updateMaintenanceGuideById(req.params.id, data);
  res.status(200).json({
    status: 200,
    message: 'Maintenance guide updated successfully',
    guide,
  });
});

const deleteMaintenanceGuide = catchAsync(async (req, res) => {
  await service.deleteMaintenanceGuideById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Maintenance guide deleted successfully',
  });
});

module.exports = {
  createMaintenanceGuide,
  getMaintenanceGuides,
  getMaintenanceGuide,
  updateMaintenanceGuide,
  deleteMaintenanceGuide,
};
