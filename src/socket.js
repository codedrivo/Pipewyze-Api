// /* eslint-disable no-console */
// const express = require('express');
// const bodyParser = require('body-parser');
// const app = express();
// const config = require('./config/config');
// const ChatRoom = require('./models/chatRoom.model');
// const Message = require('./models/message.model');
// const User = require('./models/user.model');
// const axios = require('axios');
// const AiVideo = require('./models/aiVideo.model');
// const notificationService = require('./services/notification.service');
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// const fs = require('fs');
// const path = require('path');
// const crypto = require('crypto');

// const os = require('os');

// const tempDir = path.join(os.tmpdir(), 'pipewyze_uploads');
// if (!fs.existsSync(tempDir)) {
//   fs.mkdirSync(tempDir, { recursive: true });
// }

// const activeUploads = new Map();

// const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB
// const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per chunk - safe for Socket.IO buffer (100 MB)
// const ALLOWED_MIME_TYPES = [
//   'image/jpeg',
//   'image/jpg',
//   'image/png',
//   'image/webp',
//   'image/heic',
//   'image/heif',
//   'image/gif',
//   'video/mp4',
//   'video/quicktime',
//   'video/mov',
//   'video/webm',
//   'application/octet-stream',
// ];

// function validateMagicBytes(filePath, fileType) {
//   try {
//     const fd = fs.openSync(filePath, 'r');
//     const buffer = Buffer.alloc(64); // Read 64 bytes for comprehensive checking
//     fs.readSync(fd, buffer, 0, 64, 0);
//     fs.closeSync(fd);

//     const hex = buffer.toString('hex').toUpperCase();

//     // JPEG: FFD8FF...
//     const isJpeg = hex.startsWith('FFD8FF');
//     const isPng = hex.startsWith('89504E470D0A1A0A');
//     const isGif = hex.startsWith('47494638');

//     // WebP: RIFF....WEBP (bytes 0-3: RIFF, bytes 8-11: WEBP)
//     const isWebp =
//       hex.startsWith('52494646') &&
//       buffer.slice(8, 12).toString('ascii') === 'WEBP';

//     // WebM: 1A45DFA3
//     const isWebm = hex.startsWith('1A45DFA3');

//     // ISO Base Media File Format (MP4, MOV, HEIC, HEIF)
//     // Structure: 4 bytes size, then 'ftyp' tag, then 4-byte brand identifier
//     const isISOBMFF = buffer.slice(4, 8).toString('ascii') === 'ftyp';
//     let ftypBrand = '';
//     if (isISOBMFF) {
//       ftypBrand = buffer.slice(8, 12).toString('ascii').trim();
//     }

//     // MP4: ftyp brand is one of: isom, iso2, avc1, mp41, mp42, mp43, mmp4
//     const isMp4 =
//       isISOBMFF &&
//       ['isom', 'iso2', 'avc1', 'mp41', 'mp42', 'mp43', 'mmp4'].includes(
//         ftypBrand,
//       );

//     // MOV/QuickTime: ftyp brand is 'qt  ' (qt followed by two spaces)
//     const isMov =
//       isISOBMFF &&
//       (ftypBrand === 'qt  ' ||
//         buffer.slice(8, 12).toString('ascii') === 'qt  ');

//     // HEIC/HEIF: ftyp brand is one of: mif1, heic, heix, hevc, hevx, fvt1
//     const isHeic =
//       isISOBMFF &&
//       ['mif1', 'heic', 'heix', 'hevc', 'hevx', 'fvt1'].includes(ftypBrand);

//     console.log(
//       `[Magic Byte Validation] filePath=${filePath}, fileType=${fileType}, isJpeg=${isJpeg}, isPng=${isPng}, isGif=${isGif}, isWebp=${isWebp}, isWebm=${isWebm}, isMp4=${isMp4}, isMov=${isMov}, isHeic=${isHeic}`,
//     );

//     // Validate based on declared file type
//     switch (fileType) {
//       case 'image/jpeg':
//       case 'image/jpg':
//         return isJpeg;
//       case 'image/png':
//         return isPng;
//       case 'image/gif':
//         return isGif;
//       case 'image/webp':
//         return isWebp;
//       case 'image/heic':
//       case 'image/heif':
//         return isHeic;
//       case 'video/mp4':
//         return isMp4;
//       case 'video/quicktime':
//       case 'video/mov':
//         return isMov;
//       case 'video/webm':
//         return isWebm;
//       case 'application/octet-stream':
//         // For octet-stream, accept if it matches any supported format
//         return (
//           isJpeg ||
//           isPng ||
//           isGif ||
//           isWebp ||
//           isHeic ||
//           isMp4 ||
//           isMov ||
//           isWebm
//         );
//       default:
//         console.warn(`[Magic Byte Validation] Unknown fileType: ${fileType}`);
//         return false;
//     }
//   } catch (err) {
//     console.error('[Magic Byte Validation] Error reading file:', err);
//     return false;
//   }
// }

// /**
//  * Infer MIME type from filename extension.
//  * Used as fallback when mobile client sends empty or generic MIME type.
//  */
// function inferMimeTypeFromFilename(fileName) {
//   if (!fileName) return null;
//   const ext = fileName.toLowerCase().split('.').pop();
//   const mimeMap = {
//     jpg: 'image/jpeg',
//     jpeg: 'image/jpeg',
//     png: 'image/png',
//     gif: 'image/gif',
//     webp: 'image/webp',
//     heic: 'image/heic',
//     heif: 'image/heif',
//     mp4: 'video/mp4',
//     mov: 'video/quicktime',
//     qt: 'video/quicktime',
//     webm: 'video/webm',
//     m4v: 'video/mp4',
//     '3gp': 'video/mp4',
//   };
//   return mimeMap[ext] || null;
// }

// const s3 = new S3Client({
//   region: config.s3.region,
//   credentials: {
//     accessKeyId: config.s3.accessKeyId,
//     secretAccessKey: config.s3.secretAccessKey,
//   },
// });

// const http = require('http').createServer(app);
// const io = require('socket.io')(http, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST'],
//   },
//   maxHttpBufferSize: 100 * 1024 * 1024, // 100MB max message size for large gallery files/chunks
// });
// global.io = io;
// app.use(express.static(__dirname));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: false }));

// io.on('connection', async (socket) => {
//   // Automatically join the socket to user's chat rooms on connection asynchronously
//   let userId = socket.handshake.query?.userId;
//   let token =
//     socket.handshake.auth?.token ||
//     socket.handshake.headers?.authorization ||
//     socket.handshake.query?.token;

//   if (token) {
//     try {
//       const access = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
//       const jwt = require('jsonwebtoken');
//       const config = require('./config/config');
//       const data = jwt.verify(access, config.jwt.secret, {
//         algorithm: config.jwt.algo,
//         issuer: config.jwt.issuer,
//         audience: 'access',
//       });
//       if (data && data.sub) {
//         userId = data.sub;
//       }
//     } catch (err) {
//       console.error('Socket token verification failed:', err.message);
//     }
//   }

//   if (userId) {
//     socket.userId = userId;
//     socket.join(`user_${userId}`);
//     // Set user online state in DB
//     User.findByIdAndUpdate(userId, { isOnline: true }, { new: true })
//       .exec()
//       .then((updatedUser) => {
//         const name = updatedUser ? updatedUser.fullName : userId;
//         const role = updatedUser ? updatedUser.role : 'unknown';
//         console.log(
//           `[User Connection] User ${name} (${role}) connected & marked online: ${userId}`,
//         );
//       })
//       .catch((err) => console.error(err));
//     // Broadcast status changed to everyone
//     io.emit('user_status_changed', { userId, isOnline: true });

//     ChatRoom.find({
//       $or: [{ homeOwnerId: userId }, { plumberId: userId }],
//     })
//       .then((rooms) => {
//         for (const room of rooms) {
//           socket.join(room._id.toString());
//         }
//       })
//       .catch((error) => {
//         console.error('Error auto-joining rooms on connection:', error);
//       });
//   }

//   // Client can register their userId via this event after connecting
//   socket.on('user_connected', async ({ userId: connectedUserId }) => {
//     if (!connectedUserId) return;
//     socket.userId = connectedUserId;
//     socket.join(`user_${connectedUserId}`);
//     try {
//       const updatedUser = await User.findByIdAndUpdate(
//         connectedUserId,
//         { isOnline: true },
//         { new: true },
//       );
//       const name = updatedUser ? updatedUser.fullName : connectedUserId;
//       const role = updatedUser ? updatedUser.role : 'unknown';
//       console.log(
//         `[User Connection] User ${name} (${role}) connected (via event) & marked online: ${connectedUserId}`,
//       );
//       io.emit('user_status_changed', {
//         userId: connectedUserId,
//         isOnline: true,
//       });

//       const rooms = await ChatRoom.find({
//         $or: [{ homeOwnerId: connectedUserId }, { plumberId: connectedUserId }],
//       });
//       for (const room of rooms) {
//         socket.join(room._id.toString());
//       }
//     } catch (error) {
//       console.error('Error handling user_connected socket event:', error);
//     }
//   });

//   // Handle client joining a specific chat room
//   socket.on('join_room', async ({ roomId, userId: payloadUserId }) => {
//     if (!roomId) return;
//     socket.join(roomId);

//     const activeUserId = payloadUserId || socket.userId || userId;
//     if (activeUserId) {
//       try {
//         const checkUser = await User.findById(activeUserId);
//         const allowedRoles = [
//           'home-owner',
//           'licensed-plumber',
//           'apprentice',
//           'admin',
//           'support',
//         ];
//         if (!checkUser || !allowedRoles.includes(checkUser.role)) {
//           const errorMsg = `Access denied: User with role ${
//             checkUser ? checkUser.role : 'unknown'
//           } is not authorized in chat rooms.`;
//           console.error(errorMsg);
//           socket.emit('chat_error', { message: errorMsg });
//           return;
//         }
//         socket.userId = activeUserId;
//         socket.join(`user_${activeUserId}`);
//       } catch (err) {
//         console.error('Error verifying user role in join_room:', err);
//         socket.emit('chat_error', {
//           message: 'Internal server error verifying authorization.',
//         });
//         return;
//       }
//     }

