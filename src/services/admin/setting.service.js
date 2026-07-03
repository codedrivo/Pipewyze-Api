const settingmodel = require('../../models/setting.model');

const saveSettingData = async (id, reqBody) => {
  if (id) {
    return settingmodel.findByIdAndUpdate(id, reqBody, {
      new: true,
      runValidators: true,
    });
  } else {
    return settingmodel.create(reqBody);
  }
};

const getSettingsData = async () => {
  return settingmodel.findOne();
};

module.exports = {
  saveSettingData,
  getSettingsData,
};
