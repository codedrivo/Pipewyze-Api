/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');
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

const http = require('https').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 5 * 1024 * 1024, // 5MB max message size for chunks
});
global.io = io;
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

io.on('connection', (socket) => {
  console.log('a user is connected:', socket.id);

  // Automatically join the socket to user's chat rooms on connection asynchronously
  const userId = socket.handshake.query.userId;
  if (userId) {
    // Set user online state in DB
    User.findByIdAndUpdate(userId, { isOnline: true })
      .exec()
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

  // Handle client joining a specific chat room
  socket.on('join_room', async ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);

    try {
      // Mark existing messages sent by counterpart as read
      if (userId) {
        await Message.updateMany(
          { roomId, senderId: { $ne: userId }, read: false },
          { $set: { read: true } },
        );
        // Broadcast that messages in the room have been read by this user
        socket.to(roomId).emit('messages_read', { roomId, readerId: userId });
      }

      // Fetch messages for this room
      const messages = await Message.find({ roomId })
        .populate('senderId', 'fullName profileimageurl')
        .sort({ createdAt: 1 }); // Sort chronologically

      // Send the message history ONLY to the socket that just joined (one-to-one)
      socket.emit('message_history', messages);

      // Fetch other participant's status and emit it to the user who joined
      const room = await ChatRoom.findById(roomId);
      if (room && userId) {
        const counterpartId =
          room.homeOwnerId.toString() === userId
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

  // Handle client sending a message in a room
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

            if (!finalContent) {
              finalContent = `Sent a file: ${fileName || 'file.' + extension}`;
            }
          }
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
      } catch (error) {
        console.error('Error handling send_message socket event:', error);
      }
    },
  );

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
          socket.emit('upload_error', { uploadId, error: 'Invalid file size' });
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

        if (upload.writeStream.writableEnded || upload.writeStream.destroyed) {
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
                content: `Sent a file: ${upload.fileName}`,
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
    console.log('user disconnected:', socket.id);

    // Check if the user has other active connections (e.g. other tabs/devices)
    if (userId) {
      const sockets = await io.fetchSockets();
      const hasOtherSockets = sockets.some(
        (s) => s.handshake.query.userId === userId && s.id !== socket.id,
      );
      if (!hasOtherSockets) {
        User.findByIdAndUpdate(userId, { isOnline: false })
          .exec()
          .catch((err) => console.error(err));
        io.emit('user_status_changed', { userId, isOnline: false });
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

const socketPort = config.socketPort || 4000;
var server = http.listen(socketPort, () => {
  console.log('server is running on port', server.address().port);
});