//     try {
//       if (activeUserId) {
//         console.log(`User ${activeUserId} joined room: ${roomId}`);

//         // Mark existing messages sent by counterpart as read
//         await Message.updateMany(
//           { roomId, senderId: { $ne: activeUserId }, read: false },
//           { $set: { read: true } },
//         );
//         // Broadcast that messages in the room have been read by this user
//         socket
//           .to(roomId)
//           .emit('messages_read', { roomId, readerId: activeUserId });
//       }

//       // Fetch messages for this room
//       const messages = await Message.find({ roomId })
//         .populate('senderId', 'fullName profileimageurl')
//         .sort({ createdAt: 1 }); // Sort chronologically

//       // Send the message history ONLY to the socket that just joined (one-to-one)
//       socket.emit('message_history', messages);

//       // Fetch other participant's status and emit it to the user who joined
//       const room = await ChatRoom.findById(roomId);
//       if (room && activeUserId) {
//         const counterpartId =
//           room.homeOwnerId.toString() === activeUserId.toString()
//             ? room.plumberId
//             : room.homeOwnerId;
//         const counterpartUser = await User.findById(counterpartId);
//         if (counterpartUser) {
//           socket.emit('user_status_changed', {
//             userId: counterpartId.toString(),
//             isOnline: counterpartUser.isOnline,
//           });
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching room message history:', error);
//     }
//   });

//   // Handle client sending a message in a room
//   socket.on(
//     'send_message',
//     async ({
//       roomId,
//       senderId,
//       receiverId,
//       content,
//       fileUrl,
//       fileType,
//       fileName,
//     }) => {
//       try {
//         if (!roomId || !senderId || (!content && !fileUrl)) {
//           console.warn(
//             'Validation Failed: missing roomId, senderId, or both content and fileUrl.',
//           );
//           return;
//         }

//         const senderUser = await User.findById(senderId);
//         if (!senderUser) {
//           const errorMsg = `Validation Failed: Sender ${senderId} not found.`;
//           console.error(errorMsg);
//           socket.emit('chat_error', { message: errorMsg });
//           return;
//         }

//         const allowedRoles = [
//           'home-owner',
//           'licensed-plumber',
//           'apprentice',
//           'admin',
//           'support',
//         ];
//         if (!allowedRoles.includes(senderUser.role)) {
//           const errorMsg = `Validation Failed: Sender role ${senderUser.role} is not authorized for chat.`;
//           console.error(errorMsg);
//           socket.emit('chat_error', { message: errorMsg });
//           return;
//         }

//         // Check if room exists
//         let room = await ChatRoom.findById(roomId);
//         if (!room) {
//           let plumberId = receiverId;
//           let homeOwnerId = senderId;

//           if (senderUser.role === 'licensed-plumber') {
//             plumberId = senderId;
//             homeOwnerId = receiverId;
//           }

//           if (!homeOwnerId || !plumberId) {
//             console.error(
//               `Validation Failed: Cannot dynamically create room without both homeOwnerId and plumberId.`,
//             );
//             return;
//           }

//           const homeOwnerUser = await User.findById(homeOwnerId);
//           const plumberUser = await User.findById(plumberId);

//           if (!homeOwnerUser || homeOwnerUser.role !== 'home-owner') {
//             console.error(`Validation Failed: Invalid homeowner.`);
//             return;
//           }
//           if (!plumberUser || plumberUser.role !== 'licensed-plumber') {
//             console.error(`Validation Failed: Invalid licensed plumber.`);
//             return;
//           }

//           room = await ChatRoom.create({
//             _id: roomId,
//             homeOwnerId,
//             plumberId,
//           });

//           // Auto-join all currently connected sockets to this new room
//           const sockets = await io.fetchSockets();
//           for (const s of sockets) {
//             s.join(roomId);
//           }
//         } else {
//           // Verify existing room participants exist
//           const homeOwnerUser = await User.findById(room.homeOwnerId);
//           const plumberUser = await User.findById(room.plumberId);
//           if (!homeOwnerUser || !plumberUser) {
//             const errorMsg =
//               'Validation Failed: Chat room participants not found.';
//             console.error(errorMsg);
//             socket.emit('chat_error', { message: errorMsg });
//             return;
//           }
//         }

//         // Validate that the sender is either a participant in the room or a staff/admin user
//         const isStaff = ['admin', 'support', 'apprentice'].includes(
//           senderUser.role,
//         );
//         if (
//           !isStaff &&
//           room.homeOwnerId.toString() !== senderId &&
//           room.plumberId.toString() !== senderId
//         ) {
//           const errorMsg = `Validation Failed: Sender ${senderId} is not part of room ${roomId}`;
//           console.error(errorMsg);
//           socket.emit('chat_error', { message: errorMsg });
//           return;
//         }

//         // Auto-join the sender to the room channel so they can receive future broadcasts/replies
//         socket.join(roomId);

//         let finalFileUrl = fileUrl;
//         let finalContent = content;
//         let finalFileType = fileType;

//         if (fileUrl) {
//           let isBase64 = false;
//           let mimeType = null;
//           let buffer = null;

//           if (fileUrl.startsWith('data:')) {
//             const matches = fileUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
//             if (matches && matches.length === 3) {
//               isBase64 = true;
//               mimeType = matches[1];
//               buffer = Buffer.from(matches[2], 'base64');
//             }
//           } else if (
//             !fileUrl.startsWith('http://') &&
//             !fileUrl.startsWith('https://')
//           ) {
//             const cleanBase64 = fileUrl.replace(/\s/g, '');
//             if (
//               /^[a-zA-Z0-9+/=]+$/.test(cleanBase64) &&
//               cleanBase64.length > 50
//             ) {
//               try {
//                 buffer = Buffer.from(cleanBase64, 'base64');
//                 isBase64 = true;

//                 const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
//                 if (hex.startsWith('FFD8FF')) {
//                   mimeType = 'image/jpeg';
//                 } else if (hex.startsWith('89504E470D0A1A0A')) {
//                   mimeType = 'image/png';
//                 } else if (hex.startsWith('47494638')) {
//                   mimeType = 'image/gif';
//                 } else if (
//                   hex.startsWith('52494646') &&
//                   buffer.slice(8, 12).toString('ascii') === 'WEBP'
//                 ) {
//                   mimeType = 'image/webp';
//                 } else if (buffer.slice(4, 8).toString('ascii') === 'ftyp') {
//                   mimeType = 'video/mp4';
//                 } else if (hex.startsWith('1A45DFA3')) {
//                   mimeType = 'video/webm';
//                 } else {
//                   mimeType = fileType || 'image/jpeg';
//                 }
//               } catch (e) {
//                 console.error('Failed to parse raw base64 buffer:', e.message);
//               }
//             }
//           }

//           if (isBase64 && buffer) {
//             try {
//               const extension = mimeType.split('/').pop() || 'bin';
//               const s3Folder = mimeType.startsWith('image/')
//                 ? 'images'
//                 : 'videos';
//               const uniqueKey = `PipeWyze/${s3Folder}/${crypto.randomUUID()}.${extension}`;

//               const command = new PutObjectCommand({
//                 Bucket: config.s3.S3_BUCKET_PATH,
//                 Key: uniqueKey,
//                 Body: buffer,
//                 ContentType: mimeType,
//               });

//               await s3.send(command);

//               if (config.s3.cloudfrontUrl) {
//                 const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
//                 finalFileUrl = `${baseUrl}/${uniqueKey}`;
//               } else {
//                 finalFileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;
//               }
//               finalFileType = mimeType;
//             } catch (s3Err) {
//               console.error(
//                 '[S3 Upload Error] Failed to upload base64 file to S3:',
//                 s3Err.message,
//               );
//               finalFileUrl = undefined;
//             }
//           }
//         }

//         if (
//           !finalFileType &&
//           finalFileUrl &&
//           !finalFileUrl.startsWith('data:') &&
//           (finalFileUrl.startsWith('http://') ||
//             finalFileUrl.startsWith('https://') ||
//             finalFileUrl.startsWith('/'))
//         ) {
//           const cleanUrl = finalFileUrl.split('?')[0];
//           const ext = cleanUrl
//             .substring(cleanUrl.lastIndexOf('.') + 1)
//             .toLowerCase();
//           if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) {
//             finalFileType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
//           } else if (
//             ['mp4', 'mov', 'quicktime', 'webm', 'm4v', '3gp'].includes(ext)
//           ) {
//             finalFileType = `video/${
//               ext === 'mov' || ext === 'quicktime' ? 'quicktime' : ext
//             }`;
//           }
//         }

//         if ((!finalContent || finalContent.trim() === '') && finalFileUrl) {
//           let extractedFileName = fileName;
//           if (!extractedFileName) {
//             extractedFileName = finalFileUrl.substring(
//               finalFileUrl.lastIndexOf('/') + 1,
//             );
//             if (extractedFileName) {
//               extractedFileName = decodeURIComponent(
//                 extractedFileName.split('?')[0],
//               );
//             }
//           }
//           finalContent = extractedFileName || 'Attachment';
//         }

