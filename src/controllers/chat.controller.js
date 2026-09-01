const catchAsync = require('../helpers/asyncErrorHandler');
const ApiError = require('../helpers/apiErrorConverter');
const ChatRoom = require('../models/chatRoom.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

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
    { path: 'homeOwnerId', select: 'fullName profileimageurl isOnline' },
    { path: 'plumberId', select: 'fullName profileimageurl isOnline' },
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

  let query = { lastMessage: { $exists: true, $ne: null } };
  if (role === 'home-owner') {
    query.homeOwnerId = userId;
  } else if (role === 'licensed-plumber') {
    query.plumberId = userId;
  } else if (role === 'admin') {
    // Admins can see all chats
  } else {
    throw new ApiError('Unauthorized role for accessing chat rooms', 403);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const total = await ChatRoom.countDocuments(query);
  const totalPages = Math.ceil(total / limit) || 1;
  const hasNextPage = page < totalPages;

  const roomsList = await ChatRoom.find(query)
    .populate('homeOwnerId', 'fullName profileimageurl isOnline')
    .populate('plumberId', 'fullName profileimageurl isOnline')
    .populate('lastMessage')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  const roomIds = roomsList.map((r) => r._id);
  const unreadCountsAggr = await Message.aggregate([
    {
      $match: {
        roomId: { $in: roomIds },
        read: false,
      },
    },
    {
      $group: {
        _id: '$roomId',
        count: { $sum: 1 },
      },
    },
  ]);

  const unreadCountsMap = {};
  unreadCountsAggr.forEach((item) => {
    unreadCountsMap[item._id.toString()] = item.count;
  });

  const formattedRooms = roomsList
    .map((room) => {
      // Determine the counterpart participant
      let participantUser = null;
      if (role === 'home-owner') {
        participantUser = room.plumberId;
      } else if (role === 'licensed-plumber') {
        participantUser = room.homeOwnerId;
      } else {
        // Admin fallback uses plumberId if available, else homeOwnerId
        participantUser = room.plumberId || room.homeOwnerId;
      }

      return {
        id: room._id,
        unreadCount: unreadCountsMap[room._id.toString()] || 0,
        participant: participantUser
          ? {
              id: participantUser._id,
              name: participantUser.fullName || '',
              profileImageUrl: participantUser.profileimageurl || '',
              isOnline: participantUser.isOnline || false,
            }
          : null,
        lastMessage: (() => {
          if (!room.lastMessage) return null;
          let content = room.lastMessage.content
            ? room.lastMessage.content.trim()
            : '';
          if (content === '' && room.lastMessage.fileUrl) {
            const fileUrl = room.lastMessage.fileUrl;
            let fileName = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
            if (fileName) {
              fileName = decodeURIComponent(fileName.split('?')[0]);
            }
            content = fileName || 'File';
          }
          return {
            content,
            fileUrl: room.lastMessage.fileUrl || null,
            fileType: room.lastMessage.fileType || null,
            senderId: room.lastMessage.senderId,
            createdAt: room.lastMessage.createdAt,
            read: room.lastMessage.read || false,
          };
        })(),
      };
    })
    .filter((room) => {
      if (!room.lastMessage) return false;
      const content = room.lastMessage.content
        ? room.lastMessage.content.trim()
        : '';
      const hasFile = !!room.lastMessage.fileUrl;
      return content !== '' || hasFile;
    });

  res.status(200).send({
    status: 200,
    message: 'Chat rooms retrieved successfully',
    data: {
      rooms: formattedRooms,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
      },
    },
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

  // Mark counterpart's messages in this room as read
  await Message.updateMany(
    { roomId, senderId: { $ne: req.user._id }, read: false },
    { $set: { read: true } },
  );

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
