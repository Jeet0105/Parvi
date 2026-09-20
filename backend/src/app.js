require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const routes = require('./routes');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { swaggerSpec, renderSwaggerHtml } = require('./docs/swaggerDoc');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI CDN scripts to render smoothly
  })
);
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger / OpenAPI documentation
app.get('/swagger', (req, res) => res.send(renderSwaggerHtml()));
app.get('/api/docs', (req, res) => res.send(renderSwaggerHtml()));
app.get('/api/docs/json', (req, res) => res.json(swaggerSpec));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
