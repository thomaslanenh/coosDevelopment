require('dotenv').config()
var express = require('express')
var router = express.Router();
var homepage_controller = require('../controllers/homepageController')
var useraccount_controller = require('../controllers/useraccountController')
var async = require('async')

router.get('/', homepage_controller.index )

router.get('/company/:id', useraccount_controller.companyhome)

// user account stuff
router.get('/login', useraccount_controller.index )

module.exports = router;