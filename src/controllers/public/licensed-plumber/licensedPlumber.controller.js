const catchAsync = require('../../../helpers/asyncErrorHandler');
const licensedPlumberService = require('../../../services/public/licensed-plumber/licensedPlumber.service');
const equipmentService = require('../../../services/admin/equipment.service');
const ApiError = require('../../../helpers/apiErrorConverter');

const createLicensedPlumber = catchAsync(async (req, res) => {
  const licensedPlumber = await licensedPlumberService.createLicensedPlumber(
    req.body,
  );
  res.status(201).send(licensedPlumber);
});

const getLicensedPlumber = catchAsync(async (req, res) => {
  const licensedPlumber = await licensedPlumberService.getLicensedPlumberById(
    req.params.id,
  );
  res.send(licensedPlumber);
});

const updateLicensedPlumber = catchAsync(async (req, res) => {
  const licensedPlumber =
    await licensedPlumberService.updateLicensedPlumberById(
      req.params.id,
      req.body,
    );
  res.send(licensedPlumber);
});

const deleteLicensedPlumber = catchAsync(async (req, res) => {
  await licensedPlumberService.deleteLicensedPlumberById(req.params.id);
  res.status(200).send({ message: 'Licensed Plumber deleted successfully' });
});

const getLicensedPlumbers = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const result = await licensedPlumberService.queryLicensedPlumbers(
    search,
    page,
    limit,
  );
  res.send(result);
});

const getLicensedPlumberEquipment = catchAsync(async (req, res) => {
  const equipment = await equipmentService.getEquipmentByPlumber(req.params.id);
  res.status(200).send({ status: 200, equipment });
});

const addLicensedPlumberEquipment = catchAsync(async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    throw new ApiError('Permission Denied', 403);
  }
  const data = { ...req.body, plumberId: req.params.id };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const equipment = await equipmentService.createEquipment(data);
  res.status(200).json({
    status: 200,
    message: 'Equipment added successfully',
    equipment,
  });
});

const updateLicensedPlumberEquipment = catchAsync(async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    throw new ApiError('Permission Denied', 403);
  }
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const equipment = await equipmentService.updateEquipment(req.params.equipmentId, data);
  res.status(200).json({
    status: 200,
    message: 'Equipment updated successfully',
    equipment,
  });
});

const deleteLicensedPlumberEquipment = catchAsync(async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    throw new ApiError('Permission Denied', 403);
  }
  await equipmentService.deleteEquipment(req.params.equipmentId);
  res.status(200).json({
    status: 200,
    message: 'Equipment deleted successfully',
  });
});

module.exports = {
  createLicensedPlumber,
  getLicensedPlumber,
  updateLicensedPlumber,
  deleteLicensedPlumber,
  getLicensedPlumbers,
  getLicensedPlumberEquipment,
  addLicensedPlumberEquipment,
  updateLicensedPlumberEquipment,
  deleteLicensedPlumberEquipment,
};
