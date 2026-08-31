/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');
const AiVideo = require('./models/aiVideo.model');
const AiChat = require('./models/aiChat.model');
const notificationService = require('./services/notification.service');

// -----------------------------------------------------------------------------
// S3 CONFIGURATION & HELPER
// -----------------------------------------------------------------------------
const s3 = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

async function uploadBase64ToS3(base64Payload, declaredFileType) {
  let mimeType = declaredFileType || 'image/jpeg';
  let cleanBase64 = base64Payload;

  // 1. Strip Markdown links, brackets, or accidental URL encapsulation
  if (typeof cleanBase64 === 'string') {
    cleanBase64 = cleanBase64.replace(/\]\(http[^\)]+\)/g, '').trim();
  }

  // 2. Extract MIME from data URI scheme if provided
  if (cleanBase64.startsWith('data:')) {
    const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      cleanBase64 = matches[2];
    } else {
      cleanBase64 = cleanBase64.split(';base64,')[1] || cleanBase64;
    }
  }

  // 3. Remove whitespace and newlines from Base64 string
  cleanBase64 = cleanBase64.replace(/\s/g, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  // 4. Resolve clean extension
  let extension = mimeType.split('/').pop().toLowerCase();
  if (extension === 'quicktime') extension = 'mov';
  if (extension === 'jpeg') extension = 'jpg';

  const folder = mimeType.startsWith('video/') ? 'videos' : 'images';
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const uniqueKey = `PipeWyze/${folder}/${fileName}`;

  // 5. Send to S3 with explicit ContentType and ContentLength
  const command = new PutObjectCommand({
    Bucket: config.s3.S3_BUCKET_PATH,
    Key: uniqueKey,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
  });

  const uploadResult = await s3.send(command);
  console.log(`[S3 Upload Success] ETag: ${uploadResult.ETag}, Key: ${uniqueKey}`);

  // 6. Generate clean URL
  const fileUrl = config.s3.cloudfrontUrl
    ? `${config.s3.cloudfrontUrl.replace(/\/$/, '')}/${uniqueKey}`
    : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

  return { fileUrl, fileType: mimeType };
}

const extractUserId = (socket) => {
  let userId = socket.handshake.query?.userId || socket.handshake.auth?.userId;
  const rawToken =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization ||
    socket.handshake.query?.token;

  if (rawToken) {
    try {
      const token = rawToken.startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
      const data = jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algo || 'HS256'],
      });
      if (data && data.sub) {
        userId = data.sub;
      }
    } catch (err) {
      console.error('[Socket Auth] Token verification failed:', err.message);
    }
  }
  return userId ? userId.toString() : null;
};

// -----------------------------------------------------------------------------
// STANDALONE SOCKET SERVER SETUP
// -----------------------------------------------------------------------------
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 100 * 1024 * 1024, // 100 MB max buffer for base64 media payloads
  pingTimeout: 60000,
  pingInterval: 25000,
});
global.io = io;

app.use(express.static(__dirname));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '100mb' }));

