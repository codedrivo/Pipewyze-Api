const catchAsync = require('../../../helpers/asyncErrorHandler');
const apprenticeService = require('../../../services/public/apprentice/apprentice.service');

const createApprentice = catchAsync(async (req, res) => {
  const apprentice = await apprenticeService.createApprentice(req.body);
  res.status(201).send(apprentice);
});

const getApprentice = catchAsync(async (req, res) => {
  const apprentice = await apprenticeService.getApprenticeById(req.params.id);
  res.send(apprentice);
});

const updateApprentice = catchAsync(async (req, res) => {
  const apprentice = await apprenticeService.updateApprenticeById(req.params.id, req.body);
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

module.exports = {
  createApprentice,
  getApprentice,
  updateApprentice,
  deleteApprentice,
  getApprentices,
};
