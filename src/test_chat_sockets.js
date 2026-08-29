const io = require('socket.io-client');
const fs = require('fs');
const crypto = require('crypto');

const SOCKET_URL = 'http://localhost:4000';
const HOME_OWNER_ID = '6a4cb84204fd8bd1ca92e0e0';
const PLUMBER_ID = '6a4dd3e8d6dac5e17091a475';
const ROOM_ID = '6a83ece5a73046018f8870b9';

console.log('=============================================');
console.log('PipeWyze Socket and Chat Test Suite Starting');
console.log('=============================================\n');

function connectSocket(userId) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      forceNew: true,
      query: { userId }
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Connection timeout for user ${userId}`));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`[Socket] Connected successfully for user ${userId}`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function runChunkUploadTest(socket, fileName, fileType, headerBytes) {
  return new Promise((resolve) => {
    const uploadId = crypto.randomUUID();
    const dummyBody = Buffer.alloc(100, 0);
    const fileBuffer = Buffer.concat([headerBytes, dummyBody]);
    const fileSize = fileBuffer.length;
    const totalChunks = 1;

    console.log(`Initiating start_upload for ${fileName} (${fileType}, ${fileSize} bytes)`);

    socket.once('upload_ready', ({ uploadId: readyUploadId }) => {
      console.log(`[Upload] Upload Ready for ID: ${readyUploadId}`);
      
      socket.once('upload_success', (data) => {
        console.log(`✔ Gallery file "${fileName}" uploaded successfully!`);
        resolve(true);
      });

      socket.once('upload_error', (error) => {
        console.log(`❌ Upload failed for "${fileName}" with error:`, error);
        resolve(false);
      });

      socket.emit('upload_chunk', {
        uploadId,
        chunkIndex: 0,
        chunkData: fileBuffer
      });
    });

    socket.once('upload_error', (error) => {
      console.log(`❌ Upload init failed for "${fileName}":`, error);
      resolve(false);
    });

    socket.emit('start_upload', {
      uploadId,
      roomId: ROOM_ID,
      senderId: HOME_OWNER_ID,
      fileName,
      fileType,
      fileSize,
      totalChunks
    });
  });
}

async function runTests() {
  let homeownerSocket;
  let plumberSocket;

  try {
    // -------------------------------------------------------------
    // Test 1: Sockets Connection
    // -------------------------------------------------------------
    console.log('--- TEST 1: Socket Connections ---');
    homeownerSocket = await connectSocket(HOME_OWNER_ID);
    plumberSocket = await connectSocket(PLUMBER_ID);
    console.log('✔ Socket connections established.\n');

    // -------------------------------------------------------------
    // Test 2: image/jpg MIME type upload (common on Android/web gallery pickers)
    // -------------------------------------------------------------
    console.log('--- TEST 2: Gallery Image Upload with "image/jpg" MIME type ---');
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
    const res1 = await runChunkUploadTest(homeownerSocket, 'my_photo.jpg', 'image/jpg', jpegHeader);
    if (res1) console.log('✔ image/jpg upload test passed!\n');

    // -------------------------------------------------------------
    // Test 3: application/octet-stream MIME type upload (common fallback for iOS/Android)
    // -------------------------------------------------------------
    console.log('--- TEST 3: Gallery Image Upload with "application/octet-stream" fallback ---');
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const res2 = await runChunkUploadTest(homeownerSocket, 'unresolved_media_type', 'application/octet-stream', pngHeader);
    if (res2) console.log('✔ application/octet-stream upload test passed!\n');

  } catch (err) {
    console.error('An error occurred during testing:', err);
  } finally {
    console.log('Cleaning up socket connections...');
    if (homeownerSocket) homeownerSocket.disconnect();
    if (plumberSocket) plumberSocket.disconnect();
    console.log('Done.');
  }
}

runTests();
