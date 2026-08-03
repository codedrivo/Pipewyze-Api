const catchAsync = require('../../../helpers/asyncErrorHandler');
const apprenticeService = require('../../../services/public/apprentice/apprentice.service');
const MaintenanceGuide = require('../../../models/maintenanceGuide.model');
const ApiError = require('../../../helpers/apiErrorConverter');

const createApprentice = catchAsync(async (req, res) => {
  const apprentice = await apprenticeService.createApprentice(req.body);
  res.status(201).send(apprentice);
});

const getApprentice = catchAsync(async (req, res) => {
  const apprentice = await apprenticeService.getApprenticeById(req.params.id);
  res.send(apprentice);
});

const updateApprentice = catchAsync(async (req, res) => {
  const apprentice = await apprenticeService.updateApprenticeById(
    req.params.id,
    req.body,
  );
  res.send(apprentice);
});

const deleteApprentice = catchAsync(async (req, res) => {
  await apprenticeService.deleteApprenticeById(req.params.id);
  res.status(200).send({ message: 'Apprentice deleted successfully' });
});

const getApprentices = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const result = await apprenticeService.queryApprentices(search, page, limit);
  res.send(result);
});

const getMaintenanceGuides = catchAsync(async (req, res) => {
  const search = req.query.search || '';
  const query = {};
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }
  const guides = await MaintenanceGuide.find(query);
  res.status(200).send({ status: 200, guides });
});

const getMaintenanceGuideById = catchAsync(async (req, res) => {
  const guide = await MaintenanceGuide.findById(req.params.guideId)
    .populate('requiredTools')
    .populate('relatedCodes');
  if (!guide) {
    throw new ApiError('Maintenance guide not found', 404);
  }
  res.status(200).send({ status: 200, guide });
});

module.exports = {
  createApprentice,
  getApprentice,
  updateApprentice,
  deleteApprentice,
  getApprentices,
  getMaintenanceGuides,
  getMaintenanceGuideById,
};
