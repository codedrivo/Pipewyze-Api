const router = require('express').Router();
const controller = require('../../../controllers/public/apprentice/apprentice.controller');

router.route('/')
  .post(controller.createApprentice)
  .get(controller.getApprentices);

router.route('/:id')
  .get(controller.getApprentice)
  .put(controller.updateApprentice)
  .delete(controller.deleteApprentice);

module.exports = router;
