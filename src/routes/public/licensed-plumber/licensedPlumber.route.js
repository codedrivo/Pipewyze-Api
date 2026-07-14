const router = require('express').Router();
const controller = require('../../../controllers/public/licensed-plumber/licensedPlumber.controller');

const auth = require('../../../middlewares/auth.middleware');
const upload = require('../../../middlewares/multer.middleware');

router.route('/')
  .post(controller.createLicensedPlumber)
  .get(controller.getLicensedPlumbers);

router.route('/:id')
  .get(controller.getLicensedPlumber)
  .put(controller.updateLicensedPlumber)
  .delete(controller.deleteLicensedPlumber);

router.route('/:id/equipment')
  .get(controller.getLicensedPlumberEquipment)
  .post(auth('licensed-plumber'), upload.single('image'), controller.addLicensedPlumberEquipment);

router.route('/:id/equipment/:equipmentId')
  .patch(auth('licensed-plumber'), upload.single('image'), controller.updateLicensedPlumberEquipment)
  .delete(auth('licensed-plumber'), controller.deleteLicensedPlumberEquipment);

module.exports = router;
