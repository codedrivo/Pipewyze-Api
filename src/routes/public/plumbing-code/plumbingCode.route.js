const router = require('express').Router();
const controller = require('../../../controllers/admin/plumbingCode.controller');
const categoryController = require('../../../controllers/admin/plumbingCodeCategory.controller');
const auth = require('../../../middlewares/auth.middleware');

router.get('/', auth(), controller.getPlumbingCodes);
router.get('/categories', auth(), categoryController.getCategories);
router.get('/:id', auth(), controller.getPlumbingCode);

module.exports = router;
