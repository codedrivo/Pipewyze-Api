const router = require('express').Router();
const auth = require('../../../middlewares/auth.middleware');
const { requireFeaturePermission } = require('../../../middlewares/permission.middleware');
const aiPromptController = require('../../../controllers/admin/aiPrompt.controller');

router.get('/suggested', auth(), requireFeaturePermission('ai_assistant'), aiPromptController.getSuggestedPrompts);
router.get('/status', auth(), requireFeaturePermission('ai_assistant'), aiPromptController.getAiUsageStatus);

module.exports = router;
