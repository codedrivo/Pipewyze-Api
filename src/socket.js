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

const tempDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const activeUploads = new Map();

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
    async ({ roomId, senderId, receiverId, content, fileUrl, fileType }) => {
      try {
        if (!roomId || !senderId || (!content && !fileUrl)) {
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
        if (fileUrl && fileUrl.startsWith('data:')) {
          const matches = fileUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            const extension = mimeType.split('/').pop() || 'bin';
            const uniqueKey =
              'PipeWyze/' + Date.now().toString() + '.' + extension;

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

        // Save the message to DB
        const message = await Message.create({
          roomId,
          senderId,
          content,
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

        // Send push notification to the recipient of the message
        const counterpartId =
          room.homeOwnerId.toString() === senderId
            ? room.plumberId
            : room.homeOwnerId;

        if (counterpartId) {
          const sender = await User.findById(senderId);
          const senderName = sender ? sender.fullName : 'Someone';
          const notificationService = require('./services/notification.service');

          notificationService
            .sendToUsers(
              [counterpartId.toString()],
              `New message from ${senderName}`,
              content || 'Sent an attachment',
              { roomId: roomId.toString(), type: 'chat' },
            )
            .catch((err) =>
              console.error('Failed sending chat notification:', err.message),
            );
        }
      } catch (error) {
        console.error('Error handling send_message socket event:', error);
      }
    },
  );

  // Handle start of streaming file upload
  socket.on(
    'start_upload',
    ({ uploadId, roomId, senderId, fileName, fileType, totalChunks }) => {
      if (!uploadId || !roomId || !senderId || !fileName || !totalChunks) {
        console.error('Invalid start_upload metadata');
        return;
      }

      const tempFilePath = path.join(tempDir, `${uploadId}_${fileName}`);
      const writeStream = fs.createWriteStream(tempFilePath);

      activeUploads.set(uploadId, {
        writeStream,
        tempFilePath,
        roomId,
        senderId,
        fileName,
        fileType,
        totalChunks,
        receivedChunks: 0,
        socketId: socket.id,
      });

      socket.emit('upload_ready', { uploadId });
    },
  );

  // Handle incoming file chunk
  socket.on('upload_chunk', async ({ uploadId, chunkIndex, chunkData }) => {
    const upload = activeUploads.get(uploadId);
    if (!upload) {
      socket.emit('upload_error', {
        uploadId,
        error: 'Upload session not found',
      });
      return;
    }

    try {
      const buffer = Buffer.isBuffer(chunkData)
        ? chunkData
        : Buffer.from(chunkData);

      upload.writeStream.write(buffer);
      upload.receivedChunks++;

      socket.emit('upload_progress', {
        uploadId,
        chunkIndex,
        progress: Math.round(
          (upload.receivedChunks / upload.totalChunks) * 100,
        ),
      });

      if (upload.receivedChunks === upload.totalChunks) {
        upload.writeStream.end();

        upload.writeStream.on('finish', async () => {
          try {
            const fileStats = fs.statSync(upload.tempFilePath);
            const fileStream = fs.createReadStream(upload.tempFilePath);

            const extension = upload.fileName.split('.').pop() || 'bin';
            const uniqueKey =
              'PipeWyze/' + Date.now().toString() + '.' + extension;

            const command = new PutObjectCommand({
              Bucket: config.s3.S3_BUCKET_PATH,
              Key: uniqueKey,
              Body: fileStream,
              ContentType: upload.fileType,
              ContentLength: fileStats.size,
            });

            await s3.send(command);

            let fileUrl;
            if (config.s3.cloudfrontUrl) {
              const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
              fileUrl = `${baseUrl}/${uniqueKey}`;
            } else {
              fileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;
            }

            fs.unlinkSync(upload.tempFilePath);
            activeUploads.delete(uploadId);

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
            socket.emit('upload_success', { uploadId, messageId: message._id });
          } catch (err) {
            console.error('Error finishing file upload processing:', err);
            socket.emit('upload_error', {
              uploadId,
              error: 'Failed to process completed file',
            });
            if (fs.existsSync(upload.tempFilePath)) {
              fs.unlinkSync(upload.tempFilePath);
            }
            activeUploads.delete(uploadId);
          }
        });
      }
    } catch (err) {
      console.error('Error writing chunk:', err);
      socket.emit('upload_error', {
        uploadId,
        error: 'Failed to write file chunk',
      });
    }
  });

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

    for (const [uploadId, upload] of activeUploads.entries()) {
      if (upload.socketId === socket.id) {
        upload.writeStream.end();
        if (fs.existsSync(upload.tempFilePath)) {
          fs.unlinkSync(upload.tempFilePath);
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
