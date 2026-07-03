const router = require('express').Router();
const controller = require('../../controllers/user/user.controller');
const auth = require('../../middlewares/authwithoutpermission.middleware');

router.post('/search/:limit?/:page?', auth(), controller.search);
router.get('/:id', auth(), controller.userDetail);

module.exports = router;
