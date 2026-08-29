const app = require('./app');
const http = require('http');
const cron = require('node-cron');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const moment = require('moment-timezone');
const logger = require('./config/logger');
const config = require('./config/config');

const User = require('./models/user.model');
const Setting = require('./models/setting.model');
const axios = require('axios');
const AiVideo = require('./models/aiVideo.model');
const SettingModel = require('./models/setting.model');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const notificationService = require('./services/notification.service');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const os = require('os');

const tempDir = path.join(os.tmpdir(), 'pipewyze_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const activeUploads = new Map();

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/octet-stream',
];

function validateMagicBytes(filePath, fileType) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toUpperCase();

    const isJpeg = hex.startsWith('FFD8FF');
    const isPng = hex.startsWith('89504E470D0A1A0A');
    const isGif = hex.startsWith('47494638');
    const isWebp = hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
    const isHeic = hex.slice(8, 16) === '66747970'; // Checks for 'ftyp'
    const isMp4 = hex.slice(8, 16) === '66747970';
    const isWebm = hex.startsWith('1A45DFA3');

    // If it's a known image type, verify it's a valid image
    if (fileType.startsWith('image/')) {
      return isJpeg || isPng || isGif || isWebp || isHeic;
    }

    // If it's a known video type, verify it's a valid video
    if (fileType.startsWith('video/')) {
      return isMp4 || isWebm || hex.slice(8, 16) === '6D6F6F76';
    }

    // If it's application/octet-stream, verify it's one of our supported formats
    if (fileType === 'application/octet-stream') {
      return isJpeg || isPng || isGif || isWebp || isHeic || isMp4 || isWebm;
    }

    // For any other file types, allow it
    return true;
  } catch (err) {
    console.error('Magic bytes validation error:', err);
    return false;
  }
}

const s3 = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

const usersInRoom = new Map();
const groupAuctionState = new Map();

let io, server;

