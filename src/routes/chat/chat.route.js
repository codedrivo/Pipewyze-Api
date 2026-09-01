const router = require('express').Router();
const chatController = require('../../controllers/chat.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');

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
router.post(
  '/rooms/upload',
  auth(['home-owner', 'licensed-plumber']),
  upload.chatSingle('file'),
  chatController.uploadChatMedia,
);

module.exports = router;
