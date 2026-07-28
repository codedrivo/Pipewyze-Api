const router = require('express').Router();
const controller = require('../../../controllers/public/apprentice/apprentice.controller');
const auth = require('../../../middlewares/auth.middleware');
const ApiError = require('../../../helpers/apiErrorConverter');

const verifyOwnerOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user._id.toString() === req.params.id) {
    return next();
  }
  return next(new ApiError('Permission Denied', 403));
};

router
  .route('/')
  .post(controller.createApprentice)
  .get(auth('admin'), controller.getApprentices);

router
  .route('/:id([0-9a-fA-F]{24})')
  .get(auth(), verifyOwnerOrAdmin, controller.getApprentice)
  .put(auth(), verifyOwnerOrAdmin, controller.updateApprentice)
  .delete(auth(), verifyOwnerOrAdmin, controller.deleteApprentice);

module.exports = router;
