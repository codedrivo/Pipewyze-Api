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
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

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

    // --- Plumber Chat Handlers ---
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
              socket.emit('upload_success', {
                uploadId,
                messageId: message._id,
              });
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
          upload.writeStream.end();
          if (fs.existsSync(upload.tempFilePath)) {
            fs.unlinkSync(upload.tempFilePath);
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
