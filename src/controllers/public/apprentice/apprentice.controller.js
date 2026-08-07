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
  let guidesWithSaved = guides;
  if (req.user) {
    const SavedResource = require('../../../models/savedResource.model');
    const savedResources = await SavedResource.find({
      userId: req.user._id,
      resourceType: 'MaintenanceGuide',
      resourceId: { $in: guides.map((g) => g._id) },
    });
    const savedResourceIds = new Set(
      savedResources.map((sr) => sr.resourceId.toString()),
    );
    guidesWithSaved = guides.map((guide) => {
      const guideJson = guide.toJSON ? guide.toJSON() : guide;
      guideJson.isSaved = savedResourceIds.has(guide._id.toString());
      return guideJson;
    });
  }
  res.status(200).send({ status: 200, guides: guidesWithSaved });
});

const getMaintenanceGuideById = catchAsync(async (req, res) => {
  const guide = await MaintenanceGuide.findById(req.params.guideId)
    .populate('requiredTools')
    .populate('relatedCodes');
  if (!guide) {
    throw new ApiError('Maintenance guide not found', 404);
  }
  let guideJson = guide.toJSON ? guide.toJSON() : guide;
  if (req.user) {
    const SavedResource = require('../../../models/savedResource.model');
    const isSaved = await SavedResource.exists({
      userId: req.user._id,
      resourceType: 'MaintenanceGuide',
      resourceId: guide._id,
    });
    guideJson.isSaved = !!isSaved;
  }
  res.status(200).send({ status: 200, guide: guideJson });
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
