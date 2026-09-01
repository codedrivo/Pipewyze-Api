// /* eslint-disable no-console */
// const express = require('express');
// const bodyParser = require('body-parser');
// const app = express();
// const http = require('http');
// const socketIo = require('socket.io');
// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// const config = require('./config/config');
// const ChatRoom = require('./models/chatRoom.model');
// const Message = require('./models/message.model');
// const User = require('./models/user.model');
// const AiVideo = require('./models/aiVideo.model');
// const AiChat = require('./models/aiChat.model');
// const notificationService = require('./services/notification.service');

// // -----------------------------------------------------------------------------
// // S3 CONFIGURATION & HELPER
// // -----------------------------------------------------------------------------
// const s3 = new S3Client({
//   region: config.s3.region,
//   credentials: {
//     accessKeyId: config.s3.accessKeyId,
//     secretAccessKey: config.s3.secretAccessKey,
//   },
// });

// async function uploadBase64ToS3(base64Payload, declaredFileType) {
//   let mimeType = declaredFileType || 'image/jpeg';
//   let cleanBase64 = base64Payload;

//   // 1. Strip Markdown links, brackets, or accidental URL encapsulation
//   if (typeof cleanBase64 === 'string') {
//     cleanBase64 = cleanBase64.replace(/\]\(http[^\)]+\)/g, '').trim();
//   }

//   // 2. Extract MIME from data URI scheme if provided
//   if (cleanBase64.startsWith('data:')) {
//     const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
//     if (matches && matches.length === 3) {
//       mimeType = matches[1];
//       cleanBase64 = matches[2];
//     } else {
//       cleanBase64 = cleanBase64.split(';base64,')[1] || cleanBase64;
//     }
//   }

//   // 3. Remove whitespace and newlines from Base64 string
//   cleanBase64 = cleanBase64.replace(/\s/g, '');
//   const buffer = Buffer.from(cleanBase64, 'base64');

//   // 4. Resolve clean extension
//   let extension = mimeType.split('/').pop().toLowerCase();
//   if (extension === 'quicktime') extension = 'mov';
//   if (extension === 'jpeg') extension = 'jpg';

//   const folder = mimeType.startsWith('video/') ? 'videos' : 'images';
//   const fileName = `${crypto.randomUUID()}.${extension}`;
//   const uniqueKey = `PipeWyze/${folder}/${fileName}`;

//   // 5. Send to S3 with explicit ContentType and ContentLength
//   const command = new PutObjectCommand({
//     Bucket: config.s3.S3_BUCKET_PATH,
//     Key: uniqueKey,
//     Body: buffer,
//     ContentType: mimeType,
//     ContentLength: buffer.length,
//   });

//   const uploadResult = await s3.send(command);
//   console.log(`[S3 Upload Success] ETag: ${uploadResult.ETag}, Key: ${uniqueKey}`);

//   // 6. Generate clean URL
//   const fileUrl = config.s3.cloudfrontUrl
//     ? `${config.s3.cloudfrontUrl.replace(/\/$/, '')}/${uniqueKey}`
//     : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

//   return { fileUrl, fileType: mimeType };
// }

// const extractUserId = (socket) => {
//   let userId = socket.handshake.query?.userId || socket.handshake.auth?.userId;
//   const rawToken =
//     socket.handshake.auth?.token ||
//     socket.handshake.headers?.authorization ||
//     socket.handshake.query?.token;

//   if (rawToken) {
//     try {
//       const token = rawToken.startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
//       const data = jwt.verify(token, config.jwt.secret, {
//         algorithms: [config.jwt.algo || 'HS256'],
//       });
//       if (data && data.sub) {
//         userId = data.sub;
//       }
//     } catch (err) {
//       console.error('[Socket Auth] Token verification failed:', err.message);
//     }
//   }
//   return userId ? userId.toString() : null;
// };

// // -----------------------------------------------------------------------------
// // STANDALONE SOCKET SERVER SETUP
// // -----------------------------------------------------------------------------
// const server = http.createServer(app);
// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST'],
//   },
//   maxHttpBufferSize: 100 * 1024 * 1024, // 100 MB max buffer for base64 media payloads
//   pingTimeout: 60000,
//   pingInterval: 25000,
// });
// global.io = io;

