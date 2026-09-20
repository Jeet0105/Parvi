require('dotenv').config({ quiet: true });

const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Family Identity Platform API listening on port ${PORT}`);
});

module.exports = server;
