const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/plumbingCode.service');

const createPlumbingCode = catchAsync(async (req, res) => {
  const code = await service.createPlumbingCode(req.body);
  res.status(201).json({
    status: 201,
    message: 'Plumbing code created successfully',
    code,
  });
});

const getPlumbingCodes = catchAsync(async (req, res) => {
  const category = req.query.category;
  const filter = category ? { category } : {};
  const codes = await service.getPlumbingCodes(filter);
  res.status(200).json({
    status: 200,
    codes,
  });
});

const getPlumbingCode = catchAsync(async (req, res) => {
  const code = await service.getPlumbingCodeById(req.params.id);
  res.status(200).json({
    status: 200,
    code,
  });
});

const updatePlumbingCode = catchAsync(async (req, res) => {
  const code = await service.updatePlumbingCodeById(req.params.id, req.body);
  res.status(200).json({
    status: 200,
    message: 'Plumbing code updated successfully',
    code,
  });
});

const deletePlumbingCode = catchAsync(async (req, res) => {
  await service.deletePlumbingCodeById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Plumbing code deleted successfully',
  });
});

module.exports = {
  createPlumbingCode,
  getPlumbingCodes,
  getPlumbingCode,
  updatePlumbingCode,
  deletePlumbingCode,
};
