const router = require('express').Router();
const controller = require('../../../controllers/public/licensed-plumber/licensedPlumber.controller');

router.route('/')
  .post(controller.createLicensedPlumber)
  .get(controller.getLicensedPlumbers);

router.route('/:id')
  .get(controller.getLicensedPlumber)
  .put(controller.updateLicensedPlumber)
  .delete(controller.deleteLicensedPlumber);

module.exports = router;
