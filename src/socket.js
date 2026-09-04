// /* eslint-disable no-console */
// const http = require('http');
// const crypto = require('crypto');
// const express = require('express');
// const bodyParser = require('body-parser');
// const socketIo = require('socket.io');
// const jwt = require('jsonwebtoken');
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// const config = require('./config/config');
// const ChatRoom = require('./models/chatRoom.model');
// const Message = require('./models/message.model');
// const User = require('./models/user.model');
// const AiChat = require('./models/aiChat.model');
// const notificationService = require('./services/notification.service');
// const aiAssistant = require('./helpers/aiAssistant.helper');

// const app = express();
// const server = http.createServer(app);

// // -----------------------------------------------------------------------------
// // S3 CLIENT & MEDIA UPLOAD HELPER
// // -----------------------------------------------------------------------------
// const s3 = new S3Client({
//   region: config.s3.region,
//   credentials: {
//     accessKeyId: config.s3.accessKeyId,
//     secretAccessKey: config.s3.secretAccessKey,
//   },
// });

// const MIME_EXTENSION_MAP = {
//   'video/quicktime': 'mov',
//   'video/mp4': 'mp4',
//   'video/webm': 'webm',
//   'image/jpeg': 'jpg',
//   'image/png': 'png',
//   'image/webp': 'webp',
//   'image/gif': 'gif',
// };

// async function uploadBase64ToS3(base64Payload, declaredFileType) {
//   let mimeType = declaredFileType || 'image/jpeg';
//   let cleanBase64 = base64Payload;

//   if (typeof cleanBase64 === 'string') {
//     cleanBase64 = cleanBase64.replace(/\]\(http[^\)]+\)/g, '').trim();
//     if (cleanBase64.startsWith('data:')) {
//       const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
//       if (matches && matches.length === 3) {
//         mimeType = matches[1];
//         cleanBase64 = matches[2];
//       }
//     }
//   }

//   cleanBase64 = cleanBase64.replace(/\s/g, '');
//   const buffer = Buffer.from(cleanBase64, 'base64');

//   const extension =
//     MIME_EXTENSION_MAP[mimeType] ||
//     mimeType.split('/').pop().toLowerCase() ||
//     'bin';
//   const folder = mimeType.startsWith('video/') ? 'videos' : 'images';
//   const uniqueKey = `PipeWyze/${folder}/${crypto.randomUUID()}.${extension}`;

//   await s3.send(
//     new PutObjectCommand({
//       Bucket: config.s3.S3_BUCKET_PATH,
//       Key: uniqueKey,
//       Body: buffer,
//       ContentType: mimeType,
//       ContentLength: buffer.length,
//     }),
//   );

//   const fileUrl = config.s3.cloudfrontUrl
//     ? `${config.s3.cloudfrontUrl.replace(/\/$/, '')}/${uniqueKey}`
//     : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

//   return { fileUrl, fileType: mimeType };
// }

// // -----------------------------------------------------------------------------
// // AUTHENTICATION UTILS
// // -----------------------------------------------------------------------------
// const verifyToken = (rawToken) => {
//   if (!rawToken) return null;
//   try {
//     const token = rawToken.startsWith('Bearer ')
//       ? rawToken.split(' ')[1]
//       : rawToken;
//     const decoded = jwt.verify(token, config.jwt.secret, {
//       algorithms: [config.jwt.algo || 'HS256'],
//     });
//     return decoded?.sub ? decoded.sub.toString() : null;
//   } catch (err) {
//     console.error('[Socket Auth] Verification failed:', err.message);
//     return null;
//   }
// };

// // -----------------------------------------------------------------------------
// // SOCKET SERVER & MIDDLEWARE
// // -----------------------------------------------------------------------------
// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST'],
//   },
//   maxHttpBufferSize: 50 * 1024 * 1024, // Optimized down to 50MB
//   pingTimeout: 60000,
//   pingInterval: 25000,
// });

// global.io = io;

// app.use(express.static(__dirname));
// app.use(bodyParser.json({ limit: '50mb' }));
// app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));

// // Socket Auth Middleware
// // io.use((socket, next) => {
// //   const rawToken =
// //     socket.handshake.auth?.token ||
// //     socket.handshake.headers?.authorization ||
// //     socket.handshake.query?.token;

// //   const authUserId = verifyToken(rawToken) || socket.handshake.query?.userId || socket.handshake.auth?.userId;

// //   if (authUserId) {
// //     socket.userId = authUserId.toString();
// //     return next();
// //   }
// //   return next(new Error('Authentication failed: Missing or invalid token.'));
// // });

// io.use((socket, next) => {
//   const rawToken =
//     socket.handshake.auth?.token || socket.handshake.headers?.authorization;

//   const authUserId = verifyToken(rawToken);

//   if (!authUserId) {
//     return next(new Error('Authentication failed: Missing or invalid token.'));
//   }

//   socket.userId = authUserId.toString();

//   next();
// });

// // -----------------------------------------------------------------------------
// // CONNECTION LIFECYCLE & EVENT HANDLERS
// // -----------------------------------------------------------------------------
// io.on('connection', async (socket) => {
//   const uid = socket.userId;
//   const userRoom = `user_${uid}`;

//   socket.join(userRoom);
//   socket.activeChatRoomId = null;
//   console.log(`[Socket Connected] User ${uid} connected`);

//   // Initialize User status & join active chat rooms
//   try {
//     const connectedSockets = await io.in(userRoom).fetchSockets();
//     if (connectedSockets.length === 1) {
//       console.log(`[Presence] User ${uid} is now ONLINE`);
//     }

//     await User.findByIdAndUpdate(uid, { isOnline: true });
//     io.emit('user_status_changed', { userId: uid, isOnline: true });

//     const rooms = await ChatRoom.find(
//       { $or: [{ homeOwnerId: uid }, { plumberId: uid }] },
//       { _id: 1 },
//     ).lean();

