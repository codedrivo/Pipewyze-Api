const router = require('express').Router();
const auth = require('../../../middlewares/auth.middleware');
const aiPromptController = require('../../../controllers/admin/aiPrompt.controller');

router.get('/suggested', auth(), aiPromptController.getSuggestedPrompts);
router.get('/status', auth(), aiPromptController.getAiUsageStatus);

module.exports = router;
