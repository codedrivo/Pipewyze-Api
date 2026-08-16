const router = require('express').Router();
const chatController = require('../../controllers/chat.controller');
const auth = require('../../middlewares/auth.middleware');

router.post('/rooms', auth('home-owner'), chatController.initChatRoom);
router.get(
  '/rooms',
  auth(['home-owner', 'licensed-plumber', 'admin']),
  chatController.getMyChatRooms,
);
router.get(
  '/rooms/:roomId/messages',
  auth(['home-owner', 'licensed-plumber', 'admin']),
  chatController.getRoomMessages,
);

module.exports = router;
