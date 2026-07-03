const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/site-settings/sitesettings.service');

const getSettings = catchAsync(async (req, res) => {
  const settingsData = await service.getSettings();
  res.status(200).send(settingsData);
});

module.exports = {
  getSettings,
};
