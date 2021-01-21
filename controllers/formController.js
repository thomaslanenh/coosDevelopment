var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");
var currentYear = new Date().getFullYear();
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
  res.render("./forms/qiaprogress", {
    users: req.user,
    years: options,
    currentYear,
  });
};

exports.qiaprogress_post = async function (req, res, next) {
  // takes the itemsbought text field and turns it into a array of lines.
  var lines = req.body.itemsbought
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line);

  // sets username to useraccount variable in order to grab company ID.
  var useraccount = req.user.user;

  db.tx(async (t) => {
    let associatedCompany = await t.one(
      "SELECT company_id from useraccount WHERE username = $1",
      [useraccount]
    );
    let formresponseID = await db.one(
        `INSERT INTO formresponse(form_id, company_id, date_submitted, form_responses) values (1, $1, $2, $3:json) RETURNING response_id`,
      [associatedCompany.company_id, req.body.date, {"date": req.body.date, "early_professional": req.body.earlyprofessional, "items_bought": lines, "evidence_progress": req.body.evidenceprogress, "reporting_year": req.body.reportingyear} ]
    );

    console.log(formresponseID
      )
    // deal with the weird array from text box thing.
    let arrayinput = await t.none(
      "INSERT INTO formquestionresponse (attrib_id, value, response_id) VALUES (3, unnest(array[$1:csv]), $2)",
      [lines, formresponseID.response_id]
    );

    // sets the use of the ColumnSet feature of PG Promise allowing multiple entries at once.
    const cs = new pgp.helpers.ColumnSet(
      ["attrib_id", "value", "response_id"],
      {
        table: "formquestionresponse",
      }
    );

    // the assigned values & entries for PG Promise
    const values = [
      {
        attrib_id: 1,
        value: req.body.date,
        response_id: formresponseID.response_id,
      },
      {
        attrib_id: 2,
        value: req.body.earlyprofessional,
        response_id: formresponseID.response_id,
      },
      {
        attrib_id: 4,
        value: req.body.evidenceprogress,
        response_id: formresponseID.response_id,
      },
      {
        attrib_id: 5,
        value: req.body.reportingyear,
        response_id: formresponseID.response_id,
      },
    ];

    // Sets the query to run in the DB via PG Promise, and splits up the return into variables to insert later on.

    const query = pgp.helpers.insert(values, cs);
    const responseofRecords = await t.none(query);
  })
    .then((data) => {
      console.log(data);
      res.redirect("../thanks");
    })
    .catch((error) => {
      next(error);
    });
};


exports.qiaoutcome = function(req,res,next){
  let measures = db.any('SELECT * from qualitymeasures')
  .then(results => {
    res.render('./forms/qiaoutcome', {user:req.user, currentYear, measures: results})
  }).catch(error => {
    if (error){
      req.flash('error', 'There was a error, please try again or submit a support ticket.')
      res.redirect('/')
    }
  })
 
}

exports.qiaoutcome_post = function(req,res,next){
  res.send('NYI')
}