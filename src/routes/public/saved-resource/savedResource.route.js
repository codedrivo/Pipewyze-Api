const router = require('express').Router();
const controller = require('../../../controllers/public/savedResource.controller');
const auth = require('../../../middlewares/auth.middleware');

// Routes require the user to be authenticated (either apprentice, licensed-plumber, home-owner, or admin)
router.post('/', auth(), controller.saveResource);
router.delete('/:resourceId', auth(), controller.unsaveResource);
router.get('/', auth(), controller.getSavedResources);

module.exports = router;
