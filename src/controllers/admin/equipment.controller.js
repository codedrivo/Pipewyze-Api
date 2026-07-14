const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/equipment.service');

const getEquipment = catchAsync(async (req, res) => {
  const equipment = await service.getEquipmentByPlumber(req.params.plumberId);
  res.status(200).send({ status: 200, equipment });
});

const addEquipment = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const equipment = await service.createEquipment(data);
  res.status(200).json({
    status: 200,
    message: 'Equipment added successfully',
    equipment,
  });
});

const updateEquipment = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.image = req.file.location;
  }
  const equipment = await service.updateEquipment(req.params.id, data);
  res.status(200).json({
    status: 200,
    message: 'Equipment updated successfully',
    equipment,
  });
});

const deleteEquipment = catchAsync(async (req, res) => {
  await service.deleteEquipment(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Equipment deleted successfully',
  });
});

module.exports = {
  getEquipment,
  addEquipment,
  updateEquipment,
  deleteEquipment,
};