//     rooms.forEach((r) => socket.join(r._id.toString()));
//   } catch (err) {
//     console.error(`[Init User Error] User ${uid}:`, err.message);
//   }

//   // Presence Tracking
//   socket.on('chat_opened', ({ roomId }) => {
//     if (roomId) socket.activeChatRoomId = roomId.toString();
//   });

//   socket.on('chat_closed', (data) => {
//     const roomId = data?.roomId;
//     if (!roomId || socket.activeChatRoomId === roomId.toString()) {
//       socket.activeChatRoomId = null;
//     }
//   });

//   // Mark Messages Read
//   socket.on('mark_messages_read', async ({ roomId }) => {
//     if (!roomId) return;
//     try {
//       const room = await ChatRoom.findById(roomId).lean();
//       if (!room) return;
//       if (
//         room.homeOwnerId?.toString() !== uid &&
//         room.plumberId?.toString() !== uid
//       ) {
//         return;
//       }
//       await Message.updateMany(
//         { roomId, senderId: { $ne: uid }, read: false },
//         { $set: { read: true } },
//       );
//       io.to(roomId.toString()).emit('messages_read', {
//         roomId: roomId.toString(),
//         readBy: uid.toString(),
//         read: true,
//       });
//     } catch (err) {
//       console.error('[mark_messages_read Error]:', err.message);
//     }
//   });

//   // Join Room
//   socket.on('join_room', async ({ roomId, markAsRead }) => {
//     if (!roomId) {
//       return socket.emit('chat_error', { message: 'roomId is required.' });
//     }

//     try {
//       const room = await ChatRoom.findById(roomId).lean();
//       if (!room) {
//         return socket.emit('chat_error', { message: 'Chat room not found.' });
//       }

//       const isHomeOwner = room.homeOwnerId?.toString() === uid;
//       const isPlumber = room.plumberId?.toString() === uid;

//       if (!isHomeOwner && !isPlumber) {
//         return socket.emit('chat_error', {
//           message: 'Unauthorized room access.',
//         });
//       }

//       socket.join(roomId.toString());

//       // Only mark as read if explicitly requested via markAsRead === true (when entering the actual chat screen)
//       if (markAsRead === true) {
//         await Message.updateMany(
//           { roomId, senderId: { $ne: uid }, read: false },
//           { $set: { read: true } },
//         );
//         io.to(roomId.toString()).emit('messages_read', {
//           roomId: roomId.toString(),
//           readBy: uid.toString(),
//           read: true,
//         });
//       }

//       // Fetch message history with deterministic sorting and counterpart status concurrently
//       const counterpartId = isHomeOwner
//         ? room.plumberId?.toString()
//         : room.homeOwnerId?.toString();

//       const [messages, counterpartUser] = await Promise.all([
//         Message.find({ roomId })
//           .populate('senderId', 'fullName profileimageurl')
//           .sort({ createdAt: 1, _id: 1 })
//           .lean(),
//         counterpartId ? User.findById(counterpartId, 'isOnline').lean() : null,
//       ]);

//       socket.emit('message_history', messages);

//       if (counterpartUser) {
//         socket.emit('user_status_changed', {
//           userId: counterpartId,
//           isOnline: !!counterpartUser.isOnline,
//         });
//       }
//     } catch (error) {
//       console.error('[join_room Error]:', error.message);
//       socket.emit('chat_error', {
//         message: 'Internal server error in join_room.',
//       });
//     }
//   });

//   // Send Message
//   socket.on(
//     'send_message',
//     async ({ roomId, receiverId, content, fileUrl, fileType, fileName }) => {
//       try {
//         if (!roomId || (!content && !fileUrl)) {
//           return socket.emit('chat_error', {
//             message: 'Missing roomId or message payload.',
//           });
//         }

//         let [senderUser, room] = await Promise.all([
//           User.findById(uid, 'role fullName profileimageurl').lean(),
//           ChatRoom.findById(roomId),
//         ]);

//         if (!senderUser) {
//           return socket.emit('chat_error', { message: 'Sender not found.' });
//         }

//         // Create room if it doesn't exist
//         if (!room) {
//           if (!receiverId) {
//             return socket.emit('chat_error', {
//               message: 'receiverId is required when creating a new chat room.',
//             });
//           }

//           const receiver = await User.findById(receiverId, 'role').lean();
//           if (!receiver) {
//             return socket.emit('chat_error', {
//               message: 'Receiver not found.',
//             });
//           }

//           const isPlumber = senderUser.role === 'licensed-plumber';
//           const isReceiverPlumber = receiver.role === 'licensed-plumber';

//           let homeOwnerId;
//           let plumberId;

//           if (isPlumber && !isReceiverPlumber) {
//             plumberId = uid;
//             homeOwnerId = receiverId.toString();
//           } else if (!isPlumber && isReceiverPlumber) {
//             homeOwnerId = uid;
//             plumberId = receiverId.toString();
//           } else {
//             return socket.emit('chat_error', {
//               message: 'Invalid chat participants.',
//             });
//           }

//           room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });

//           // Auto-join connected sockets of both parties
//           io.in(`user_${homeOwnerId}`).socketsJoin(roomId.toString());
//           io.in(`user_${plumberId}`).socketsJoin(roomId.toString());
//         }

//         const senderIdStr = uid.toString();
//         const homeOwnerIdStr = room.homeOwnerId?.toString();
//         const plumberIdStr = room.plumberId?.toString();

//         let counterpartId = null;

//         if (senderIdStr === homeOwnerIdStr) {
//           counterpartId = plumberIdStr;
//         } else if (senderIdStr === plumberIdStr) {
//           counterpartId = homeOwnerIdStr;
//         } else {
//           return socket.emit('chat_error', {
//             message:
//               'Unauthorized action. You are not a participant of this chat room.',
//           });
//         }

//         if (!counterpartId) {
//           return socket.emit('chat_error', {
//             message: 'Chat room does not have a valid counterpart.',
//           });
//         }