mongoose.connect(config.mongoose.url).then(() => {
  logger.info('Connected to MongoDB');

  server = http.createServer(app);

  io = socketIo(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 100 * 1024 * 1024, // 100MB max message size for large gallery files/chunks
  });
  global.io = io;

  io.on('connection', async (socket) => {
    // Automatically join the socket to user's chat rooms on connection asynchronously
    let userId = socket.handshake.query?.userId;
    let token = socket.handshake.auth?.token || 
                socket.handshake.headers?.authorization || 
                socket.handshake.query?.token;

    if (token) {
      try {
        const access = token.startsWith('Bearer ')
          ? token.split(' ')[1]
          : token;
        const jwt = require('jsonwebtoken');
        const config = require('./config/config');
        const data = jwt.verify(access, config.jwt.secret, {
          algorithm: config.jwt.algo,
          issuer: config.jwt.issuer,
          audience: 'access',
        });
        if (data && data.sub) {
          userId = data.sub;
        }
      } catch (err) {
        console.error('Socket token verification failed:', err.message);
      }
    }

    if (userId) {
      socket.userId = userId;
      socket.join(`user_${userId}`);
      // Set user online state in DB
      User.findByIdAndUpdate(userId, { isOnline: true }, { new: true })
        .exec()
        .then((updatedUser) => {
          const name = updatedUser ? updatedUser.fullName : userId;
          const role = updatedUser ? updatedUser.role : 'unknown';
          console.log(`[User Connection] User ${name} (${role}) connected & marked online: ${userId}`);
        })
        .catch((err) => console.error(err));
      // Broadcast status changed to everyone
      io.emit('user_status_changed', { userId, isOnline: true });

      ChatRoom.find({
        $or: [{ homeOwnerId: userId }, { plumberId: userId }],
      })
        .then((rooms) => {
          for (const room of rooms) {
            socket.join(room._id.toString());
          }
        })
        .catch((error) => {
          console.error('Error auto-joining rooms on connection:', error);
        });
    }

    // Client can register their userId via this event after connecting
    socket.on('user_connected', async ({ userId: connectedUserId }) => {
      if (!connectedUserId) return;
      socket.userId = connectedUserId;
      socket.join(`user_${connectedUserId}`);
      try {
        const updatedUser = await User.findByIdAndUpdate(connectedUserId, { isOnline: true }, { new: true });
        const name = updatedUser ? updatedUser.fullName : connectedUserId;
        const role = updatedUser ? updatedUser.role : 'unknown';
        console.log(
          `[User Connection] User ${name} (${role}) connected (via event) & marked online: ${connectedUserId}`,
        );
        io.emit('user_status_changed', {
          userId: connectedUserId,
          isOnline: true,
        });

        const rooms = await ChatRoom.find({
          $or: [
            { homeOwnerId: connectedUserId },
            { plumberId: connectedUserId },
          ],
        });
        for (const room of rooms) {
          socket.join(room._id.toString());
        }
      } catch (error) {
        console.error('Error handling user_connected socket event:', error);
      }
    });

    // --- Plumber Chat Handlers ---
    socket.on('join_room', async ({ roomId, userId: payloadUserId }) => {
      if (!roomId) return;
      socket.join(roomId);

      const activeUserId = payloadUserId || socket.userId || userId;
      if (activeUserId) {
        try {
          const checkUser = await User.findById(activeUserId);
          const allowedRoles = ['home-owner', 'licensed-plumber', 'apprentice', 'admin', 'support'];
          if (!checkUser || !allowedRoles.includes(checkUser.role)) {
            const errorMsg = `Access denied: User with role ${
              checkUser ? checkUser.role : 'unknown'
            } is not authorized in chat rooms.`;
            console.error(errorMsg);
            socket.emit('chat_error', { message: errorMsg });
            return;
          }
          socket.userId = activeUserId;
          socket.join(`user_${activeUserId}`);
        } catch (err) {
          console.error('Error verifying user role in join_room:', err);
          socket.emit('chat_error', { message: 'Internal server error verifying authorization.' });
          return;
        }
      }

      try {
        if (activeUserId) {
          console.log(`User ${activeUserId} joined room: ${roomId}`);

          // Mark existing messages sent by counterpart as read
          await Message.updateMany(
            { roomId, senderId: { $ne: activeUserId }, read: false },
            { $set: { read: true } },
          );
          // Broadcast that messages in the room have been read by this user
          socket
            .to(roomId)
            .emit('messages_read', { roomId, readerId: activeUserId });
        }

        // Fetch messages for this room
        const messages = await Message.find({ roomId })
          .populate('senderId', 'fullName profileimageurl')
          .sort({ createdAt: 1 }); // Sort chronologically

        // Send the message history ONLY to the socket that just joined (one-to-one)
        socket.emit('message_history', messages);

        // Fetch other participant's status and emit it to the user who joined
        const room = await ChatRoom.findById(roomId);
        if (room && activeUserId) {
          const counterpartId =
            room.homeOwnerId.toString() === activeUserId.toString()
              ? room.plumberId
              : room.homeOwnerId;
          const counterpartUser = await User.findById(counterpartId);
          if (counterpartUser) {
            socket.emit('user_status_changed', {
              userId: counterpartId.toString(),
              isOnline: counterpartUser.isOnline,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching room message history:', error);
      }
    });

    socket.on(
      'send_message',
      async ({
        roomId,
        senderId,
        receiverId,
        content,
        fileUrl,
        fileType,
        fileName,
      }) => {
        try {
          if (!roomId || !senderId || (!content && !fileUrl)) {
            console.warn(
              'Validation Failed: missing roomId, senderId, or both content and fileUrl.',
            );
            return;
          }

          const senderUser = await User.findById(senderId);
          if (!senderUser) {
            console.error(`Validation Failed: Sender ${senderId} not found.`);
            return;
          }

          if (
            senderUser.role !== 'home-owner' &&
            senderUser.role !== 'licensed-plumber'
          ) {
            console.error(
              `Validation Failed: Sender role ${senderUser.role} is not authorized for one-to-one chat.`,
            );
            return;
          }

          // Check if room exists
          let room = await ChatRoom.findById(roomId);
          if (!room) {
            let plumberId = receiverId;
            let homeOwnerId = senderId;

            if (senderUser.role === 'licensed-plumber') {
              plumberId = senderId;
              homeOwnerId = receiverId;
            }

            if (!homeOwnerId || !plumberId) {
              console.error(
                `Validation Failed: Cannot dynamically create room without both homeOwnerId and plumberId.`,
              );
              return;
            }

            const homeOwnerUser = await User.findById(homeOwnerId);
            const plumberUser = await User.findById(plumberId);

            if (!homeOwnerUser || homeOwnerUser.role !== 'home-owner') {
              console.error(`Validation Failed: Invalid homeowner.`);
              return;
            }
            if (!plumberUser || plumberUser.role !== 'licensed-plumber') {
              console.error(`Validation Failed: Invalid licensed plumber.`);
              return;
            }

            room = await ChatRoom.create({
              _id: roomId,
              homeOwnerId,
              plumberId,
            });

            // Auto-join all currently connected sockets to this new room
            const sockets = await io.fetchSockets();
            for (const s of sockets) {
              s.join(roomId);
            }
          } else {
            // Verify existing room has valid roles
            const homeOwnerUser = await User.findById(room.homeOwnerId);
            const plumberUser = await User.findById(room.plumberId);
            if (
              !homeOwnerUser ||
              homeOwnerUser.role !== 'home-owner' ||
              !plumberUser ||
              plumberUser.role !== 'licensed-plumber'
            ) {
              console.error(
                `Validation Failed: Chat room participants are not valid home-owner and licensed-plumber.`,
              );
              return;
            }
          }

          // Validate that the sender is a participant in this room
          if (
            room.homeOwnerId.toString() !== senderId &&
            room.plumberId.toString() !== senderId
          ) {
            console.error(
              `Validation Failed: Sender ${senderId} is not part of room ${roomId}`,
            );
            return;
          }

          // Auto-join the sender to the room channel so they can receive future broadcasts/replies
          socket.join(roomId);

          let finalFileUrl = fileUrl;
          let finalContent = content;
          let finalFileType = fileType;

          if (fileUrl) {
            let isBase64 = false;
            let mimeType = null;
            let buffer = null;

            if (fileUrl.startsWith('data:')) {
              const matches = fileUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
              if (matches && matches.length === 3) {
                isBase64 = true;
                mimeType = matches[1];
                buffer = Buffer.from(matches[2], 'base64');
              }
            } else if (
              !fileUrl.startsWith('http://') &&
              !fileUrl.startsWith('https://')
            ) {
              const cleanBase64 = fileUrl.replace(/\s/g, '');
              if (/^[a-zA-Z0-9+/=]+$/.test(cleanBase64) && cleanBase64.length > 50) {
                try {
                  buffer = Buffer.from(cleanBase64, 'base64');
                  isBase64 = true;

                  const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
                  if (hex.startsWith('FFD8FF')) {
                    mimeType = 'image/jpeg';
                  } else if (hex.startsWith('89504E470D0A1A0A')) {
                    mimeType = 'image/png';
                  } else if (hex.startsWith('47494638')) {
                    mimeType = 'image/gif';
                  } else if (hex.startsWith('52494646') && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
                    mimeType = 'image/webp';
                  } else if (buffer.slice(4, 8).toString('ascii') === 'ftyp') {
                    mimeType = 'video/mp4';
                  } else if (hex.startsWith('1A45DFA3')) {
                    mimeType = 'video/webm';
                  } else {
                    mimeType = fileType || 'image/jpeg';
                  }
                } catch (e) {
                  console.error('Failed to parse raw base64 buffer:', e.message);
                }
              }
            }

            if (isBase64 && buffer) {
              const extension = mimeType.split('/').pop() || 'bin';
              const s3Folder = mimeType.startsWith('image/') ? 'images' : 'videos';
              const uniqueKey = `PipeWyze/${s3Folder}/${crypto.randomUUID()}.${extension}`;

              const command = new PutObjectCommand({
                Bucket: config.s3.S3_BUCKET_PATH,
                Key: uniqueKey,
                Body: buffer,
                ContentType: mimeType,
              });

              await s3.send(command);

              if (config.s3.cloudfrontUrl) {
                const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
                finalFileUrl = `${baseUrl}/${uniqueKey}`;
              } else {
                finalFileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;
              }
              finalFileType = mimeType;
            }
          }

          if (!finalFileType && finalFileUrl && !finalFileUrl.startsWith('data:') && (finalFileUrl.startsWith('http://') || finalFileUrl.startsWith('https://') || finalFileUrl.startsWith('/'))) {
            const cleanUrl = finalFileUrl.split('?')[0];
            const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1).toLowerCase();
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) {
              finalFileType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            } else if (['mp4', 'mov', 'quicktime', 'webm', 'm4v', '3gp'].includes(ext)) {
              finalFileType = `video/${ext === 'mov' || ext === 'quicktime' ? 'quicktime' : ext}`;
            }
          }

          if ((!finalContent || finalContent.trim() === '') && finalFileUrl) {
            let extractedFileName = fileName;
            if (!extractedFileName) {
              extractedFileName = finalFileUrl.substring(
                finalFileUrl.lastIndexOf('/') + 1,
              );
              if (extractedFileName) {
                extractedFileName = decodeURIComponent(
                  extractedFileName.split('?')[0],
                );
              }
            }
            finalContent = extractedFileName || 'File';
          }

          // Safeguard: Ensure finalContent and finalFileUrl do not contain raw base64 data dumps
          if (finalContent && finalContent.length > 100 && !finalContent.includes(' ') && /^[a-zA-Z0-9+/=]+$/.test(finalContent.replace(/\s/g, ''))) {
            finalContent = fileName || 'Media File';
          }
          if (finalFileUrl && finalFileUrl.length > 100 && !finalFileUrl.includes(' ') && !finalFileUrl.startsWith('http') && /^[a-zA-Z0-9+/=]+$/.test(finalFileUrl.replace(/\s/g, ''))) {
            finalFileUrl = undefined;
          }

          // Save the message to DB
          const message = await Message.create({
            roomId,
            senderId,
            content: finalContent,
            fileUrl: finalFileUrl,
            fileType: finalFileType,
          });
          console.log(`[Chat Message] Chat message sent successfully in room ${roomId} from sender ${senderId}. Content: "${finalContent}", fileUrl: "${finalFileUrl || 'none'}"`);

          // Update the last message in the room
          await ChatRoom.findByIdAndUpdate(roomId, {
            lastMessage: message._id,
          });

          // Populate sender details for the response
          const populatedMessage = await message.populate(
            'senderId',
            'fullName profileimageurl',
          );

          // Broadcast the message to all clients in the room (including sender)
          io.to(roomId).emit('new_message', populatedMessage);

          // Send push notification to counterpart participant
          const counterpartId =
            room.homeOwnerId.toString() === senderId.toString()
              ? room.plumberId
              : room.homeOwnerId;

          // Also emit new_message to counterpart's user room in case they are not in the active chat room socket
          io.to(`user_${counterpartId.toString()}`).emit('new_message', populatedMessage);

          const senderName = senderUser ? senderUser.fullName : 'Someone';

          // Emit chat_notification for in-app toast/banner alerts when outside the chat route
          io.to(`user_${counterpartId.toString()}`).emit('chat_notification', {
            roomId,
            senderName,
            message: populatedMessage,
          });

          notificationService
            .sendToUsers(
              [counterpartId.toString()],
              `New message from ${senderName}`,
              message.content || 'Sent an attachment',
              {
                roomId: roomId.toString(),
                messageId: message._id.toString(),
              },
            )
            .catch((err) =>
              console.error('Failed sending chat notification:', err.message),
            );
        } catch (error) {
          console.error('Error handling send_message socket event:', error);
        }
      },
    );

    socket.on('joinRoom', async ({ userId, groupId }) => {
      if (!userId || !groupId) return;

      const userData = await User.findById(userId).lean();
      if (!userData) return;

      if (!usersInRoom.has(groupId)) {
        usersInRoom.set(groupId, new Map());
      }

      const groupMap = usersInRoom.get(groupId);

      if (groupMap.has(userId)) {
        // Add new socket.id to existing user's socketIds
        groupMap.get(userId).socketIds.push(socket.id);
      } else {
        // Create new entry for user
        groupMap.set(userId, {
          user: userData,
          socketIds: [socket.id],
        });
      }

      socket.join(groupId);
      socket.join(`user_${userId}`);

      // Send updated user list to group
      io.to(groupId).emit(
        'updateUserList',
        Array.from(groupMap.values()).map((u) => u.user),
      );
    });

    socket.on('auctionaddmessage', ({ auctionData, groupId }) => {
      io.to(groupId).emit('auctionaddmessage', { auctionData });

      const state = groupAuctionState.get(groupId);
      if (state?.activeTeam) {
        console.log(
          `New bid received, restarting countdown for ${state.activeTeam.teamName}`,
        );
        startCountdown(groupId, state.activeTeam, 20);
      }
    });

    socket.on('pause_auction', async ({ duration }) => {
      const groups = await Group.find().lean();

      for (const group of groups) {
        const groupId = group._id.toString();

        if (!groupAuctionState.has(groupId)) {
          groupAuctionState.set(groupId, {});
        }

        const state = groupAuctionState.get(groupId);
        state.pauseAuction = true;
        state.pauseduration = duration;
        state.pauseTimeout = null;
        console.log(state);
      }
    });

    // Handle start of streaming file upload
    socket.on(
      'start_upload',
      async ({
        uploadId,
        roomId,
        senderId,
        fileName,
        fileType,
        fileSize,
        totalChunks,
      }) => {
        console.log('--- Socket Event: start_upload ---');
        console.log('Metadata:', {
          uploadId,
          roomId,
          senderId,
          fileName,
          fileType,
          fileSize,
          totalChunks,
        });

        if (
          !uploadId ||
          !roomId ||
          !senderId ||
          !fileName ||
          !fileType ||
          !totalChunks
        ) {
          socket.emit('upload_error', { uploadId, error: 'Missing metadata' });
          return;
        }

        // Check path traversal on filename
        if (
          typeof fileName !== 'string' ||
          fileName.includes('/') ||
          fileName.includes('\\') ||
          fileName.includes('..')
        ) {
          socket.emit('upload_error', { uploadId, error: 'Invalid file name' });
          return;
        }

        // Validate fileSize if provided
        let size = null;
        if (fileSize !== undefined && fileSize !== null) {
          size = parseInt(fileSize, 10);
          if (isNaN(size) || size <= 0 || size > MAX_UPLOAD_SIZE) {
            socket.emit('upload_error', {
              uploadId,
              error: 'Invalid file size',
            });
            return;
          }
        }

        // Validate totalChunks
        const chunks = parseInt(totalChunks, 10);
        if (isNaN(chunks) || chunks <= 0 || chunks > 10000) {
          socket.emit('upload_error', {
            uploadId,
            error: 'Invalid total chunks count',
          });
          return;
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(fileType)) {
          console.error(`[Upload Error] Unsupported MIME type ${fileType} for uploadId ${uploadId}`);
          socket.emit('upload_error', {
            uploadId,
            error: 'Unsupported file type',
          });
          return;
        }

        try {
          // Authorization: Verify room and sender
          const room = await ChatRoom.findById(roomId);
          if (!room) {
            socket.emit('upload_error', {
              uploadId,
              error: 'Chat room not found',
            });
            return;
          }

          if (
            room.homeOwnerId.toString() !== senderId &&
            room.plumberId.toString() !== senderId
          ) {
            socket.emit('upload_error', {
              uploadId,
              error: 'Access denied: You are not authorized in this room',
            });
            return;
          }

          // Clean up previous active upload if the client retries
          const existing = activeUploads.get(uploadId);
          if (existing) {
            if (existing.timeoutId) clearTimeout(existing.timeoutId);
            existing.writeStream.end();
            if (fs.existsSync(existing.tempFilePath)) {
              try {
                fs.unlinkSync(existing.tempFilePath);
              } catch (e) {}
            }
            activeUploads.delete(uploadId);
          }

          const tempFilePath = path.join(tempDir, `${uploadId}.upload`);
          const writeStream = fs.createWriteStream(tempFilePath);

          // Timeout (15 minutes)
          const timeoutId = setTimeout(
            () => {
              const up = activeUploads.get(uploadId);
              if (up) {
                up.writeStream.end();
                if (fs.existsSync(up.tempFilePath)) {
                  try {
                    fs.unlinkSync(up.tempFilePath);
                  } catch (e) {}
                }
                activeUploads.delete(uploadId);
                socket.emit('upload_error', {
                  uploadId,
                  error: 'Upload timed out',
                });
              }
            },
            15 * 60 * 1000,
          );

          activeUploads.set(uploadId, {
            uploadId,
            socketId: socket.id,
            roomId,
            senderId,
            fileName,
            fileType,
            fileSize: size,
            totalChunks: chunks,
            expectedChunkIndex: 0,
            receivedChunks: 0,
            tempFilePath,
            writeStream,
            timeoutId,
            chunksWritten: new Set(),
          });

          console.log(`Temp file stream created at: ${tempFilePath}`);
          socket.emit('upload_ready', { uploadId });
        } catch (err) {
          console.error('Error starting upload:', err);
          socket.emit('upload_error', {
            uploadId,
            error: 'Internal server error',
          });
        }
      },
    );

    // Handle incoming file chunk
    socket.on(
      'upload_chunk',
      async ({ uploadId, chunkIndex, chunkData }, callback) => {
        const upload = activeUploads.get(uploadId);

        const sendAck = () => {
          const progress = Math.round(
            (upload.receivedChunks / upload.totalChunks) * 100,
          );
          const progressPayload = {
            uploadId,
            chunkIndex,
            progress,
          };
          if (upload.fileSize) {
            progressPayload.receivedBytes =
              upload.receivedChunks * (upload.fileSize / upload.totalChunks);
            progressPayload.totalBytes = upload.fileSize;
          }
          socket.emit('upload_progress', progressPayload);

          if (callback) {
            callback({ status: 'ok', chunkIndex });
          }
          socket.emit('upload_chunk_ack', { uploadId, chunkIndex });
        };

        const handleFail = (errorMsg) => {
          if (upload) {
            if (upload.timeoutId) clearTimeout(upload.timeoutId);
            upload.writeStream.end();
            if (fs.existsSync(upload.tempFilePath)) {
              try {
                fs.unlinkSync(upload.tempFilePath);
              } catch (e) {}
            }
            activeUploads.delete(uploadId);
          }
          console.error(`[Upload Error] Chunk upload failed for uploadId ${uploadId}: ${errorMsg}`);
          socket.emit('upload_error', { uploadId, error: errorMsg });
          if (callback) {
            callback({ status: 'error', error: errorMsg });
          }
        };

        if (!upload) {
          handleFail('Upload session not found');
          return;
        }

        if (upload.socketId !== socket.id) {
          handleFail('Unauthorized socket upload');
          return;
        }

        const idx = parseInt(chunkIndex, 10);
        if (isNaN(idx) || idx < 0 || idx >= upload.totalChunks) {
          handleFail('Invalid chunk index');
          return;
        }

        if (upload.chunksWritten.has(idx)) {
          console.warn(
            `Duplicate chunk index received: ${idx} for upload ${uploadId}. Skipping.`,
          );
          sendAck();
          return;
        }

        if (idx !== upload.expectedChunkIndex) {
          handleFail(
            `Out of order chunk received. Expected: ${upload.expectedChunkIndex}, got: ${idx}`,
          );
          return;
        }

        try {
          let buffer;
          if (Buffer.isBuffer(chunkData)) {
            buffer = chunkData;
          } else if (typeof chunkData === 'string') {
            const base64Content = chunkData.includes(';base64,')
              ? chunkData.split(';base64,')[1]
              : chunkData;
            buffer = Buffer.from(base64Content, 'base64');
          } else {
            buffer = Buffer.from(chunkData);
          }

          if (
            upload.writeStream.writableEnded ||
            upload.writeStream.destroyed
          ) {
            handleFail('Write stream is closed');
            return;
          }

          const writeSuccessful = upload.writeStream.write(buffer);
          upload.chunksWritten.add(idx);
          upload.receivedChunks++;
          upload.expectedChunkIndex++;

          const isLastChunk = upload.receivedChunks === upload.totalChunks;

          const processCompleteUpload = () => {
            upload.writeStream.end();

            upload.writeStream.on('finish', async () => {
              try {
                if (upload.timeoutId) clearTimeout(upload.timeoutId);

                const stats = fs.statSync(upload.tempFilePath);
                if (
                  stats.size === 0 ||
                  (upload.fileSize && stats.size > upload.fileSize)
                ) {
                  throw new Error(
                    'Actual file size does not match metadata / is zero',
                  );
                }

                if (!validateMagicBytes(upload.tempFilePath, upload.fileType)) {
                  console.error(`[Upload Error] Magic bytes validation failed for uploadId ${uploadId}, expected type ${upload.fileType}`);
                  throw new Error('File integrity/magic signature mismatch');
                }

                const fileStream = fs.createReadStream(upload.tempFilePath);
                const extension = upload.fileName.split('.').pop() || 'bin';
                const s3Folder = upload.fileType.startsWith('image/')
                  ? 'images'
                  : 'videos';
                const uniqueS3Key = `PipeWyze/${s3Folder}/${crypto.randomUUID()}.${extension}`;

                const command = new PutObjectCommand({
                  Bucket: config.s3.S3_BUCKET_PATH,
                  Key: uniqueS3Key,
                  Body: fileStream,
                  ContentType: upload.fileType,
                  ContentLength: stats.size,
                });

                await s3.send(command);
                console.log(
                  `Successfully uploaded file to S3. Key: ${uniqueS3Key}`,
                );

                let fileUrl;
                if (config.s3.cloudfrontUrl) {
                  const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
                  fileUrl = `${baseUrl}/${uniqueS3Key}`;
                } else {
                  fileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueS3Key}`;
                }

                console.log(`Generated file URL: ${fileUrl}`);

                fs.unlinkSync(upload.tempFilePath);
                activeUploads.delete(uploadId);
                console.log(`Removed local temp file: ${upload.tempFilePath}`);

                const message = await Message.create({
                  roomId: upload.roomId,
                  senderId: upload.senderId,
                  content: upload.fileName,
                  fileUrl,
                  fileType: upload.fileType,
                });
                console.log(`[Media Upload] File uploaded successfully to S3 and message created: room=${upload.roomId}, fileUrl=${fileUrl}, type=${upload.fileType}`);

                await ChatRoom.findByIdAndUpdate(upload.roomId, {
                  lastMessage: message._id,
                });

                const populatedMessage = await message.populate(
                  'senderId',
                  'fullName profileimageurl',
                );

                io.to(upload.roomId).emit('new_message', populatedMessage);
                socket.emit('upload_success', {
                  uploadId,
                  messageId: message._id,
                });

                const room = await ChatRoom.findById(upload.roomId);
                if (room) {
                  const counterpartId =
                    room.homeOwnerId.toString() === upload.senderId.toString()
                      ? room.plumberId
                      : room.homeOwnerId;

                  // Also emit new_message to counterpart's user room
                  io.to(`user_${counterpartId.toString()}`).emit('new_message', populatedMessage);

                  const senderUser = await User.findById(upload.senderId);
                  const senderName = senderUser
                    ? senderUser.fullName
                    : 'Someone';

                  // Emit chat_notification for in-app toast/banner alerts when outside the chat route
                  io.to(`user_${counterpartId.toString()}`).emit('chat_notification', {
                    roomId: upload.roomId.toString(),
                    senderName,
                    message: populatedMessage,
                  });

                  notificationService
                    .sendToUsers(
                      [counterpartId.toString()],
                      `New message from ${senderName}`,
                      message.content || 'Sent a file',
                      {
                        roomId: upload.roomId.toString(),
                        messageId: message._id.toString(),
                      },
                    )
                    .catch((err) =>
                      console.error(
                        'Failed sending upload chat notification:',
                        err.message,
                      ),
                    );
                }
              } catch (err) {
                console.error('Error completing file upload:', err.message);
                handleFail(err.message || 'Failed to process completed file');
              }
            });
          };

          if (isLastChunk) {
            if (!writeSuccessful) {
              upload.writeStream.once('drain', () => {
                processCompleteUpload();
              });
            } else {
              processCompleteUpload();
            }
          } else {
            if (!writeSuccessful) {
              upload.writeStream.once('drain', () => {
                sendAck();
              });
            } else {
              sendAck();
            }
          }
        } catch (err) {
          console.error('Error writing chunk:', err);
          handleFail('Failed to write chunk data');
        }
      },
    );

    socket.on('disconnect', async () => {
      const activeUserId = socket.userId || userId;
      // Check if the user has other active connections (e.g. other tabs/devices)
      if (activeUserId) {
        const sockets = await io.fetchSockets();
        const hasOtherSockets = sockets.some(
          (s) =>
            ((s.handshake.query.userId &&
              String(s.handshake.query.userId) === String(activeUserId)) ||
              (s.userId && String(s.userId) === String(activeUserId))) &&
            s.id !== socket.id,
        );
        if (!hasOtherSockets) {
          User.findByIdAndUpdate(activeUserId, { isOnline: false })
            .exec()
            .then(() =>
              console.log(
                `User disconnected & marked offline: ${activeUserId}`,
              ),
            )
            .catch((err) => console.error(err));
          io.emit('user_status_changed', {
            userId: activeUserId,
            isOnline: false,
          });
        }
      }

      for (const [groupId, groupMap] of usersInRoom.entries()) {
        for (const [userId, userEntry] of groupMap.entries()) {
          if (userEntry.socketIds.includes(socket.id)) {
            // Remove the user entirely once any of their sockets disconnects
            groupMap.delete(userId);
            io.to(groupId).emit(
              'updateUserList',
              Array.from(groupMap.values()).map((u) => u.user),
            );

            if (groupMap.size === 0) {
              usersInRoom.delete(groupId);
            }

            break; // Exit after finding the user
          }
        }
      }

      // Cleanup streaming upload state
      for (const [uploadId, upload] of activeUploads.entries()) {
        if (upload.socketId === socket.id) {
          if (upload.timeoutId) clearTimeout(upload.timeoutId);
          upload.writeStream.end();
          if (fs.existsSync(upload.tempFilePath)) {
            try {
              fs.unlinkSync(upload.tempFilePath);
            } catch (err) {
              console.error(
                `Failed to delete temp file ${upload.tempFilePath}:`,
                err,
              );
            }
          }
          activeUploads.delete(uploadId);
        }
      }
    });

    // AI Assistant socket handler
    socket.on(
      'ask_ai',
      async ({
        message,
        userId: payloadUserId,
        fileUrl,
        fileType,
        fileName,
      }) => {
        const activeUserId = payloadUserId || socket.userId || userId;

        console.log(
          `[ask_ai] Received event from userId: ${activeUserId}, message: "${message}", file: "${
            fileName || ''
          }"`,
        );

        try {
          const AiChat = require('./models/aiChat.model');

          // Validate user ID
          if (!activeUserId) {
            console.warn('[ask_ai] User verification failed: missing user ID');

            socket.emit('ai_error', {
              message: 'User verification failed (missing user ID).',
            });

            return;
          }

          // Validate message and media url
          if (
            (!message || typeof message !== 'string' || !message.trim()) &&
            !fileUrl
          ) {
            console.warn('[ask_ai] Empty AI message and no file received');

            socket.emit('ai_error', {
              message: 'Please enter a question or upload a file.',
            });

            return;
          }

          let cleanMessage = message ? message.trim() : '';

          // Find user
          const user = await User.findById(activeUserId);

          if (!user) {
            console.warn(`[ask_ai] User not found for ID: ${activeUserId}`);

            socket.emit('ai_error', {
              message: 'User not found in database.',
            });

            return;
          }

          // Handle socket media upload to S3
          let finalFileUrl = fileUrl;
          if (fileUrl && fileUrl.startsWith('data:')) {
            const matches = fileUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const base64Data = matches[2];
              const buffer = Buffer.from(base64Data, 'base64');

              const extension = mimeType.split('/').pop() || 'bin';
              const s3Folder = mimeType.startsWith('image/')
                ? 'images'
                : 'videos';
              const uniqueKey = `PipeWyze/${s3Folder}/${crypto.randomUUID()}.${extension}`;

              const command = new PutObjectCommand({
                Bucket: config.s3.S3_BUCKET_PATH,
                Key: uniqueKey,
                Body: buffer,
                ContentType: mimeType,
              });

              await s3.send(command);

              if (config.s3.cloudfrontUrl) {
                const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
                finalFileUrl = `${baseUrl}/${uniqueKey}`;
              } else {
                finalFileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;
              }
            }
          }

          if (!cleanMessage && finalFileUrl) {
            let extractedFileName = fileName;
            if (!extractedFileName) {
              extractedFileName = finalFileUrl.substring(
                finalFileUrl.lastIndexOf('/') + 1,
              );
              if (extractedFileName) {
                extractedFileName = decodeURIComponent(
                  extractedFileName.split('?')[0],
                );
              }
            }
            cleanMessage = extractedFileName || 'File';
          }

          // Get AI videos for user's role
          const allVideos = await AiVideo.find({
            targetAudience: user.role,
          }).lean();

          // Find relevant videos using simple keyword matching
          console.log(
            `[ask_ai] Searching local database of AI videos for query: "${cleanMessage}"...`,
          );
          const queryWords = cleanMessage
            .toLowerCase()
            .split(/\s+/)
            .map((word) => word.replace(/[^\w]/g, ''))
            .filter((word) => word.length > 3);

          const matchedVideos = allVideos
            .filter((video) => {
              const title = (video.title || '').toLowerCase();
              return queryWords.some((word) => title.includes(word));
            })
            .slice(0, 3);

          let suggestedVideo = null;
          let aiMessage = '';

          // Direct response if matching video exists in local DB
          if (matchedVideos.length > 0) {
            suggestedVideo = {
              id: matchedVideos[0]._id || matchedVideos[0].id,
              title: matchedVideos[0].title,
              videoUrl: matchedVideos[0].videoUrl,
              description: matchedVideos[0].description,
              thumbnail: matchedVideos[0].thumbnail,
              isYoutube: false,
            };

            aiMessage = `I found a highly relevant video tutorial in our library to help you: "${suggestedVideo.title}". You can watch it directly by clicking the link attached below.`;
            console.log(
              `[ask_ai] Local DB match found: "${suggestedVideo.title}". Bypassing OpenAI API.`,
            );

            await AiChat.create({
              userId: activeUserId,
              message: cleanMessage,
              response: aiMessage,
              suggestedVideo,
              fileUrl: finalFileUrl || '',
              fileType: fileType || '',
              fileName: fileName || '',
            });

            socket.emit('ai_response', {
              sender: 'ai',
              message: aiMessage,
              suggestedVideo,
              fileUrl: finalFileUrl || '',
              fileType: fileType || '',
              fileName: fileName || '',
            });

            // Send push notification for AI response
            notificationService
              .sendToUsers(
                [activeUserId.toString()],
                'AI Assistant Response',
                aiMessage,
                {
                  type: 'ai_chat',
                  isAiChat: 'true',
                },
              )
              .catch((err) =>
                console.error('Failed sending AI chat notification:', err.message),
              );

            // Emit chat_notification for in-app toast/banner alerts when outside the chat route
            io.to(`user_${activeUserId.toString()}`).emit('chat_notification', {
              roomId: 'ai',
              senderName: 'AI Assistant',
              message: {
                sender: 'ai',
                message: aiMessage,
                suggestedVideo,
                fileUrl: finalFileUrl || '',
                fileType: fileType || '',
                fileName: fileName || '',
                createdAt: new Date(),
              },
            });
            return;
          }

          console.log(
            '[ask_ai] No local video match found in database. Proceeding to OpenAI with YouTube fallback...',
          );

          // Check OpenAI API key
          const openaiApiKey = process.env.OPENAI_API_KEY;

          if (!openaiApiKey) {
            console.warn('[ask_ai] OpenAI API key not configured');

            socket.emit('ai_error', {
              message:
                'AI Assistant is currently unavailable. OpenAI API key is not configured.',
            });

            return;
          }

          // Prepare OpenAI request
          const systemPrompt = `You are the PipeWyze AI helper.
 
User role: "${user.role}"

Rules:
1. Answer the user's question clearly, professionally, and keep it under 3 sentences.
2. If the user's query is a general greeting, appreciation, or conversational message (e.g. "hi", "hello", "thanks", "how are you"), reply normally and politely. Do NOT provide a YouTube link.
3. If the user is asking a technical plumbing question, provide a helpful YouTube search link that demonstrates the solution.
4. Your response MUST end with a JSON object wrapped in code block structured exactly like:
{
  "youtubeTitle": "YouTube Demonstration Title",
  "youtubeUrl": "https://www.youtube.com/results?search_query=..."
}
For general conversation or greetings, you MUST set "youtubeUrl" to null.
`;

          console.log('[ask_ai] Querying OpenAI Chat Completions API...');

          // Build OpenAI user message content (multimodal if image, or inline text representation)
          let openAiUserContent;
          if (finalFileUrl && fileType && fileType.startsWith('image/')) {
            openAiUserContent = [
              {
                type: 'text',
                text: cleanMessage || 'Analyze this image',
              },
              {
                type: 'image_url',
                image_url: {
                  url: finalFileUrl,
                },
              },
            ];
          } else if (finalFileUrl) {
            openAiUserContent = `${cleanMessage} (Attached file: ${
              fileName || 'file'
            } - ${finalFileUrl})`.trim();
          } else {
            openAiUserContent = cleanMessage;
          }

          // Call OpenAI
          const openAiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o-mini',

              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: openAiUserContent,
                },
              ],

              max_tokens: 250,

              temperature: 0.3,
            },
            {
              headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },

              // Prevent the request from hanging indefinitely
              timeout: 30000,
            },
          );

          // Extract AI response safely
          const rawAiMessage =
            openAiResponse?.data?.choices?.[0]?.message?.content?.trim();

          if (!rawAiMessage) {
            console.error('[ask_ai] OpenAI returned an empty response');

            socket.emit('ai_error', {
              message: 'AI Assistant returned an empty response.',
            });

            return;
          }

          console.log(`[ask_ai] OpenAI Raw response: "${rawAiMessage}"`);

          // Parse the JSON blocks out of rawAiMessage if any
          let cleanResponseText = rawAiMessage;
          const jsonMatch = rawAiMessage.match(/\{[\s\S]*?\}/);
          let hasCheckedVideo = false;
          if (jsonMatch) {
            try {
              const parsedJson = JSON.parse(jsonMatch[0]);
              hasCheckedVideo = true;
              if (parsedJson.youtubeUrl) {
                suggestedVideo = {
                  id: null,
                  title: parsedJson.youtubeTitle || 'YouTube Demonstration',
                  videoUrl: parsedJson.youtubeUrl,
                  description: 'YouTube search result for demonstration',
                  thumbnail: '',
                  isYoutube: true,
                };
              } else {
                suggestedVideo = null;
              }
              cleanResponseText = rawAiMessage
                .replace(/```json[\s\S]*?```|```[\s\S]*?```|\{[\s\S]*?\}/g, '')
                .trim();
            } catch (err) {
              console.error(
                '[ask_ai] Failed to parse JSON block from OpenAI response:',
                err,
              );
            }
          }

          if (!suggestedVideo && !hasCheckedVideo) {
            const searchQuery = encodeURIComponent(cleanMessage);
            suggestedVideo = {
              id: null,
              title: 'Search YouTube',
              videoUrl: `https://www.youtube.com/results?search_query=${searchQuery}`,
              description: 'Watch video tutorials on YouTube',
              thumbnail: '',
              isYoutube: true,
            };
          }

          aiMessage =
            cleanResponseText || 'Here is a video demonstrating the solution:';

          // Save to database
          await AiChat.create({
            userId: activeUserId,
            message: cleanMessage,
            response: aiMessage,
            suggestedVideo,
            fileUrl: finalFileUrl || '',
            fileType: fileType || '',
            fileName: fileName || '',
          });

           // Send successful response to frontend
          socket.emit('ai_response', {
            sender: 'ai',
            message: aiMessage,
            suggestedVideo,
            fileUrl: finalFileUrl || '',
            fileType: fileType || '',
            fileName: fileName || '',
          });

          // Send push notification for AI response
          notificationService
            .sendToUsers(
              [activeUserId.toString()],
              'AI Assistant Response',
              aiMessage,
              {
                type: 'ai_chat',
                isAiChat: 'true',
              },
            )
            .catch((err) =>
              console.error('Failed sending AI chat notification:', err.message),
            );

          // Emit chat_notification for in-app toast/banner alerts when outside the chat route
          io.to(`user_${activeUserId.toString()}`).emit('chat_notification', {
            roomId: 'ai',
            senderName: 'AI Assistant',
            message: {
              sender: 'ai',
              message: aiMessage,
              suggestedVideo,
              fileUrl: finalFileUrl || '',
              fileType: fileType || '',
              fileName: fileName || '',
              createdAt: new Date(),
            },
          });
        } catch (err) {
          // ERROR HANDLING
          console.error('[ask_ai] AI Assistant error:', err.message);

          // OpenAI HTTP errors
          if (err.response) {
            const status = err.response.status;
            const data = err.response.data;

            console.error('[ask_ai] OpenAI response status:', status);
            console.error('[ask_ai] OpenAI response data:', data);

            if (status === 429) {
              console.warn('[ask_ai] OpenAI returned 429 Too Many Requests');

              socket.emit('ai_error', {
                message:
                  'AI service is temporarily unavailable. Please try again shortly.',
                code: 'OPENAI_RATE_LIMIT',
              });

              return;
            }

            if (status === 401) {
              console.error(
                '[ask_ai] OpenAI API key is invalid or unauthorized',
              );

              socket.emit('ai_error', {
                message:
                  'AI Assistant configuration error. Please contact the administrator.',
                code: 'OPENAI_AUTH_ERROR',
              });

              return;
            }

            if (status === 403) {
              console.error('[ask_ai] OpenAI API request was forbidden');

              socket.emit('ai_error', {
                message:
                  'AI Assistant does not have permission to process this request.',
                code: 'OPENAI_FORBIDDEN',
              });

              return;
            }

            if (status === 400) {
              console.error('[ask_ai] OpenAI rejected the request');

              socket.emit('ai_error', {
                message:
                  'The AI request was invalid. Please try asking the question differently.',
                code: 'OPENAI_BAD_REQUEST',
              });

              return;
            }

            if (status >= 500) {
              console.error(`[ask_ai] OpenAI server error: ${status}`);

              socket.emit('ai_error', {
                message:
                  'AI service is temporarily unavailable. Please try again later.',
                code: 'OPENAI_SERVER_ERROR',
              });

              return;
            }
          }

          // Axios timeout
          if (err.code === 'ECONNABORTED') {
            console.error('[ask_ai] OpenAI request timed out');

            socket.emit('ai_error', {
              message:
                'AI Assistant took too long to respond. Please try again.',
              code: 'OPENAI_TIMEOUT',
            });

            return;
          }

          // Network error
          if (err.request && !err.response) {
            console.error('[ask_ai] No response received from OpenAI');

            socket.emit('ai_error', {
              message:
                'Unable to connect to the AI service. Please try again later.',
              code: 'OPENAI_NETWORK_ERROR',
            });

            return;
          }

          // Unknown error
          console.error('[ask_ai] Unknown error:', err.message);

          socket.emit('ai_error', {
            message: 'Failed to generate response from AI Assistant.',
            code: 'AI_UNKNOWN_ERROR',
          });
        }
      },
    );
  });

  server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}, Mode: ${config.env}`);
  });

  const startCountdown = (groupId, team, seconds) => {
    const state = groupAuctionState.get(groupId) || {};
    if (state.countdownTimer) clearInterval(state.countdownTimer);

    state.activeTeam = team;
    groupAuctionState.set(groupId, state);

    state.countdownTimer = setInterval(() => {
      if (seconds <= 0) {
        clearInterval(state.countdownTimer);
        processBid(groupId, team);
        return;
      }

      io.to(groupId).emit('countdownUpdate', {
        team,
        secondsLeft: seconds,
      });

      seconds--;
    }, 1000);
  };

  const processBid = async (groupId, team) => {
    if (!team) return;

    const highestAuction = await Auction.findOne({
      teamID: team._id,
      groupId: groupId,
    })
      .sort({ amount: -1 })
      .lean();

    if (highestAuction) {
      const userData = await User.findById(highestAuction.userId).lean();

      if (userData && userData.amount >= highestAuction.amount) {
        const netAmount = userData.amount - highestAuction.amount;
        await User.updateOne({ _id: userData._id }, { amount: netAmount });

        const groupMap = usersInRoom.get(groupId);
        if (groupMap?.has(userData._id.toString())) {
          const userEntry = groupMap.get(userData._id.toString());
          userEntry.user.amount = netAmount;
          groupMap.set(userData._id.toString(), userEntry);

          io.to(groupId).emit(
            'updateUserList',
            Array.from(groupMap.values()).map((u) => u.user),
          );
        }

        const existingTransaction = await Teamtransaction.findOne({
          userId: highestAuction.userId,
          teamID: team._id,
          groupID: groupId,
        });
        if (!existingTransaction) {
          await Teamtransaction.create({
            userId: highestAuction.userId,
            teamID: team._id,
            groupID: groupId,
            amount: highestAuction.amount,
            status: 'sold',
          });
        }
      }
    } else {
      const existingTransaction = await Teamtransaction.findOne({
        teamID: team._id,
        groupID: groupId,
      });

      if (!existingTransaction) {
        await Teamtransaction.create({
          teamID: team._id,
          groupID: groupId,
          status: 'unsold',
        });
      }
    }

    io.to(groupId).emit('teamStatusUpdate', {
      message: `Team ${team.teamName} has been processed.`,
    });

    processInactiveTeams(groupId);
  };

  const processInactiveTeams = async (groupId) => {
    const state = groupAuctionState.get(groupId) || {};
    const pauseTime = new Date();
    pauseTime.setMinutes(pauseTime.getMinutes() + (state.pauseduration || 0));

    if (state.pauseAuction) {
      const settingdata = await saveSetting({ pauseTime, pauseStatus: true });

      io.to(groupId).emit('auctionpaused', {
        message: `Auction is paused`,
        settingdata,
      });

      state.pauseTimeout = setTimeout(
        () => {
          state.pauseAuction = false;
          processInactiveTeams(groupId);
        },
        (state.pauseduration || 1) * 60 * 1000,
      );

      groupAuctionState.set(groupId, state);
      return;
    }

    if (state.pauseTimeout) {
      clearTimeout(state.pauseTimeout);
      state.pauseTimeout = null;
    }

    await saveSetting({ pauseStatus: false });

    const transactions = await Teamtransaction.find({
      groupID: groupId,
    }).lean();
    const teamIDs = transactions.map((t) => t.teamID);

    const query = teamIDs.length > 0 ? { _id: { $nin: teamIDs } } : {};
    const team = await Team.findOne(query)
      .sort({ randomNumber: 1 })
      .select('_id teamName')
      .lean();

    if (!team) {
      io.to(groupId).emit('teamStatusUpdate', { message: `No Team Found` });
      return;
    }

    startCountdown(groupId, team, 20);
  };

  const saveSetting = async (data) => {
    const setting = await Setting.findOne();
    return await SettingModel.findByIdAndUpdate(setting._id, data, {
      new: true,
    });
  };

  cron.schedule('* * * * * *', async () => {
    try {
      const setting = await Setting.findOne();
      if (!setting) return;

      const now = moment().tz('America/Los_Angeles');
      const scheduled = moment(setting.auctionDate).tz('America/Los_Angeles');
      const delay = scheduled.diff(now);

      if (Math.abs(delay) <= 1000) {
        const groups = await Group.find();
        for (const group of groups) {
          const groupId = group._id.toString();
          if (!groupAuctionState.get(groupId)?.countdownTimer) {
            processInactiveTeams(groupId);
          }
        }
      }
    } catch (err) {
      console.error('Error in cron job:', err);
    }
  });

  // Service reminder cron job - runs daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      const Equipment = require('./models/equipment.model');
      const targetDateStart = moment().add(3, 'days').startOf('day').toDate();
      const targetDateEnd = moment().add(3, 'days').endOf('day').toDate();

      const upcomingServices = await Equipment.find({
        nextServiceDate: {
          $gte: targetDateStart,
          $lte: targetDateEnd,
        },
      });

      for (const eq of upcomingServices) {
        if (eq.ownerId) {
          const brandModel =
            `${eq.brand || ''} ${eq.model || ''}`.trim() || eq.category;
          await notificationService
            .sendToUsers(
              [eq.ownerId.toString()],
              'Upcoming Equipment Service Reminder',
              `Your ${brandModel} is scheduled for service on ${moment(
                eq.nextServiceDate,
              ).format('YYYY-MM-DD')}.`,
              {
                type: 'maintenance',
                equipmentId: eq._id.toString(),
              },
            )
            .catch((err) =>
              console.error(
                `Failed sending service reminder to user ${eq.ownerId}:`,
                err.message,
              ),
            );
        }
      }
    } catch (err) {
      console.error('Error in service reminder cron job:', err);
    }
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) server.close();
});
