require("dotenv").config();
var express = require("express");
var router = express.Router();
var homepage_controller = require("../controllers/homepageController");
var useraccount_controller = require("../controllers/useraccountController");
var async = require("async");
var passport = require('passport')

function ensureAuthentication(req,res,next){
  if (req.isAuthenticated()){
    next()
  }else {
    req.session.error = "You must be logged in to see this page."
    res.redirect(403, "/login")
  }
}


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
      res.redirect(result.user + '/profile')
    })
    
  })(req,res,next);
})

router.get("/signup", useraccount_controller.signup);
router.post("/signup", useraccount_controller.signup_post);

router.get("/:username/profile", ensureAuthentication, useraccount_controller.profile);

router.get("/test", ensureAuthentication, function (req, res, next) {
  res.send("TEST PAGE FOR MAC! :) ");
});

module.exports = router;