//         // Safeguard: Ensure finalContent and finalFileUrl do not contain raw base64 data dumps
//         if (
//           finalContent &&
//           finalContent.length > 100 &&
//           !finalContent.includes(' ') &&
//           /^[a-zA-Z0-9+/=]+$/.test(finalContent.replace(/\s/g, ''))
//         ) {
//           finalContent = fileName || 'Attachment';
//         }
//         if (
//           finalFileUrl &&
//           finalFileUrl.length > 100 &&
//           !finalFileUrl.includes(' ') &&
//           !finalFileUrl.startsWith('http') &&
//           /^[a-zA-Z0-9+/=]+$/.test(finalFileUrl.replace(/\s/g, ''))
//         ) {
//           finalFileUrl = undefined;
//         }

//         // Save the message to DB
//         const message = await Message.create({
//           roomId,
//           senderId,
//           content: finalContent,
//           fileUrl: finalFileUrl,
//           fileType: finalFileType,
//         });
//         console.log(
//           `[Chat Message] Chat message sent successfully in room ${roomId} from sender ${senderId}. Content: "${finalContent}", fileUrl: "${
//             finalFileUrl || 'none'
//           }"`,
//         );

//         // Update the last message in the room
//         await ChatRoom.findByIdAndUpdate(roomId, {
//           lastMessage: message._id,
//         });

//         // Populate sender details for the response
//         const populatedMessage = await message.populate(
//           'senderId',
//           'fullName profileimageurl',
//         );

//         // Broadcast the message to all clients in the room (including sender)
//         io.to(roomId).emit('new_message', populatedMessage);

//         // Send push notification to counterpart participant
//         const counterpartId =
//           room.homeOwnerId.toString() === senderId.toString()
//             ? room.plumberId
//             : room.homeOwnerId;

//         // Also emit new_message to counterpart's user room in case they are not in the active chat room socket
//         io.to(`user_${counterpartId.toString()}`).emit(
//           'new_message',
//           populatedMessage,
//         );

//         const senderName = senderUser ? senderUser.fullName : 'Someone';

//         // Emit chat_notification for in-app toast/banner alerts when outside the chat route
//         io.to(`user_${counterpartId.toString()}`).emit('chat_notification', {
//           roomId,
//           senderName,
//           message: populatedMessage,
//         });

//         notificationService
//           .sendToUsers(
//             [counterpartId.toString()],
//             `New message from ${senderName}`,
//             message.content || 'Sent an attachment',
//             {
//               roomId: roomId.toString(),
//               messageId: message._id.toString(),
//             },
//           )
//           .catch((err) =>
//             console.error('Failed sending chat notification:', err.message),
//           );
//       } catch (error) {
//         console.error('Error handling send_message socket event:', error);
//       }
//     },
//   );

//   // Handle start of streaming file upload
//   socket.on(
//     'start_upload',
//     async ({
//       uploadId,
//       roomId,
//       senderId,
//       fileName,
//       fileType,
//       fileSize,
//       totalChunks,
//     }) => {
//       console.log(
//         `[Media Upload] start_upload event - uploadId=${uploadId}, fileName=${fileName}, fileType=${fileType}, fileSize=${fileSize}, totalChunks=${totalChunks}`,
//       );

//       if (!uploadId || !roomId || !senderId || !fileName || !totalChunks) {
//         console.error(
//           `[Media Upload Error] start_upload: Missing required metadata for uploadId=${uploadId}`,
//         );
//         socket.emit('upload_error', {
//           uploadId,
//           error:
//             'Missing required metadata (uploadId, roomId, senderId, fileName, totalChunks)',
//         });
//         return;
//       }

//       // Check path traversal on filename
//       if (
//         typeof fileName !== 'string' ||
//         fileName.includes('/') ||
//         fileName.includes('\\') ||
//         fileName.includes('..')
//       ) {
//         console.error(
//           `[Media Upload Error] start_upload: Invalid file name for uploadId=${uploadId}: ${fileName}`,
//         );
//         socket.emit('upload_error', {
//           uploadId,
//           error: 'Invalid file name (contains path separators or ..)',
//         });
//         return;
//       }

//       // Validate fileSize if provided
//       let size = null;
//       if (fileSize !== undefined && fileSize !== null) {
//         size = parseInt(fileSize, 10);
//         if (isNaN(size) || size <= 0 || size > MAX_UPLOAD_SIZE) {
//           console.error(
//             `[Media Upload Error] start_upload: Invalid file size for uploadId=${uploadId}: ${size} (max: ${MAX_UPLOAD_SIZE})`,
//           );
//           socket.emit('upload_error', {
//             uploadId,
//             error: `Invalid file size. Max: ${Math.floor(
//               MAX_UPLOAD_SIZE / 1024 / 1024,
//             )}MB`,
//           });
//           return;
//         }
//       }

//       // Validate totalChunks
//       const chunks = parseInt(totalChunks, 10);
//       if (isNaN(chunks) || chunks <= 0 || chunks > 10000) {
//         console.error(
//           `[Media Upload Error] start_upload: Invalid total chunks for uploadId=${uploadId}: ${chunks}`,
//         );
//         socket.emit('upload_error', {
//           uploadId,
//           error: 'Invalid total chunks count (must be > 0 and <= 10000)',
//         });
//         return;
//       }

//       // Infer MIME type from filename if not provided or generic
//       let finalFileType = fileType;
//       if (!fileType || fileType === 'application/octet-stream') {
//         const inferredType = inferMimeTypeFromFilename(fileName);
//         if (inferredType) {
//           console.log(
//             `[Media Upload] Inferred MIME type from filename: ${fileName} -> ${inferredType}`,
//           );
//           finalFileType = inferredType;
//         }
//       }

//       // Validate MIME type
//       if (!ALLOWED_MIME_TYPES.includes(finalFileType)) {
//         console.error(
//           `[Media Upload Error] start_upload: Unsupported MIME type=${finalFileType} for uploadId=${uploadId}`,
//         );
//         socket.emit('upload_error', {
//           uploadId,
//           error: `Unsupported file type: ${finalFileType}. Supported: JPEG, PNG, GIF, WebP, HEIC, MP4, MOV, WebM`,
//         });
//         return;
//       }

//       try {
//         // Authorization: Verify socket user matches senderId
//         const socketUserId = socket.userId || socket.handshake.query?.userId;
//         if (socketUserId && socketUserId.toString() !== senderId.toString()) {
//           console.error(
//             `[Media Upload Error] start_upload: Socket user ${socketUserId} does not match sender ${senderId}`,
//           );
//           socket.emit('upload_error', {
//             uploadId,
//             error: 'Unauthorized: Socket user does not match sender',
//           });
//           return;
//         }

//         // Verify room exists and sender is a participant
//         const room = await ChatRoom.findById(roomId);
//         if (!room) {
//           console.error(
//             `[Media Upload Error] start_upload: Chat room not found for roomId=${roomId}`,
//           );
//           socket.emit('upload_error', {
//             uploadId,
//             error: 'Chat room not found',
//           });
//           return;
//         }

//         const senderUser = await User.findById(senderId);
//         if (!senderUser) {
//           console.error(
//             `[Media Upload Error] start_upload: Sender not found for senderId=${senderId}`,
//           );
//           socket.emit('upload_error', {
//             uploadId,
//             error: 'Sender user not found',
//           });
//           return;
//         }

//         const isStaff = ['admin', 'support', 'apprentice'].includes(
//           senderUser.role,
//         );
//         if (
//           !isStaff &&
//           room.homeOwnerId.toString() !== senderId.toString() &&
//           room.plumberId.toString() !== senderId.toString()
//         ) {
//           console.error(
//             `[Media Upload Error] start_upload: Sender ${senderId} is not authorized in room ${roomId}`,
//           );
//           socket.emit('upload_error', {
//             uploadId,
//             error: 'Access denied: You are not a participant in this room',
//           });
//           return;
//         }

//         // Clean up previous active upload if the client retries (allows resuming on reconnect)
//         const existing = activeUploads.get(uploadId);
//         if (existing) {
//           console.log(
//             `[Media Upload] Cleaning up previous upload session for uploadId=${uploadId}`,
//           );
//           if (existing.timeoutId) clearTimeout(existing.timeoutId);
//           existing.writeStream.end();
//           if (fs.existsSync(existing.tempFilePath)) {
//             try {
//               fs.unlinkSync(existing.tempFilePath);
//             } catch (e) {
//               console.warn(
//                 `[Media Upload] Failed to delete existing temp file: ${existing.tempFilePath}`,
//               );
//             }
//           }
//           activeUploads.delete(uploadId);
//         }

//         const tempFilePath = path.join(tempDir, `${uploadId}.upload`);
//         const writeStream = fs.createWriteStream(tempFilePath);

//         // Timeout (15 minutes for mobile network stability)
//         const timeoutId = setTimeout(
//           () => {
//             const up = activeUploads.get(uploadId);
//             if (up) {
//               console.log(
//                 `[Media Upload] Upload timeout for uploadId=${uploadId}`,
//               );
//               up.writeStream.end();
//               if (fs.existsSync(up.tempFilePath)) {
//                 try {
//                   fs.unlinkSync(up.tempFilePath);
//                 } catch (e) {
//                   // Cleanup failure is not critical
//                 }
//               }
//               activeUploads.delete(uploadId);
//               socket.emit('upload_error', {
//                 uploadId,
//                 error: 'Upload timed out after 15 minutes of inactivity',
//               });
//             }
//           },
//           15 * 60 * 1000,
//         );

//         activeUploads.set(uploadId, {
//           uploadId,
//           socketId: socket.id,
//           roomId,
//           senderId,
//           fileName,
//           fileType: finalFileType, // Use inferred type
//           fileSize: size,
//           totalChunks: chunks,
//           expectedChunkIndex: 0,
//           receivedChunks: 0,
//           tempFilePath,
//           writeStream,
//           timeoutId,
//           chunksWritten: new Set(),
//         });

