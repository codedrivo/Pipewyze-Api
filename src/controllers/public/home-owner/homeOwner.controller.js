const catchAsync = require('../../../helpers/asyncErrorHandler');
const homeOwnerService = require('../../../services/public/home-owner/homeOwner.service');

const createHomeOwner = catchAsync(async (req, res) => {
  const homeOwner = await homeOwnerService.createHomeOwner(req.body);
  res.status(201).send(homeOwner);
});

const getHomeOwner = catchAsync(async (req, res) => {
  const homeOwner = await homeOwnerService.getHomeOwnerById(req.params.id);
  res.send(homeOwner);
});

const updateHomeOwner = catchAsync(async (req, res) => {
  const homeOwner = await homeOwnerService.updateHomeOwnerById(
    req.params.id,
    req.body,
  );
  res.send(homeOwner);
});

const deleteHomeOwner = catchAsync(async (req, res) => {
  await homeOwnerService.deleteHomeOwnerById(req.params.id);
  res.status(200).send({ message: 'Home Owner deleted successfully' });
});

const getHomeOwners = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const result = await homeOwnerService.queryHomeOwners(search, page, limit);
  res.send(result);
});

module.exports = {
  createHomeOwner,
  getHomeOwner,
  updateHomeOwner,
  deleteHomeOwner,
  getHomeOwners,
};
