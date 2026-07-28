const router = require('express').Router();
const controller = require('../../../controllers/public/licensed-plumber/licensedPlumber.controller');

const auth = require('../../../middlewares/auth.middleware');
const upload = require('../../../middlewares/multer.middleware');
const validationSchema = require('../../../validators/licensedPlumber.validator');
const ApiError = require('../../../helpers/apiErrorConverter');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

const verifyOwnerOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user._id.toString() === req.params.id) {
    return next();
  }
  return next(new ApiError('Permission Denied', 403));
};

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
  .get(auth(), controller.getLicensedPlumbers);

router
  .route('/:id')
  .get(auth(), controller.getLicensedPlumber)
  .put(
    auth(),
    verifyOwnerOrAdmin,
    upload.single('profileimageurl'),
    parsePlumberArrays,
    validator.body(validationSchema.updateLicensedPlumber),
    controller.updateLicensedPlumber,
  )
  .delete(auth(), verifyOwnerOrAdmin, controller.deleteLicensedPlumber);

router
  .route('/:id/equipment')
  .get(auth(), controller.getLicensedPlumberEquipment)
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