//         console.log(
//           `[Media Upload] Upload session ready: uploadId=${uploadId}, roomId=${roomId}, senderId=${senderId}, fileName=${fileName}, fileType=${finalFileType}, fileSize=${size}, totalChunks=${chunks}, tempPath=${tempFilePath}`,
//         );
//         socket.emit('upload_ready', { uploadId });
//       } catch (err) {
//         console.error('Error starting upload:', err);
//         socket.emit('upload_error', {
//           uploadId,
//           error: 'Internal server error',
//         });
//       }
//     },
//   );

//   // Handle incoming file chunk
//   socket.on(
//     'upload_chunk',
//     async ({ uploadId, chunkIndex, chunkData }, callback) => {
//       const upload = activeUploads.get(uploadId);

//       const sendAck = () => {
//         const progress = Math.round(
//           (upload.receivedChunks / upload.totalChunks) * 100,
//         );
//         const progressPayload = {
//           uploadId,
//           chunkIndex,
//           progress,
//         };
//         if (upload.fileSize) {
//           progressPayload.receivedBytes =
//             upload.receivedChunks * (upload.fileSize / upload.totalChunks);
//           progressPayload.totalBytes = upload.fileSize;
//         }
//         console.log(
//           `[Media Upload] Chunk ACK: uploadId=${uploadId}, chunkIndex=${chunkIndex}, progress=${progress}%`,
//         );
//         socket.emit('upload_progress', progressPayload);

//         if (callback) {
//           callback({ status: 'ok', chunkIndex });
//         }
//         socket.emit('upload_chunk_ack', { uploadId, chunkIndex });
//       };

//       const handleFail = (errorMsg) => {
//         if (upload) {
//           if (upload.timeoutId) clearTimeout(upload.timeoutId);
//           upload.writeStream.end();
//           if (fs.existsSync(upload.tempFilePath)) {
//             try {
//               fs.unlinkSync(upload.tempFilePath);
//             } catch (e) {
//               // Cleanup failure is not critical
//             }
//           }
//           activeUploads.delete(uploadId);
//         }
//         console.error(
//           `[Media Upload] Chunk upload failed: uploadId=${uploadId}, error=${errorMsg}`,
//         );
//         socket.emit('upload_error', { uploadId, error: errorMsg });
//         if (callback) {
//           callback({ status: 'error', error: errorMsg });
//         }
//       };

//       if (!upload) {
//         console.error(
//           `[Media Upload] Upload session not found: uploadId=${uploadId}`,
//         );
//         handleFail('Upload session not found');
//         return;
//       }

//       if (upload.socketId !== socket.id) {
//         console.error(
//           `[Media Upload] Unauthorized socket: uploadId=${uploadId}, expectedSocket=${upload.socketId}, receivedSocket=${socket.id}`,
//         );
//         handleFail('Unauthorized: Chunk from different socket');
//         return;
//       }

//       const idx = parseInt(chunkIndex, 10);
//       if (isNaN(idx) || idx < 0 || idx >= upload.totalChunks) {
//         console.error(
//           `[Media Upload] Invalid chunk index: uploadId=${uploadId}, chunkIndex=${idx}, totalChunks=${upload.totalChunks}`,
//         );
//         handleFail(
//           `Invalid chunk index: ${idx} (valid: 0-${upload.totalChunks - 1})`,
//         );
//         return;
//       }

//       if (upload.chunksWritten.has(idx)) {
//         console.warn(
//           `[Media Upload] Duplicate chunk received: uploadId=${uploadId}, chunkIndex=${idx}. Skipping duplicate.`,
//         );
//         sendAck();
//         return;
//       }

//       if (idx !== upload.expectedChunkIndex) {
//         console.error(
//           `[Media Upload] Out of order chunk: uploadId=${uploadId}, expected=${upload.expectedChunkIndex}, received=${idx}`,
//         );
//         handleFail(
//           `Out of order chunk. Expected: ${upload.expectedChunkIndex}, got: ${idx}. Chunks must be sent sequentially.`,
//         );
//         return;
//       }

//       try {
//         // Convert chunkData to Buffer - handle multiple formats from mobile clients
//         let buffer;
//         let chunkSize = 0;

//         if (Buffer.isBuffer(chunkData)) {
//           buffer = chunkData;
//         } else if (chunkData instanceof ArrayBuffer) {
//           // Handle ArrayBuffer (Uint8Array) from mobile clients
//           buffer = Buffer.from(chunkData);
//         } else if (typeof chunkData === 'string') {
//           // Handle base64 string
//           const base64Content = chunkData.includes(';base64,')
//             ? chunkData.split(';base64,')[1]
//             : chunkData;
//           buffer = Buffer.from(base64Content, 'base64');
//         } else {
//           // Fallback: try to convert to Buffer
//           buffer = Buffer.from(chunkData);
//         }

//         chunkSize = buffer.length;

//         // Validate chunk size - prevent oversized chunks that exceed Socket.IO buffer
//         if (chunkSize <= 0 || chunkSize > MAX_CHUNK_SIZE) {
//           console.error(
//             `[Media Upload] Invalid chunk size: uploadId=${uploadId}, chunkIndex=${idx}, size=${chunkSize}B (max: ${MAX_CHUNK_SIZE}B)`,
//           );
//           handleFail(
//             `Chunk size invalid: ${chunkSize}B (max: ${Math.floor(
//               MAX_CHUNK_SIZE / 1024,
//             )}KB)`,
//           );
//           return;
//         }

//         if (upload.writeStream.writableEnded || upload.writeStream.destroyed) {
//           console.error(
//             `[Media Upload] Write stream is closed: uploadId=${uploadId}`,
//           );
//           handleFail('Write stream is closed');
//           return;
//         }

//         console.log(
//           `[Media Upload] Writing chunk: uploadId=${uploadId}, chunkIndex=${idx}, chunkSize=${chunkSize}B, totalChunks=${upload.totalChunks}`,
//         );

//         const writeSuccessful = upload.writeStream.write(buffer);
//         upload.chunksWritten.add(idx);
//         upload.receivedChunks++;
//         upload.expectedChunkIndex++;

//         const isLastChunk = upload.receivedChunks === upload.totalChunks;

//         const processCompleteUpload = () => {
//           console.log(
//             `[Media Upload] Final chunk received, closing stream: uploadId=${uploadId}`,
//           );
//           upload.writeStream.end();

//           upload.writeStream.on('finish', async () => {
//             try {
//               if (upload.timeoutId) clearTimeout(upload.timeoutId);

//               console.log(
//                 `[Media Upload] Stream finished, validating file: uploadId=${uploadId}`,
//               );

//               const stats = fs.statSync(upload.tempFilePath);
//               const finalFileSize = stats.size;

//               // Validate final file size
//               if (finalFileSize === 0) {
//                 console.error(
//                   `[Media Upload] File is empty: uploadId=${uploadId}, path=${upload.tempFilePath}`,
//                 );
//                 throw new Error('Final file size is zero (empty file)');
//               }

//               if (upload.fileSize && finalFileSize !== upload.fileSize) {
//                 console.warn(
//                   `[Media Upload] File size mismatch: uploadId=${uploadId}, expected=${upload.fileSize}B, actual=${finalFileSize}B`,
//                 );
//                 // Allow small variance for streaming uploads but reject if significantly different
//                 if (Math.abs(finalFileSize - upload.fileSize) > 1024) {
//                   throw new Error(
//                     `File size mismatch: expected ${upload.fileSize}B, got ${finalFileSize}B`,
//                   );
//                 }
//               }

//               if (finalFileSize > MAX_UPLOAD_SIZE) {
//                 console.error(
//                   `[Media Upload] File exceeds max size: uploadId=${uploadId}, size=${finalFileSize}B (max: ${MAX_UPLOAD_SIZE}B)`,
//                 );
//                 throw new Error(
//                   `File exceeds maximum size of ${Math.floor(
//                     MAX_UPLOAD_SIZE / 1024 / 1024,
//                   )}MB`,
//                 );
//               }

//               console.log(
//                 `[Media Upload] Validating magic bytes: uploadId=${uploadId}, fileType=${upload.fileType}`,
//               );
//               if (!validateMagicBytes(upload.tempFilePath, upload.fileType)) {
//                 console.error(
//                   `[Media Upload] Magic bytes validation failed: uploadId=${uploadId}, fileType=${upload.fileType}, path=${upload.tempFilePath}`,
//                 );
//                 throw new Error(
//                   `File magic bytes do not match declared type: ${upload.fileType}`,
//                 );
//               }

//               console.log(
//                 `[Media Upload] Starting S3 upload: uploadId=${uploadId}, fileSize=${finalFileSize}B`,
//               );

//               const fileStream = fs.createReadStream(upload.tempFilePath);
//               const extension = upload.fileName.split('.').pop() || 'bin';
//               const s3Folder = upload.fileType.startsWith('image/')
//                 ? 'images'
//                 : 'videos';
//               const uniqueS3Key = `PipeWyze/${s3Folder}/${crypto.randomUUID()}.${extension}`;

//               const command = new PutObjectCommand({
//                 Bucket: config.s3.S3_BUCKET_PATH,
//                 Key: uniqueS3Key,
//                 Body: fileStream,
//                 ContentType: upload.fileType,
//                 ContentLength: finalFileSize,
//               });

//               await s3.send(command);
//               console.log(
//                 `[Media Upload] S3 upload successful: uploadId=${uploadId}, key=${uniqueS3Key}, size=${finalFileSize}B`,
//               );

//               let fileUrl;
//               if (config.s3.cloudfrontUrl) {
//                 const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
//                 fileUrl = `${baseUrl}/${uniqueS3Key}`;
//               } else {
//                 fileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueS3Key}`;
//               }

//               console.log(
//                 `[Media Upload] Generated URL: uploadId=${uploadId}, url=${fileUrl}`,
//               );

