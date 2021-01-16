var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");

exports.index = function (req, res) {
  res.render("login", { title: "Login", user: req.user });
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
        console.log(data);
        res.redirect("/");
      })
      .catch((err) => {
        if (err) {
          req.flash('info', 'Username or E-Mail already registered. Try again.')
          res.redirect('/signup')
        }
      });
  });
};

exports.companyhome = function (req, res, next) {
  db.one("select * from company where id = $1", [req.params.id])
    .then((data) => {
      console.log(data);
      res.render("companypage", {
        companylist: data,
        title: "Company Profile",
        user: req.user,
      });
    })
    .catch((error) => {
      if (error) {
        next(error);
      }
    });
};

exports.profile = async function (req, res, next) {
  if (req.isAuthenticated()) {
    db.one(
      "SELECT * from useraccount INNER JOIN company on useraccount.company_id = company.id WHERE username = $1",
      [req.params.username]
    )
      .then((data) => {
        res.render("profile", {
          title: `${data.user} Profile`,
          userinfo: data,
          user: req.user,
        });
      })
      .catch((error) => {
        if (error) {
          next(err);
        }
      });
  } else {
    res.redirect("/login");
  }
};