//         console.log('========== SEND MESSAGE DEBUG ==========');
//         console.log('socket.id:', socket.id);
//         console.log('authenticated uid:', uid);
//         console.log('roomId:', roomId);
//         console.log('mobile receiverId:', receiverId);
//         console.log('room homeOwnerId:', homeOwnerIdStr);
//         console.log('room plumberId:', plumberIdStr);
//         console.log('calculated counterpartId:', counterpartId);
//         console.log('content:', content);
//         console.log('=========================================');

//         // Handle Media Upload / URL Parsing
//         let finalFileUrl = null;
//         let finalFileType = fileType || null;

//         if (fileUrl) {
//           if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
//             finalFileUrl = fileUrl;
//           } else {
//             const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
//             finalFileUrl = uploadResult.fileUrl;
//             finalFileType = uploadResult.fileType;
//           }
//         }

//         if (!finalFileType && finalFileUrl) {
//           const cleanUrl = finalFileUrl.split('?')[0].toLowerCase();
//           if (/\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(cleanUrl)) {
//             finalFileType = 'video/mp4';
//           } else if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(cleanUrl)) {
//             finalFileType = 'image/jpeg';
//           }
//         }

//         const isVideo =
//           (finalFileType && finalFileType.startsWith('video/')) ||
//           /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(
//             finalFileUrl || fileName || '',
//           );

//         let finalContent = typeof content === 'string' ? content.trim() : '';
//         const isBase64Payload =
//           finalContent.startsWith('data:') ||
//           /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, ''));

//         if (!finalContent || isBase64Payload) {
//           finalContent = finalFileUrl ? (isVideo ? 'Video' : 'Photo') : '';
//         }

//         // Check if recipient has any socket actively viewing this room
//         const counterpartSockets = await io
//           .in(`user_${counterpartId}`)
//           .fetchSockets();

//         const isCounterpartActiveInRoom = counterpartSockets.some(
//           (s) => s.activeChatRoomId === roomId.toString(),
//         );

//         // Save Message using database generated timestamp and initial read status based on active chat presence
//         const message = await Message.create({
//           roomId,
//           senderId: uid,
//           content: finalContent || (isVideo ? 'Video' : 'Photo'),
//           fileUrl: finalFileUrl,
//           fileType: finalFileType,
//           read: isCounterpartActiveInRoom,
//         });

//         if (room) {
//           await ChatRoom.findByIdAndUpdate(roomId, {
//             lastMessage: message._id,
//           });
//         }

//         const populatedMessage = await message.populate(
//           'senderId',
//           'fullName profileimageurl',
//         );
//         const messageJson = populatedMessage.toJSON();

//         console.log('[CHAT SEND]', {
//           messageId: message._id.toString(),
//           roomId: roomId.toString(),
//           senderId: uid.toString(),
//           receiverId: counterpartId,
//           readStatus: message.read,
//           createdAt: message.createdAt,
//         });

//         console.log('[CHAT ORDER DEBUG]', {
//           roomId: roomId.toString(),
//           messageId: message._id.toString(),
//           senderId: uid.toString(),
//           createdAt: message.createdAt,
//         });

//         console.log('[CHAT EMIT]', {
//           messageId: message._id.toString(),
//           roomId: roomId.toString(),
//         });

//         // Emit directly to room participants (room contains both sender and receiver sockets that joined room)
//         io.to(roomId.toString()).emit('new_message', messageJson);

//         io.to(`user_${counterpartId}`).emit('chat_notification', {
//           roomId: roomId.toString(),
//           senderName: senderUser.fullName || 'Someone',
//           message: messageJson,
//         });

//         // Dispatch push notification asynchronously ONLY if recipient is not active in the chat room
//         if (!isCounterpartActiveInRoom) {
//           notificationService
//             .sendToUsers(
//               [counterpartId],
//               `New message from ${senderUser.fullName || 'Someone'}`,
//               finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
//               { roomId: roomId.toString(), messageId: message._id.toString() },
//             )
//             .catch((err) =>
//               console.error('[Push Notification Error]:', err.message),
//             );
//         }
//       } catch (error) {
//         console.error('[send_message Error]:', error.message);
//         socket.emit('chat_error', { message: 'Failed to send message.' });
//       }
//     },
//   );

//   // Ask AI
//   socket.on('ask_ai', async ({ message, fileUrl, fileType, fileName }) => {
//     try {
//       console.log(`\n========== AI SOCKET: ASK AI ==========`);
//       console.log(`[AI] Socket ID: ${socket.id}`);
//       console.log(`[AI] User UID: ${uid}`);

//       if ((!message || !message.trim()) && !fileUrl) {
//         return socket.emit('ai_error', {
//           message: 'Please enter a question or upload a file.',
//         });
//       }

//       const user = await User.findById(uid, 'role').lean();
//       if (!user) {
//         return socket.emit('ai_error', { message: 'User not found.' });
//       }

//       console.log('[AI] Role:', user.role);

//       let finalFileUrl = fileUrl || '';
//       let finalFileType = fileType || '';

//       console.log(`[AI] Incoming Message: ${message || '(none)'}`);
//       console.log(`[AI] File URL received: ${fileUrl ? 'Yes' : 'No'}`);
//       console.log(`[AI] File Type: ${fileType || 'None'}`);
//       console.log(`[AI] File Name: ${fileName || 'None'}`);

//       if (fileUrl && !fileUrl.startsWith('http')) {
//         try {
//           console.log('[AI] Base64 S3 upload started...');
//           const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
//           finalFileUrl = uploadResult.fileUrl;
//           finalFileType = uploadResult.fileType;
//           console.log('[AI] S3 upload completed:', finalFileUrl);
//         } catch (e) {
//           console.error('[AI Base64 Upload Error]:', e.message);
//           return socket.emit('ai_error', {
//             message: 'Failed to upload media file to server.',
//           });
//         }
//       }

