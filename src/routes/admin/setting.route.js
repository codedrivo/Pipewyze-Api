const router = require('express').Router();
const controller = require('../../controllers/admin/setting.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSettingSchema = require('../../validators/general-settings.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router.patch(
  '/savesettings/:id?',
  upload.fields([
    { name: 'sitelogo', maxCount: 1 },
    { name: 'footerlogo', maxCount: 1 },
  ]),
  validator.body(validationSettingSchema.saveSetting),
  controller.saveSettings,
);
router.get('/getsettings', controller.getSettings);

module.exports = router;
