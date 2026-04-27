const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');

// Cuando alguien haga un POST a /api/auth/login, se ejecutará el controlador 'login'
router.post('/login', login);

module.exports = router;