//               // Delete temp file AFTER successful S3 upload
//               try {
//                 fs.unlinkSync(upload.tempFilePath);
//                 console.log(
//                   `[Media Upload] Deleted temp file: uploadId=${uploadId}`,
//                 );
//               } catch (unlinkErr) {
//                 console.warn(
//                   `[Media Upload] Failed to delete temp file: uploadId=${uploadId}, path=${upload.tempFilePath}, error=${unlinkErr.message}`,
//                 );
//               }

//               activeUploads.delete(uploadId);

//               // Create exactly ONE MongoDB message for this upload
//               console.log(
//                 `[Media Upload] Creating MongoDB message: uploadId=${uploadId}, roomId=${upload.roomId}, senderId=${upload.senderId}`,
//               );
//               const message = await Message.create({
//                 roomId: upload.roomId,
//                 senderId: upload.senderId,
//                 content: upload.fileName,
//                 fileUrl,
//                 fileType: upload.fileType,
//               });
//               console.log(
//                 `[Media Upload] Message created: uploadId=${uploadId}, messageId=${message._id}, fileUrl=${fileUrl}`,
//               );

//               // Update chat room with latest message
//               await ChatRoom.findByIdAndUpdate(upload.roomId, {
//                 lastMessage: message._id,
//               });
//               console.log(
//                 `[Media Upload] ChatRoom updated: uploadId=${uploadId}, roomId=${upload.roomId}`,
//               );

//               const populatedMessage = await message.populate(
//                 'senderId',
//                 'fullName profileimageurl',
//               );

//               // Emit to room (both participants)
//               console.log(
//                 `[Media Upload] Emitting new_message to room: uploadId=${uploadId}, roomId=${upload.roomId}`,
//               );
//               io.to(upload.roomId).emit('new_message', populatedMessage);

//               // Notify sender of successful upload
//               socket.emit('upload_success', {
//                 uploadId,
//                 messageId: message._id,
//                 fileUrl,
//               });
//               console.log(
//                 `[Media Upload] Sent upload_success to sender: uploadId=${uploadId}`,
//               );

//               // Notify counterpart (recipient)
//               const room = await ChatRoom.findById(upload.roomId);
//               if (room) {
//                 const counterpartId =
//                   room.homeOwnerId.toString() === upload.senderId.toString()
//                     ? room.plumberId
//                     : room.homeOwnerId;

//                 console.log(
//                   `[Media Upload] Notifying counterpart: uploadId=${uploadId}, counterpartId=${counterpartId}`,
//                 );

//                 // Emit new_message to counterpart's user room (they may not be in the active room)
//                 io.to(`user_${counterpartId.toString()}`).emit(
//                   'new_message',
//                   populatedMessage,
//                 );

//                 const senderUser = await User.findById(upload.senderId);
//                 const senderName = senderUser ? senderUser.fullName : 'Someone';

//                 // Emit in-app chat notification
//                 io.to(`user_${counterpartId.toString()}`).emit(
//                   'chat_notification',
//                   {
//                     roomId: upload.roomId.toString(),
//                     senderName,
//                     message: populatedMessage,
//                   },
//                 );

//                 // Send push notification
//                 notificationService
//                   .sendToUsers(
//                     [counterpartId.toString()],
//                     `New message from ${senderName}`,
//                     message.content || 'Sent an attachment',
//                     {
//                       roomId: upload.roomId.toString(),
//                       messageId: message._id.toString(),
//                     },
//                   )
//                   .catch((err) =>
//                     console.error(
//                       '[Media Upload] Failed sending notification:',
//                       err.message,
//                     ),
//                   );
//               }
//             } catch (err) {
//               console.error(
//                 `[Media Upload] Error completing file upload: uploadId=${uploadId}, error=${err.message}`,
//               );
//               handleFail(
//                 err.message ||
//                   'Failed to process completed file. Check server logs.',
//               );
//             }
//           });
//         };

//         if (isLastChunk) {
//           if (!writeSuccessful) {
//             upload.writeStream.once('drain', () => {
//               processCompleteUpload();
//             });
//           } else {
//             processCompleteUpload();
//           }
//         } else {
//           if (!writeSuccessful) {
//             upload.writeStream.once('drain', () => {
//               sendAck();
//             });
//           } else {
//             sendAck();
//           }
//         }
//       } catch (err) {
//         console.error(
//           `[Media Upload] Error writing chunk: uploadId=${uploadId}, chunkIndex=${idx}, error=${err.message}`,
//         );
//         handleFail(`Failed to write chunk data: ${err.message}`);
//       }
//     },
//   );

//   /// AI Assistant socket handler
//   socket.on(
//     'ask_ai',
//     async ({ message, userId: payloadUserId, fileUrl, fileType, fileName }) => {
//       const activeUserId = payloadUserId || socket.userId || userId;

//       console.log(
//         `[ask_ai] Received event from userId: ${activeUserId}, message: "${message}", file: "${
//           fileName || ''
//         }"`,
//       );

//       try {
//         const AiChat = require('./models/aiChat.model');

//         // Validate user ID
//         if (!activeUserId) {
//           console.warn('[ask_ai] User verification failed: missing user ID');

//           socket.emit('ai_error', {
//             message: 'User verification failed (missing user ID).',
//           });

//           return;
//         }

//         // Validate message and media url
//         if (
//           (!message || typeof message !== 'string' || !message.trim()) &&
//           !fileUrl
//         ) {
//           console.warn('[ask_ai] Empty AI message and no file received');

//           socket.emit('ai_error', {
//             message: 'Please enter a question or upload a file.',
//           });

//           return;
//         }

//         let cleanMessage = message ? message.trim() : '';

//         // Find user
//         const user = await User.findById(activeUserId);

//         if (!user) {
//           console.warn(`[ask_ai] User not found for ID: ${activeUserId}`);

//           socket.emit('ai_error', {
//             message: 'User not found in database.',
//           });

//           return;
//         }

//         // Handle socket media upload to S3
//         let finalFileUrl = fileUrl;
//         if (fileUrl && fileUrl.startsWith('data:')) {
//           const matches = fileUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
//           if (matches && matches.length === 3) {
//             const mimeType = matches[1];
//             const base64Data = matches[2];
//             const buffer = Buffer.from(base64Data, 'base64');

//             const extension = mimeType.split('/').pop() || 'bin';
//             const s3Folder = mimeType.startsWith('image/')
//               ? 'images'
//               : 'videos';
//             const uniqueKey = `PipeWyze/${s3Folder}/${crypto.randomUUID()}.${extension}`;

//             const command = new PutObjectCommand({
//               Bucket: config.s3.S3_BUCKET_PATH,
//               Key: uniqueKey,
//               Body: buffer,
//               ContentType: mimeType,
//             });

//             await s3.send(command);

//             if (config.s3.cloudfrontUrl) {
//               const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
//               finalFileUrl = `${baseUrl}/${uniqueKey}`;
//             } else {
//               finalFileUrl = `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;
//             }
//           }
//         }

//         if (!cleanMessage && finalFileUrl) {
//           let extractedFileName = fileName;
//           if (!extractedFileName) {
//             extractedFileName = finalFileUrl.substring(
//               finalFileUrl.lastIndexOf('/') + 1,
//             );
//             if (extractedFileName) {
//               extractedFileName = decodeURIComponent(
//                 extractedFileName.split('?')[0],
//               );
//             }
//           }
//           cleanMessage = extractedFileName || 'File';
//         }

//         // Get AI videos for user's role
//         const allVideos = await AiVideo.find({
//           targetAudience: user.role,
//         }).lean();

//         // Find relevant videos using simple keyword matching
//         const queryWords = cleanMessage
//           .toLowerCase()
//           .split(/\s+/)
//           .map((word) => word.replace(/[^\w]/g, ''))
//           .filter((word) => word.length > 3);

//         const matchedVideos = allVideos
//           .filter((video) => {
//             const title = (video.title || '').toLowerCase();
//             const description = (video.description || '').toLowerCase();

//             return queryWords.some(
//               (word) => title.includes(word) || description.includes(word),
//             );
//           })
//           .slice(0, 3);

//         console.log(
//           `[ask_ai] Total videos: ${allVideos.length}, matched videos: ${matchedVideos.length}`,
//         );

//         let suggestedVideo = null;
//         let aiMessage = '';

//         // If local videos match, we suggest the top local video directly
//         if (matchedVideos.length > 0) {
//           suggestedVideo = {
//             id: matchedVideos[0]._id || matchedVideos[0].id,
//             title: matchedVideos[0].title,
//             videoUrl: matchedVideos[0].videoUrl,
//             description: matchedVideos[0].description,
//             thumbnail: matchedVideos[0].thumbnail,
//             isYoutube: false,
//           };

//           aiMessage = `I found a highly relevant video tutorial in our library to help you: "${suggestedVideo.title}". You can watch it directly by clicking the link attached below.`;

//           console.log(
//             `[ask_ai] Local DB match found: "${suggestedVideo.title}". Bypassing OpenAI API.`,
//           );

//           // Save to database
//           await AiChat.create({
//             userId: activeUserId,
//             message: cleanMessage,
//             response: aiMessage,
//             suggestedVideo,
//             fileUrl: finalFileUrl || '',
//             fileType: fileType || '',
//             fileName: fileName || '',
//           });

//           socket.emit('ai_response', {
//             sender: 'ai',
//             message: aiMessage,
//             suggestedVideo,
//             fileUrl: finalFileUrl || '',
//             fileType: fileType || '',
//             fileName: fileName || '',
//           });

//           // Send push notification for AI response
//           notificationService
//             .sendToUsers(
//               [activeUserId.toString()],
//               'AI Assistant Response',
//               aiMessage,
//               {
//                 type: 'ai_chat',
//                 isAiChat: 'true',
//               },
//             )
//             .catch((err) =>
//               console.error(
//                 'Failed sending AI chat notification:',
//                 err.message,
//               ),
//             );

