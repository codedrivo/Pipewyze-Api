const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const aiPromptController = require('../../controllers/admin/aiPrompt.controller');

router.get('/user-usage', auth('admin'), aiPromptController.getUserAiUsageReport);

router
  .route('/')
  .get(auth('admin'), aiPromptController.getPrompts)
  .post(auth('admin'), aiPromptController.createPrompt);

router
  .route('/:id')
  .put(auth('admin'), aiPromptController.updatePrompt)
  .delete(auth('admin'), aiPromptController.deletePrompt);

module.exports = router;
