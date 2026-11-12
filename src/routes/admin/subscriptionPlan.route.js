const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const subscriptionPlanController = require('../../controllers/admin/subscriptionPlan.controller');

router
  .route('/')
  .get(auth('admin'), subscriptionPlanController.getPlans)
  .post(auth('admin'), subscriptionPlanController.createPlan);

router
  .route('/:id')
  .put(auth('admin'), subscriptionPlanController.updatePlan)
  .delete(auth('admin'), subscriptionPlanController.deletePlan);

module.exports = router;
