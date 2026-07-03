const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const config = require('./config/config');

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

io.on('connection', () => {
  console.log('a user is connected');
});
const socketPort = config.socketPort || 4000;
var server = http.listen(socketPort, () => {
  console.log('server is running on port', server.address().port);
});
