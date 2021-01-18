var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");
const pgp = require("pg-promise")({
  /* initialization options */
  capSQL: true, // capitalize all generated SQL
});

exports.qiaprogress = function (req, res, next) {
  var start = 2020;
  var options = [];
  var end = new Date().getFullYear();

  for (var year = start; year <= end; year++) {
    console.log(year);
    options.push(year);
  }

  console.log(options);
  res.render("./forms/qiaprogress", { users: req.user, years: options });
};

exports.qiaprogress_post = async function (req, res, next) {
  var data = req.body;
  var lines = req.body.itemsbought
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line);

  var useraccount = req.user.user;
  const cs = new pgp.helpers.ColumnSet(["attribute_id", "value"], {
    table: "formquestionresponse",
  });
  const values = [
    {
      attribute_id: 1,
      value: req.body.date,
    },
    {
      attribute_id: 2,
      value: req.body.earlyprofessional,
    },
    {
      attribute_id: 4,
      value: req.body.evidenceprogress,
    },
    {
      attribute_id: 5,
      value: req.body.reportingyear,
    },
  ];
  const query = pgp.helpers.insert(values, cs) + "RETURNING record_id";
  const responseofRecords = await db.map(query, [], a => +a.record_id);  

  db.tx(async (t) => {
    let arrayinput = await t.none(
      "INSERT INTO formquestionresponse (attribute_id, value) VALUES (3, unnest(array[$1:csv]))",
      [lines]
    );
    let associatedCompany = await t.one(
      "SELECT company_id from useraccount WHERE username = $1",
      [useraccount]
    );
    await db.none(
      "INSERT INTO formresponse(form_id, company_id, date_submitted, answer_ids) values (1, $1, $2, unnest(array[$3:csv]))",
      [associatedCompany.company_id, req.body.date, responseofRecords]
    );
  })
    .then((data) => {
      console.log(data);
      res.redirect("/");
    })
    .catch((error) => {
      next(error);
    });
};