//           // Emit chat_notification for in-app toast/banner alerts when outside the chat route
//           io.to(`user_${activeUserId.toString()}`).emit('chat_notification', {
//             roomId: 'ai',
//             senderName: 'AI Assistant',
//             message: {
//               sender: 'ai',
//               message: aiMessage,
//               suggestedVideo,
//               fileUrl: finalFileUrl || '',
//               fileType: fileType || '',
//               fileName: fileName || '',
//               createdAt: new Date(),
//             },
//           });
//           return;
//         }

//         console.log(
//           '[ask_ai] No local video match found in database. Querying OpenAI with YouTube fallback instructions...',
//         );

//         // Check OpenAI API key
//         const openaiApiKey = process.env.OPENAI_API_KEY;

//         if (!openaiApiKey) {
//           console.warn('[ask_ai] OpenAI API key not configured');

//           socket.emit('ai_error', {
//             message:
//               'AI Assistant is currently unavailable. OpenAI API key is not configured.',
//           });

//           return;
//         }

//         // Prepare OpenAI request
//         const systemPrompt = `You are the PipeWyze AI helper.

// User role: "${user.role}"

// Rules:
// 1. Answer the user's question clearly, professionally, and keep it under 3 sentences.
// 2. If the user's query is a general greeting, appreciation, or conversational message (e.g. "hi", "hello", "thanks", "how are you"), reply normally and politely. Do NOT provide a YouTube link.
// 3. If the user is asking a technical plumbing question, provide a helpful YouTube search link that demonstrates the solution.
// 4. Your response MUST end with a JSON object wrapped in code block structured exactly like:
// {
//   "youtubeTitle": "YouTube Demonstration Title",
//   "youtubeUrl": "https://www.youtube.com/results?search_query=..."
// }
// For general conversation or greetings, you MUST set "youtubeUrl" to null.
// `;

//         console.log('[ask_ai] Querying OpenAI Chat Completions API...');

//         // Build OpenAI user message content (multimodal if image, or inline text representation)
//         let openAiUserContent;
//         if (finalFileUrl && fileType && fileType.startsWith('image/')) {
//           openAiUserContent = [
//             {
//               type: 'text',
//               text: cleanMessage || 'Analyze this image',
//             },
//             {
//               type: 'image_url',
//               image_url: {
//                 url: finalFileUrl,
//               },
//             },
//           ];
//         } else if (finalFileUrl) {
//           openAiUserContent = `${cleanMessage} (Attached file: ${
//             fileName || 'file'
//           } - ${finalFileUrl})`.trim();
//         } else {
//           openAiUserContent = cleanMessage;
//         }

//         // Call OpenAI
//         const openAiResponse = await axios.post(
//           'https://api.openai.com/v1/chat/completions',
//           {
//             model: 'gpt-4o-mini',

//             messages: [
//               {
//                 role: 'system',
//                 content: systemPrompt,
//               },
//               {
//                 role: 'user',
//                 content: openAiUserContent,
//               },
//             ],

//             max_tokens: 250,

//             temperature: 0.3,
//           },
//           {
//             headers: {
//               Authorization: `Bearer ${openaiApiKey}`,
//               'Content-Type': 'application/json',
//             },

//             // Prevent the request from hanging indefinitely
//             timeout: 30000,
//           },
//         );

//         // Extract AI response safely
//         const rawAiMessage =
//           openAiResponse?.data?.choices?.[0]?.message?.content?.trim();

//         if (!rawAiMessage) {
//           console.error('[ask_ai] OpenAI returned an empty response');

//           socket.emit('ai_error', {
//             message: 'AI Assistant returned an empty response.',
//           });

//           return;
//         }

//         console.log(`[ask_ai] OpenAI Raw response: "${rawAiMessage}"`);

//         // Parse the JSON blocks out of rawAiMessage if any
//         let cleanResponseText = rawAiMessage;
//         const jsonMatch = rawAiMessage.match(/\{[\s\S]*?\}/);
//         let hasCheckedVideo = false;
//         if (jsonMatch) {
//           try {
//             const parsedJson = JSON.parse(jsonMatch[0]);
//             hasCheckedVideo = true;
//             if (parsedJson.youtubeUrl) {
//               suggestedVideo = {
//                 id: null,
//                 title: parsedJson.youtubeTitle || 'YouTube Demonstration',
//                 videoUrl: parsedJson.youtubeUrl,
//                 description: 'YouTube search result for demonstration',
//                 thumbnail: '',
//                 isYoutube: true,
//               };
//             } else {
//               suggestedVideo = null;
//             }
//             cleanResponseText = rawAiMessage
//               .replace(/```json[\s\S]*?```|```[\s\S]*?```|\{[\s\S]*?\}/g, '')
//               .trim();
//           } catch (err) {
//             console.error(
//               '[ask_ai] Failed to parse JSON block from OpenAI response:',
//               err,
//             );
//           }
//         }

//         if (!suggestedVideo && !hasCheckedVideo) {
//           // Fallback fallback if JSON extraction fails: construct search query from prompt words
//           const searchQuery = encodeURIComponent(cleanMessage);
//           suggestedVideo = {
//             id: null,
//             title: 'Search YouTube',
//             videoUrl: `https://www.youtube.com/results?search_query=${searchQuery}`,
//             description: 'Watch video tutorials on YouTube',
//             thumbnail: '',
//             isYoutube: true,
//           };
//         }

//         aiMessage =
//           cleanResponseText || 'Here is a video demonstrating the solution:';

//         // Save to database
//         await AiChat.create({
//           userId: activeUserId,
//           message: cleanMessage,
//           response: aiMessage,
//           suggestedVideo,
//           fileUrl: finalFileUrl || '',
//           fileType: fileType || '',
//           fileName: fileName || '',
//         });

//         // Send successful response to frontend
//         socket.emit('ai_response', {
//           sender: 'ai',
//           message: aiMessage,
//           suggestedVideo,
//           fileUrl: finalFileUrl || '',
//           fileType: fileType || '',
//           fileName: fileName || '',
//         });

//         // Send push notification for AI response
//         notificationService
//           .sendToUsers(
//             [activeUserId.toString()],
//             'AI Assistant Response',
//             aiMessage,
//             {
//               type: 'ai_chat',
//               isAiChat: 'true',
//             },
//           )
//           .catch((err) =>
//             console.error('Failed sending AI chat notification:', err.message),
//           );

//         // Emit chat_notification for in-app toast/banner alerts when outside the chat route
//         io.to(`user_${activeUserId.toString()}`).emit('chat_notification', {
//           roomId: 'ai',
//           senderName: 'AI Assistant',
//           message: {
//             sender: 'ai',
//             message: aiMessage,
//             suggestedVideo,
//             fileUrl: finalFileUrl || '',
//             fileType: fileType || '',
//             fileName: fileName || '',
//             createdAt: new Date(),
//           },
//         });
//       } catch (err) {
//         // ERROR HANDLING
//         console.error('[ask_ai] AI Assistant error:', err.message);

//         // OpenAI HTTP errors
//         if (err.response) {
//           const status = err.response.status;
//           const data = err.response.data;

//           console.error('[ask_ai] OpenAI response status:', status);
//           console.error('[ask_ai] OpenAI response data:', data);

//           // 429 - Too Many Requests / Quota / Rate Limit
//           if (status === 429) {
//             console.warn('[ask_ai] OpenAI returned 429 Too Many Requests');

//             socket.emit('ai_error', {
//               message:
//                 'AI service is temporarily unavailable. Please try again shortly.',
//               code: 'OPENAI_RATE_LIMIT',
//             });

//             return;
//           }

//           // 401 - Invalid API key
//           if (status === 401) {
//             console.error('[ask_ai] OpenAI API key is invalid or unauthorized');

//             socket.emit('ai_error', {
//               message:
//                 'AI Assistant configuration error. Please contact the administrator.',
//               code: 'OPENAI_AUTH_ERROR',
//             });

//             return;
//           }

//           // 403 - Permission error
//           if (status === 403) {
//             console.error('[ask_ai] OpenAI API request was forbidden');

//             socket.emit('ai_error', {
//               message:
//                 'AI Assistant does not have permission to process this request.',
//               code: 'OPENAI_FORBIDDEN',
//             });

//             return;
//           }

//           // 400 - Bad request
//           if (status === 400) {
//             console.error('[ask_ai] OpenAI rejected the request');

//             socket.emit('ai_error', {
//               message:
//                 'The AI request was invalid. Please try asking the question differently.',
//               code: 'OPENAI_BAD_REQUEST',
//             });

//             return;
//           }

//           // 500 / 502 / 503 - OpenAI server problems
//           if (status >= 500) {
//             console.error(`[ask_ai] OpenAI server error: ${status}`);

//             socket.emit('ai_error', {
//               message:
//                 'AI service is temporarily unavailable. Please try again later.',
//               code: 'OPENAI_SERVER_ERROR',
//             });

//             return;
//           }
//         }

//         // Axios timeout
//         if (err.code === 'ECONNABORTED') {
//           console.error('[ask_ai] OpenAI request timed out');

//           socket.emit('ai_error', {
//             message: 'AI Assistant took too long to respond. Please try again.',
//             code: 'OPENAI_TIMEOUT',
//           });

//           return;
//         }

//         // Network error
//         if (err.request && !err.response) {
//           console.error('[ask_ai] No response received from OpenAI');

//           socket.emit('ai_error', {
//             message:
//               'Unable to connect to the AI service. Please try again later.',
//             code: 'OPENAI_NETWORK_ERROR',
//           });

//           return;
//         }

//         // Unknown error
//         console.error('[ask_ai] Unknown error:', err.message);

