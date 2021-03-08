var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var nextYear = new Date().getFullYear() + 1;
var isEmpty = require("lodash.isempty");
const { ColumnSet } = require("pg-promise");
const { NULL } = require("node-sass");
var todaysDate = new Date();

function inputSkipper(column) {
  console.log(column.value);
  if (isEmpty(column.value)) {
    return column.value === "null";
  }
  return column;
}

const pgp = require("pg-promise")({
  /* initialization options */
  capSQL: true, // capitalize all generated SQL
});

// QIA Progress

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
    user: req.user,
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
      [
        associatedCompany.company_id,
        req.body.date,
        {
          date: req.body.date,
          early_professional: req.body.earlyprofessional,
          items_bought: lines,
          evidence_progress: req.body.evidenceprogress,
          reporting_year: req.body.reportingyear,
        },
      ]
    );

    console.log(formresponseID);
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

// QIA Outcome

exports.qiaoutcome = function (req, res, next) {
  let measures = db
    .any("SELECT * from qualitymeasures ORDER BY measure_id desc")
    .then((results) => {
      res.render("./forms/qiaoutcome", {
        user: req.user,
        currentYear,
        previousYear,
        measures: results,
      });
    })
    .catch((error) => {
      if (error) {
        req.flash(
          "error",
          "There was a error, please try again or submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

exports.qiaoutcome_post = function (req, res, next) {
  // turn items bought entries into seperate fields
  var linesone = req.body.itemsboughtgoalone
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line);

  var linestwo = req.body.itemsboughtgoaltwo
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line);

  var linesthree = req.body.itemsboughtgoalthree
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line);

  // set arrays up for measurements
  let arraygoalone = req.body.measuresgoalone;

  if (arraygoalone.length > 1) {
    arraygoalone = arraygoalone.map((i) => Number(i));
  } else {
    arraygoalone = parseInt(arraygoalone);
  }

  let arraygoaltwo = req.body.measuresgoaltwo;

  if (arraygoaltwo.length > 1) {
    arraygoaltwo = arraygoaltwo.map((i) => Number(i));
  } else {
    arraygoaltwo = parseInt(arraygoaltwo);
  }

  let arraygoalthree = req.body.measuresgoalthree;

  if (arraygoalthree.length > 1) {
    arraygoalthree = arraygoalthree.map((i) => Number(i));
  } else {
    arraygoalthree = parseInt(arraygoalthree);
  }

  const arrayInsert = (formid) => {
    db.tx(async (t) => {
      // now for the arrays of items bought
      if (linesone.length > 1 && arraygoalone.length > 1) {
        let arrayinsertOne = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,unnest(array[$4:csv]))",
          [10, linesone, formid, arraygoalone]
        );
      } else if (linesone.length === 1 && arraygoalone.length > 1) {
        let arrayinsertOne = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,unnest(array[$4:csv]))",
          [10, linesone, formid, arraygoalone]
        );
      } else if (linesone.length === 0) {
        return;
      } else {
        let arrayinsertOne = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,$4)",
          [10, linesone, formid, arraygoalone]
        );
      }

      // line two
      if (linestwo.length > 1 && arraygoaltwo.length > 1) {
        let arrayinserttwo = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,unnest(array[$4:csv]))",
          [10, linestwo, formid, arraygoaltwo]
        );
      } else if (linestwo.length === 1 && arraygoaltwo.length > 1) {
        let arrayinserttwo = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,unnest(array[$4:csv]))",
          [10, linestwo, formid, arraygoaltwo]
        );
      } else if (linestwo.length === 0) {
        return;
      } else {
        let arrayinserttwo = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,$4)",
          [10, linestwo, formid, arraygoaltwo]
        );
      }

      // lines three
      if (linesthree.length > 1 && arraygoalthree.length > 1) {
        let arrayinsertthree = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,unnest(array[$4:csv]))",
          [10, linesthree, formid, arraygoalthree]
        );
      } else if (linesthree.length === 1 && arraygoalthree.length > 1) {
        let arrayinsertthree = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,unnest(array[$4:csv]))",
          [10, linesthree, formid, arraygoalthree]
        );
      } else if (linesthree.length === 0) {
        return;
      } else {
        let arrayinsertthree = await t.none(
          "INSERT INTO formquestionresponse(attrib_id, value, response_id, measure_id) values($1,unnest(array[$2:csv]),$3,$4)",
          [10, linesthree, formid, arraygoalthree]
        );
      }
    });
  };
  // begin database inserts

  db.tx(async (t) => {
    const useraccount = await db.one(
      "SELECT company_id from useraccount WHERE username = $1",
      [req.user.user]
    );
    const formresponseID = await t.one(
      "INSERT INTO formresponse(form_id, company_id) VALUES (2, $1) RETURNING response_id",
      [useraccount.company_id]
    );
    // insert the responses into the database proper utilizing ColumnSet

    const cs = new pgp.helpers.ColumnSet(
      ["attrib_id", "value", "response_id", "measure_id"],
      {
        table: "formquestionresponse",
      }
    );

    const values = [
      {
        attrib_id: 16,
        value: req.body.date,
        response_id: formresponseID.response_id,
        measure_id: 8,
      },
      {
        attrib_id: 17,
        value: req.body.earlyprofessionalgoalone,
        response_id: formresponseID.response_id,
        measure_id: 8,
      },
      {
        attrib_id: 2,
        value: req.body.centerimprovementgoalone,
        response_id: formresponseID.response_id,
        measure_id: 8,
      },
      {
        attrib_id: 9,
        value: req.body.measuretypeindicatoronechoice1,
        response_id: formresponseID.response_id,
        measure_id: req.body.measuretypeindicatoronechoice1,
      },
      {
        attrib_id: 12,
        value: req.body.indicatorgoalonechoice1,
        response_id: formresponseID.response_id,
        measure_id: req.body.measuretypeindicatoronechoice1,
      },
      {
        attrib_id: 13,
        value: req.body.previousyearscoregoalonechoice1,
        response_id: formresponseID.response_id,
        measure_id: req.body.measuretypeindicatoronechoice1,
      },
      {
        attrib_id: 14,
        value: req.body.currentyearscoregoalonechoice1,
        response_id: formresponseID.response_id,
        measure_id: req.body.measuretypeindicatoronechoice1,
      },
      {
        attrib_id: 15,
        value: req.body.narrativeforgoalone,
        response_id: formresponseID.response_id,
        measure_id: 8,
      },
    ];

    // loop for response one indicator section
    for (var x = 1; x > 7; x++) {
      if (req.body.measuretypeindicatoronechoice[x] != 8) {
        values.push(
          {
            attrib_id: 9,
            value: req.body.measuretypeindicatoronechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatoronechoice[x],
          },
          {
            attrib_id: 12,
            value: req.body.indicatorgoalonechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatoronechoice[x],
          },
          {
            attrib_id: 13,
            value: req.body.previousyearscoregoalonechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatoronechoice[x],
          },
          {
            attrib_id: 14,
            value: req.body.currentyearscoregoalonechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatoronechoice[x],
          }
        );
      }
    }

    //loop for response two indicator section
    for (var x = 0; x > 7; x++) {
      if (req.body.measuretypeindicatortwochoice[x] != 8) {
        values.push(
          {
            attrib_id: 9,
            value: req.body.measuretypeindicatortwochoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatortwochoice[x],
          },
          {
            attrib_id: 12,
            value: req.body.indicatorgoaltwochoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatortwochoice[x],
          },
          {
            attrib_id: 13,
            value: req.body.previousyearscoregoaltwochoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatortwochoice[x],
          },
          {
            attrib_id: 14,
            value: req.body.currentyearscoregoaltwochoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatortwochoice[x],
          }
        );
      }
    }

    // conditional logic for goal #2 insert to DB

    if (req.body.centerimprovementgoaltwo.length > 0) {
      values.push(
        {
          attrib_id: 2,
          value: req.body.centerimprovementgoaltwo,
          response_id: formresponseID.response_id,
          measure_id: 8,
        },
        {
          attrib_id: 9,
          value: req.body.measuretypeindicatortwochoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatortwochoice1,
        },
        {
          attrib_id: 12,
          value: req.body.indicatorgoaltwochoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatortwochoice1,
        },
        {
          attrib_id: 13,
          value: req.body.previousyearscoregoaltwochoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatortwochoice1,
        },
        {
          attrib_id: 14,
          value: req.body.currentyearscoregoaltwochoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatortwochoice1,
        },
        {
          attrib_id: 15,
          value: req.body.narrativeforgoaltwo,
          response_id: formresponseID.response_id,
          measure_id: 8,
        }
      );
    }

    // loop for response three indicator section
    for (var x = 0; x > 7; x++) {
      if (req.body.measuretypeindicatorthreechoice[x] != 8) {
        values.push(
          {
            attrib_id: 9,
            value: req.body.measuretypeindicatorthreechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatorthreechoice[x],
          },
          {
            attrib_id: 12,
            value: req.body.indicatorgoalthreechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatorthreechoice[x],
          },
          {
            attrib_id: 13,
            value: req.body.previousyearscoregoalthreechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatorthreechoice[x],
          },
          {
            attrib_id: 14,
            value: req.body.currentyearscoregoalthreechoice[x],
            response_id: formresponseID.response_id,
            measure_id: req.body.measuretypeindicatorthreechoice[x],
          }
        );
      }
    }

    // conditional logic for goal 3
    // conditional logic for goal #2 insert to DB

    if (req.body.centerimprovementgoalthree.length > 0) {
      values.push(
        {
          attrib_id: 2,
          value: req.body.centerimprovementgoalthree,
          response_id: formresponseID.response_id,
          measure_id: 8,
        },
        {
          attrib_id: 9,
          value: req.body.measuretypeindicatorthreechoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatorthreechoice1,
        },
        {
          attrib_id: 12,
          value: req.body.indicatorgoalthreechoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatorthreechoice1,
        },
        {
          attrib_id: 13,
          value: req.body.previousyearscoregoalthreechoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatorthreechoice1,
        },
        {
          attrib_id: 14,
          value: req.body.currentyearscoregoalthreechoice1,
          response_id: formresponseID.response_id,
          measure_id: req.body.measuretypeindicatorthreechoice1,
        },
        {
          attrib_id: 15,
          value: req.body.narrativeforgoalthree,
          response_id: formresponseID.response_id,
          measure_id: 8,
        }
      );
    }

    // Sets the query to run in the DB via PG Promise, and splits up the return into variables to insert later on.

    const query = pgp.helpers.insert(values, cs);
    const responseofRecords = await t.none(query);
    arrayInsert(formresponseID.response_id);
  })
    .then((response) => {
      req.flash("info", "Your form has been submitted. Thank you!");
      res.redirect("/thanks");
    })
    .catch((error) => {
      console.log(error);
      req.flash(
        "error",
        "An error has occured. Please try again or submit a support ticket."
      );
      res.redirect("/");
    });
};

