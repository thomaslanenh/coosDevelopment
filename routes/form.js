require("dotenv").config();
var express = require("express");
var router = express.Router();
var homepage_controller = require("../controllers/homepageController");
var useraccount_controller = require("../controllers/useraccountController");
var companycreate_controller = require("../controllers/companycreationController");
var async = require("async");
var passport = require("passport");
const { path } = require("../app");
function ensureAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.flash = "error, You must be logged in to see this page.";
    res.redirect(403, "/login");
  }
}

function administratorCheck(req, res, next) {
  console.log(req.user);
  if (req.isAuthenticated() && req.user.user_type === "ADMIN") {
    next();
  } else {
    req.session.error = "You must be a administrator to see this page.";
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

router.get(
  "/createcompany",
  administratorCheck,
  companycreate_controller.createcompany
);

router.post(
  "/createcompany",
  companycreate_controller.createcompany_post
);
module.exports = router;
