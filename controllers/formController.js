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

  // dynamically sets the form reporting year in a loop from 2020 up to existing year.
  var start = 2020;
  var options = [];
  var end = new Date().getFullYear();

  for (var year = start; year <= end; year++) {
    console.log(year);
    options.push(year);
  }

  // renders the form
  res.render("./forms/qiaprogress", { users: req.user, years: options });
};

exports.qiaprogress_post = async function (req, res, next) {

  // takes the itemsbought text field and turns it into a array of lines.
  var lines = req.body.itemsbought
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line);

    // sets username to useraccount variable in order to grab company ID.
  var useraccount = req.user.user;

  // sets the use of the ColumnSet feature of PG Promise allowing multiple entries at once. 
  const cs = new pgp.helpers.ColumnSet(["attrib_id", "value"], {
    table: "formquestionresponse",
  });

  // the assigned values & entries for PG Promise
  const values = [
    {
      attrib_id: 1,
      value: req.body.date,
    },
    {
      attrib_id: 2,
      value: req.body.earlyprofessional,
    },
    {
      attrib_id: 4,
      value: req.body.evidenceprogress,
    },
    {
      attrib_id: 5,
      value: req.body.reportingyear,
    },
  ];

  // Sets the query to run in the DB via PG Promise, and splits up the return into variables to insert later on.
  const query = pgp.helpers.insert(values, cs) + "RETURNING record_id";
  const responseofRecords = await db.map(query, [], a => +a.record_id);  

  db.tx(async (t) => {
    let arrayinput = await t.none(
      "INSERT INTO formquestionresponse (attrib_id, value) VALUES (3, unnest(array[$1:csv]))",
      [lines]
    );
    let associatedCompany = await t.one(
      "SELECT company_id from useraccount WHERE username = $1",
      [useraccount]
    );
    await db.none(
      "INSERT INTO formresponse(form_id, company_id, date_submitted, record_ids) values (1, $1, $2, unnest(array[$3:csv]))",
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
