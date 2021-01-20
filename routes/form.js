require("dotenv").config();
var express = require("express");
var db = require("../db");
var router = express.Router();

// controller inits
var homepage_controller = require("../controllers/homepageController");
var useraccount_controller = require("../controllers/useraccountController");
var companycreate_controller = require("../controllers/companycreationController");
var formcreate_controller = require("../controllers/formController");
var adminformview_controller = require("../controllers/adminFormView");
var userformview_controller = require("../controllers/userFormView");

var async = require("async");

// multer initiation and sets upload folder to be /uploads
var multer = require("multer");
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
var upload = multer({ storage: storage });

var passport = require("passport");
const { path } = require("../app");

// ensures authentication for user before letting them log in
function ensureAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.flash = "error, You must be logged in to see this page.";
    res.redirect(403, "/login");
  }
}

// ensures user is a administrator AND authenticated before letting them to a ADMIN area.
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

//dynamically assign a company page to their ID.
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

// sets variables for company uploader to take the File input type. Sticks it in the "uplaods' folder"

var compUploader = upload.fields([
  { name: "logo" },
  { name: "business_picture" },
]);

router.post("/createcompany", compUploader, function (req, res, next) {
  console.log(req.files.logo[0].originalname);

  //transactionally adds the company to the database. Multer removes req.body access for multipart forms when the input
  // type is file, so req.files.x.x needs to be used.
  db.tx(async (t) => {
    const insertCompany = await db.none(
      `insert into company(company_name, address, town, state, zipcode,phone_number,website,description,logo,business_picture,first_name,last_name,codirector_name)
              values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        req.body.company_name,
        req.body.address,
        req.body.town,
        req.body.state,
        req.body.zipcode,
        req.body.phone_number,
        req.body.website,
        req.body.description,
        req.files.logo[0].originalname,
        req.files.business_picture[0].originalname,
        req.body.first_name,
        req.body.last_name,
        req.body.codirector_name,
      ]
    );
  })
    .then((data) => {
      res.redirect("/");
    })
    .catch((err) => {
      if (err) {
        req.flash("error", "Something went wrong, contact DB admin");
        res.redirect("/createcompany");
      }
    });
});

//starting forms

router.get(
  "/forms/qiaprogress",
  ensureAuthentication,
  formcreate_controller.qiaprogress
);
router.post("/forms/qiaprogress", formcreate_controller.qiaprogress_post);

// form thank you page
router.get("/thanks", function (req, res, next) {
  res.render("thanks", { user: req.user });
});

//form user view
router.get(
  "/:username/forms/:companyid/:formid/:formresponseid",
  userformview_controller.index
);
//form administration view
router.get("/admin/:companyid/:formid/:formresponseid", adminformview_controller.index);

module.exports = router;
