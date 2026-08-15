const router = require('express').Router();
const controller = require('../../controllers/admin/support.controller');
const auth = require('../../middlewares/auth.middleware');

router.use(auth('admin'));

router.get('/', controller.getSupportRequests);
router.patch('/resolve/:id', controller.resolveSupportRequest);

module.exports = router;