// QIA Detailed Budget

exports.detailedbudget = function (req, res, next) {
  db.tx(async (t) => {
    const companydetails = await t.one(
      "SELECT company_name, c.id, u.first_name, u.last_name FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );
    return companydetails;
  })
    .then((results) => {
      res.render("./forms/qiabudget", {
        user: req.user,
        currentYear,
        previousYear,
        companyDetails: results,
        todaysDate,
      });
    })
    .catch((error) => {
      if (error) {
        req.flash(
          "error",
          "There was a error. Please try again or submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

exports.detailedbudgetpost = function (req, res, next) {
  const arrayCheck = async (values, formresponse) => {
    // validation for loop
    for (var x = 1; x <= 7; x++) {
      console.log("for looop hit");
      if (isEmpty(req.body[`goal${x}`]) == false) {
        console.log("first is empty hit");
        values.push({
          attrib_id: 23,
          value: req.body[`goal${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`descriptionofneed${x}`]) == false) {
        values.push({
          attrib_id: 24,
          value: req.body[`descriptionofneed${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`itemnumber${x}`]) == false) {
        values.push({
          attrib_id: 25,
          value: req.body[`itemnumber${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`itemdescription${x}`]) == false) {
        values.push({
          attrib_id: 26,
          value: req.body[`itemdescription${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`howmany${x}`]) == false) {
        values.push({
          attrib_id: 27,
          value: req.body[`howmany${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`vendor${x}`]) == false) {
        values.push({
          attrib_id: 28,
          value: req.body[`vendor${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`estimatedcost${x}`]) == false) {
        values.push({
          attrib_id: 29,
          value: req.body[`estimatedcost${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`estimatedtotalcost${x}`]) == false) {
        values.push({
          attrib_id: 30,
          value: req.body[`estimatedtotalcost${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`estimatedshippingcost${x}`]) == false) {
        values.push({
          attrib_id: 31,
          value: req.body[`estimatedshippingcost${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`actualcost${x}`]) == false) {
        values.push({
          attrib_id: 32,
          value: req.body[`actualcost${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`totalactualcost${x}`]) == false) {
        values.push({
          attrib_id: 33,
          value: req.body[`totalactualcost${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`totalactualshipping${x}`]) == false) {
        values.push({
          attrib_id: 34,
          value: req.body[`totalactualshipping${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`purchasedate${x}`]) == false) {
        values.push({
          attrib_id: 35,
          value: req.body[`purchasedate${x}`],
          response_id: formresponse,
        });
      }

      if (isEmpty(req.body[`receiptsubmitted${x}`]) == false) {
        values.push({
          attrib_id: 36,
          value: req.body[`receiptsubmitted${x}`],
          response_id: formresponse,
        });
      }
    }
    return values;
  };
  const cs = new pgp.helpers.ColumnSet(["attrib_id", "value", "response_id"], {
    table: "formquestionresponse",
  });

  db.tx(async (t) => {
    const companyDetails = await t.one(
      "SELECT company_name, c.id, first_name, last_name FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );

    const insertedForm = await t.one(
      "INSERT INTO formresponse(company_id, form_id) VALUES ($1, 3) RETURNING response_id",
      [companyDetails.id]
    );

    return { companyDetails, insertedForm };
  })
    .then((results) => {
      const values = [
        {
          attrib_id: 20,
          value: results.companyDetails.company_name,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 19,
          value:
            results.companyDetails.first_name +
            " " +
            results.companyDetails.last_name,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 18,
          value: req.body.date,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 21,
          value: req.body.licensedchildren,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 22,
          value: req.body.currentchildren,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 37,
          value: req.body.totalestimatedcost,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 38,
          value: req.body.totalestimatedshippingcost,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 39,
          value: req.body.amountawarded,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 40,
          value: req.body.amountspent,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 41,
          value: req.body.totalactualcostfinal,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 42,
          value: req.body.totalshippingcostfinal,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 44,
          value: req.body.allitemspurchased,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 43,
          value: req.body.allreceiptssubmitted,
          response_id: results.insertedForm.response_id,
        },
      ];

      const arrayed = arrayCheck(values, results.insertedForm.response_id);
      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);
      req.flash("info", "Your form has been succesfully submitted. Thank you!");
      res.redirect("/thanks");
    })
    .catch((error) => {
      console.log(error);
      req.flash(
        "error",
        "An error has occured. Please try again or submit a support ticket."
      );
      res.redirect("/");
    });
};

// center improvement

exports.centerimprovement = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      "SELECT c.id, company_name, address, email, phone_number FROM company c INNER JOIN useraccount u ON c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );

    const qualityMeasures = await t.many("SELECT * from qualitymeasures");
    return { companyDetails, qualityMeasures };
  })
    .then((results) => {
      res.render("./forms/qiacenterimprovement", {
        user: req.user,
        currentYear,
        previousYear,
        companyDetails: results.companyDetails,
        qualityMeasures: results.qualityMeasures,
      });
    })
    .catch((error) => {
      console.log(error);
      if (error) {
        req.flash(
          "error",
          "An error occured. Please try again or submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

exports.centerimprovementpost = function (req, res, next) {
  const arrayLoop = (values, formresponse) => {
    for (var x = 1; x <= 8; x++) {
      if (isEmpty(req.body[`dateofqualitymeasure${x}`]) == false) {
        values.push({
          attrib_id: 52,
          value: req.body[`dateofqualitymeasure${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`qualitymeasure${x}`]) == false) {
        values.push({
          attrib_id: 53,
          value: req.body[`qualitymeasure${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`strengths${x}`]) == false) {
        values.push({
          attrib_id: 54,
          value: req.body[`strengths${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`weaknesses${x}`]) == false) {
        values.push({
          attrib_id: 55,
          value: req.body[`weaknesses${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`items${x}`]) == false) {
        values.push({
          attrib_id: 56,
          value: req.body[`items${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`goal${x}`]) == false) {
        values.push({
          attrib_id: 57,
          value: req.body[`goal${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`priority${x}`]) == false) {
        values.push({
          attrib_id: 58,
          value: req.body[`priority${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`resourcesneeded${x}`]) == false) {
        values.push({
          attrib_id: 59,
          value: req.body[`resourcesneeded${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`cost${x}`]) == false) {
        values.push({
          attrib_id: 60,
          value: req.body[`cost${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`expectedcompletion${x}`]) == false) {
        values.push({
          attrib_id: 61,
          value: req.body[`expectedcompletion${x}`],
          response_id: formresponse,
        });
      }
      if (isEmpty(req.body[`followup${x}`]) == false) {
        values.push({
          attrib_id: 62,
          value: req.body[`followup${x}`],
          response_id: formresponse,
        });
      }
    }
    return values;
  };

  const cs = new pgp.helpers.ColumnSet(["attrib_id", "value", "response_id"], {
    table: "formquestionresponse",
  });

  db.tx(async (t) => {
    const companyid = await t.one(
      "SELECT c.id, c.company_name, c.address, c.phone_number, u.email from company c INNER JOIN useraccount u on c.id = u.company_id where u.username = $1",
      [req.user.user]
    );
    const formResponse = await t.one(
      "INSERT INTO formresponse(company_id, form_id) values($1, 4) RETURNING response_id",
      [companyid.id]
    );

    return { companyid, formResponse };
  })
    .then((results) => {
      const values = [
        {
          attrib_id: 45,
          value: results.companyid.company_name,
          response_id: results.formResponse.response_id,
        },
        {
          attrib_id: 46,
          value: req.body.nameofpersoncompleting,
          response_id: results.formResponse.response_id,
        },
        {
          attrib_id: 47,
          value: results.companyid.address,
          response_id: results.formResponse.response_id,
        },
        {
          attrib_id: 48,
          value: results.companyid.phone_number,
          response_id: results.formResponse.response_id,
        },
        {
          attrib_id: 49,
          value: results.companyid.email,
          response_id: results.formResponse.response_id,
        },
      ];

      const arrayed = arrayLoop(values, results.formResponse.response_id);
      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash("info", "Form succesfully submitted.");
      res.redirect("/");
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          "error",
          "An error occured. Try again or please submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

// staff meeting tracker form
exports.staffmeetingtracker = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      "SELECT * from company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );
    return { companyDetails };
  }).then((results) => {
    res.render("./forms/staffmeetingtracker", {
      user: req.user,
      currentYear,
      previousYear,
      programDetails: results.companyDetails,
    });
  });
};

exports.staffmeetingtrackerpost = function (req, res, next) {
  const cs = new pgp.helpers.ColumnSet(
    [
      {
        name: "attrib_id",
      },
      {
        name: "value",
        skip(col) {
          return col.value === null || col.value === undefined;
        },
      },
      {
        name: "response_id",
      },
    ],
    {
      table: "formquestionresponse",
    }
  );

  db.tx(async (t) => {
    const useraccount = await t.one(
      "SELECT u.company_id, c.company_name, c.first_name, c.last_name from company c inner join useraccount u on c.id = u.company_id where u.username = $1",
      [req.user.user]
    );
    const formresponse = await t.one(
      "INSERT INTO formresponse(form_id, company_id) VALUES (6, $1) RETURNING response_id",
      [useraccount.company_id]
    );

    return { useraccount, formresponse };
  })
    .then((results) => {
      var linesJanuary =
        req.body.januarydates.length > 0
          ? req.body.januarydates.split(", " || "," || " ")
          : null;

      var linesFebruary =
        req.body.februarydates.length > 0
          ? req.body.februarydates.split(", " || "," || " ")
          : null;

      var linesMarch =
        req.body.marchdates.length > 0
          ? req.body.marchdates.split(", " || "," || " ")
          : null;

      var linesApril =
        req.body.aprildates.length > 0
          ? req.body.aprildates.split(", " || "," || " ")
          : null;

      var linesMay =
        req.body.maydates.length > 0
          ? req.body.maydates.split(", " || "," || " ")
          : null;

      var linesJune =
        req.body.junedates.length > 0
          ? req.body.junedates.split(", " || "," || " ")
          : null;

      var linesJuly =
        req.body.julydates.length > 0
          ? req.body.julydates.split(", " || "," || " ")
          : null;

      var linesAugust =
        req.body.augustdates.length > 0
          ? req.body.augustdates.split(", " || "," || " ")
          : null;

      var linesSeptember =
        req.body.septemberdates.length > 0
          ? req.body.septemberdates.split(", " || "," || " ")
          : null;

      var linesOctober =
        req.body.octoberdates.length > 0
          ? req.body.septemberdates.split(", " || "," || " ")
          : null;

      var linesNovember =
        req.body.novemberdates.length > 0
          ? req.body.novemberdates.split(", " || "," || " ")
          : null;

      var linesDecember =
        req.body.decemberdates.length > 0
          ? req.body.decemberdates.split(", " || "," || " ")
          : null;

      const values = [
        {
          attrib_id: 63,
          value: results.useraccount.company_name,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 64,
          value:
            results.useraccount.first_name +
            " " +
            results.useraccount.last_name,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 65,
          value: req.body.othername,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 66,
          value: linesJanuary,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 67,
          value: linesFebruary,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 68,
          value: linesMarch,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 69,
          value: linesApril,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 70,
          value: linesMay,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 71,
          value: linesJune,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 72,
          value: linesJuly,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 73,
          value: linesAugust,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 74,
          value: linesSeptember,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 75,
          value: linesOctober,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 76,
          value: linesNovember,
          response_id: results.formresponse.response_id,
        },
        {
          attrib_id: 77,
          value: linesDecember,
          response_id: results.formresponse.response_id,
        },
      ];

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      const deletenull = db.none(
        "DELETE from formquestionresponse where value is null and response_id = $1",
        [parseInt(results.formresponse.response_id)]
      );

      req.flash("info", "Form has been submitted. Thank you.");
      res.redirect("/");
    })
    .catch((error) => {
      console.log(error);
      if (error) {
        req.flash(
          "error",
          "There has been a error. Try again or submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

// ECE Credit Tracking

exports.ececredittracking = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      "SELECT * from company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );
    const classTypes = await t.manyOrNone("SELECT * from classtypes");
    const staffMembers = await t.manyOrNone(
      "SELECT u.first_name, u.last_name, u.id, d.degree, dt.degree_type from useraccount u INNER JOIN degree_types dt on u.degree_type = dt.type_id INNER JOIN degrees d on dt.type_id = d.degree_id INNER JOIN company c on u.company_id = c.id WHERE c.id = $1",
      [companyDetails.company_id]
    );
    return { companyDetails, staffMembers, classTypes };
  })
    .then((results) => {
      res.render("./forms/ececredittracking", {
        user: req.user,
        companyName: results.companyDetails,
        staffMembers: results.staffMembers,
        currentYear,
        previousYear,
        nextYear,
        classTypes: results.classTypes,
      });
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          "error",
          "There has been a error. Your company may not have any Staff Members. Try again or submit a Support Ticket."
        );
        res.redirect("/");
      }
    });
};

exports.ececredittrackingpost = function (req, res, next) {
  db.tx(async (t) => {
    const companyAccount = await t.one(
      "SELECT c.id, u.company_id, c.company_name from company c INNER JOIN useraccount u on c.id = u.company_id where u.username = $1",
      [req.user.user]
    );
    const staffMembers = await t.manyOrNone(
      "SELECT u.first_name, u.last_name, u.id, d.degree, dt.degree_type from useraccount u INNER JOIN degree_types dt on u.degree_type = dt.type_id INNER JOIN degrees d on dt.type_id = d.degree_id INNER JOIN company c on u.company_id = c.id WHERE c.id = $1",
      [companyAccount.company_id]
    );
    const insertForm = await t.one(
      "INSERT INTO formresponse(form_id, company_id) values (7, $1) returning response_id",
      [companyAccount.company_id]
    );
    return { companyAccount, staffMembers, insertForm };
  })
    .then((result) => {
      const cs = new pgp.helpers.ColumnSet(
        [
          {
            name: "attrib_id",
          },
          {
            name: "value",
          },
          {
            name: "response_id",
          },
        ],
        {
          table: "formquestionresponse",
        }
      );

      const values = [
        {
          attrib_id: 78,
          value: result.companyAccount.company_name,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 79,
          value: req.body.date,
          response_id: result.insertForm.response_id,
        },
      ];

      const staffMembers = result.staffMembers;
      staffMembers.map((member) => {
        if (
          isEmpty(
            req.body[`${member.first_name}${member.last_name}ECEcredits`]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 82,
              value:
                req.body[`${member.first_name}${member.last_name}ECEcredits`],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[`${member.first_name}${member.last_name}Elementarycredits`]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 83,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Elementarycredits`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[`${member.first_name}${member.last_name}ECE Admincredits`]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 84,
              value:
                req.body[
                  `${member.first_name}${member.last_name}ECE Admincredits`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[`${member.first_name}${member.last_name}Psychologycredits`]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 85,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Psychologycredits`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}Other ECE Relatedcredits`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 86,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Other ECE Relatedcredits`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}Other Non-ECE Relatedcredits`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 87,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Other Non-ECE Relatedcredits`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}ECEscholarshipaccessed`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 88,
              value: [
                req.body[
                  `${member.first_name}${member.last_name}ECEscholarshipaccessed`
                ],
              ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }

        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}Elementaryscholarshipaccessed`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 89,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Elementaryscholarshipaccessed`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}ECE Adminscholarshipaccessed`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 90,
              value:
                req.body[
                  `${member.first_name}${member.last_name}ECE Adminscholarshipaccessed`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}Psychologyscholarshipaccessed`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 91,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Psychologyscholarshipaccessed`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}Other ECE Relatedscholarshipaccessed`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 92,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Other ECE Relatedscholarshipaccessed`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        if (
          isEmpty(
            req.body[
              `${member.first_name}${member.last_name}Other Non-ECE Relatedscholarshipaccessed`
            ]
          ) == false
        ) {
          values.push(
            {
              attrib_id: 93,
              value:
                req.body[
                  `${member.first_name}${member.last_name}Other Non-ECE Relatedscholarshipaccessed`
                ],
              response_id: result.insertForm.response_id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
            }
          );
        }
        return values;
      });

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash("info", "Thank you for your form submission.");
      res.redirect("/");
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          "error",
          "There has been a error. Try again or submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

// Annual Report

exports.annualreport = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      "SELECT u.company_id, c.company_name, c.first_name,c.last_name, c.town, l.license_type from company c INNER JOIN license l ON c.license_type = l.id INNER JOIN useraccount u ON c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );
    const agesServed = await t.many(
      "SELECT * FROM agerange a INNER JOIN companyages ca ON a.id = ca.age_id WHERE ca.company_id = $1",
      [companyDetails.company_id]
    );
    return { companyDetails, agesServed };
  })
    .then((results) => {
      res.render("./forms/annualreport", {
        companyDetails: results.companyDetails,
        agesServed: results.agesServed,
        user: req.user,
        currentYear,
        previousYear,
        nextYear,
      });
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          "error",
          "An error has occured. Try again or submit a support ticket"
        );
        res.redirect("/");
      }
    });
};

exports.annualreportpost = function (req, res, next) {
  // not real code.
  db.tx(async (t) => {
    const formresponseid = await t
      .one("SELECT id FROM formresponse WHERE id = $1", [req.user.id])
      .then((results) => {
        res.json(results);
      });
  });

  // real code.
  res.send("NYI");
};
