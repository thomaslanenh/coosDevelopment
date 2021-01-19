var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");
var currentYear = new Date().getFullYear();

exports.index = function (req, res) {
  res.render("login", { title: "Login", user: req.user, currentYear });
};

exports.logout = function (req, res, next) {
  req.logout();
  res.redirect("/");
};

exports.signup = function (req, res) {
  db.tx(async (t) => {
    const companys = await t.any("SELECT company_name, id FROM company");
    return { companys };
  })
    .then((data) => {
      res.render("signup", {
        title: "Sign Up",
        companys: data.companys,
        user: req.user,
        currentYear,
      });
    })
    .catch((err) => {
      if (err) {
        next(err);
      }
    });
};

exports.signup_post = async function (req, res, next) {
  bcrypt.hash(req.body.password, 10, async function (error, hash) {
    if (error) {
      next(error);
    }

    db.tx(async (t) => {
      const companys = await t.any("SELECT company_name, id FROM company");
      const insertion = await t.none(
        "INSERT INTO useraccount(username, password,email, company_id) VALUES ($1, $2, $3, $4)",
        [req.body.username, hash, req.body.email, req.body.companyradio]
      );
      return companys;
    })
      .then((data) => {
        res.redirect("/");
      })
      .catch((err) => {
        if (err) {
          req.flash(
            "info",
            "Username or E-Mail already registered. Try again."
          );
          res.redirect("/signup");
        }
      });
  });
};

exports.companyhome = function (req, res, next) {
  db.one("select * from company where id = $1", [req.params.id])
    .then((data) => {
      res.render("companypage", {
        companylist: data,
        title: "Company Profile",
        user: req.user,
        currentYear,
      });
    })
    .catch((error) => {
      if (error) {
        next(error);
      }
    });
};

exports.profile = async function (req, res, next) {
  let accountInfo = {};
  let recentForms = {};

  db.tx(async (t) => {
    accountInfo = await t.one(
      "SELECT * from useraccount INNER JOIN company on useraccount.company_id = company.id WHERE username = $1",
      [req.params.username]
    );
    recentForms = await t.any(
      "SELECT f.form_id, TO_CHAR(f.date_submitted :: DATE,'yyyy-mm-dd'), f2.form_name from formresponse f INNER JOIN forms f2 on f.form_id = f2.form_id WHERE f.company_id = $1",
      [accountInfo.company_id]
    );
    return {accountInfo, recentForms};
  })
    .then((data) => {
      console.log(recentForms.length)
      // We need to compare the form submitted date to our date today to determine if completed.
      // First we need to see if to_char exists and then decalre the forms date as a date variable
      if (recentForms.length > 0){
        formDate = new Date(recentForms[0].to_char);
      }
      else{
        formDate = '2120-01-12' 
      }

      // now we declare todays date as a variable
      let todaysDate = new Date();

      // Then we do our comparisons.
      if (formDate <= todaysDate) {
        console.log('Yes')
        todaysDate = "Yes";
      } else {
        console.log('no')
        todaysDate = "No";
      }

      res.render("profile", {
        title: `${req.params.username}'s Profile`,
        userinfo: accountInfo,
        user: req.user,
        currentYear,
        todaysDate,
        recentForms,
      });
    })
    .catch((error) => {
      if (error) {
        next(error);
      }
    });
};
