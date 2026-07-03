const catchAsync = require('../helpers/asyncErrorHandler');
const service = require('../services/page.service');

const viewPages = catchAsync(async (req, res) => {
  const pageData = await service.viewPage(req.params.slug);
  res.status(200).json({
    pageDetails: pageData,
  });
});

const ViewSettings = catchAsync(async (req, res) => {
  const getSettings = await service.viewSettings();
  res.status(200).json({
    settings: getSettings,
  });
});

const saveContact = catchAsync(async (req, res) => {
  const data = await service.saveContact({
    ...req.body,
    userId: req.user?._id || null,
  });
  res.status(201).json({
    message: data.message,
    sentTo: data.sentTo,
  });
});

module.exports = {
  viewPages,
  ViewSettings,
  saveContact,
};
