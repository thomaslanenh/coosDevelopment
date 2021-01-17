var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");

exports.index = function (req, res, next) {
  res.send("NYI");
};

exports.createcompany = function (req, res, next) {
  res.render("createcompany", { user: req.user });
};

exports.createcompany_post = function (req, res, next) {
  db.tx(async (t) => {
    const insertCompany = db.none(
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
        req.body.logo,
        req.body.business_picture,
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
};
