const Equipment = require('../../models/equipment.model');
const User = require('../../models/user.model');
const ApiError = require('../../helpers/apiErrorConverter');

const getEquipmentByPlumber = async (plumberId) => {
  const plumber = await User.findById(plumberId);
  if (!plumber || plumber.role !== 'licensed-plumber') {
    throw new ApiError(
      'Plumber not found or user is not a licensed plumber',
      404,
    );
  }
  const equipment = await Equipment.find({ plumberId }).sort({ createdAt: -1 });
  return equipment;
};

const createEquipment = async (data) => {
  const plumber = await User.findById(data.plumberId);
  if (!plumber || plumber.role !== 'licensed-plumber') {
    throw new ApiError(
      'Plumber not found or user is not a licensed plumber',
      404,
    );
  }
  const equipment = await Equipment.create(data);
  return equipment;
};

const updateEquipment = async (id, data) => {
  let equipment = await Equipment.findById(id);
  if (!equipment) {
    throw new ApiError('Equipment not found', 404);
  }
  Object.assign(equipment, data);
  await equipment.save();
  return equipment;
};

const deleteEquipment = async (id) => {
  const equipment = await Equipment.findById(id);
  if (!equipment) {
    throw new ApiError('Equipment not found', 404);
  }
  await Equipment.deleteOne({ _id: id });
  return equipment;
};

module.exports = {
  getEquipmentByPlumber,
  createEquipment,
  updateEquipment,
  deleteEquipment,
};
