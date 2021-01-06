var express = require('express')
var router = express.Router();
var homepage_controller = require('../controllers/homepageController')

router.get('/', homepage_controller.index )


module.exports = router;