// app.use(express.static(__dirname));
// app.use(bodyParser.json({ limit: '100mb' }));
// app.use(bodyParser.urlencoded({ extended: false, limit: '100mb' }));

// io.on('connection', async (socket) => {
//   let userId = extractUserId(socket);

//   const initUser = async (uid) => {
//     socket.userId = uid;
//     socket.join(`user_${uid}`);

//     await User.findByIdAndUpdate(uid, { isOnline: true }).catch((err) => console.error(err));
//     io.emit('user_status_changed', { userId: uid, isOnline: true });

//     const rooms = await ChatRoom.find({
//       $or: [{ homeOwnerId: uid }, { plumberId: uid }],
//     });
//     rooms.forEach((room) => socket.join(room._id.toString()));
//     console.log(`[User Connected] User ${uid} connected & joined ${rooms.length} rooms`);
//   };

//   if (userId) {
//     await initUser(userId);
//   }

//   socket.on('user_connected', async ({ userId: connectedUserId }) => {
//     if (!connectedUserId) return;
//     await initUser(connectedUserId.toString());
//   });

//   // ---------------------------------------------------------------------------
//   // EVENT: chat presence & mark messages read
//   // ---------------------------------------------------------------------------
//   socket.on('chat_opened', ({ roomId }) => {
//     socket.activeChatRoomId = roomId;
//   });

//   socket.on('chat_closed', ({ roomId }) => {
//     if (socket.activeChatRoomId === roomId) {
//       socket.activeChatRoomId = null;
//     }
//   });

//   socket.on('mark_messages_read', async ({ roomId }) => {
//     const activeUserId = socket.userId || userId;
//     if (activeUserId && roomId) {
//       await Message.updateMany(
//         { roomId, senderId: { $ne: activeUserId }, read: false },
//         { $set: { read: true } }
//       );
//       const unreadCount = await Message.countDocuments({
//         roomId,
//         senderId: { $ne: activeUserId },
//         read: false
//       });
//       io.to(`user_${activeUserId}`).emit('unread_count_updated', {
//         roomId: roomId.toString(),
//         unreadCount
//       });
//     }
//   });

//   // ---------------------------------------------------------------------------
//   // EVENT: join_room
//   // ---------------------------------------------------------------------------
//   socket.on('join_room', async ({ roomId, userId: payloadUserId }) => {
//     if (!roomId) {
//       socket.emit('chat_error', { message: 'roomId is required' });
//       return;
//     }
//     const activeUserId = (payloadUserId || socket.userId || userId || '').toString();

//     if (activeUserId) {
//       socket.userId = activeUserId;
//       socket.join(`user_${activeUserId}`);

//       try {
//         const room = await ChatRoom.findById(roomId);
//         if (!room) {
//           socket.emit('chat_error', { message: 'Chat room not found.' });
//           return;
//         }

//         // Restrict room access to only the homeowner and plumber
//         if (room.homeOwnerId.toString() !== activeUserId && room.plumberId.toString() !== activeUserId) {
//           socket.emit('chat_error', { message: 'You are not authorized to join this room.' });
//           return;
//         }

//         // If authorized, join the socket room
//         socket.join(roomId);

//         // Mark counterpart's messages as read
//         await Message.updateMany(
//           { roomId, senderId: { $ne: activeUserId }, read: false },
//           { $set: { read: true } }
//         );

//         const unreadCount = await Message.countDocuments({
//           roomId,
//           senderId: { $ne: activeUserId },
//           read: false
//         });

//         // Notify all of this user's sockets that unread count for this room is updated
//         io.to(`user_${activeUserId}`).emit('unread_count_updated', {
//           roomId: roomId.toString(),
//           unreadCount
//         });

//         const messages = await Message.find({ roomId })
//           .populate('senderId', 'fullName profileimageurl')
//           .sort({ createdAt: 1 });

//         socket.emit('message_history', messages);

//         if (room) {
//           const counterpartId =
//             room.homeOwnerId.toString() === activeUserId
//               ? room.plumberId.toString()
//               : room.homeOwnerId.toString();
//           const counterpartUser = await User.findById(counterpartId);
//           if (counterpartUser) {
//             socket.emit('user_status_changed', {
//               userId: counterpartId,
//               isOnline: counterpartUser.isOnline,
//             });
//           }
//         }
//       } catch (error) {
//         console.error('Error in join_room:', error.message);
//         socket.emit('chat_error', { message: 'Internal server error in join_room.' });
//       }
//     }
//   });

