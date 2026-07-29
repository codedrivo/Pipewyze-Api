const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/plumbingCodeCategory.service');

const getCategories = catchAsync(async (req, res) => {
  const categories = await service.getCategories();
  res.status(200).send({ status: 200, categories });
});

const createCategory = catchAsync(async (req, res) => {
  const category = await service.createCategory(req.body);
  res.status(201).send({
    status: 201,
    message: 'Category created successfully',
    category,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const category = await service.updateCategory(req.params.id, req.body);
  res.status(200).send({
    status: 200,
    message: 'Category updated successfully',
    category,
  });
});

const deleteCategory = catchAsync(async (req, res) => {
  await service.deleteCategory(req.params.id);
  res.status(200).send({
    status: 200,
    message: 'Category deleted successfully',
  });
});

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
