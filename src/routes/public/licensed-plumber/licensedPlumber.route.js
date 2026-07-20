const router = require('express').Router();
const controller = require('../../../controllers/public/licensed-plumber/licensedPlumber.controller');

const auth = require('../../../middlewares/auth.middleware');
const upload = require('../../../middlewares/multer.middleware');
const validationSchema = require('../../../validators/licensedPlumber.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

const parsePlumberArrays = (req, res, next) => {
  if (
    req.body.serviceLocations &&
    typeof req.body.serviceLocations === 'string'
  ) {
    try {
      req.body.serviceLocations = JSON.parse(req.body.serviceLocations);
    } catch (e) {
      // ignore
    }
  }
  if (
    req.body.servicesOffered &&
    typeof req.body.servicesOffered === 'string'
  ) {
    try {
      req.body.servicesOffered = JSON.parse(req.body.servicesOffered);
    } catch (e) {
      // ignore
    }
  }
  next();
};

router
  .route('/')
  .post(
    upload.single('profileimageurl'),
    parsePlumberArrays,
    validator.body(validationSchema.createLicensedPlumber),
    controller.createLicensedPlumber,
  )
  .get(controller.getLicensedPlumbers);

router
  .route('/:id')
  .get(controller.getLicensedPlumber)
  .put(
    upload.single('profileimageurl'),
    parsePlumberArrays,
    validator.body(validationSchema.updateLicensedPlumber),
    controller.updateLicensedPlumber,
  )
  .delete(controller.deleteLicensedPlumber);

router
  .route('/:id/equipment')
  .get(controller.getLicensedPlumberEquipment)
  .post(
    auth('licensed-plumber'),
    upload.single('image'),
    controller.addLicensedPlumberEquipment,
  );

router
  .route('/:id/equipment/:equipmentId')
  .patch(
    auth('licensed-plumber'),
    upload.single('image'),
    controller.updateLicensedPlumberEquipment,
  )
  .delete(auth('licensed-plumber'), controller.deleteLicensedPlumberEquipment);

module.exports = router;