//   // ---------------------------------------------------------------------------
//   // EVENT: send_message (Base64 Media & Text Chat)
//   // ---------------------------------------------------------------------------
//   socket.on('send_message', async ({ roomId, senderId, receiverId, content, fileUrl, fileType, fileName }) => {
//   try {
//     const actualSenderId = socket.userId || senderId;
    
//     if (!roomId || !actualSenderId || (!content && !fileUrl)) {
//       socket.emit('chat_error', { message: 'Missing roomId, senderId, or content/file.' });
//       return;
//     }

//     const senderUser = await User.findById(actualSenderId);
//     if (!senderUser) {
//       socket.emit('chat_error', { message: 'Sender not found.' });
//       return;
//     }

//     let room = await ChatRoom.findById(roomId);
//     if (room) {
//       if (room.homeOwnerId.toString() !== actualSenderId.toString() && room.plumberId.toString() !== actualSenderId.toString()) {
//         socket.emit('chat_error', { message: 'You are not authorized to send messages in this room.' });
//         return;
//       }
//     } else if (receiverId) {
//       const sRole = senderUser.role;
//       const homeOwnerId = sRole === 'licensed-plumber' ? receiverId : actualSenderId;
//       const plumberId = sRole === 'licensed-plumber' ? actualSenderId : receiverId;

//       room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });
//       const sockets = await io.fetchSockets();
//       sockets.forEach((s) => {
//         if (s.userId === homeOwnerId.toString() || s.userId === plumberId.toString()) {
//           s.join(roomId);
//         }
//       });
//     }

//     socket.join(roomId);

//     let finalFileUrl = null;
//     let finalFileType = fileType || null;

//     // 1. Process Base64 fileUrl or uploaded HTTP/S3 link
//     if (fileUrl) {
//       if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
//         finalFileUrl = fileUrl;
//       } else {
//         try {
//           const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
//           finalFileUrl = uploadResult.fileUrl;
//           finalFileType = uploadResult.fileType;
//         } catch (uploadErr) {
//           console.error('[Media Upload Error] S3 upload failed:', uploadErr.message);
//           socket.emit('chat_error', { message: 'Media upload failed.' });
//           return;
//         }
//       }
//     }

//     // 2. Infer MIME type if missing
//     if (!finalFileType && finalFileUrl) {
//       const cleanUrl = finalFileUrl.split('?')[0].toLowerCase();
//       if (/\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(cleanUrl)) {
//         finalFileType = 'video/mp4';
//       } else if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(cleanUrl)) {
//         finalFileType = 'image/jpeg';
//       }
//     }

//     const isVideo =
//       (finalFileType && finalFileType.startsWith('video/')) ||
//       /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

//     // 3. Strict content sanitization (Prevents raw Base64 string text dumps)
//     let finalContent = typeof content === 'string' ? content.trim() : '';

//     const isBase64String =
//       finalContent.startsWith('data:') ||
//       finalContent.length > 200 ||
//       /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, '')) ||
//       finalContent === fileName ||
//       /\.(mp4|mov|jpg|jpeg|png|webp|heic)$/i.test(finalContent);

//     if (!finalContent || isBase64String) {
//       if (finalFileUrl) {
//         finalContent = isVideo ? 'Video' : 'Photo';
//       } else {
//         finalContent = '';
//       }
//     }

//     // 4. Create single message entry
//     const message = await Message.create({
//       roomId,
//       senderId: actualSenderId,
//       content: finalContent || (isVideo ? 'Video' : 'Photo'),
//       fileUrl: finalFileUrl,
//       fileType: finalFileType,
//     });

//     if (room) {
//       await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });
//     }

//     const populatedMessage = await message.populate('senderId', 'fullName profileimageurl');
    
//     console.log(`\n[CHAT LOG] New message created in room: ${roomId}`);
//     console.log(`[CHAT LOG] Sender: ${senderUser?.role} (${senderUser?.fullName || actualSenderId})`);
//     console.log(`[CHAT LOG] Content: ${finalContent || 'Media File'}`);

//     // Emit to the sender explicitly so their UI updates immediately without needing to refresh
//     io.to(`user_${actualSenderId}`).emit('new_message', populatedMessage.toJSON());

