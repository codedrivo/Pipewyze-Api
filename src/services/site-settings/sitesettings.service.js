const Settings = require('../../models/setting.model');

const getSettings = async () => {
  const settingsData = await Settings.find();
  return settingsData;
};

module.exports = {
  getSettings,
};
