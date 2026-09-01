const app = require('./app');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const cron = require('node-cron');
const logger = require('./config/logger');
const config = require('./config/config');
const Setting = require('./models/setting.model');
const notificationService = require('./services/notification.service');

let server;

mongoose.connect(config.mongoose.url).then(() => {
  logger.info('Connected to MongoDB');

  // Start main API server
  server = app.listen(config.port, () => {
    logger.info(`Listening on port ${config.port}, Mode: ${config.env}`);
  });

  // Start and initialize the standalone Socket.IO server
  require('./socket');

  // Service reminder cron job - runs daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      const Equipment = require('./models/equipment.model');
      const targetDateStart = moment().add(3, 'days').startOf('day').toDate();
      const targetDateEnd = moment().add(3, 'days').endOf('day').toDate();
      const upcomingServices = await Equipment.find({
        nextServiceDate: {
          $gte: targetDateStart,
          $lte: targetDateEnd,
        },
      });
      for (const eq of upcomingServices) {
        if (eq.ownerId) {
          const brandModel =
            `${eq.brand || ''} ${eq.model || ''}`.trim() || eq.category;
          await notificationService
            .sendToUsers(
              [eq.ownerId.toString()],
              'Upcoming Equipment Service Reminder',
              `Your ${brandModel} is scheduled for service on ${moment(
                eq.nextServiceDate,
              ).format('YYYY-MM-DD')}.`,
              {
                type: 'maintenance',
                equipmentId: eq._id.toString(),
              },
            )
            .catch((err) =>
              console.error(
                `Failed sending service reminder to user ${eq.ownerId}:`,
                err.message,
              ),
            );
        }
      }
    } catch (err) {
      console.error('Error in service reminder cron job:', err);
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
