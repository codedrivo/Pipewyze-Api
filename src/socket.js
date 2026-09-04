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
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');
const AiChat = require('./models/aiChat.model');
const notificationService = require('./services/notification.service');
const aiAssistant = require('./helpers/aiAssistant.helper');

const app = express();
const server = http.createServer(app);

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

  const extension =
    MIME_EXTENSION_MAP[mimeType] ||
    mimeType.split('/').pop().toLowerCase() ||
    'bin';
  const folder = mimeType.startsWith('video/') ? 'videos' : 'images';
  const uniqueKey = `PipeWyze/${folder}/${crypto.randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.S3_BUCKET_PATH,
      Key: uniqueKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    }),
  );

  const fileUrl = config.s3.cloudfrontUrl
    ? `${config.s3.cloudfrontUrl.replace(/\/$/, '')}/${uniqueKey}`
    : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

  return { fileUrl, fileType: mimeType };
}

const verifyToken = (rawToken) => {
  if (!rawToken) return null;
  try {
    const token = rawToken.startsWith('Bearer ')
      ? rawToken.split(' ')[1]
      : rawToken;
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algo || 'HS256'],
    });
    return decoded?.sub ? decoded.sub.toString() : null;
  } catch (err) {
    console.error('[Socket Auth] Verification failed:', err.message);
    return null;
  }
};

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
  pingTimeout: 60000,
  pingInterval: 25000,
});

global.io = io;

app.use(express.static(__dirname));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));

io.use((socket, next) => {
  const rawToken =
    socket.handshake.auth?.token || socket.handshake.headers?.authorization;

  const authUserId = verifyToken(rawToken);

  if (!authUserId) {
    return next(new Error('Authentication failed: Missing or invalid token.'));
  }

  socket.userId = authUserId.toString();
  socket.activeRoom = null;
  next();
});

io.on('connection', async (socket) => {
  const uid = socket.userId;
  const userRoom = `user_${uid}`;

  socket.join(userRoom);
  socket.activeRoom = null;
  console.log(`[Socket Connected] User ${uid} connected`);

  try {
    const connectedSockets = await io.in(userRoom).fetchSockets();
    if (connectedSockets.length === 1) {
      await User.findByIdAndUpdate(uid, { isOnline: true });
      io.emit('user_status_changed', { userId: uid, isOnline: true });
    }
  } catch (err) {
    console.error(`[Init User Error] User ${uid}:`, err.message);
  }

  // Active Screen Presence: Only called when entering SupportChatPage
  socket.on('chat_opened', async ({ roomId }) => {
    if (!roomId) return;
    const cleanRoomId = roomId.toString();
    socket.activeRoom = cleanRoomId;
    socket.join(cleanRoomId);

    try {
      const updateResult = await Message.updateMany(
        { roomId: cleanRoomId, senderId: { $ne: uid }, read: false },
        { $set: { read: true } },
      );

      if (updateResult.modifiedCount > 0) {
        io.to(cleanRoomId).emit('messages_read', {
          roomId: cleanRoomId,
          readBy: uid,
          read: true,
        });
      }
    } catch (err) {
      console.error('[chat_opened Error]:', err.message);
    }
  });

  // Explicit Screen Exit: Called on screen leave / dispose
  socket.on('chat_closed', ({ roomId } = {}) => {
    const targetRoomId = roomId ? roomId.toString() : socket.activeRoom;
    if (targetRoomId) {
      socket.leave(targetRoomId);
    }
    socket.activeRoom = null;
  });

  // Mark Read (must be active in that room)
  socket.on('mark_messages_read', async ({ roomId }) => {
    if (!roomId) return;
    const cleanRoomId = roomId.toString();

    if (socket.activeRoom !== cleanRoomId) {
      return;
    }

    try {
      const updateResult = await Message.updateMany(
        { roomId: cleanRoomId, senderId: { $ne: uid }, read: false },
        { $set: { read: true } },
      );

      if (updateResult.modifiedCount > 0) {
        io.to(cleanRoomId).emit('messages_read', {
          roomId: cleanRoomId,
          readBy: uid,
          read: true,
        });
      }
    } catch (err) {
      console.error('[mark_messages_read Error]:', err.message);
    }
  });

  // Join Room: Data subscription only (does NOT mark read by default)
  socket.on('join_room', async ({ roomId, markAsRead }) => {
    if (!roomId) {
      return socket.emit('chat_error', { message: 'roomId is required.' });
    }

    try {
      const cleanRoomId = roomId.toString();
      const room = await ChatRoom.findById(cleanRoomId).lean();
      if (!room) {
        return socket.emit('chat_error', { message: 'Chat room not found.' });
      }

      const isHomeOwner = room.homeOwnerId?.toString() === uid;
      const isPlumber = room.plumberId?.toString() === uid;

      if (!isHomeOwner && !isPlumber) {
        return socket.emit('chat_error', {
          message: 'Unauthorized room access.',
        });
      }

      socket.join(cleanRoomId);

      if (markAsRead === true) {
        socket.activeRoom = cleanRoomId;
        const updateResult = await Message.updateMany(
          { roomId: cleanRoomId, senderId: { $ne: uid }, read: false },
          { $set: { read: true } },
        );

        if (updateResult.modifiedCount > 0) {
          io.to(cleanRoomId).emit('messages_read', {
            roomId: cleanRoomId,
            readBy: uid,
            read: true,
          });
        }
      }

      const counterpartId = isHomeOwner
        ? room.plumberId?.toString()
        : room.homeOwnerId?.toString();

      const [messages, counterpartUser] = await Promise.all([
        Message.find({ roomId: cleanRoomId })
          .populate('senderId', 'fullName profileimageurl')
          .sort({ createdAt: 1, _id: 1 })
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
      socket.emit('chat_error', {
        message: 'Internal server error in join_room.',
      });
    }
  });

  // Send Message
  socket.on(
    'send_message',
    async ({ roomId, receiverId, content, fileUrl, fileType, fileName }) => {
      try {
        if (!roomId || (!content && !fileUrl)) {
          return socket.emit('chat_error', {
            message: 'Missing roomId or message payload.',
          });
        }

        const cleanRoomId = roomId.toString();
        let [senderUser, room] = await Promise.all([
          User.findById(uid, 'role fullName profileimageurl').lean(),
          ChatRoom.findById(cleanRoomId),
        ]);

        if (!senderUser) {
          return socket.emit('chat_error', { message: 'Sender not found.' });
        }

        if (!room) {
          if (!receiverId) {
            return socket.emit('chat_error', {
              message: 'receiverId is required when creating a new chat room.',
            });
          }

          const receiver = await User.findById(receiverId, 'role').lean();
          if (!receiver) {
            return socket.emit('chat_error', {
              message: 'Receiver not found.',
            });
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
            return socket.emit('chat_error', {
              message: 'Invalid chat participants.',
            });
          }

          room = await ChatRoom.create({ _id: cleanRoomId, homeOwnerId, plumberId });
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
          return socket.emit('chat_error', {
            message: 'Unauthorized action. You are not a participant of this chat room.',
          });
        }

        if (!counterpartId) {
          return socket.emit('chat_error', {
            message: 'Chat room does not have a valid counterpart.',
          });
        }

        // Media processing
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
          /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(
            finalFileUrl || fileName || '',
          );

        let finalContent = typeof content === 'string' ? content.trim() : '';
        const isBase64Payload =
          finalContent.startsWith('data:') ||
          /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, ''));

        if (!finalContent || isBase64Payload) {
          finalContent = finalFileUrl ? (isVideo ? 'Video' : 'Photo') : '';
        }

        // Check if recipient is actively viewing this specific chat room
        const counterpartSockets = await io.in(`user_${counterpartId}`).fetchSockets();
        const isCounterpartActiveInRoom = counterpartSockets.some(
          (s) => s.activeRoom === cleanRoomId,
        );

        const message = await Message.create({
          roomId: cleanRoomId,
          senderId: uid,
          content: finalContent || (isVideo ? 'Video' : 'Photo'),
          fileUrl: finalFileUrl,
          fileType: finalFileType,
          read: isCounterpartActiveInRoom,
        });

        if (room) {
          await ChatRoom.findByIdAndUpdate(cleanRoomId, {
            lastMessage: message._id,
          });
        }

        const populatedMessage = await message.populate(
          'senderId',
          'fullName profileimageurl',
        );
        const messageJson = populatedMessage.toJSON();

        // Emit message to room and user channels
        io.to(cleanRoomId).emit('new_message', messageJson);
        io.to(`user_${counterpartId}`).emit('new_message', messageJson);

        io.to(`user_${counterpartId}`).emit('chat_notification', {
          roomId: cleanRoomId,
          senderName: senderUser.fullName || 'Someone',
          message: messageJson,
        });

        // Push notification only sent when recipient is not currently viewing the room
        if (!isCounterpartActiveInRoom) {
          notificationService
            .sendToUsers(
              [counterpartId],
              `New message from ${senderUser.fullName || 'Someone'}`,
              finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
              { roomId: cleanRoomId, messageId: message._id.toString() },
            )
            .catch((err) =>
              console.error('[Push Notification Error]:', err.message),
            );
        }
      } catch (error) {
        console.error('[send_message Error]:', error.message);
        socket.emit('chat_error', { message: 'Failed to send message.' });
      }
    },
  );

  socket.on('disconnect', async () => {
    try {
      socket.activeRoom = null;
      const remainingSockets = await io.in(userRoom).fetchSockets();
      if (remainingSockets.length === 0) {
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