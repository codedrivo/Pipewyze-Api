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
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

function validateMagicBytes(filePath, fileType) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toUpperCase();

    if (fileType === 'image/jpeg') {
      return hex.startsWith('FFD8FF');
    }
    if (fileType === 'image/png') {
      return hex.startsWith('89504E470D0A1A0A');
    }
    if (fileType === 'image/webp') {
      return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
    }
    if (fileType === 'video/mp4') {
      return hex.slice(8, 16) === '66747970';
    }
    if (fileType === 'video/quicktime') {
      return hex.slice(8, 16) === '66747970' || hex.slice(8, 16) === '6D6F6F76';
    }
    if (fileType === 'video/webm') {
      return hex.startsWith('1A45DFA3');
    }
    return false;
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

  server = app.listen(config.port, () => {
    logger.info(`Listening on port ${config.port}, Mode: ${config.env}`);
  });

  const socketApp = http.createServer(app);
  const socketPort = config.socketPort || 4000;

  io = socketIo(socketApp, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 5 * 1024 * 1024, // 5MB max message size for chunks
  });
  global.io = io;

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Automatically join the socket to user's chat rooms on connection asynchronously
    let userId = socket.handshake.query.userId;
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!userId && token) {
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
      // Set user online state in DB
      User.findByIdAndUpdate(userId, { isOnline: true })
        .exec()
        .then(() => console.log(`User connected & marked online: ${userId}`))
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
      try {
        await User.findByIdAndUpdate(connectedUserId, { isOnline: true });
        console.log(
          `User connected (via event) & marked online: ${connectedUserId}`,
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
        socket.userId = activeUserId;
      }

      try {
        if (activeUserId) {
          // Set user online state in DB and broadcast status
          await User.findByIdAndUpdate(activeUserId, { isOnline: true });
          console.log(`User joined room & marked online: ${activeUserId}`);
          io.emit('user_status_changed', {
            userId: activeUserId,
            isOnline: true,
          });

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

          // Check if room exists
          let room = await ChatRoom.findById(roomId);
          if (!room) {
            let plumberId = receiverId;
            if (!plumberId) {
              // Find a licensed plumber to associate with the room
              const plumber = await User.findOne({ role: 'licensed-plumber' });
              plumberId = plumber ? plumber._id : null;
            }

            if (!plumberId) {
              console.error(
                `Validation Failed: Cannot dynamically create room ${roomId} without a plumberId.`,
              );
              return;
            }

            room = await ChatRoom.create({
              _id: roomId,
              homeOwnerId: senderId,
              plumberId: plumberId,
            });

            // Auto-join all currently connected sockets to this new room
            const sockets = await io.fetchSockets();
            for (const s of sockets) {
              s.join(roomId);
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

          if (fileUrl && fileUrl.startsWith('data:')) {
            const matches = fileUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
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

          // Save the message to DB
          const message = await Message.create({
            roomId,
            senderId,
            content: finalContent,
            fileUrl: finalFileUrl,
            fileType,
          });

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

          const senderUser = await User.findById(senderId);
          const senderName = senderUser ? senderUser.fullName : 'Someone';

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

                  const senderUser = await User.findById(upload.senderId);
                  const senderName = senderUser
                    ? senderUser.fullName
                    : 'Someone';

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
  });

  socketApp.listen(socketPort, () => {
    logger.info(`Socket.IO server running on port ${socketPort}`);
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
