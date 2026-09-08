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

  console.log(`[CHAT REST] POST /v1/chat/rooms/init | uid=${homeOwnerId} | plumberId=${plumberId}`);

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
  const userId = req.user._id.toString();
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

  const roomIdsStrings = roomsList.map((r) => r._id.toString());
  const roomObjectIds = roomIdsStrings
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // Match both ObjectId and String forms of roomId in MongoDB
  const allRoomIds = Array.from(new Set([...roomObjectIds, ...roomIdsStrings]));

  // Exclude current user's own sent messages
  const excludedSenderIds = mongoose.Types.ObjectId.isValid(userId)
    ? [new mongoose.Types.ObjectId(userId), userId.toString()]
    : [userId.toString()];

  const [unreadCountsAggr, messageCountsAggr] = await Promise.all([
    Message.aggregate([
      {
        $match: {
          roomId: { $in: allRoomIds },
          senderId: { $nin: excludedSenderIds },
          $or: [{ read: false }, { read: { $exists: false } }],
        },
      },
      {
        $group: {
          _id: { $toString: '$roomId' },
          count: { $sum: 1 },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          roomId: { $in: allRoomIds },
        },
      },
      {
        $group: {
          _id: { $toString: '$roomId' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const unreadCountsMap = {};
  unreadCountsAggr.forEach((item) => {
    if (item._id) {
      unreadCountsMap[String(item._id)] = item.count;
    }
  });

  const messageCountsMap = {};
  messageCountsAggr.forEach((item) => {
    if (item._id) {
      messageCountsMap[String(item._id)] = item.count;
    }
  });

  const formattedRooms = roomsList
    .map((room) => {
      let participantUser = null;
      if (role === 'home-owner') {
        participantUser = room.plumberId;
      } else if (role === 'licensed-plumber') {
        participantUser = room.homeOwnerId;
      } else {
        participantUser = room.plumberId || room.homeOwnerId;
      }

      const roomIdStr = room._id.toString();
      const unreadCount = unreadCountsMap[roomIdStr] || 0;
      const messageCount = messageCountsMap[roomIdStr] || 0;

      console.log(`[CHAT ROOMS UNREAD] user=${userId} | room=${roomIdStr} | unreadCount=${unreadCount}`);

      return {
        id: room._id,
        _id: room._id,
        roomId: room._id,
        unreadCount,
        unread_count: unreadCount,
        unreadMessagesCount: unreadCount,
        unread_messages_count: unreadCount,
        messageCount,
        message_count: messageCount,
        totalMessages: messageCount,
        total_messages: messageCount,
        count: messageCount,
        participant: participantUser
          ? {
              id: participantUser._id,
              _id: participantUser._id,
              name: participantUser.fullName || '',
              fullName: participantUser.fullName || '',
              profileImageUrl: participantUser.profileimageurl || '',
              profileimageurl: participantUser.profileimageurl || '',
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
          let senderIdStr = '';
          if (room.lastMessage.senderId) {
            senderIdStr = room.lastMessage.senderId._id
              ? room.lastMessage.senderId._id.toString()
              : room.lastMessage.senderId.toString();
          }
          return {
            content,
            fileUrl: room.lastMessage.fileUrl || null,
            fileType: room.lastMessage.fileType || null,
            senderId: senderIdStr,
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

  const totalUnreadCount = Object.values(unreadCountsMap).reduce(
    (a, b) => a + b,
    0,
  );
  const totalMessagesCount = Object.values(messageCountsMap).reduce(
    (a, b) => a + b,
    0,
  );

  res.status(200).send({
    status: 200,
    message: 'Chat rooms retrieved successfully',
    totalUnreadCount,
    unreadCount: totalUnreadCount,
    totalMessagesCount,
    messageCount: totalMessagesCount,
    data: {
      rooms: formattedRooms,
      totalUnreadCount,
      unreadCount: totalUnreadCount,
      totalMessagesCount,
      messageCount: totalMessagesCount,
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
  const shouldMarkAsRead =
    req.query.markAsRead !== 'false' &&
    req.query.markAsRead !== false &&
    req.query.mark_read !== 'false' &&
    req.query.mark_read !== false;

  console.log(`[CHAT REST] GET /v1/chat/rooms/${roomId}/messages | uid=${userId} | markAsRead=${shouldMarkAsRead}`);

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

  const roomObjId = mongoose.Types.ObjectId.isValid(roomId)
    ? new mongoose.Types.ObjectId(roomId)
    : roomId;
  const userObjId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;

  const roomIdsFilter = Array.from(new Set([roomObjId, roomId.toString()]));
  const senderIdsFilter = Array.from(new Set([userObjId, userId.toString()]));

  // Mark counterpart's messages in this room as read unless markAsRead=false is explicitly requested
  if (shouldMarkAsRead) {
    const unreadMessages = await Message.find({
      roomId: { $in: roomIdsFilter },
      senderId: { $nin: senderIdsFilter },
      read: { $ne: true },
    }).select('_id senderId');

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((m) => m._id);
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { read: true, status: 'seen' } },
      );

      // Notify sender sockets via global.io if connected
      if (global.io) {
        const payload = {
          roomId: roomId.toString(),
          readBy: userId,
          seenBy: userId,
          read: true,
          seen: true,
          isRead: true,
          isSeen: true,
          status: 'seen',
          messageIds: messageIds.map((id) => id.toString()),
        };

        const senderIds = [
          ...new Set(unreadMessages.map((m) => m.senderId.toString())),
        ];
        for (const senderId of senderIds) {
          global.io.to(`user_${senderId}`).emit('messages_read', payload);
          global.io.to(`user_${senderId}`).emit('messages_seen', payload);
          global.io.to(`user_${senderId}`).emit('message_read', payload);
          global.io.to(`user_${senderId}`).emit('message_seen', payload);
        }
        global.io.to(roomId.toString()).emit('messages_read', payload);
        global.io.to(roomId.toString()).emit('messages_seen', payload);
        global.io.to(roomId.toString()).emit('message_read', payload);
        global.io.to(roomId.toString()).emit('message_seen', payload);

        global.io.to(`user_${userId}`).emit('unread_count_updated', {
          roomId: roomId.toString(),
          unreadCount: 0,
          unread_count: 0,
        });
      }
    }
  }

  const rawMessages = await Message.find({ roomId: { $in: roomIdsFilter } })
    .sort({ createdAt: 1, _id: 1 })
    .populate('senderId', 'fullName profileimageurl')
    .lean();

  const formattedMessages = rawMessages.map((msg) => {
    const isRead = !!msg.read;
    return {
      ...msg,
      id: msg._id,
      read: isRead,
      isRead,
      is_read: isRead,
      seen: isRead,
      isSeen: isRead,
      status: isRead ? 'seen' : 'sent',
    };
  });

  const total = formattedMessages.length;
  const unreadCount = formattedMessages.filter((m) => {
    if (!m.senderId || m.read) return false;
    const senderStr = m.senderId._id
      ? m.senderId._id.toString()
      : m.senderId.toString();
    return senderStr !== userId;
  }).length;

  res.status(200).send({
    status: 200,
    message: 'Messages retrieved successfully',
    total,
    count: total,
    messageCount: total,
    unreadCount,
    messages: formattedMessages,
    data: {
      messages: formattedMessages,
      total,
      count: total,
      messageCount: total,
      unreadCount,
    },
  });
});

/**
 * Upload photo or video for chat room attachments
 */
const uploadChatMedia = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError('Please upload a video or photo file', 400);
  }

  console.log(`[CHAT REST] POST /v1/chat/media | name=${req.file.originalname} | type=${req.file.mimetype}`);

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