//         socket.emit('ai_error', {
//           message: 'Failed to generate response from AI Assistant.',
//           code: 'AI_UNKNOWN_ERROR',
//         });
//       }
//     },
//   );

//   socket.on('disconnect', async () => {
//     console.log('user disconnected:', socket.id);

//     const activeUserId = socket.userId || userId;
//     // Check if the user has other active connections (e.g. other tabs/devices)
//     if (activeUserId) {
//       const sockets = await io.fetchSockets();
//       const hasOtherSockets = sockets.some(
//         (s) =>
//           ((s.handshake.query.userId &&
//             String(s.handshake.query.userId) === String(activeUserId)) ||
//             (s.userId && String(s.userId) === String(activeUserId))) &&
//           s.id !== socket.id,
//       );
//       if (!hasOtherSockets) {
//         User.findByIdAndUpdate(activeUserId, { isOnline: false })
//           .exec()
//           .then(() =>
//             console.log(`User disconnected & marked offline: ${activeUserId}`),
//           )
//           .catch((err) => console.error(err));
//         io.emit('user_status_changed', {
//           userId: activeUserId,
//           isOnline: false,
//         });
//       }
//     }

//     // Cleanup streaming upload state
//     for (const [uploadId, upload] of activeUploads.entries()) {
//       if (upload.socketId === socket.id) {
//         if (upload.timeoutId) clearTimeout(upload.timeoutId);
//         upload.writeStream.end();
//         if (fs.existsSync(upload.tempFilePath)) {
//           try {
//             fs.unlinkSync(upload.tempFilePath);
//           } catch (err) {
//             console.error(
//               `Failed to delete temp file ${upload.tempFilePath}:`,
//               err,
//             );
//           }
//         }
//         activeUploads.delete(uploadId);
//       }
//     }
//   });
// });

// const socketPort = config.socketPort || 4000;
// var server = http.listen(socketPort, () => {
//   console.log('server is running on port', server.address().port);
// });


/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const config = require('./config/config');
const ChatRoom = require('./models/chatRoom.model');
const Message = require('./models/message.model');
const User = require('./models/user.model');
const AiVideo = require('./models/aiVideo.model');
const AiChat = require('./models/aiChat.model');
const notificationService = require('./services/notification.service');

// -----------------------------------------------------------------------------
// S3 CONFIGURATION & HELPER
// -----------------------------------------------------------------------------
const s3 = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

async function uploadBase64ToS3(base64Payload, declaredFileType) {
  let mimeType = declaredFileType || 'image/jpeg';
  let cleanBase64 = base64Payload;

  // 1. Strip Markdown links, brackets, or accidental URL encapsulation
  if (typeof cleanBase64 === 'string') {
    cleanBase64 = cleanBase64.replace(/\]\(http[^\)]+\)/g, '').trim();
  }

  // 2. Extract MIME from data URI scheme if provided
  if (cleanBase64.startsWith('data:')) {
    const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      cleanBase64 = matches[2];
    } else {
      cleanBase64 = cleanBase64.split(';base64,')[1] || cleanBase64;
    }
  }

  // 3. Remove whitespace and newlines from Base64 string
  cleanBase64 = cleanBase64.replace(/\s/g, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  // 4. Resolve clean extension
  let extension = mimeType.split('/').pop().toLowerCase();
  if (extension === 'quicktime') extension = 'mov';
  if (extension === 'jpeg') extension = 'jpg';

  const folder = mimeType.startsWith('video/') ? 'videos' : 'images';
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const uniqueKey = `PipeWyze/${folder}/${fileName}`;

  // 5. Send to S3 with explicit ContentType and ContentLength
  const command = new PutObjectCommand({
    Bucket: config.s3.S3_BUCKET_PATH,
    Key: uniqueKey,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
  });

  const uploadResult = await s3.send(command);
  console.log(`[S3 Upload Success] ETag: ${uploadResult.ETag}, Key: ${uniqueKey}`);

  // 6. Generate clean URL
  const fileUrl = config.s3.cloudfrontUrl
    ? `${config.s3.cloudfrontUrl.replace(/\/$/, '')}/${uniqueKey}`
    : `https://${config.s3.S3_BUCKET_PATH}.s3.${config.s3.region}.amazonaws.com/${uniqueKey}`;

  return { fileUrl, fileType: mimeType };
}

const extractUserId = (socket) => {
  let userId = socket.handshake.query?.userId || socket.handshake.auth?.userId;
  const rawToken =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization ||
    socket.handshake.query?.token;

  if (rawToken) {
    try {
      const token = rawToken.startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
      const data = jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algo || 'HS256'],
      });
      if (data && data.sub) {
        userId = data.sub;
      }
    } catch (err) {
      console.error('[Socket Auth] Token verification failed:', err.message);
    }
  }
  return userId ? userId.toString() : null;
};

// -----------------------------------------------------------------------------
// STANDALONE SOCKET SERVER SETUP
// -----------------------------------------------------------------------------
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 100 * 1024 * 1024, // 100 MB max buffer for base64 media payloads
  pingTimeout: 60000,
  pingInterval: 25000,
});
global.io = io;

app.use(express.static(__dirname));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '100mb' }));

