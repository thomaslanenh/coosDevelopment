var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var isEmpty = require("lodash.isempty");
var todaysDate = new Date();
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
      "SELECT company_name, c.id, first_name, last_name FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1",
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
 const arrayCheck = (values, formresponse) => {
    console.log('Array Check Hit?')
    for (var x = 1; x >= 7; x++) {
      console.log('for looop hit')
      if (isEmpty(req.body[`goal${x}`]) == false) {
        console.log('first is empty hit')
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
  
      if (isEmpty(req.body[`itemdescription${x}`] + x) == false) {
        values.push({
          attrib_id: 26,
          value: req.body.itemdescription + x,
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
    return values
  }
  const cs = new pgp.helpers.ColumnSet(["attrib_id", "value", "response_id"], {
    table: "formquestionresponse",
  });

  
  db.tx(async (t) => {

    
    const companyDetails = await db.one(
      "SELECT company_name, c.id, first_name, last_name FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1",
      [req.user.user]
    );
  
    const insertedForm =  await db.one(
      "INSERT INTO formresponse(company_id, form_id) VALUES ($1, 3) RETURNING response_id",
      [companyDetails.id]
    );

    const values = [
      {
        attrib_id: 20,
        value: companyDetails.company_name,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 19,
        value: companyDetails.first_name + " " + companyDetails.last_name,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 18,
        value: req.body.date,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 21,
        value: req.body.licensedchildren,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 22,
        value: req.body.currentchildren,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 37,
        value: req.body.totalestimatedcost,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 38,
        value: req.body.totalestimatedshippingcost,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 39,
        value: req.body.amountawarded,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 40,
        value: req.body.amountspent,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 41,
        value: req.body.totalactualcostfinal,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 42,
        value: req.body.totalshippingcostfinal,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 44,
        value: req.body.allitemspurchased,
        response_id: insertedForm.response_id,
      },
      {
        attrib_id: 43,
        value: req.body.allreceiptssubmitted,
        response_id: insertedForm.response_id,
      },
    ];
    
    const arrayed = await arrayCheck(values, insertedForm.response_id)
    const query = pgp.helpers.insert(values, cs);
        const recordsResponse = await t.none(query);
  })
    .then((results) => {
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
