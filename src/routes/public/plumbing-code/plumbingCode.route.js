const router = require('express').Router();
const controller = require('../../../controllers/admin/plumbingCode.controller');
const categoryController = require('../../../controllers/admin/plumbingCodeCategory.controller');
const auth = require('../../../middlewares/auth.middleware');
const { requireFeaturePermission } = require('../../../middlewares/permission.middleware');

router.get('/', auth(), requireFeaturePermission('plumbing_codes'), controller.getPlumbingCodes);
router.get('/categories', auth(), requireFeaturePermission('plumbing_codes'), categoryController.getCategories);
router.get('/:id', auth(), requireFeaturePermission('plumbing_codes'), controller.getPlumbingCode);

module.exports = router;
