const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/setting.service');

// Add & update setting
const saveSettings = catchAsync(async (req, res, next) => {
  const settingId = req.params.id;
  const data = { ...req.body };

  // Extract file locations from req.files
  if (req.files) {
    if (req.files.sitelogo && req.files.sitelogo[0].location) {
      data.sitelogo = req.files.sitelogo[0].location;
    }
    if (req.files.footerlogo && req.files.footerlogo[0].location) {
      data.footerlogo = req.files.footerlogo[0].location;
    }
  }

  await service.saveSettingData(settingId, data);
  res.status(200).send({ message: 'Settings saved successfully' });
});

// Get settings
const getSettings = catchAsync(async (req, res, next) => {
  const settings = await service.getSettingsData();
  res.status(200).json({ message: 'Get General Settings', settings });
});

module.exports = {
  saveSettings,
  getSettings,
};
