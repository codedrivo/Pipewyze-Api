const io = require('socket.io-client');

const socketUrl = 'http://localhost:4000';
const roomId = '6a80238fec20e814dde60fb3';
const ownerId = '6a4cb84204fd8bd1ca92e0e0';
const plumberId = '6a6b3a906da2f3f9a768df02';

console.log('Connecting Plumber...');
const plumberSocket = io(socketUrl, {
  query: { userId: plumberId }
});

plumberSocket.on('connect', () => {
  console.log('Plumber connected! Joining room...');
  plumberSocket.emit('join_room', { roomId });
});

console.log('Connecting Owner...');
const ownerSocket = io(socketUrl, {
  query: { userId: ownerId }
});

ownerSocket.on('connect', () => {
  console.log('Owner connected! Joining room...');
  ownerSocket.emit('join_room', { roomId });
});

ownerSocket.on('message_history', (history) => {
  console.log('Owner received message_history, length:', history.length);
});

ownerSocket.on('new_message', (msg) => {
  console.log('Owner received new_message:', msg.content);
  ownerSocket.disconnect();
  plumberSocket.disconnect();
  process.exit(0);
});

setTimeout(() => {
  console.log('Plumber sending message...');
  plumberSocket.emit('send_message', {
    roomId,
    senderId: plumberId,
    content: 'Test message from plumber to owner!'
  });
}, 1500);

setTimeout(() => {
  console.log('Timeout reached, owner did not receive message!');
  ownerSocket.disconnect();
  plumberSocket.disconnect();
  process.exit(1);
}, 4000);