io.on('connection', async (socket) => {
  let userId = extractUserId(socket);

  const initUser = async (uid) => {
    socket.userId = uid;
    socket.join(`user_${uid}`);

    await User.findByIdAndUpdate(uid, { isOnline: true }).catch((err) => console.error(err));
    io.emit('user_status_changed', { userId: uid, isOnline: true });

    const rooms = await ChatRoom.find({
      $or: [{ homeOwnerId: uid }, { plumberId: uid }],
    });
    rooms.forEach((room) => socket.join(room._id.toString()));
    console.log(`[User Connected] User ${uid} connected & joined ${rooms.length} rooms`);
  };

  if (userId) {
    await initUser(userId);
  }

  socket.on('user_connected', async ({ userId: connectedUserId }) => {
    if (!connectedUserId) return;
    await initUser(connectedUserId.toString());
  });

  // ---------------------------------------------------------------------------
  // EVENT: join_room
  // ---------------------------------------------------------------------------
  socket.on('join_room', async ({ roomId, userId: payloadUserId }) => {
    if (!roomId) {
      socket.emit('chat_error', { message: 'roomId is required' });
      return;
    }
    socket.join(roomId);
    const activeUserId = (payloadUserId || socket.userId || userId || '').toString();

    if (activeUserId) {
      socket.userId = activeUserId;
      socket.join(`user_${activeUserId}`);

      try {
        await Message.updateMany(
          { roomId, senderId: { $ne: activeUserId }, read: false },
          { $set: { read: true } },
        );
        socket.to(roomId).emit('messages_read', { roomId, readerId: activeUserId });

        const messages = await Message.find({ roomId })
          .populate('senderId', 'fullName profileimageurl')
          .sort({ createdAt: 1 });

        socket.emit('message_history', messages);

        const room = await ChatRoom.findById(roomId);
        if (room) {
          const counterpartId =
            room.homeOwnerId.toString() === activeUserId
              ? room.plumberId.toString()
              : room.homeOwnerId.toString();
          const counterpartUser = await User.findById(counterpartId);
          if (counterpartUser) {
            socket.emit('user_status_changed', {
              userId: counterpartId,
              isOnline: counterpartUser.isOnline,
            });
          }
        }
      } catch (error) {
        console.error('Error in join_room:', error.message);
        socket.emit('chat_error', { message: 'Internal server error in join_room.' });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // EVENT: send_message (Base64 Media & Text Chat)
  // ---------------------------------------------------------------------------
  // socket.on('send_message', async ({ roomId, senderId, receiverId, content, fileUrl, fileType, fileName }) => {
  //   try {
  //     if (!roomId || !senderId || (!content && !fileUrl)) {
  //       socket.emit('chat_error', { message: 'Missing roomId, senderId, or content/file.' });
  //       return;
  //     }

  //     const senderUser = await User.findById(senderId);
  //     if (!senderUser) {
  //       socket.emit('chat_error', { message: 'Sender not found.' });
  //       return;
  //     }

  //     let room = await ChatRoom.findById(roomId);
  //     if (!room && receiverId) {
  //       const sRole = senderUser.role;
  //       const homeOwnerId = sRole === 'licensed-plumber' ? receiverId : senderId;
  //       const plumberId = sRole === 'licensed-plumber' ? senderId : receiverId;

  //       room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });
  //       const sockets = await io.fetchSockets();
  //       sockets.forEach((s) => s.join(roomId));
  //     }

  //     socket.join(roomId);

  //     let finalFileUrl = null;
  //     let finalFileType = fileType || null;

  //     // Handle Base64 strings vs direct HTTP/S3 URLs
  //     if (fileUrl) {
  //       if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
  //         finalFileUrl = fileUrl;
  //       } else {
  //         try {
  //           console.log(`[Media Upload] Processing Base64 media for room: ${roomId}`);
  //           const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
  //           finalFileUrl = uploadResult.fileUrl;
  //           finalFileType = uploadResult.fileType;
  //           console.log(`[Media Upload] S3 upload successful: ${finalFileUrl}`);
  //         } catch (uploadErr) {
  //           console.error('[Media Upload Error] S3 upload failed:', uploadErr.message);
  //           socket.emit('chat_error', { message: 'Media upload failed.' });
  //           return;
  //         }
  //       }
  //     }

  //     // Infer fileType from URL extension if not supplied
  //     if (!finalFileType && finalFileUrl) {
  //       const cleanUrl = finalFileUrl.split('?')[0].toLowerCase();
  //       if (/\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(cleanUrl)) {
  //         finalFileType = 'video/mp4';
  //       } else if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(cleanUrl)) {
  //         finalFileType = 'image/jpeg';
  //       }
  //     }

  //     // Determine if media is a video
  //     const isVideo =
  //       (finalFileType && finalFileType.startsWith('video/')) ||
  //       /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

  //     // Content fallback rules: "Video" vs "Photo"
  //     let finalContent = typeof content === 'string' ? content.trim() : '';

  //     const isUuidOrFilename =
  //       finalContent === fileName ||
  //       /^[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+$/.test(finalContent) ||
  //       /\.(mp4|mov|jpg|jpeg|png|webp|heic)$/i.test(finalContent);

  //     if ((!finalContent || isUuidOrFilename) && finalFileUrl) {
  //       finalContent = isVideo ? 'Video' : 'Photo';
  //     }

  //     const message = await Message.create({
  //       roomId,
  //       senderId,
  //       content: finalContent || (isVideo ? 'Video' : 'Photo'),
  //       fileUrl: finalFileUrl,
  //       fileType: finalFileType,
  //     });

  //     if (room) {
  //       await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });
  //     }

  //     const populatedMessage = await message.populate('senderId', 'fullName profileimageurl');

  //     // Realtime room emission
  //     io.to(roomId).emit('new_message', populatedMessage);

  //     if (room) {
  //       const counterpartId =
  //         room.homeOwnerId.toString() === senderId.toString()
  //           ? room.plumberId.toString()
  //           : room.homeOwnerId.toString();

  //       io.to(`user_${counterpartId}`).emit('new_message', populatedMessage);
  //       io.to(`user_${counterpartId}`).emit('chat_notification', {
  //         roomId,
  //         senderName: senderUser.fullName || 'Someone',
  //         message: populatedMessage,
  //       });

  //       notificationService
  //         .sendToUsers(
  //           [counterpartId],
  //           `New message from ${senderUser.fullName || 'Someone'}`,
  //           finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
  //           { roomId: roomId.toString(), messageId: message._id.toString() },
  //         )
  //         .catch((err) => console.error('[Push Notification Error]:', err.message));
  //     }
  //   } catch (error) {
  //     console.error('[send_message Error]:', error.message);
  //     socket.emit('chat_error', { message: 'Failed to send message.' });
  //   }
  // });

  socket.on('send_message', async ({ roomId, senderId, receiverId, content, fileUrl, fileType, fileName }) => {
  try {
    if (!roomId || !senderId || (!content && !fileUrl)) {
      socket.emit('chat_error', { message: 'Missing roomId, senderId, or content/file.' });
      return;
    }

    const senderUser = await User.findById(senderId);
    if (!senderUser) {
      socket.emit('chat_error', { message: 'Sender not found.' });
      return;
    }

    let room = await ChatRoom.findById(roomId);
    if (!room && receiverId) {
      const sRole = senderUser.role;
      const homeOwnerId = sRole === 'licensed-plumber' ? receiverId : senderId;
      const plumberId = sRole === 'licensed-plumber' ? senderId : receiverId;

      room = await ChatRoom.create({ _id: roomId, homeOwnerId, plumberId });
      const sockets = await io.fetchSockets();
      sockets.forEach((s) => s.join(roomId));
    }

    socket.join(roomId);

    let finalFileUrl = null;
    let finalFileType = fileType || null;

    // 1. Process Base64 fileUrl or uploaded HTTP/S3 link
    if (fileUrl) {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        finalFileUrl = fileUrl;
      } else {
        try {
          const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
          finalFileUrl = uploadResult.fileUrl;
          finalFileType = uploadResult.fileType;
        } catch (uploadErr) {
          console.error('[Media Upload Error] S3 upload failed:', uploadErr.message);
          socket.emit('chat_error', { message: 'Media upload failed.' });
          return;
        }
      }
    }

    // 2. Infer MIME type if missing
    if (!finalFileType && finalFileUrl) {
      const cleanUrl = finalFileUrl.split('?')[0].toLowerCase();
      if (/\.(mp4|mov|quicktime|webm|m4v|3gp)$/.test(cleanUrl)) {
        finalFileType = 'video/mp4';
      } else if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(cleanUrl)) {
        finalFileType = 'image/jpeg';
      }
    }

    const isVideo =
      (finalFileType && finalFileType.startsWith('video/')) ||
      /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

    // 3. Strict content sanitization (Prevents raw Base64 string text dumps)
    let finalContent = typeof content === 'string' ? content.trim() : '';

    const isBase64String =
      finalContent.startsWith('data:') ||
      finalContent.length > 200 ||
      /^[a-zA-Z0-9+/=]{100,}$/.test(finalContent.replace(/\s/g, '')) ||
      finalContent === fileName ||
      /\.(mp4|mov|jpg|jpeg|png|webp|heic)$/i.test(finalContent);

    if (!finalContent || isBase64String) {
      if (finalFileUrl) {
        finalContent = isVideo ? 'Video' : 'Photo';
      } else {
        finalContent = '';
      }
    }

    // 4. Create single message entry
    const message = await Message.create({
      roomId,
      senderId,
      content: finalContent || (isVideo ? 'Video' : 'Photo'),
      fileUrl: finalFileUrl,
      fileType: finalFileType,
    });

    if (room) {
      await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });
    }

    const populatedMessage = await message.populate('senderId', 'fullName profileimageurl');
    io.to(roomId).emit('new_message', populatedMessage);

    if (room) {
      const counterpartId =
        room.homeOwnerId.toString() === senderId.toString()
          ? room.plumberId.toString()
          : room.homeOwnerId.toString();

      io.to(`user_${counterpartId}`).emit('new_message', populatedMessage);
      io.to(`user_${counterpartId}`).emit('chat_notification', {
        roomId,
        senderName: senderUser.fullName || 'Someone',
        message: populatedMessage,
      });

      notificationService
        .sendToUsers(
          [counterpartId],
          `New message from ${senderUser.fullName || 'Someone'}`,
          finalContent || (isVideo ? 'Sent a video' : 'Sent a photo'),
          { roomId: roomId.toString(), messageId: message._id.toString() },
        )
        .catch((err) => console.error('[Push Notification Error]:', err.message));
    }
  } catch (error) {
    console.error('[send_message Error]:', error.message);
    socket.emit('chat_error', { message: 'Failed to send message.' });
  }
});

  // ---------------------------------------------------------------------------
  // EVENT: ask_ai (AI Assistant)
  // ---------------------------------------------------------------------------
  socket.on('ask_ai', async ({ message, userId: payloadUserId, fileUrl, fileType, fileName }) => {
    const activeUserId = payloadUserId || socket.userId || userId;
    try {
      if (!activeUserId) {
        socket.emit('ai_error', { message: 'User verification failed: missing user ID.' });
        return;
      }
      if ((!message || !message.trim()) && !fileUrl) {
        socket.emit('ai_error', { message: 'Please enter a question or upload a file.' });
        return;
      }
      const user = await User.findById(activeUserId);
      if (!user) {
        socket.emit('ai_error', { message: 'User not found in database.' });
        return;
      }

      let finalFileUrl = fileUrl || '';
      let finalFileType = fileType || '';

      if (fileUrl && !fileUrl.startsWith('http')) {
        try {
          const uploadResult = await uploadBase64ToS3(fileUrl, fileType);
          finalFileUrl = uploadResult.fileUrl;
          finalFileType = uploadResult.fileType;
        } catch (e) {
          console.error('[AI Base64 Upload Error]:', e.message);
        }
      }

      const isVideo =
        (finalFileType && finalFileType.startsWith('video/')) ||
        /\.(mp4|mov|quicktime|webm|m4v|3gp)$/i.test(finalFileUrl || fileName || '');

      let cleanMessage = message ? message.trim() : (isVideo ? 'Video' : 'Photo');
      const allVideos = await AiVideo.find({ targetAudience: user.role }).lean();
      const queryWords = cleanMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchedVideos = allVideos.filter((video) =>
        queryWords.some((word) => (video.title || '').toLowerCase().includes(word)),
      );

      let suggestedVideo = null;
      let aiMessage = '';

      if (matchedVideos.length > 0) {
        suggestedVideo = {
          id: matchedVideos[0]._id || matchedVideos[0].id,
          title: matchedVideos[0].title,
          videoUrl: matchedVideos[0].videoUrl,
          description: matchedVideos[0].description,
          thumbnail: matchedVideos[0].thumbnail,
          isYoutube: false,
        };
        aiMessage = `I found a tutorial video in our library: "${suggestedVideo.title}".`;
      } else {
        aiMessage = 'I am looking into this plumbing question for you.';
      }

      await AiChat.create({
        userId: activeUserId,
        message: cleanMessage,
        response: aiMessage,
        suggestedVideo,
        fileUrl: finalFileUrl || '',
        fileType: finalFileType || '',
        fileName: fileName || '',
      });

      socket.emit('ai_response', {
        sender: 'ai',
        message: aiMessage,
        suggestedVideo,
        fileUrl: finalFileUrl || '',
        fileType: finalFileType || '',
        fileName: fileName || '',
      });
    } catch (err) {
      console.error('[ask_ai Error]:', err.message);
      socket.emit('ai_error', { message: 'Failed to generate response from AI Assistant.' });
    }
  });

  socket.on('disconnect', async () => {
    const activeUserId = socket.userId || userId;
    if (activeUserId) {
      const sockets = await io.fetchSockets();
      const hasOtherSockets = sockets.some((s) => s.userId === activeUserId && s.id !== socket.id);
      if (!hasOtherSockets) {
        User.findByIdAndUpdate(activeUserId, { isOnline: false })
          .exec()
          .then(() => console.log(`User disconnected & marked offline: ${activeUserId}`))
          .catch((err) => console.error(err));
        io.emit('user_status_changed', {
          userId: activeUserId,
          isOnline: false,
        });
      }
    }
  });
});

const socketPort = config.socketPort || 4000;
server.listen(socketPort, () => {
  console.log('Socket.IO server running on port:', socketPort);
});

module.exports = { io, server };