const catchAsync = require('../helpers/asyncErrorHandler');
const ApiError = require('../helpers/apiErrorConverter');
const ChatRoom = require('../models/chatRoom.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');

/**
 * Initiate a chat room between homeowner and licensed plumber
 */
const initChatRoom = catchAsync(async (req, res) => {
  const { plumberId } = req.body;
  const homeOwnerId = req.user._id;

  if (req.user.role !== 'home-owner') {
    throw new ApiError('Only homeowners can initiate chats with plumbers', 400);
  }

  // Validate the plumber exists and is a licensed plumber
  const plumber = await User.findById(plumberId);
  if (!plumber || plumber.role !== 'licensed-plumber') {
    throw new ApiError('Invalid licensed plumber specified', 404);
  }

  // Find or create room
  let room = await ChatRoom.findOne({ homeOwnerId, plumberId });
  if (!room) {
    room = await ChatRoom.create({ homeOwnerId, plumberId });
  }

  // Populate info
  room = await room.populate([
    { path: 'homeOwnerId', select: 'fullName profileimageurl' },
    { path: 'plumberId', select: 'fullName profileimageurl' },
    { path: 'lastMessage' },
  ]);

  res.status(200).send({
    message: 'Chat room initialized successfully',
    room,
  });
});

/**
 * Get all chat rooms for the logged-in user
 */
const getMyChatRooms = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role;

  let query = {};
  if (role === 'home-owner') {
    query = { homeOwnerId: userId };
  } else if (role === 'licensed-plumber') {
    query = { plumberId: userId };
  } else if (role === 'admin') {
    // Admins can see all chats
    query = {};
  } else {
    throw new ApiError('Unauthorized role for accessing chat rooms', 403);
  }

  const rooms = await ChatRoom.find(query)
    .populate('homeOwnerId', 'fullName profileimageurl')
    .populate('plumberId', 'fullName profileimageurl')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  res.status(200).send({
    message: 'Chat rooms retrieved successfully',
    rooms,
  });
});

/**
 * Get messages inside a chat room
 */
const getRoomMessages = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id.toString();
  const role = req.user.role;

  const room = await ChatRoom.findById(roomId);
  if (!room) {
    throw new ApiError('Chat room not found', 404);
  }

  // Ensure requester is participant or admin
  if (
    role !== 'admin' &&
    room.homeOwnerId.toString() !== userId &&
    room.plumberId.toString() !== userId
  ) {
    throw new ApiError('Access denied to this chat room', 403);
  }

  const messages = await Message.find({ roomId })
    .sort({ createdAt: 1 })
    .populate('senderId', 'fullName profileimageurl');

  res.status(200).send({
    message: 'Messages retrieved successfully',
    messages,
  });
});

/**
 * Upload photo or video for chat room attachments
 */
const uploadChatMedia = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError('Please upload a video or photo file', 400);
  }

  console.log('Chat media file uploaded successfully:', {
    name: req.file.originalname,
    type: req.file.mimetype,
    url: req.file.location,
  });

  res.status(200).send({
    message: 'Media uploaded successfully',
    fileUrl: req.file.location,
    fileType: req.file.mimetype,
  });
});

module.exports = {
  initChatRoom,
  getMyChatRooms,
  getRoomMessages,
  uploadChatMedia,
};
