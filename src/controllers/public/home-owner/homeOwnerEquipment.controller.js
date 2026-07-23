const catchAsync = require('../../../helpers/asyncErrorHandler');
const Equipment = require('../../../models/equipment.model');
const ApiError = require('../../../helpers/apiErrorConverter');

const getMyEquipment = catchAsync(async (req, res) => {
  const equipment = await Equipment.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ status: 200, equipment });
});

const addMyEquipment = catchAsync(async (req, res) => {
  const data = { ...req.body, ownerId: req.user._id };
  if (req.file) {
    data.image = req.file.location || req.file.path;
  }
  const equipment = await Equipment.create(data);
  res.status(201).json({
    status: 201,
    message: 'Appliance added successfully',
    equipment,
  });
});

const updateMyEquipment = catchAsync(async (req, res) => {
  let equipment = await Equipment.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!equipment) {
    throw new ApiError('Equipment not found or access denied', 404);
  }

  const data = { ...req.body };
  if (req.file) {
    data.image = req.file.location || req.file.path;
  }

  Object.assign(equipment, data);
  await equipment.save();

  res.status(200).json({
    status: 200,
    message: 'Appliance updated successfully',
    equipment,
  });
});

const deleteMyEquipment = catchAsync(async (req, res) => {
  const equipment = await Equipment.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!equipment) {
    throw new ApiError('Equipment not found or access denied', 404);
  }

  await Equipment.deleteOne({ _id: req.params.id });
  res.status(200).json({
    status: 200,
    message: 'Appliance deleted successfully',
  });
});

module.exports = {
  getMyEquipment,
  addMyEquipment,
  updateMyEquipment,
  deleteMyEquipment,
};
