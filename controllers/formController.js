var async = require("async");
var bcrypt = require("bcrypt");
var passport = require("passport");
var session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const app = require("../app");
const db = require("../db");
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
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
      "INSERT INTO formresponse(form_id, company_id, form_responses) VALUES (2, $1, $2:json) RETURNING response_id",
      [
        useraccount.company_id,
        {
          date: req.body.date,
          early_professional_one: req.body.earlyprofessionalgoalone,
          center_improvement_plan_one: req.body.centerimprovementgoalone,
          measurements_one_choice: arraygoalone,
          items_bought_one: linesone,
          measurements_one: {
            measuretypeone: req.body.measuretypeindicatoronechoice1,
            indicator_one: req.body.indicatorgoalonechoice1,
            previousyear_score_one: req.body.previousyearsscoregoalonechoice1,
            current_year_one: req.body.currentyearscoregoalonechoice1,
            measuretypetwo: req.body.measuretypeindicatoronechoice2,
            indicator_two: req.body.indicatorgoalonechoice2,
            previousyear_score_two: req.body.previousyearsscoregoalonechoice2,
            current_year_two: req.body.currentyearscoregoalonechoice2,
            measuretypethree: req.body.measuretypeindicatoronechoice3,
            indicator_three: req.body.indicatorgoalonechoice3,
            previousyear_score_three: req.body.previousyearsscoregoalonechoice3,
            current_year_three: req.body.currentyearscoregoalonechoice3,
            measuretypefour: req.body.measuretypeindicatoronechoice4,
            indicator_four: req.body.indicatorgoalonechoice4,
            previousyear_score_four: req.body.previousyearsscoregoalonechoice4,
            current_year_four: req.body.currentyearscoregoalonechoice4,
            measuretypefive: req.body.measuretypeindicatoronechoice5,
            indicator_five: req.body.indicatorgoalonechoice5,
            previousyear_score_five: req.body.previousyearsscoregoalonechoice5,
            current_year_five: req.body.currentyearscoregoalonechoice5,
            measuretypesix: req.body.measuretypeindicatoronechoice6,
            indicator_six: req.body.indicatorgoalonechoice6,
            previousyear_score_six: req.body.previousyearsscoregoalonechoice6,
            current_year_six: req.body.currentyearscoregoalonechoice6,
            measuretypeseven: req.body.measuretypeindicatoronechoice7,
            indicator_seven: req.body.indicatorgoalonechoice7,
            previousyear_score_seven: req.body.previousyearsscoregoalonechoice7,
            current_year_seven: req.body.currentyearscoregoalonechoice7,
          },
          narrative_one: req.body.narrativeforgoalone,
          // form entry 2
          center_improvement_plan_two: req.body.centerimprovementgoaltwo,
          measurements_two_choice: arraygoaltwo,
          items_bought_two: linestwo,
          measurements_two: {
            measuretypeone: req.body.measuretypeindicatortwoochoice1,
            indicator_one: req.body.indicatorgoaltwoochoice1,
            previousyear_score_one: req.body.previousyearsscoregoaltwochoice1,
            current_year_one: req.body.currentyearscoregoaltwochoice1,
            measuretypetwo: req.body.measuretypeindicatortwochoice2,
            indicator_two: req.body.indicatorgoaltwochoice2,
            previousyear_score_two: req.body.previousyearsscoregoaltwochoice2,
            current_year_two: req.body.currentyearscoregoaltwochoice2,
            measuretypethree: req.body.measuretypeindicatortwochoice3,
            indicator_three: req.body.indicatorgoaltwochoice3,
            previousyear_score_three: req.body.previousyearsscoregoaltwochoice3,
            current_year_three: req.body.currentyearscoregoaltwochoice3,
            measuretypefour: req.body.measuretypeindicatortwochoice4,
            indicator_four: req.body.indicatorgoaltwochoice4,
            previousyear_score_four: req.body.previousyearsscoregoaltwochoice4,
            current_year_four: req.body.currentyearscoregoaltwochoice4,
            measuretypefive: req.body.measuretypeindicatortwochoice5,
            indicator_five: req.body.indicatorgoaltwochoice5,
            previousyear_score_five: req.body.previousyearsscoregoaltwochoice5,
            current_year_five: req.body.currentyearscoregoaltwochoice5,
            measuretypesix: req.body.measuretypeindicatortwochoice6,
            indicator_six: req.body.indicatorgoaltwochoice6,
            previousyear_score_six: req.body.previousyearsscoregoaltwochoice6,
            current_year_six: req.body.currentyearscoregoaltwochoice6,
            measuretypeseven: req.body.measuretypeindicatortwochoice7,
            indicator_seven: req.body.indicatorgoaltwochoice7,
            previousyear_score_seven: req.body.previousyearsscoregoaltwochoice7,
            current_year_seven: req.body.currentyearscoregoalonechoice7,
          },
          narrative_two: req.body.narrativeforgoaltwo,
          // form 3
          center_improvement_plan_three: req.body.centerimprovementgoalthree,
          measurements_three: arraygoalthree,
          items_bought_three: linesthree,
          measurements_three_choice: {
            measuretypeone: req.body.measuretypeindicatorthreechoice1,
            indicator_one: req.body.indicatorgoalthreechoice1,
            previousyear_score_one: req.body.previousyearsscoregoalthreechoice1,
            current_year_one: req.body.currentyearscoregoalthreechoice1,
            measuretypetwo: req.body.measuretypeindicatorthreechoice2,
            indicator_two: req.body.indicatorgoalthreechoice2,
            previousyear_score_two: req.body.previousyearsscoregoalthreechoice2,
            current_year_two: req.body.currentyearscoregoalthreechoice2,
            measuretypethree: req.body.measuretypeindicatorthreechoice3,
            indicator_three: req.body.indicatorgoalthreechoice3,
            previousyear_score_three:
              req.body.previousyearsscoregoalthreechoice3,
            current_year_three: req.body.currentyearscoregoalthreechoice3,
            measuretypefour: req.body.measuretypeindicatorthreechoice4,
            indicator_four: req.body.indicatorgoalthreechoice4,
            previousyear_score_four:
              req.body.previousyearsscoregoalthreechoice4,
            current_year_four: req.body.currentyearscoregoalthreechoice4,
            measuretypefive: req.body.measuretypeindicatorthreechoice5,
            indicator_five: req.body.indicatorgoalthreechoice5,
            previousyear_score_five:
              req.body.previousyearsscoregoalthreechoice5,
            current_year_five: req.body.currentyearscoregoalthreechoice5,
            measuretypesix: req.body.measuretypeindicatorthreechoice6,
            indicator_six: req.body.indicatorgoalthreechoice6,
            previousyear_score_six: req.body.previousyearsscoregoalthreechoice6,
            current_year_six: req.body.currentyearscoregoalthreechoice6,
            measuretypeseven: req.body.measuretypeindicatorthreechoice7,
            indicator_seven: req.body.indicatorgoalthreechoice7,
            previousyear_score_seven:
              req.body.previousyearsscoregoalthreechoice7,
            current_year_seven: req.body.currentyearscoregoalthreechoice7,
          },
          narrative_three: req.body.narrativeforgoalthree,
        },
      ]
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