//     if (room) {
//       const counterpartId =
//         room.homeOwnerId.toString() === actualSenderId.toString()
//           ? room.plumberId.toString()
//           : room.homeOwnerId.toString();

//       if (counterpartId.toString() !== actualSenderId.toString()) {
//         console.log(`[CHAT LOG] Delivering to counterpart ID: ${counterpartId}`);
//         const counterpartSockets = await io.in(`user_${counterpartId}`).fetchSockets();
//         const isCounterpartActive = counterpartSockets.some((s) => s.activeChatRoomId === roomId.toString());

//         if (isCounterpartActive) {
//           await Message.findByIdAndUpdate(message._id, { read: true });
//         }

//         const unreadCount = await Message.countDocuments({
//           roomId,
//           senderId: { $ne: counterpartId },
//           read: false,
//         });

//         io.to(`user_${counterpartId}`).emit('unread_count_updated', {
//           roomId: roomId.toString(),
//           unreadCount,
//         });

//         // Restore global message delivery so the receiver gets it even if not inside the room socket
//         io.to(`user_${counterpartId}`).emit('new_message', populatedMessage.toJSON());

//         io.to(`user_${counterpartId}`).emit('chat_notification', {
//           roomId,
//           senderName: senderUser.fullName || 'Someone',
//           message: populatedMessage,
//         });

//         console.log(`[FCM DEBUG] Sending notification to counterpart: ${counterpartId}`);

//         notificationService
//           .sendToUsers(
//             [counterpartId],
//             `New message from ${senderUser.fullName || 'Someone'}`,
//             finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
//             { roomId: roomId.toString(), messageId: message._id.toString() },
//           )
//           .catch((err) => console.error('[Push Notification Error]:', err.message));
//       }
//     }
//   } catch (error) {
//     console.error('[send_message Error]:', error.message);
//     socket.emit('chat_error', { message: 'Failed to send message.' });
//   }
// });

//   // ---------------------------------------------------------------------------
//   // EVENT: ask_ai (AI Assistant)
//   // ---------------------------------------------------------------------------
//   socket.on('ask_ai', async ({ message, userId: payloadUserId, fileUrl, fileType, fileName }) => {
//     const activeUserId = payloadUserId || socket.userId || userId;
//     try {
//       if (!activeUserId) {
//         socket.emit('ai_error', { message: 'User verification failed: missing user ID.' });
//         return;
//       }
//       if ((!message || !message.trim()) && !fileUrl) {
//         socket.emit('ai_error', { message: 'Please enter a question or upload a file.' });
//         return;
//       }
//       const user = await User.findById(activeUserId);
//       if (!user) {
//         socket.emit('ai_error', { message: 'User not found in database.' });
//         return;
//       }

//       let finalFileUrl = fileUrl || '';
//       let finalFileType = fileType || '';

//       if (fileUrl && !fileUrl.startsWith('http')) {
//         try {
//           const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
//           finalFileUrl = uploadResult.fileUrl;
//           finalFileType = uploadResult.fileType;
//         } catch (e) {
//           console.error('[AI Base64 Upload Error]:', e.message);
//         }
//       }

//       const isVideo =
//         (finalFileType && finalFileType.startsWith('video/')) ||
//         /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

//       let cleanMessage = message ? message.trim() : (isVideo ? 'Video' : 'Photo');
//       const allVideos = await AiVideo.find({ targetAudience: user.role }).lean();
//       const queryWords = cleanMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
//       const matchedVideos = allVideos.filter((video) =>
//         queryWords.some((word) => (video.title || '').toLowerCase().includes(word)),
//       );

//       let suggestedVideo = null;
//       let aiMessage = '';

//       if (matchedVideos.length > 0) {
//         suggestedVideo = {
//           id: matchedVideos[0]._id || matchedVideos[0].id,
//           title: matchedVideos[0].title,
//           videoUrl: matchedVideos[0].videoUrl,
//           description: matchedVideos[0].description,
//           thumbnail: matchedVideos[0].thumbnail,
//           isYoutube: false,
//         };
//         aiMessage = `I found a tutorial video in our library: "${suggestedVideo.title}".`;
//       } else {
//         aiMessage = 'I am looking into this plumbing question for you.';
//       }

//       await AiChat.create({
//         userId: activeUserId,
//         message: cleanMessage,
//         response: aiMessage,
//         suggestedVideo,
//         fileUrl: finalFileUrl || '',
//         fileType: finalFileType || '',
//         fileName: fileName || '',
//       });

