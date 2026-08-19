const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/faq.service');

const createFaq = catchAsync(async (req, res) => {
  const faq = await service.createFaq(req.body);
  res.status(201).json({
    status: 201,
    message: 'FAQ created successfully',
    faq,
  });
});

const listFaq = catchAsync(async (req, res) => {
  const limit = req.params.limit ? Number(req.params.limit) : 10;
  const page = req.params.page ? Number(req.params.page) : 1;
  const search = req.query.search || req.body.search || '';
  const result = await service.getFaqs(search, page, limit);
  res.status(200).json({
    status: 200,
    ...result,
  });
});

const getFaq = catchAsync(async (req, res) => {
  const faq = await service.getFaqById(req.params.id);
  res.status(200).json({
    status: 200,
    faq,
    data: { faq },
  });
});

const updateFaq = catchAsync(async (req, res) => {
  const faq = await service.updateFaqById(req.params.id, req.body);
  res.status(200).json({
    status: 200,
    message: 'FAQ updated successfully',
    faq,
  });
});

const deleteFaq = catchAsync(async (req, res) => {
  await service.deleteFaqById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'FAQ deleted successfully',
  });
});

const getPublicFaqs = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const result = await service.getFaqs(search, page, limit);
  res.status(200).json(result);
});

module.exports = {
  createFaq,
  listFaq,
  getFaq,
  updateFaq,
  deleteFaq,
  getPublicFaqs,
};
