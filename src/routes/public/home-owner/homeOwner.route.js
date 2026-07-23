const router = require('express').Router();
const controller = require('../../../controllers/public/home-owner/homeOwner.controller');
const dashboardController = require('../../../controllers/public/home-owner/homeOwnerDashboard.controller');
const equipmentController = require('../../../controllers/public/home-owner/homeOwnerEquipment.controller');
const auth = require('../../../middlewares/auth.middleware');
const upload = require('../../../middlewares/multer.middleware');

router.get(
  '/dashboard',
  auth('home-owner'),
  dashboardController.getDashboardSummary,
);

router.get(
  '/equipment',
  auth('home-owner'),
  equipmentController.getMyEquipment,
);

router.post(
  '/equipment',
  auth('home-owner'),
  upload.single('image'),
  equipmentController.addMyEquipment,
);

router.patch(
  '/equipment/:id',
  auth('home-owner'),
  upload.single('image'),
  equipmentController.updateMyEquipment,
);

router.delete(
  '/equipment/:id',
  auth('home-owner'),
  equipmentController.deleteMyEquipment,
);

router
  .route('/')
  .post(controller.createHomeOwner)
  .get(controller.getHomeOwners);

router
  .route('/:id')
  .get(controller.getHomeOwner)
  .put(controller.updateHomeOwner)
  .delete(controller.deleteHomeOwner);

module.exports = router;