//       socket.emit('ai_response', {
//         sender: 'ai',
//         message: aiMessage,
//         suggestedVideo,
//         fileUrl: finalFileUrl || '',
//         fileType: finalFileType || '',
//         fileName: fileName || '',
//       });
//     } catch (err) {
//       console.error('[ask_ai Error]:', err.message);
//       socket.emit('ai_error', { message: 'Failed to generate response from AI Assistant.' });
//     }
//   });

//   socket.on('disconnect', async () => {
//     const activeUserId = socket.userId || userId;
//     if (activeUserId) {
//       const sockets = await io.fetchSockets();
//       const hasOtherSockets = sockets.some((s) => s.userId === activeUserId && s.id !== socket.id);
//       if (!hasOtherSockets) {
//         User.findByIdAndUpdate(activeUserId, { isOnline: false })
//           .exec()
//           .then(() => console.log(`User disconnected & marked offline: ${activeUserId}`))
//           .catch((err) => console.error(err));
//         io.emit('user_status_changed', {
//           userId: activeUserId,
//           isOnline: false,
//         });
//       }
//     }
//   });
// });

// const socketPort = config.socketPort || 4000;
// server.listen(socketPort, () => {
//   console.log('Socket.IO server running on port:', socketPort);
// });

// module.exports = { io, server };

/* eslint-disable no-console */
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');
const AiVideo = require('./models/aiVideo.model');
const AiChat = require('./models/aiChat.model');
const notificationService = require('./services/notification.service');

const app = express();
const server = http.createServer(app);

// -----------------------------------------------------------------------------
// S3 CLIENT & MEDIA UPLOAD HELPER
// -----------------------------------------------------------------------------
const s3 = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

