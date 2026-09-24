const router = require('express').Router();
const subscriptionPlanController = require('../../../controllers/admin/subscriptionPlan.controller');

router.get('/', subscriptionPlanController.getPlans);

module.exports = router;
