// const mongoose = require('mongoose');
// const { toJSON } = require('./plugins');

// const messageSchema = new mongoose.Schema(
//   {
//     roomId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'ChatRoom',
//       required: true,
//     },
//     senderId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     content: {
//       type: String,
//       trim: true,
//       default: '',
//     },
//     fileUrl: {
//       type: String,
//       default: null,
//     },
//     fileType: {
//       type: String,
//       default: null,
//     },
//     read: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// messageSchema.plugin(toJSON);

// const Message = mongoose.model('Message', messageSchema);

// module.exports = Message;

const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: '',
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileType: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.plugin(toJSON);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
