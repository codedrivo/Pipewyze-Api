/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');

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

  // Handle client joining a specific chat room
  socket.on('join_room', ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  // Handle client sending a message in a room
  socket.on('send_message', async ({ roomId, senderId, content }) => {
    try {
      if (!roomId || !senderId || !content) {
        return;
      }

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

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const socketPort = config.socketPort || 4000;
var server = http.listen(socketPort, () => {
  console.log('server is running on port', server.address().port);
});