//       const isVideo =
//         (finalFileType && finalFileType.startsWith('video/')) ||
//         /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(
//           finalFileUrl || fileName || '',
//         );

//       const cleanMessage = message ? message.trim() : '';
//       const mediaContext = isVideo ? 'video' : finalFileUrl ? 'image' : null;

//       console.log('[AI] Final Question Text:', cleanMessage || '(Media only)');

//       // Determine if question is work-related or media upload
//       const { isWorkRelated, searchQuery } =
//         aiAssistant.isWorkRelatedQuestion(cleanMessage);

//       const effectiveIsWorkRelated = isWorkRelated || !!mediaContext;
//       const effectiveSearchQuery =
//         searchQuery ||
//         (mediaContext === 'image'
//           ? 'pipe leak repair'
//           : mediaContext === 'video'
//           ? 'plumbing repair tutorial'
//           : '');

//       let suggestedVideo = null;
//       let aiMessage = '';

//       if (effectiveIsWorkRelated) {
//         console.log('[AI] Work-related question detected');
//         console.log('[AI] Searching PipeWyze AiVideo...');
//         suggestedVideo = await aiAssistant.searchAiVideo(
//           effectiveSearchQuery,
//           user.role,
//         );

//         if (suggestedVideo) {
//           console.log('[AI] AiVideo found');
//         } else {
//           console.log('[AI] No AiVideo found, searching YouTube...');
//           suggestedVideo = await aiAssistant.searchYouTubeVideo(
//             effectiveSearchQuery,
//             effectiveIsWorkRelated,
//           );
//           if (suggestedVideo) {
//             console.log('[AI] YouTube video found');
//           } else {
//             console.log('[AI] No YouTube video found');
//           }
//         }
//       } else {
//         console.log('[AI] General question detected');
//         suggestedVideo = null;
//       }

//       // Generate AI Answer
//       console.log('[AI] Generating AI answer...');
//       aiMessage = await aiAssistant.generateAIAnswer(
//         cleanMessage,
//         effectiveIsWorkRelated,
//         mediaContext,
//         finalFileUrl,
//       );
//       console.log('[AI] Final response generated.');

//       const responsePayload = {
//         sender: 'ai',
//         message: aiMessage,
//         suggestedVideo,
//         fileUrl: finalFileUrl,
//         fileType: finalFileType,
//         fileName: fileName || '',
//       };

//       try {
//         console.log('[AI] Saving AiChat to database...');
//         await AiChat.create({
//           userId: uid,
//           message: cleanMessage || (isVideo ? 'Video' : 'Photo'),
//           response: aiMessage,
//           suggestedVideo,
//           fileUrl: finalFileUrl,
//           fileType: finalFileType,
//           fileName: fileName || '',
//         });
//       } catch (dbErr) {
//         console.error('[AI] AiChat save error (non-fatal):', dbErr.message);
//       }

//       console.log(`[AI] Checking socket connected status...`);
//       if (!socket.connected) {
//         console.warn(
//           `[AI] WARNING: Socket disconnected before response. socket.id=${socket.id}`,
//         );
//       } else {
//         console.log(`[AI] Emitting ai_response back to socket ${socket.id}...`);
//         socket.emit('ai_response', responsePayload);
//       }
//       console.log(`========== AI SOCKET: FINISHED ==========\n`);
//     } catch (err) {
//       console.error('[ask_ai Error]:', err.message);
//       if (socket.connected) {
//         socket.emit('ai_error', {
//           message: 'Failed to process AI assistant request.',
//         });
//       }
//     }
//   });

//   // Disconnect Handling
//   socket.on('disconnect', async () => {
//     try {
//       console.log(`[Socket Disconnected] User ${uid} disconnected`);

//       // Check remaining connected sockets in this user's private room
//       const remainingSockets = await io.in(userRoom).fetchSockets();
//       const remainingCount = remainingSockets.length;

//       console.log(
//         `[Presence Debug] User ${uid} has ${remainingCount} socket(s) remaining`,
//       );

//       if (remainingCount === 0) {
//         console.log(`[Presence] User ${uid} is now OFFLINE`);
//         await User.findByIdAndUpdate(uid, { isOnline: false });
//         io.emit('user_status_changed', { userId: uid, isOnline: false });
//       }
//     } catch (err) {
//       console.error('[Disconnect Error]:', err.message);
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

