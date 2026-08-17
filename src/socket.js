/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');

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

  // Handle client joining a specific chat room
  socket.on('join_room', ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  // Handle client sending a message in a room
  socket.on(
    'send_message',
    async ({ roomId, senderId, content, fileUrl, fileType }) => {
      try {
        if (!roomId || !senderId) {
          return;
        }
        if (!content && !fileUrl) {
          return;
        }

        // Save the message to DB
        const message = await Message.create({
          roomId,
          senderId,
          content: content || '',
          fileUrl: fileUrl || null,
          fileType: fileType || null,
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

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const socketPort = config.socketPort || 4000;
var server = http.listen(socketPort, () => {
  console.log('server is running on port', server.address().port);
});
