const router = require('express').Router();
const Controller = require('../../controllers/admin/dashboard.controller');
const auth = require('../../middlewares/auth.middleware');

router.use(auth('admin'));

router.get('/get', Controller.getDashboardData);
router.get('/transaction/:id', Controller.getTransactionDetails);

module.exports = router;
