// swagger.js
const config = require('./src/config/config');
const swaggerJsDoc = require('swagger-jsdoc');
const glob = require('glob');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PipeWyze API docs',
      version: '0.0.1',
      description: 'Show all APIs here',
    },

    servers: [
      {
        url: `http://localhost:${config.port || 3030}/v1`,
        description: 'Local server',
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT', // Optional, specifies the format
        },
      },
    },
    security: [
      {
        bearerAuth: [], // Apply globally to all APIs
      },
    ],
  },
  apis: getRoutes(),
};

function getRoutes() {
  const files = glob.sync(path.resolve(__dirname, './src/routes/**/*.js'));
  return files;
}

const specs = swaggerJsDoc(options);
module.exports = specs;
