const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/page.service');

const listPage = catchAsync(async (req, res, next) => {
  const limit = req.params.limit ? Number(req.params.limit) : 10;
  const page = req.params.page ? Number(req.params.page) : 1;
  const search = req.body.search ? req.body.search : '';
  const pages = await service.pageListFind(limit, page, search);
  res.status(200).send({ status: 200, pages });
});

const addPage = catchAsync(async (req, res) => {
  userId = req.user._id;

  data = {
    userId,
    ...req.body,
  };
  const policyData = await service.page(req.params.id, data);
  res.status(200).json({
    message: 'Page added successfully',
    data: policyData,
  });
});

const viewPage = catchAsync(async (req, res) => {
  const pageDetail = await service.viewPage(req.params.id);
  res.status(200).json({
    pageData: pageDetail,
  });
});
const updatePage = catchAsync(async (req, res) => {
  const updatePage = await service.updatePage(req.params.id, req.body);
  res.status(200).json({
    message: 'Page updated successfully',
    pageData: updatePage,
  });
});
const deletePage = catchAsync(async (req, res) => {
  await service.deletePage(req.params.id);
  res.status(200).send('Page deleted successfully');
});

module.exports = {
  addPage,
  viewPage,
  updatePage,
  deletePage,
  listPage,
};
