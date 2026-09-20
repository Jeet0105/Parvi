const express = require('express');
const { success } = require('../utils/apiResponse');

const router = express.Router();

router.get('/health', (req, res) =>
  success(res, 200, 'Family Identity Platform API is running')
);

module.exports = router;