const MIME_EXTENSION_MAP = {
  'video/quicktime': 'mov',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

async function uploadBase64ToS3(base64Payload, declaredFileType) {
  let mimeType = declaredFileType || 'image/jpeg';
  let cleanBase64 = base64Payload;

  if (typeof cleanBase64 === 'string') {
    cleanBase64 = cleanBase64.replace(/\]\(http[^\)]+\)/g, '').trim();
    if (cleanBase64.startsWith('data:')) {
      const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        cleanBase64 = matches[2];
      }
    }
  }

  cleanBase64 = cleanBase64.replace(/\s/g, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  const extension = MIME_EXTENSION_MAP[mimeType] || mimeType.split('/').pop().toLowerCase() || 'bin';
  const folder = mimeType.startsWith('video/') ? 'videos' : 'images';
  const uniqueKey = `PipeWyze/${folder}/${crypto.randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.S3_BUCKET_PATH,
      Key: uniqueKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    })
  );

  const fileUrl = config.s3.cloudfrontUrl
    ? `${config.s3.cloudfrontUrl.replace(/\/$/, '')}/${uniqueKey}`
    : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

  return { fileUrl, fileType: mimeType };
}

// -----------------------------------------------------------------------------
// AUTHENTICATION UTILS
// -----------------------------------------------------------------------------
const verifyToken = (rawToken) => {
  if (!rawToken) return null;
  try {
    const token = rawToken.startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algo || 'HS256'],
    });
    return decoded?.sub ? decoded.sub.toString() : null;
  } catch (err) {
    console.error('[Socket Auth] Verification failed:', err.message);
    return null;
  }
};

// -----------------------------------------------------------------------------
// SOCKET SERVER & MIDDLEWARE
// -----------------------------------------------------------------------------
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // Optimized down to 50MB
  pingTimeout: 60000,
  pingInterval: 25000,
});

global.io = io;

app.use(express.static(__dirname));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));

// Socket Auth Middleware
// io.use((socket, next) => {
//   const rawToken =
//     socket.handshake.auth?.token ||
//     socket.handshake.headers?.authorization ||
//     socket.handshake.query?.token;

//   const authUserId = verifyToken(rawToken) || socket.handshake.query?.userId || socket.handshake.auth?.userId;

//   if (authUserId) {
//     socket.userId = authUserId.toString();
//     return next();
//   }
//   return next(new Error('Authentication failed: Missing or invalid token.'));
// });

io.use((socket, next) => {
  const rawToken =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization;

  const authUserId = verifyToken(rawToken);

  if (!authUserId) {
    return next(
      new Error('Authentication failed: Missing or invalid token.')
    );
  }

  socket.userId = authUserId.toString();

  next();
});

// -----------------------------------------------------------------------------
// CONNECTION LIFECYCLE & EVENT HANDLERS
// -----------------------------------------------------------------------------
io.on('connection', async (socket) => {
  const uid = socket.userId;
  const userRoom = `user_${uid}`;

  socket.join(userRoom);

  // Initialize User status & join active chat rooms
  try {
    await User.findByIdAndUpdate(uid, { isOnline: true });
    io.emit('user_status_changed', { userId: uid, isOnline: true });

    const rooms = await ChatRoom.find(
      { $or: [{ homeOwnerId: uid }, { plumberId: uid }] },
      { _id: 1 }
    ).lean();

    rooms.forEach((r) => socket.join(r._id.toString()));
  } catch (err) {
    console.error(`[Init User Error] User ${uid}:`, err.message);
  }

  // Presence Tracking
  socket.on('chat_opened', ({ roomId }) => {
    if (roomId) socket.activeChatRoomId = roomId.toString();
  });

  socket.on('chat_closed', ({ roomId }) => {
    if (socket.activeChatRoomId === roomId?.toString()) {
      socket.activeChatRoomId = null;
    }
  });

  // Mark Messages Read
  socket.on('mark_messages_read', async ({ roomId }) => {
    if (!roomId) return;
    try {
      await Message.updateMany(
        { roomId, senderId: { $ne: uid }, read: false },
        { $set: { read: true } }
      );

      io.to(userRoom).emit('unread_count_updated', {
        roomId: roomId.toString(),
        unreadCount: 0,
      });
    } catch (err) {
      console.error('[mark_messages_read Error]:', err.message);
    }
  });

  // Join Room
  socket.on('join_room', async ({ roomId }) => {
    if (!roomId) {
      return socket.emit('chat_error', { message: 'roomId is required.' });
    }

    try {
      const room = await ChatRoom.findById(roomId).lean();
      if (!room) {
        return socket.emit('chat_error', { message: 'Chat room not found.' });
      }

      const isHomeOwner = room.homeOwnerId?.toString() === uid;
      const isPlumber = room.plumberId?.toString() === uid;

      if (!isHomeOwner && !isPlumber) {
        return socket.emit('chat_error', { message: 'Unauthorized room access.' });
      }

      socket.join(roomId.toString());

      // Mark unread counterpart messages
      await Message.updateMany(
        { roomId, senderId: { $ne: uid }, read: false },
        { $set: { read: true } }
      );

      io.to(userRoom).emit('unread_count_updated', {
        roomId: roomId.toString(),
        unreadCount: 0,
      });

      // Fetch message history and counterpart status concurrently
      const counterpartId = isHomeOwner ? room.plumberId?.toString() : room.homeOwnerId?.toString();

      const [messages, counterpartUser] = await Promise.all([
        Message.find({ roomId })
          .populate('senderId', 'fullName profileimageurl')
          .sort({ createdAt: 1 })
          .lean(),
        counterpartId ? User.findById(counterpartId, 'isOnline').lean() : null,
      ]);

      socket.emit('message_history', messages);

      if (counterpartUser) {
        socket.emit('user_status_changed', {
          userId: counterpartId,
          isOnline: !!counterpartUser.isOnline,
        });
      }
    } catch (error) {
      console.error('[join_room Error]:', error.message);
      socket.emit('chat_error', { message: 'Internal server error in join_room.' });
    }
  });

  // Send Message
  socket.on('send_message', async ({ roomId, receiverId, content, fileUrl, fileType, fileName }) => {
    try {
      if (!roomId || (!content && !fileUrl)) {
        return socket.emit('chat_error', { message: 'Missing roomId or message payload.' });
      }

      let [senderUser, room] = await Promise.all([
        User.findById(uid, 'role fullName profileimageurl').lean(),
        ChatRoom.findById(roomId),
      ]);

      if (!senderUser) {
        return socket.emit('chat_error', { message: 'Sender not found.' });
      }

      // Create room if it doesn't exist
      if (!room) {
        if (!receiverId) {
          return socket.emit('chat_error', { message: 'receiverId is required when creating a new chat room.' });
        }

        const receiver = await User.findById(receiverId, 'role').lean();
        if (!receiver) {
          return socket.emit('chat_error', { message: 'Receiver not found.' });
        }

        const isPlumber = senderUser.role === 'licensed-plumber';
        const isReceiverPlumber = receiver.role === 'licensed-plumber';

        let homeOwnerId;
        let plumberId;

        if (isPlumber && !isReceiverPlumber) {
          plumberId = uid;
          homeOwnerId = receiverId.toString();
        } else if (!isPlumber && isReceiverPlumber) {
          homeOwnerId = uid;
          plumberId = receiverId.toString();
        } else {
          return socket.emit('chat_error', { message: 'Invalid chat participants.' });
        }

        room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });

        // Auto-join connected sockets of both parties
        io.in(`user_${homeOwnerId}`).socketsJoin(roomId.toString());
        io.in(`user_${plumberId}`).socketsJoin(roomId.toString());
      }

      const senderIdStr = uid.toString();
      const homeOwnerIdStr = room.homeOwnerId?.toString();
      const plumberIdStr = room.plumberId?.toString();

      let counterpartId = null;

      if (senderIdStr === homeOwnerIdStr) {
        counterpartId = plumberIdStr;
      } else if (senderIdStr === plumberIdStr) {
        counterpartId = homeOwnerIdStr;
      } else {
        return socket.emit('chat_error', { message: 'Unauthorized action. You are not a participant of this chat room.' });
      }

      if (!counterpartId) {
        return socket.emit('chat_error', { message: 'Chat room does not have a valid counterpart.' });
      }

      console.log('========== SEND MESSAGE DEBUG ==========');
      console.log('socket.id:', socket.id);
      console.log('authenticated uid:', uid);
      console.log('roomId:', roomId);
      console.log('mobile receiverId:', receiverId);
      console.log('room homeOwnerId:', homeOwnerIdStr);
      console.log('room plumberId:', plumberIdStr);
      console.log('calculated counterpartId:', counterpartId);
      console.log('content:', content);
      console.log('=========================================');

      // Handle Media Upload / URL Parsing
      let finalFileUrl = null;
      let finalFileType = fileType || null;

      if (fileUrl) {
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          finalFileUrl = fileUrl;
        } else {
          const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
          finalFileUrl = uploadResult.fileUrl;
          finalFileType = uploadResult.fileType;
        }
      }

      if (!finalFileType && finalFileUrl) {
        const cleanUrl = finalFileUrl.split('?')[0].toLowerCase();
        if (/\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(cleanUrl)) {
          finalFileType = 'video/mp4';
        } else if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(cleanUrl)) {
          finalFileType = 'image/jpeg';
        }
      }

      const isVideo =
        (finalFileType && finalFileType.startsWith('video/')) ||
        /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

      // Content Sanitization
      // let finalContent = typeof content === 'string' ? content.trim() : '';
      // const isBase64Payload =
      //   finalContent.startsWith('data:') ||
      //   finalContent.length > 250 ||
      //   /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, '')) ||
      //   finalContent === fileName;

      // if (!finalContent || isBase64Payload) {
      //   finalContent = finalFileUrl ? (isVideo ? 'Video' : 'Photo') : '';
      // }

      let finalContent = typeof content === 'string' ? content.trim() : '';
      const isBase64Payload = finalContent.startsWith('data:') || /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, ''));

      if (!finalContent || isBase64Payload) {
        finalContent = finalFileUrl ? isVideo ? 'Video' : 'Photo' : '';
}

      console.log('[MESSAGE CREATE]', {
        roomId: roomId.toString(),
        senderId: uid.toString(),
        receiverId: counterpartId,
        content: finalContent,
      });

      // Save Message
      const message = await Message.create({
        roomId,
        senderId: uid,
        content: finalContent || (isVideo ? 'Video' : 'Photo'),
        fileUrl: finalFileUrl,
        fileType: finalFileType,
      });

      if (room) {
        await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });
      }

      const populatedMessage = await message.populate('senderId', 'fullName profileimageurl');
      const messageJson = populatedMessage.toJSON();

      // Emit directly to room participants
      io.to(roomId.toString()).emit('new_message', messageJson);

      const counterpartSockets = await io.in(`user_${counterpartId}`).fetchSockets();
      const isCounterpartActiveInRoom = counterpartSockets.some(
        (s) => s.activeChatRoomId === roomId.toString()
      );

      if (isCounterpartActiveInRoom) {
        await Message.findByIdAndUpdate(message._id, { read: true });
      } else {
        const unreadCount = await Message.countDocuments({
          roomId,
          senderId: { $ne: counterpartId },
          read: false,
        });

        io.to(`user_${counterpartId}`).emit('unread_count_updated', {
          roomId: roomId.toString(),
          unreadCount,
        });
      }

      io.to(`user_${counterpartId}`).emit('chat_notification', {
        roomId: roomId.toString(),
        senderName: senderUser.fullName || 'Someone',
        message: messageJson,
      });

      // Dispatch push notification asynchronously
      notificationService
        .sendToUsers(
          [counterpartId],
          `New message from ${senderUser.fullName || 'Someone'}`,
          finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
          { roomId: roomId.toString(), messageId: message._id.toString() }
        )
        .catch((err) => console.error('[Push Notification Error]:', err.message));
    } catch (error) {
      console.error('[send_message Error]:', error.message);
      socket.emit('chat_error', { message: 'Failed to send message.' });
    }
  });

  // Ask AI
  socket.on('ask_ai', async ({ message, fileUrl, fileType, fileName }) => {
    try {
      if ((!message || !message.trim()) && !fileUrl) {
        return socket.emit('ai_error', { message: 'Please enter a question or upload a file.' });
      }

      const user = await User.findById(uid, 'role').lean();
      if (!user) {
        return socket.emit('ai_error', { message: 'User not found.' });
      }

      let finalFileUrl = fileUrl || '';
      let finalFileType = fileType || '';

      if (fileUrl && !fileUrl.startsWith('http')) {
        try {
          const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
          finalFileUrl = uploadResult.fileUrl;
          finalFileType = uploadResult.fileType;
        } catch (e) {
          console.error('[AI Base64 Upload Error]:', e.message);
        }
      }

      const isVideo =
        (finalFileType && finalFileType.startsWith('video/')) ||
        /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

      const cleanMessage = message ? message.trim() : isVideo ? 'Video' : 'Photo';
      const queryWords = cleanMessage
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);

      // Perform MongoDB regex search instead of loading full collection into RAM
      let suggestedVideo = null;
      let aiMessage = 'I am looking into this plumbing question for you.';

      if (queryWords.length > 0) {
        const regexPatterns = queryWords.map((word) => new RegExp(word, 'i'));
        const matchedVideo = await AiVideo.findOne({
          targetAudience: user.role,
          title: { $in: regexPatterns },
        }).lean();

        if (matchedVideo) {
          suggestedVideo = {
            id: matchedVideo._id || matchedVideo.id,
            title: matchedVideo.title,
            videoUrl: matchedVideo.videoUrl,
            description: matchedVideo.description,
            thumbnail: matchedVideo.thumbnail,
            isYoutube: false,
          };
          aiMessage = `I found a tutorial video in our library: "${suggestedVideo.title}".`;
        }
      }

      const responsePayload = {
        sender: 'ai',
        message: aiMessage,
        suggestedVideo,
        fileUrl: finalFileUrl,
        fileType: finalFileType,
        fileName: fileName || '',
      };

      await AiChat.create({
        userId: uid,
        message: cleanMessage,
        response: aiMessage,
        suggestedVideo,
        fileUrl: finalFileUrl,
        fileType: finalFileType,
        fileName: fileName || '',
      });

      socket.emit('ai_response', responsePayload);
    } catch (err) {
      console.error('[ask_ai Error]:', err.message);
      socket.emit('ai_error', { message: 'Failed to process AI assistant request.' });
    }
  });

  // Disconnect Handling
  socket.on('disconnect', async () => {
    try {
      // Check remaining connected sockets in this user's private room
      const remainingSockets = io.sockets.adapter.rooms.get(userRoom);
      const isCompletelyOffline = !remainingSockets || remainingSockets.size === 0;

      if (isCompletelyOffline) {
        await User.findByIdAndUpdate(uid, { isOnline: false });
        io.emit('user_status_changed', { userId: uid, isOnline: false });
      }
    } catch (err) {
      console.error('[Disconnect Error]:', err.message);
    }
  });
});

const socketPort = config.socketPort || 4000;
server.listen(socketPort, () => {
  console.log('Socket.IO server running on port:', socketPort);
});

module.exports = { io, server };