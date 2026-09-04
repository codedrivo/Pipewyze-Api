// const mongoose = require('mongoose');
// const { toJSON } = require('./plugins');

// const chatRoomSchema = new mongoose.Schema(
//   {
//     homeOwnerId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     plumberId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     lastMessage: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Message',
//       default: null,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// chatRoomSchema.plugin(toJSON);

// const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

// module.exports = ChatRoom;

const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const chatRoomSchema = new mongoose.Schema(
  {
    homeOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plumberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

chatRoomSchema.plugin(toJSON);

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;
