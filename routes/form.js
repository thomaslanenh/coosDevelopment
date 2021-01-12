require("dotenv").config();
var express = require("express");
var router = express.Router();
var homepage_controller = require("../controllers/homepageController");
var useraccount_controller = require("../controllers/useraccountController");
var async = require("async");
var passport = require('passport')
router.get("/", homepage_controller.index);

router.get("/company/:id", useraccount_controller.companyhome);

// user account stuff
router.get("/login", useraccount_controller.index);
router.post("/login", (req,res,next) => {
  passport.authenticate('local', (err,result,info) => {
    if (err) {
      console.log(err)
      return next(err);
    }
    if (!result) {
      req.session.error = "Username or Password Incorrect"
    }
    req.logIn(result, err => {
      if (err) {
        console.log(err)
        return next(err)
      }
      console.log(result)
      res.redirect('/')
    })
    
  })(req,res,next);
})

router.get("/signup", useraccount_controller.signup);
router.post("/signup", useraccount_controller.signup_post);

router.get("/:username/profile", useraccount_controller.profile);

router.get("/test", function (req, res, next) {
  res.send("TEST PAGE FOR MAC! :) ");
});

module.exports = router;
