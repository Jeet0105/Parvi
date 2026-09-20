const express = require('express');

const authController = require('../controllers/auth.controller');
const { validateBody } = require('../middleware/validation.middleware');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);

module.exports = router;
