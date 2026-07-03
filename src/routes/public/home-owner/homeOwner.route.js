const router = require('express').Router();
const controller = require('../../../controllers/public/home-owner/homeOwner.controller');

router.route('/')
  .post(controller.createHomeOwner)
  .get(controller.getHomeOwners);

router.route('/:id')
  .get(controller.getHomeOwner)
  .put(controller.updateHomeOwner)
  .delete(controller.deleteHomeOwner);

module.exports = router;
