const mongoose = require('mongoose');
const config = require('./src/config/config');
const Settings = require('./src/models/setting.model');

mongoose.connect(config.mongoose.url, config.mongoose.options).then(async () => {
  const settings = await Settings.findOne();
  console.log('Site Settings:', settings);
  mongoose.connection.close();
});
