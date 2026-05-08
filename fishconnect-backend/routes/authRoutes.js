const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Points to the logic in controllers/authController.js
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;