const {
  S3Client,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const config = require('./config/config');

const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');

const AiChat = require('./models/aiChat.model');

const notificationService =
  require('./services/notification.service');

const aiAssistant =
  require('./helpers/aiAssistant.helper');

// ============================================================
// APP / SERVER
// ============================================================

const app = express();

const server = http.createServer(app);

// ============================================================
// AWS S3
// ============================================================

const s3 = new S3Client({
  region: config.s3.region,

  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

// ============================================================
// MIME → EXTENSION
// ============================================================

const MIME_EXTENSION_MAP = {
  'video/quicktime': 'mov',
  'video/mp4': 'mp4',
  'video/webm': 'webm',

  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// ============================================================
// BASE64 → S3
// ============================================================

async function uploadBase64ToS3(
  base64Payload,
  declaredFileType,
) {
  let mimeType =
    declaredFileType || 'image/jpeg';

  let cleanBase64 = base64Payload;

  if (typeof cleanBase64 === 'string') {
    cleanBase64 = cleanBase64
      .replace(/\]\(http[^\)]+\)/g, '')
      .trim();

    if (cleanBase64.startsWith('data:')) {
      const matches = cleanBase64.match(
        /^data:([^;]+);base64,(.+)$/s,
      );

      if (
        matches &&
        matches.length === 3
      ) {
        mimeType = matches[1];
        cleanBase64 = matches[2];
      }
    }
  }

  cleanBase64 = cleanBase64.replace(
    /\s/g,
    '',
  );

  const buffer = Buffer.from(
    cleanBase64,
    'base64',
  );

  const extension =
    MIME_EXTENSION_MAP[mimeType] ||
    mimeType
      .split('/')
      .pop()
      .toLowerCase() ||
    'bin';

  const folder = mimeType.startsWith(
    'video/',
  )
    ? 'videos'
    : 'images';

  const uniqueKey =
    `PipeWyze/${folder}/${crypto.randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.S3_BUCKET_PATH,
      Key: uniqueKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    }),
  );

  const fileUrl =
    config.s3.cloudfrontUrl
      ? `${config.s3.cloudfrontUrl.replace(
          /\/$/,
          '',
        )}/${uniqueKey}`
      : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

  return {
    fileUrl,
    fileType: mimeType,
  };
}

// ============================================================
// JWT
// ============================================================

const verifyToken = (rawToken) => {
  if (!rawToken) {
    return null;
  }

  try {
    const token =
      rawToken.startsWith('Bearer ')
        ? rawToken.split(' ')[1]
        : rawToken;

    const decoded = jwt.verify(
      token,
      config.jwt.secret,
      {
        algorithms: [
          config.jwt.algo || 'HS256',
        ],
      },
    );

    return decoded?.sub
      ? decoded.sub.toString()
      : null;
  } catch (err) {
    console.error(
      '[Socket Auth] Verification failed:',
      err.message,
    );

    return null;
  }
};

// ============================================================
// SOCKET.IO
// ============================================================

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },

  maxHttpBufferSize:
    50 * 1024 * 1024,

  pingTimeout: 60000,

  pingInterval: 25000,
});

global.io = io;

// ============================================================
// EXPRESS
// ============================================================

app.use(
  express.static(__dirname),
);

app.use(
  bodyParser.json({
    limit: '50mb',
  }),
);

app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: '50mb',
  }),
);

// ============================================================
// SOCKET AUTHENTICATION
// ============================================================

io.use((socket, next) => {
  const rawToken =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization;

  const authUserId =
    verifyToken(rawToken);

  if (!authUserId) {
    return next(
      new Error(
        'Authentication failed: Missing or invalid token.',
      ),
    );
  }

  socket.userId =
    authUserId.toString();

  // ==========================================================
  // IMPORTANT
  //
  // activeRoom represents the room the user is CURRENTLY
  // viewing.
  //
  // This is different from Socket.IO room membership.
  // ==========================================================

  socket.activeRoom = null;

  next();
});

// ============================================================
// SOCKET CONNECTION
// ============================================================

io.on(
  'connection',
  async (socket) => {
    const uid =
      socket.userId;

    const userRoom =
      `user_${uid}`;

    // ----------------------------------------------------------
    // USER ROOM
    // ----------------------------------------------------------

    socket.join(userRoom);

    socket.activeRoom = null;

    console.log(
      `[Socket Connected] User ${uid} connected`,
    );

    // ----------------------------------------------------------
    // ONLINE STATUS
    // ----------------------------------------------------------

    try {
      const connectedSockets =
        await io
          .in(userRoom)
          .fetchSockets();

      if (
        connectedSockets.length === 1
      ) {
        await User.findByIdAndUpdate(
          uid,
          {
            isOnline: true,
          },
        );

        io.emit(
          'user_status_changed',
          {
            userId: uid,
            isOnline: true,
          },
        );
      }
    } catch (err) {
      console.error(
        `[Init User Error] User ${uid}:`,
        err.message,
      );
    }

    // ==========================================================
    // CHAT OPENED
    // ==========================================================

    socket.on(
      'chat_opened',
      async ({ roomId } = {}) => {
        if (!roomId) {
          console.log(
            `[chat_opened] Missing roomId from user ${uid}`,
          );

          return;
        }

        const cleanRoomId =
          roomId.toString().trim();

        if (!cleanRoomId) {
          return;
        }

        console.log(
          `[chat_opened] User=${uid} Room=${cleanRoomId}`,
        );

        // ------------------------------------------------------
        // Verify user belongs to room.
        // ------------------------------------------------------

        try {
          const room =
            await ChatRoom.findById(
              cleanRoomId,
            ).lean();

          if (!room) {
            console.log(
              `[chat_opened] Room not found: ${cleanRoomId}`,
            );

            return;
          }

          const isHomeOwner =
            room.homeOwnerId?.toString() ===
            uid;

          const isPlumber =
            room.plumberId?.toString() ===
            uid;

          if (
            !isHomeOwner &&
            !isPlumber
          ) {
            console.log(
              `[chat_opened] Unauthorized user=${uid} room=${cleanRoomId}`,
            );

            return;
          }

          // ----------------------------------------------------
          // IMPORTANT FIX
          //
          // Set activeRoom whenever chat is opened.
          // ----------------------------------------------------

          socket.activeRoom =
            cleanRoomId;

          socket.join(
            cleanRoomId,
          );

          console.log(
            `[chat_opened] Active room set => ${cleanRoomId}`,
          );

          // ----------------------------------------------------
          // Mark unread incoming messages as read.
          // ----------------------------------------------------

          const updateResult =
            await Message.updateMany(
              {
                roomId: cleanRoomId,
                senderId: {
                  $ne: uid,
                },
                read: false,
              },
              {
                $set: {
                  read: true,
                },
              },
            );

          console.log(
            `[chat_opened] Marked ${updateResult.modifiedCount} messages as read`,
          );

          // ----------------------------------------------------
          // IMPORTANT
          //
          // Emit messages_read whenever chat is opened.
          // This makes the client state deterministic even
          // when messages were already marked read.
          // ----------------------------------------------------

          io.to(
            cleanRoomId,
          ).emit(
            'messages_read',
            {
              roomId: cleanRoomId,
              readBy: uid,
              read: true,
            },
          );

          console.log(
            `[chat_opened] messages_read emitted => room=${cleanRoomId} readBy=${uid}`,
          );
        } catch (err) {
          console.error(
            '[chat_opened Error]:',
            err.message,
          );
        }
      },
    );

    // ==========================================================
    // CHAT CLOSED
    // ==========================================================

    socket.on(
      'chat_closed',
      ({ roomId } = {}) => {
        const requestedRoomId =
          roomId
            ? roomId.toString().trim()
            : null;

        const activeRoom =
          socket.activeRoom;

        const targetRoomId =
          requestedRoomId ||
          activeRoom;

        console.log(
          `[chat_closed] User=${uid} Room=${targetRoomId || 'none'}`,
        );

        if (targetRoomId) {
          socket.leave(
            targetRoomId,
          );
        }

        // ------------------------------------------------------
        // IMPORTANT
        //
        // Always clear activeRoom when leaving chat.
        // ------------------------------------------------------

        socket.activeRoom = null;

        console.log(
          `[chat_closed] Active room cleared for user=${uid}`,
        );
      },
    );

    // ==========================================================
    // MARK MESSAGES READ
    // ==========================================================

    socket.on(
      'mark_messages_read',
      async ({ roomId } = {}) => {
        // ------------------------------------------------------
        // Validate room ID.
        // ------------------------------------------------------

        if (!roomId) {
          console.log(
            `[mark_messages_read] Missing roomId from user=${uid}`,
          );

          return;
        }

        const cleanRoomId =
          roomId.toString().trim();

        if (!cleanRoomId) {
          return;
        }

        console.log(
          `[mark_messages_read] RECEIVED user=${uid} room=${cleanRoomId} activeRoom=${socket.activeRoom}`,
        );

        // ------------------------------------------------------
        // IMPORTANT SECURITY CHECK
        //
        // The user can only mark messages read if this is
        // actually their active chat.
        // ------------------------------------------------------

        if (
          socket.activeRoom !==
          cleanRoomId
        ) {
          console.log(
            `[mark_messages_read] REJECTED - inactive room. user=${uid} requested=${cleanRoomId} active=${socket.activeRoom}`,
          );

          return;
        }

        try {
          // ----------------------------------------------------
          // Verify room membership.
          // ----------------------------------------------------

          const room =
            await ChatRoom.findById(
              cleanRoomId,
            ).lean();

          if (!room) {
            console.log(
              `[mark_messages_read] Room not found: ${cleanRoomId}`,
            );

            return;
          }

          const isHomeOwner =
            room.homeOwnerId?.toString() ===
            uid;

          const isPlumber =
            room.plumberId?.toString() ===
            uid;

          if (
            !isHomeOwner &&
            !isPlumber
          ) {
            console.log(
              `[mark_messages_read] Unauthorized user=${uid} room=${cleanRoomId}`,
            );

            return;
          }

          // ----------------------------------------------------
          // Mark ONLY messages sent by the other participant.
          // ----------------------------------------------------

          const updateResult =
            await Message.updateMany(
              {
                roomId: cleanRoomId,

                senderId: {
                  $ne: uid,
                },

                read: false,
              },
              {
                $set: {
                  read: true,
                },
              },
            );

          console.log(
            `[mark_messages_read] DB updated. modifiedCount=${updateResult.modifiedCount}`,
          );

          // ----------------------------------------------------
          // IMPORTANT FIX
          //
          // Always emit messages_read.
          //
          // Previously this was only emitted when
          // modifiedCount > 0.
          //
          // That meant the client could emit the event
          // successfully but receive NOTHING if messages
          // were already read.
          // ----------------------------------------------------

          io.to(
            cleanRoomId,
          ).emit(
            'messages_read',
            {
              roomId: cleanRoomId,
              readBy: uid,
              read: true,
            },
          );

          console.log(
            `[mark_messages_read] SUCCESS messages_read emitted. room=${cleanRoomId} readBy=${uid}`,
          );
        } catch (err) {
          console.error(
            '[mark_messages_read Error]:',
            err.message,
          );

          socket.emit(
            'chat_error',
            {
              message:
                'Failed to mark messages as read.',
            },
          );
        }
      },
    );

    // ==========================================================
    // JOIN ROOM
    // ==========================================================

    socket.on(
      'join_room',
      async ({
        roomId,
        markAsRead = false,
      } = {}) => {
        if (!roomId) {
          return socket.emit(
            'chat_error',
            {
              message:
                'roomId is required.',
            },
          );
        }

        const cleanRoomId =
          roomId.toString().trim();

        if (!cleanRoomId) {
          return socket.emit(
            'chat_error',
            {
              message:
                'roomId is required.',
            },
          );
        }

        console.log(
          `[join_room] User=${uid} Room=${cleanRoomId} markAsRead=${markAsRead}`,
        );

        try {
          const room =
            await ChatRoom.findById(
              cleanRoomId,
            ).lean();

          if (!room) {
            console.log(
              `[join_room] Room not found: ${cleanRoomId}`,
            );

            return socket.emit(
              'chat_error',
              {
                message:
                  'Chat room not found.',
              },
            );
          }

          // ----------------------------------------------------
          // Verify participant.
          // ----------------------------------------------------

          const isHomeOwner =
            room.homeOwnerId?.toString() ===
            uid;

          const isPlumber =
            room.plumberId?.toString() ===
            uid;

          if (
            !isHomeOwner &&
            !isPlumber
          ) {
            console.log(
              `[join_room] Unauthorized user=${uid} room=${cleanRoomId}`,
            );

            return socket.emit(
              'chat_error',
              {
                message:
                  'Unauthorized room access.',
              },
            );
          }

          // ----------------------------------------------------
          // JOIN SOCKET.IO ROOM.
          // ----------------------------------------------------

          socket.join(
            cleanRoomId,
          );

          // ----------------------------------------------------
          // CRITICAL FIX
          //
          // join_room establishes the user's active chat.
          //
          // Previously activeRoom was only set when
          // markAsRead === true.
          //
          // Flutter intentionally sends markAsRead=false,
          // therefore mark_messages_read was rejected later.
          // ----------------------------------------------------

          socket.activeRoom =
            cleanRoomId;

          console.log(
            `[join_room] Active room set => user=${uid} room=${cleanRoomId}`,
          );

          // ----------------------------------------------------
          // OPTIONAL MARK AS READ
          // ----------------------------------------------------

          if (markAsRead === true) {
            const updateResult =
              await Message.updateMany(
                {
                  roomId: cleanRoomId,

                  senderId: {
                    $ne: uid,
                  },

                  read: false,
                },
                {
                  $set: {
                    read: true,
                  },
                },
              );

            console.log(
              `[join_room] Marked ${updateResult.modifiedCount} messages as read`,
            );

            io.to(
              cleanRoomId,
            ).emit(
              'messages_read',
              {
                roomId:
                  cleanRoomId,

                readBy: uid,

                read: true,
              },
            );

            console.log(
              `[join_room] messages_read emitted => room=${cleanRoomId} readBy=${uid}`,
            );
          }

          // ----------------------------------------------------
          // COUNTERPART
          // ----------------------------------------------------

          const counterpartId =
            isHomeOwner
              ? room.plumberId?.toString()
              : room.homeOwnerId?.toString();

          // ----------------------------------------------------
          // LOAD HISTORY + USER STATUS
          // ----------------------------------------------------

          const [
            messages,
            counterpartUser,
          ] = await Promise.all([
            Message.find({
              roomId:
                cleanRoomId,
            })
              .populate(
                'senderId',
                'fullName profileimageurl',
              )
              .sort({
                createdAt: 1,
                _id: 1,
              })
              .lean(),

            counterpartId
              ? User.findById(
                  counterpartId,
                  'isOnline',
                ).lean()
              : null,
          ]);

          // ----------------------------------------------------
          // MESSAGE HISTORY
          // ----------------------------------------------------

          socket.emit(
            'message_history',
            messages,
          );

          // ----------------------------------------------------
          // COUNTERPART STATUS
          // ----------------------------------------------------

          if (counterpartUser) {
            socket.emit(
              'user_status_changed',
              {
                userId:
                  counterpartId,

                isOnline:
                  !!counterpartUser.isOnline,
              },
            );
          }

          console.log(
            `[join_room] SUCCESS user=${uid} room=${cleanRoomId} messages=${messages.length}`,
          );
        } catch (error) {
          console.error(
            '[join_room Error]:',
            error.message,
          );

          socket.emit(
            'chat_error',
            {
              message:
                'Internal server error in join_room.',
            },
          );
        }
      },
    );

    // ==========================================================
    // SEND MESSAGE
    // ==========================================================

    socket.on(
      'send_message',
      async ({
        roomId,
        receiverId,
        content,
        fileUrl,
        fileType,
        fileName,
      }) => {
        try {
          // ----------------------------------------------------
          // Validate payload.
          // ----------------------------------------------------

          if (
            !roomId ||
            (!content && !fileUrl)
          ) {
            return socket.emit(
              'chat_error',
              {
                message:
                  'Missing roomId or message payload.',
              },
            );
          }

          const cleanRoomId =
            roomId.toString().trim();

          // ----------------------------------------------------
          // Load sender + room.
          // ----------------------------------------------------

          let [
            senderUser,
            room,
          ] = await Promise.all([
            User.findById(
              uid,
              'role fullName profileimageurl',
            ).lean(),

            ChatRoom.findById(
              cleanRoomId,
            ),
          ]);

          if (!senderUser) {
            return socket.emit(
              'chat_error',
              {
                message:
                  'Sender not found.',
              },
            );
          }

          // ----------------------------------------------------
          // CREATE ROOM IF NEEDED.
          // ----------------------------------------------------

          if (!room) {
            if (!receiverId) {
              return socket.emit(
                'chat_error',
                {
                  message:
                    'receiverId is required when creating a new chat room.',
                },
              );
            }

            const receiver =
              await User.findById(
                receiverId,
                'role',
              ).lean();

            if (!receiver) {
              return socket.emit(
                'chat_error',
                {
                  message:
                    'Receiver not found.',
                },
              );
            }

            const isPlumber =
              senderUser.role ===
              'licensed-plumber';

            const isReceiverPlumber =
              receiver.role ===
              'licensed-plumber';

            let homeOwnerId;
            let plumberId;

            if (
              isPlumber &&
              !isReceiverPlumber
            ) {
              plumberId =
                uid;

              homeOwnerId =
                receiverId.toString();
            } else if (
              !isPlumber &&
              isReceiverPlumber
            ) {
              homeOwnerId =
                uid;

              plumberId =
                receiverId.toString();
            } else {
              return socket.emit(
                'chat_error',
                {
                  message:
                    'Invalid chat participants.',
                },
              );
            }

            room =
              await ChatRoom.create({
                _id: cleanRoomId,
                homeOwnerId,
                plumberId,
              });
          }

          // ----------------------------------------------------
          // PARTICIPANTS
          // ----------------------------------------------------

          const senderIdStr =
            uid.toString();

          const homeOwnerIdStr =
            room.homeOwnerId
              ?.toString();

          const plumberIdStr =
            room.plumberId
              ?.toString();

          let counterpartId =
            null;

          if (
            senderIdStr ===
            homeOwnerIdStr
          ) {
            counterpartId =
              plumberIdStr;
          } else if (
            senderIdStr ===
            plumberIdStr
          ) {
            counterpartId =
              homeOwnerIdStr;
          } else {
            return socket.emit(
              'chat_error',
              {
                message:
                  'Unauthorized action. You are not a participant of this chat room.',
              },
            );
          }

          if (!counterpartId) {
            return socket.emit(
              'chat_error',
              {
                message:
                  'Chat room does not have a valid counterpart.',
              },
            );
          }

          // ----------------------------------------------------
          // MEDIA PROCESSING
          // ----------------------------------------------------

          let finalFileUrl =
            null;

          let finalFileType =
            fileType || null;

          if (fileUrl) {
            if (
              fileUrl.startsWith(
                'http://',
              ) ||
              fileUrl.startsWith(
                'https://',
              )
            ) {
              finalFileUrl =
                fileUrl;
            } else {
              const uploadResult =
                await uploadBase64ToS3(
                  fileUrl,
                  fileType,
                );

              finalFileUrl =
                uploadResult.fileUrl;

              finalFileType =
                uploadResult.fileType;
            }
          }

          // ----------------------------------------------------
          // RESOLVE FILE TYPE
          // ----------------------------------------------------

          if (
            !finalFileType &&
            finalFileUrl
          ) {
            const cleanUrl =
              finalFileUrl
                .split('?')[0]
                .toLowerCase();

            if (
              /\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(
                cleanUrl,
              )
            ) {
              finalFileType =
                'video/mp4';
            } else if (
              /\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(
                cleanUrl,
              )
            ) {
              finalFileType =
                'image/jpeg';
            }
          }

          const isVideo =
            (
              finalFileType &&
              finalFileType.startsWith(
                'video/',
              )
            ) ||
            /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(
              finalFileUrl ||
                fileName ||
                '',
            );

          // ----------------------------------------------------
          // CONTENT
          // ----------------------------------------------------

          let finalContent =
            typeof content ===
            'string'
              ? content.trim()
              : '';

          const isBase64Payload =
            finalContent.startsWith(
              'data:',
            ) ||
            /^[a-zA-Z0-9+/=]{100,}$/.test(
              finalContent.replace(
                /\s/g,
                '',
              ),
            );

          if (
            !finalContent ||
            isBase64Payload
          ) {
            finalContent =
              finalFileUrl
                ? isVideo
                  ? 'Video'
                  : 'Photo'
                : '';
          }

          // ----------------------------------------------------
          // CHECK IF RECIPIENT IS CURRENTLY VIEWING ROOM
          // ----------------------------------------------------

          const counterpartSockets =
            await io
              .in(
                `user_${counterpartId}`,
              )
              .fetchSockets();

          const isCounterpartActiveInRoom =
            counterpartSockets.some(
              (s) =>
                s.activeRoom ===
                cleanRoomId,
            );

          console.log(
            `[send_message] sender=${uid} recipient=${counterpartId} room=${cleanRoomId} recipientActive=${isCounterpartActiveInRoom}`,
          );

          // ----------------------------------------------------
          // CREATE MESSAGE
          // ----------------------------------------------------

          const message =
            await Message.create({
              roomId:
                cleanRoomId,

              senderId:
                uid,

              content:
                finalContent ||
                (isVideo
                  ? 'Video'
                  : 'Photo'),

              fileUrl:
                finalFileUrl,

              fileType:
                finalFileType,

              // If recipient is actively viewing this room,
              // message is immediately considered read.
              read:
                isCounterpartActiveInRoom,
            });

          // ----------------------------------------------------
          // UPDATE CHAT ROOM
          // ----------------------------------------------------

          if (room) {
            await ChatRoom.findByIdAndUpdate(
              cleanRoomId,
              {
                lastMessage:
                  message._id,
              },
            );
          }

          // ----------------------------------------------------
          // POPULATE MESSAGE
          // ----------------------------------------------------

          const populatedMessage =
            await message.populate(
              'senderId',
              'fullName profileimageurl',
            );

          const messageJson =
            populatedMessage.toJSON();

          // ----------------------------------------------------
          // EMIT NEW MESSAGE
          // ----------------------------------------------------

          io.to(
            cleanRoomId,
          ).emit(
            'new_message',
            messageJson,
          );

          io.to(
            `user_${counterpartId}`,
          ).emit(
            'new_message',
            messageJson,
          );

          // ----------------------------------------------------
          // CHAT NOTIFICATION
          // ----------------------------------------------------

          io.to(
            `user_${counterpartId}`,
          ).emit(
            'chat_notification',
            {
              roomId:
                cleanRoomId,

              senderName:
                senderUser.fullName ||
                'Someone',

              message:
                messageJson,
            },
          );

          // ----------------------------------------------------
          // PUSH NOTIFICATION
          // ----------------------------------------------------

          if (
            !isCounterpartActiveInRoom
          ) {
            notificationService
              .sendToUsers(
                [counterpartId],

                `New message from ${
                  senderUser.fullName ||
                  'Someone'
                }`,

                finalContent ||
                  (isVideo
                    ? 'Sent a video'
                    : 'Sent a photo'),

                {
                  roomId:
                    cleanRoomId,

                  messageId:
                    message._id.toString(),
                },
              )
              .catch(
                (err) =>
                  console.error(
                    '[Push Notification Error]:',
                    err.message,
                  ),
              );
          }
        } catch (error) {
          console.error(
            '[send_message Error]:',
            error.message,
          );

          socket.emit(
            'chat_error',
            {
              message:
                'Failed to send message.',
            },
          );
        }
      },
    );

    // ==========================================================
    // DISCONNECT
    // ==========================================================

    socket.on(
      'disconnect',
      async () => {
        try {
          console.log(
            `[Socket Disconnected] User=${uid}`,
          );

          socket.activeRoom =
            null;

          const remainingSockets =
            await io
              .in(userRoom)
              .fetchSockets();

          if (
            remainingSockets.length ===
            0
          ) {
            await User.findByIdAndUpdate(
              uid,
              {
                isOnline: false,
              },
            );

            io.emit(
              'user_status_changed',
              {
                userId: uid,
                isOnline: false,
              },
            );
          }
        } catch (err) {
          console.error(
            '[Disconnect Error]:',
            err.message,
          );
        }
      },
    );
  },
);

// ============================================================
// SERVER START
// ============================================================

const socketPort =
  config.socketPort || 4000;

server.listen(
  socketPort,
  () => {
    console.log(
      'Socket.IO server running on port:',
      socketPort,
    );
  },
);

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  io,
  server,}