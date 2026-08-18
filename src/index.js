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

    // Automatically join the socket to all existing chat rooms on connection asynchronously
    ChatRoom.find({})
      .then((rooms) => {
        for (const room of rooms) {
          socket.join(room._id.toString());
        }
      })
      .catch((error) => {
        console.error('Error auto-joining rooms on connection:', error);
      });

    // --- Plumber Chat Handlers ---
    socket.on('join_room', ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
    });

    socket.on('send_message', async ({ roomId, senderId, content, fileUrl, fileType }) => {
      try {
        if (!roomId || !senderId || (!content && !fileUrl)) return;

        // Check if room exists
        let room = await ChatRoom.findById(roomId);
        if (!room) {
          // Find a licensed plumber to associate with the room
          const plumber = await User.findOne({ role: 'licensed-plumber' });
          const plumberId = plumber ? plumber._id : '6a6b3a906da2f3f9a768df01'; // Default fallback ID if none exists

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

        // Save the message to DB
        const message = await Message.create({
          roomId,
          senderId,
          content,
          fileUrl,
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
    });

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

    socket.on('disconnect', () => {
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
