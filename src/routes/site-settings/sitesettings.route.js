const router = require('express').Router();
const controller = require('../../controllers/site-settings/sitesettings.controller');

router.get('/get', controller.getSettings);

module.exports = router;