io.on('connection', async (socket) => {
  let userId = extractUserId(socket);

  const initUser = async (uid) => {
    socket.userId = uid;
    socket.join(`user_${uid}`);

    await User.findByIdAndUpdate(uid, { isOnline: true }).catch((err) => console.error(err));
    io.emit('user_status_changed', { userId: uid, isOnline: true });

    const rooms = await ChatRoom.find({
      $or: [{ homeOwnerId: uid }, { plumberId: uid }],
    });
    rooms.forEach((room) => socket.join(room._id.toString()));
    console.log(`[User Connected] User ${uid} connected & joined ${rooms.length} rooms`);
  };

  if (userId) {
    await initUser(userId);
  }

  socket.on('user_connected', async ({ userId: connectedUserId }) => {
    if (!connectedUserId) return;
    await initUser(connectedUserId.toString());
  });

  // ---------------------------------------------------------------------------
  // EVENT: join_room
  // ---------------------------------------------------------------------------
  socket.on('join_room', async ({ roomId, userId: payloadUserId }) => {
    if (!roomId) {
      socket.emit('chat_error', { message: 'roomId is required' });
      return;
    }
    socket.join(roomId);
    const activeUserId = (payloadUserId || socket.userId || userId || '').toString();

    if (activeUserId) {
      socket.userId = activeUserId;
      socket.join(`user_${activeUserId}`);

      try {
        await Message.updateMany(
          { roomId, senderId: { $ne: activeUserId }, read: false },
          { $set: { read: true } },
        );
        socket.to(roomId).emit('messages_read', { roomId, readerId: activeUserId });

        const messages = await Message.find({ roomId })
          .populate('senderId', 'fullName profileimageurl')
          .sort({ createdAt: 1 });

        socket.emit('message_history', messages);

        const room = await ChatRoom.findById(roomId);
        if (room) {
          const counterpartId =
            room.homeOwnerId.toString() === activeUserId
              ? room.plumberId.toString()
              : room.homeOwnerId.toString();
          const counterpartUser = await User.findById(counterpartId);
          if (counterpartUser) {
            socket.emit('user_status_changed', {
              userId: counterpartId,
              isOnline: counterpartUser.isOnline,
            });
          }
        }
      } catch (error) {
        console.error('Error in join_room:', error.message);
        socket.emit('chat_error', { message: 'Internal server error in join_room.' });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // EVENT: send_message (Base64 Media & Text Chat)
  // ---------------------------------------------------------------------------
  // socket.on('send_message', async ({ roomId, senderId, receiverId, content, fileUrl, fileType, fileName }) => {
  //   try {
  //     if (!roomId || !senderId || (!content && !fileUrl)) {
  //       socket.emit('chat_error', { message: 'Missing roomId, senderId, or content/file.' });
  //       return;
  //     }

  //     const senderUser = await User.findById(senderId);
  //     if (!senderUser) {
  //       socket.emit('chat_error', { message: 'Sender not found.' });
  //       return;
  //     }

  //     let room = await ChatRoom.findById(roomId);
  //     if (!room && receiverId) {
  //       const sRole = senderUser.role;
  //       const homeOwnerId = sRole === 'licensed-plumber' ? receiverId : senderId;
  //       const plumberId = sRole === 'licensed-plumber' ? senderId : receiverId;

  //       room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });
  //       const sockets = await io.fetchSockets();
  //       sockets.forEach((s) => s.join(roomId));
  //     }

  //     socket.join(roomId);

  //     let finalFileUrl = null;
  //     let finalFileType = fileType || null;

  //     // Handle Base64 strings vs direct HTTP/S3 URLs
  //     if (fileUrl) {
  //       if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
  //         finalFileUrl = fileUrl;
  //       } else {
  //         try {
  //           console.log(`[Media Upload] Processing Base64 media for room: ${roomId}`);
  //           const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
  //           finalFileUrl = uploadResult.fileUrl;
  //           finalFileType = uploadResult.fileType;
  //           console.log(`[Media Upload] S3 upload successful: ${finalFileUrl}`);
  //         } catch (uploadErr) {
  //           console.error('[Media Upload Error] S3 upload failed:', uploadErr.message);
  //           socket.emit('chat_error', { message: 'Media upload failed.' });
  //           return;
  //         }
  //       }
  //     }

  //     // Infer fileType from URL extension if not supplied
  //     if (!finalFileType && finalFileUrl) {
  //       const cleanUrl = finalFileUrl.split('?')[0].toLowerCase();
  //       if (/\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(cleanUrl)) {
  //         finalFileType = 'video/mp4';
  //       } else if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(cleanUrl)) {
  //         finalFileType = 'image/jpeg';
  //       }
  //     }

  //     // Determine if media is a video
  //     const isVideo =
  //       (finalFileType && finalFileType.startsWith('video/')) ||
  //       /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

  //     // Content fallback rules: "Video" vs "Photo"
  //     let finalContent = typeof content === 'string' ? content.trim() : '';

  //     const isUuidOrFilename =
  //       finalContent === fileName ||
  //       /^[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+$/.test(finalContent) ||
  //       /\.(mp4|mov|jpg|jpeg|png|webp|heic)$/i.test(finalContent);

  //     if ((!finalContent || isUuidOrFilename) && finalFileUrl) {
  //       finalContent = isVideo ? 'Video' : 'Photo';
  //     }

  //     const message = await Message.create({
  //       roomId,
  //       senderId,
  //       content: finalContent || (isVideo ? 'Video' : 'Photo'),
  //       fileUrl: finalFileUrl,
  //       fileType: finalFileType,
  //     });

  //     if (room) {
  //       await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });
  //     }

  //     const populatedMessage = await message.populate('senderId', 'fullName profileimageurl');

  //     // Realtime room emission
  //     io.to(roomId).emit('new_message', populatedMessage);

  //     if (room) {
  //       const counterpartId =
  //         room.homeOwnerId.toString() === senderId.toString()
  //           ? room.plumberId.toString()
  //           : room.homeOwnerId.toString();

  //       io.to(`user_${counterpartId}`).emit('new_message', populatedMessage);
  //       io.to(`user_${counterpartId}`).emit('chat_notification', {
  //         roomId,
  //         senderName: senderUser.fullName || 'Someone',
  //         message: populatedMessage,
  //       });

  //       notificationService
  //         .sendToUsers(
  //           [counterpartId],
  //           `New message from ${senderUser.fullName || 'Someone'}`,
  //           finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
  //           { roomId: roomId.toString(), messageId: message._id.toString() },
  //         )
  //         .catch((err) => console.error('[Push Notification Error]:', err.message));
  //     }
  //   } catch (error) {
  //     console.error('[send_message Error]:', error.message);
  //     socket.emit('chat_error', { message: 'Failed to send message.' });
  //   }
  // });

  socket.on('send_message', async ({ roomId, senderId, receiverId, content, fileUrl, fileType, fileName }) => {
  try {
    if (!roomId || !senderId || (!content && !fileUrl)) {
      socket.emit('chat_error', { message: 'Missing roomId, senderId, or content/file.' });
      return;
    }

    const senderUser = await User.findById(senderId);
    if (!senderUser) {
      socket.emit('chat_error', { message: 'Sender not found.' });
      return;
    }

    let room = await ChatRoom.findById(roomId);
    if (!room && receiverId) {
      const sRole = senderUser.role;
      const homeOwnerId = sRole === 'licensed-plumber' ? receiverId : senderId;
      const plumberId = sRole === 'licensed-plumber' ? senderId : receiverId;

      room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });
      const sockets = await io.fetchSockets();
      sockets.forEach((s) => s.join(roomId));
    }

    socket.join(roomId);

    let finalFileUrl = null;
    let finalFileType = fileType || null;

    // 1. Process Base64 fileUrl or uploaded HTTP/S3 link
    if (fileUrl) {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        finalFileUrl = fileUrl;
      } else {
        try {
          const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
          finalFileUrl = uploadResult.fileUrl;
          finalFileType = uploadResult.fileType;
        } catch (uploadErr) {
          console.error('[Media Upload Error] S3 upload failed:', uploadErr.message);
          socket.emit('chat_error', { message: 'Media upload failed.' });
          return;
        }
      }
    }

    // 2. Infer MIME type if missing
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

    // 3. Strict content sanitization (Prevents raw Base64 string text dumps)
    let finalContent = typeof content === 'string' ? content.trim() : '';

    const isBase64String =
      finalContent.startsWith('data:') ||
      finalContent.length > 200 ||
      /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, '')) ||
      finalContent === fileName ||
      /\.(mp4|mov|jpg|jpeg|png|webp|heic)$/i.test(finalContent);

    if (!finalContent || isBase64String) {
      if (finalFileUrl) {
        finalContent = isVideo ? 'Video' : 'Photo';
      } else {
        finalContent = '';
      }
    }

    // 4. Create single message entry
    const message = await Message.create({
      roomId,
      senderId,
      content: finalContent || (isVideo ? 'Video' : 'Photo'),
      fileUrl: finalFileUrl,
      fileType: finalFileType,
    });

    if (room) {
      await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });
    }

    const populatedMessage = await message.populate('senderId', 'fullName profileimageurl');
    io.to(roomId).emit('new_message', populatedMessage);

    if (room) {
      const counterpartId =
        room.homeOwnerId.toString() === senderId.toString()
          ? room.plumberId.toString()
          : room.homeOwnerId.toString();

      io.to(`user_${counterpartId}`).emit('new_message', populatedMessage);
      io.to(`user_${counterpartId}`).emit('chat_notification', {
        roomId,
        senderName: senderUser.fullName || 'Someone',
        message: populatedMessage,
      });

      notificationService
        .sendToUsers(
          [counterpartId],
          `New message from ${senderUser.fullName || 'Someone'}`,
          finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
          { roomId: roomId.toString(), messageId: message._id.toString() },
        )
        .catch((err) => console.error('[Push Notification Error]:', err.message));
    }
  } catch (error) {
    console.error('[send_message Error]:', error.message);
    socket.emit('chat_error', { message: 'Failed to send message.' });
  }
});

  // ---------------------------------------------------------------------------
  // EVENT: ask_ai (AI Assistant)
  // ---------------------------------------------------------------------------
  socket.on('ask_ai', async ({ message, userId: payloadUserId, fileUrl, fileType, fileName }) => {
    const activeUserId = payloadUserId || socket.userId || userId;
    try {
      if (!activeUserId) {
        socket.emit('ai_error', { message: 'User verification failed: missing user ID.' });
        return;
      }
      if ((!message || !message.trim()) && !fileUrl) {
        socket.emit('ai_error', { message: 'Please enter a question or upload a file.' });
        return;
      }
      const user = await User.findById(activeUserId);
      if (!user) {
        socket.emit('ai_error', { message: 'User not found in database.' });
        return;
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

      let cleanMessage = message ? message.trim() : (isVideo ? 'Video' : 'Photo');
      const allVideos = await AiVideo.find({ targetAudience: user.role }).lean();
      const queryWords = cleanMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchedVideos = allVideos.filter((video) =>
        queryWords.some((word) => (video.title || '').toLowerCase().includes(word)),
      );

      let suggestedVideo = null;
      let aiMessage = '';

      if (matchedVideos.length > 0) {
        suggestedVideo = {
          id: matchedVideos[0]._id || matchedVideos[0].id,
          title: matchedVideos[0].title,
          videoUrl: matchedVideos[0].videoUrl,
          description: matchedVideos[0].description,
          thumbnail: matchedVideos[0].thumbnail,
          isYoutube: false,
        };
        aiMessage = `I found a tutorial video in our library: "${suggestedVideo.title}".`;
      } else {
        aiMessage = 'I am looking into this plumbing question for you.';
      }

      await AiChat.create({
        userId: activeUserId,
        message: cleanMessage,
        response: aiMessage,
        suggestedVideo,
        fileUrl: finalFileUrl || '',
        fileType: finalFileType || '',
        fileName: fileName || '',
      });

      socket.emit('ai_response', {
        sender: 'ai',
        message: aiMessage,
        suggestedVideo,
        fileUrl: finalFileUrl || '',
        fileType: finalFileType || '',
        fileName: fileName || '',
      });
    } catch (err) {
      console.error('[ask_ai Error]:', err.message);
      socket.emit('ai_error', { message: 'Failed to generate response from AI Assistant.' });
    }
  });

  socket.on('disconnect', async () => {
    const activeUserId = socket.userId || userId;
    if (activeUserId) {
      const sockets = await io.fetchSockets();
      const hasOtherSockets = sockets.some((s) => s.userId === activeUserId && s.id !== socket.id);
      if (!hasOtherSockets) {
        User.findByIdAndUpdate(activeUserId, { isOnline: false })
          .exec()
          .then(() => console.log(`User disconnected & marked offline: ${activeUserId}`))
          .catch((err) => console.error(err));
        io.emit('user_status_changed', {
          userId: activeUserId,
          isOnline: false,
        });
      }
    }
  });
});

const socketPort = config.socketPort || 4000;
server.listen(socketPort, () => {
  console.log('Socket.IO server running on port:', socketPort);
});

module.exports = { io, server };