const catchAsync = require('../../helpers/asyncErrorHandler');
const authService = require('../../services/auth/auth.service');

const search = catchAsync(async (req, res) => {
  const limit = req.params.limit ? Number(req.params.limit) : 10;
  const page = req.params.page ? Number(req.params.page) : 1;
  const filters = req.body.filters ? req.body.filters : '';
  const sortOption = req.body.sort ? req.body.sort : '';
  const searchData = await service.searchWithFilters(
    req.user,
    filters,
    sortOption,
    limit,
    page,
  );
  res.status(200).send({ searchData });
});

module.exports = {
  search,
};
