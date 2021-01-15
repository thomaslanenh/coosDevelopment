var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const pool = require("../db");

exports.index = function (req, res) {
  res.render("login", { title: "Login", user: req.user });
};

exports.logout = function (req, res, next) {
  req.logout();
  res.redirect("/");
};

exports.signup = function (req, res) {
  async.parallel(
    {
      companys: function (callback) {
        pool.query("Select company_name, id FROM COMPANY", callback);
      },
    },
    function (err, results) {
      console.log(results.companys.rows);
      if (err) {
        return next(err);
      }

      res.render("signup", {
        title: "Sign Up",
        companys: results.companys.rows,
        user: req.user,
      });
    }
  );
};

exports.signup_post = function (req, res, next) {
  console.log(req.body.password);
  var pwd = bcrypt.hash(req.body.password, 10);
  console.log(pwd);
  async.parallel(
    {
      companys: function (callback) {
        pool.query("SELECT company_name, id FROM COMPANY", callback);
      },
    },
    function (err, results) {
      if (err) {
        return next(err);
      }

      bcrypt.hash(req.body.password, 10, function (error, hash) {
        pool.query(
          "INSERT INTO useraccount(username, password, email, company_id) VALUES($1,$2,$3,$4)",
          [req.body.username, hash, req.body.email, req.body.companyradio],
          (err, result) => {
            console.log(err);
            if (err) {
              res.render("signup", {
                title: "Sign Up",
                companys: results.companys.rows,
                error: "Username or E-Mail already registered. Try Again.",
                user: req.user,
              });
            } else {
              pool.query("COMMIT");
              res.redirect("/");
            }
          }
        );
      });
    }
  );
};

exports.companyhome = function (req, res, next) {
  pool.query(
    "SELECT * FROM company WHERE id = $1",
    [req.params.id],
    (err, result) => {
      if (err) {
        next(err);
      }
      res.render("companypage", {
        companylist: result.rows,
        title: "Company Profile",
        user: req.user,
      });
    }
  );
};

exports.profile = function (req, res, next) {
  if (req.isAuthenticated()) {
    async.parallel(
      {
        username: function (callback) {
          pool.query(
            "SELECT * FROM useraccount INNER JOIN company ON useraccount.company_id = company.id WHERE username = $1",
            [req.params.username],
            callback
          );
        },
      },
      function (err, results) {
        if (err) {
          next(err);
        }
        res.render("profile", {
          title: `${req.user.user} Profile`,
          userinfo: results.username.rows,
          user: req.user,
        });
      }
    );
  } else {
    res.redirect("/login");
  }
};
