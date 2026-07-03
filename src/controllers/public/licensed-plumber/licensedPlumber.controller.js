const catchAsync = require('../../../helpers/asyncErrorHandler');
const licensedPlumberService = require('../../../services/public/licensed-plumber/licensedPlumber.service');

const createLicensedPlumber = catchAsync(async (req, res) => {
  const licensedPlumber = await licensedPlumberService.createLicensedPlumber(
    req.body,
  );
  res.status(201).send(licensedPlumber);
});

const getLicensedPlumber = catchAsync(async (req, res) => {
  const licensedPlumber = await licensedPlumberService.getLicensedPlumberById(
    req.params.id,
  );
  res.send(licensedPlumber);
});

const updateLicensedPlumber = catchAsync(async (req, res) => {
  const licensedPlumber =
    await licensedPlumberService.updateLicensedPlumberById(
      req.params.id,
      req.body,
    );
  res.send(licensedPlumber);
});

const deleteLicensedPlumber = catchAsync(async (req, res) => {
  await licensedPlumberService.deleteLicensedPlumberById(req.params.id);
  res.status(200).send({ message: 'Licensed Plumber deleted successfully' });
});

const getLicensedPlumbers = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const result = await licensedPlumberService.queryLicensedPlumbers(
    search,
    page,
    limit,
  );
  res.send(result);
});

module.exports = {
  createLicensedPlumber,
  getLicensedPlumber,
  updateLicensedPlumber,
  deleteLicensedPlumber,
  getLicensedPlumbers,
};
