const EquipmentCategory = require('../../models/equipmentCategory.model');
const ApiError = require('../../helpers/apiErrorConverter');

const getCategories = async () => {
  return await EquipmentCategory.find().sort({ name: 1 });
};

const createCategory = async (data) => {
  const exists = await EquipmentCategory.findOne({ name: data.name });
  if (exists) {
    throw new ApiError('Category with this name already exists', 400);
  }
  return await EquipmentCategory.create(data);
};

const updateCategory = async (id, data) => {
  const category = await EquipmentCategory.findById(id);
  if (!category) {
    throw new ApiError('Category not found', 404);
  }
  
  if (data.name && data.name !== category.name) {
    const exists = await EquipmentCategory.findOne({ name: data.name });
    if (exists) {
      throw new ApiError('Category with this name already exists', 400);
    }
  }

  Object.assign(category, data);
  await category.save();
  return category;
};

const deleteCategory = async (id) => {
  const category = await EquipmentCategory.findById(id);
  if (!category) {
    throw new ApiError('Category not found', 404);
  }
  await EquipmentCategory.deleteOne({ _id: id });
  return category;
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
