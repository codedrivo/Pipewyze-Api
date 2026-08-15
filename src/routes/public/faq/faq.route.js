const router = require('express').Router();
const controller = require('../../../controllers/admin/faq.controller');

router.get('/', controller.getPublicFaqs);

module.exports = router;
