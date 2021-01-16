require("dotenv").config();
var express = require("express");
var router = express.Router();
var homepage_controller = require("../controllers/homepageController");
var useraccount_controller = require("../controllers/useraccountController");
var async = require("async");
var passport = require("passport");

function ensureAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.session.error = "You must be logged in to see this page.";
    res.redirect(403, "/login");
  }
}

router.get("/", homepage_controller.index);

router.get("/company/:id", useraccount_controller.companyhome);

// user account stuff
router.get("/login", useraccount_controller.index);
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: `/`,
    successFlash: true,
    failureRedirect: "/login",
    failureFlash: true,
  })
);
router.get("/signup", useraccount_controller.signup);
router.post("/signup", useraccount_controller.signup_post);

router.get("/logout", useraccount_controller.logout);

router.get(
  "/:username/profile",
  ensureAuthentication,
  useraccount_controller.profile
);

module.exports = router;
