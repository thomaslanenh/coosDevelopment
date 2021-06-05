var async = require('async');
var bcrypt = require('bcrypt');
var passport = require('passport');
var session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const app = require('../app');
const db = require('../db');
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var nextYear = new Date().getFullYear() + 1;
var isEmpty = require('lodash.isempty');
const path = require('path');
var NodeGoogleDrive = require('node-google-drive');
const { ColumnSet } = require('pg-promise');
const { NULL } = require('node-sass');
var todaysDate = new Date();

var multer = require('multer');

const ROOT_FOLDER = '1LOJ5KvYGLbeU2-C6Sz9qyi-iSfnAfkhW',
  PATH_TO_CREDENTIALS = path.resolve(`${__dirname}/my-credentials.json`);

// google drive
async function PhotoUploader() {
  const creds_service_user = require(PATH_TO_CREDENTIALS);

  const googleDriveInstance = new NodeGoogleDrive({
    ROOT_FOLDER: ROOT_FOLDER,
  });

  let gdrive = await googleDriveInstance.useServiceAccountAuth(
    creds_service_user
  );

  let folderResponse = await googleDriveInstance.listFolders(
    ROOT_FOLDER,
    null,
    false
  );

  let listFilesResponse = await googleDriveInstance.listFiles(
    ROOT_FOLDER,
    null,
    false
  );

  for (let file of listFilesResponse.files) {
    console.log({ file });
  }
}

function inputSkipper(column) {
  console.log(column.value);
  if (isEmpty(column.value)) {
    return column.value === 'null';
  }
  return column;
}

const pgp = require('pg-promise')({
  /* initialization options */
  capSQL: true, // capitalize all generated SQL
});

// submit photos
exports.submitphotos = function (req, res, next) {
  res.render('./forms/submitphotos', {
    user: req.user,
    currentYear,
    nextYear,
    previousYear,
  });
};

exports.submitphotos_post = function (req, res, next) {
  res.send('NYI');
};

// submit receipts
exports.submitreceipts = function (req, res, next) {
  res.render('./forms/submitreceipts', {
    user: req.user,
    currentYear,
    previousYear,
    nextYear,
  });
};

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
  res.render('./forms/qiaprogress', {
    user: req.user,
    years: options,
    currentYear,
  });
};

exports.qiaprogress_post = async function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id= u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) VALUES(1, $1) RETURNING response_id',
      [companyDetails.company_id]
    );

    const cs = new pgp.helpers.ColumnSet(
      [
        {
          name: 'value',
        },
        {
          name: 'attrib_id',
        },
        {
          name: 'response_id',
          def: insertForm.response_id,
        },
      ],
      {
        table: 'formquestionresponse',
      }
    );

    const values = [
      {
        attrib_id: 1,
        value: req.body['1'],
      },
      {
        attrib_id: 2,
        value: req.body['2'],
      },
      {
        attrib_id: 4,
        value: req.body['4'],
      },
      {
        attrib_id: 5,
        value: req.body['5'],
      },
    ];

    var linesone = req.body['3']
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line);

    linesone.map((line) => {
      values.push({
        value: line,
        attrib_id: 3,
      });
      return values;
    });

    const query = pgp.helpers.insert(values, cs);
    const responseInsert = await t.none(query);

    return { companyDetails, insertForm };
  })
    .then((results) => {
      req.flash('info', 'Your form has been succesfully submitted.');
      res.redirect('/');
    })
    .catch((e) => {
      console.log(e);
      req.flash(
        'error',
        'An error has occured. Please try again or submit a support ticket.'
      );
      res.redirect('/');
    });
};

// QIA Outcome

exports.qiaoutcome = async function (req, res, next) {
  let measures = db
    .any('SELECT * from qualitymeasures ORDER BY measure_id desc')
    .then((results) => {
      res.render('./forms/qiaoutcome', {
        user: req.user,
        currentYear,
        previousYear,
        measures: results,
      });
    })
    .catch((error) => {
      if (error) {
        req.flash(
          'error',
          'There was a error, please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.qiaoutcome_post = async function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id= u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) VALUES(2, $1) RETURNING response_id',
      [companyDetails.company_id]
    );

    const cs = new pgp.helpers.ColumnSet(
      [
        {
          name: 'value',
        },
        {
          name: 'attrib_id',
        },
        {
          name: 'measure_id',
          def: 8,
        },
        {
          name: 'response_id',
          def: insertForm.response_id,
        },
      ],
      {
        table: 'formquestionresponse',
      }
    );

    const values = [
      {
        value: req.body['16'],
        attrib_id: 16,
      },
      {
        value: req.body['17'],
        attrib_id: 17,
      },
    ];

    // loops over goals in the list and adds them to values
    let goalsList = [81, 82, 83];

    goalsList.map((goal) => {
      if (req.body[`${goal}`].length <= 0) {
        return;
      } else {
        values.push({
          value: req.body[`${goal}`],
          attrib_id: 8,
        });
        return values;
      }
    });

    // loops over quality measurement select fields and adds them to values

    let qmSelects = [91, 92, 93];

    qmSelects.map((qm) => {
      let qmSelections = req.body[`${qm}`];

      if (qmSelections.length > 0) {
        if (Array.isArray(qmSelections)) {
          qmSelections.map((quality) => {
            values.push({
              value: quality,
              attrib_id: 9,
            });
            return values;
          });
        } else {
          values.push({
            value: req.body[`${qm}`],
            attrib_id: 9,
          });
          return values;
        }
      } else {
        return;
      }
    });

    // turn items bought entries into seperate fields, fields 101, 102 & 103

    var linesone = req.body['101']
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line);

    var linestwo = req.body['102']
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line);

    var linesthree = req.body['103']
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line);

    linesone.map((line) => {
      values.push({
        value: line,
        attrib_id: 10,
      });
      return values;
    });

    linestwo.length > 0
      ? linestwo.map((line) => {
          values.push({
            value: line,
            attrib_id: 10,
          });
          return values;
        })
      : null;

    linesthree.length > 0
      ? linesthree.map((line) => {
          values.push({
            value: line,
            attrib_id: 10,
          });
          return values;
        })
      : null;

    // quality measures

    let rowsQM = [1, 2, 3, 4, 5, 6, 7, 8];
    let totalRows = [1, 2, 3];

    totalRows.map((instance) => {
      rowsQM.map((row) => {
        let measure_id = parseInt(req.body[`qm${row}${instance}`]);
        if (measure_id >= 1 && measure_id != 8) {
          values.push(
            {
              value: req.body[`12${row}${instance}`],
              attrib_id: 12,
              measure_id: measure_id,
            },
            {
              value: req.body[`13${row}${instance}`],
              attrib_id: 13,
              measure_id: measure_id,
            },
            {
              value: req.body[`14${row}${instance}`],
              attrib_id: 14,
              measure_id: measure_id,
            }
          );
          return values;
        } else {
          return;
        }
      });
      return values;
    });

    // narrative set loop
    let narratives = [1, 2, 3];

    narratives.map((nar) => {
      if (req.body[`15${nar}`].length > 1) {
        values.push({
          value: req.body[`15${nar}`],
          attrib_id: 15,
        });
        return values;
      } else {
        return;
      }
    });

    const query = pgp.helpers.insert(values, cs);
    const responseInsert = await t.none(query);

    return { companyDetails, insertForm };
  })
    .then((results) => {
      req.flash('info', 'Your form has been succesfully submitted.');
      res.redirect('/');
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'An error has occured. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

// QIA Detailed Budget

exports.detailedbudget = function (req, res, next) {
  db.tx(async (t) => {
    const companydetails = await t.one(
      'SELECT c.company_name, c.id, u.first_name, u.last_name FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    return companydetails;
  })
    .then((results) => {
      res.render('./forms/qiabudget', {
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
          'error',
          'There was a error. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.detailedbudgetpost = function (req, res, next) {
  const arrayCheck = async (values, formresponse) => {
    // validation for loop
    for (var x = 1; x <= 7; x++) {
      console.log('for looop hit');
      if (isEmpty(req.body[`goal${x}`]) == false) {
        console.log('first is empty hit');
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
  const cs = new pgp.helpers.ColumnSet(['attrib_id', 'value', 'response_id'], {
    table: 'formquestionresponse',
  });

  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT c.company_name, c.id, u.first_name, u.last_name FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );

    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyDetails.company_name]
    );

    const insertedForm = await t.one(
      'INSERT INTO formresponse(company_id, form_id) VALUES ($1, 3) RETURNING response_id',
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
          attrib_id: 246,
          value: req.body.receiptnames,
          response_id: results.insertedForm.response_id,
        },
        {
          attrib_id: 19,
          value:
            results.companyDetails.first_name +
            ' ' +
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
      req.flash('info', 'Your form has been succesfully submitted. Thank you!');
      res.redirect('/thanks');
    })
    .catch((error) => {
      console.log(error);
      req.flash(
        'error',
        'An error has occured. Please try again or submit a support ticket.'
      );
      res.redirect('/');
    });
};

// center improvement

exports.centerimprovement = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT c.id, company_name, address, email, phone_number FROM company c INNER JOIN useraccount u ON c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );

    const qualityMeasures = await t.many('SELECT * from qualitymeasures');
    return { companyDetails, qualityMeasures };
  })
    .then((results) => {
      res.render('./forms/qiacenterimprovement', {
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
          'error',
          'An error occured. Please try again or submit a support ticket.'
        );
        res.redirect('/');
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

  const cs = new pgp.helpers.ColumnSet(['attrib_id', 'value', 'response_id'], {
    table: 'formquestionresponse',
  });

  db.tx(async (t) => {
    const companyid = await t.one(
      'SELECT c.id, c.company_name, c.address, c.phone_number, u.email from company c INNER JOIN useraccount u on c.id = u.company_id where u.username = $1',
      [req.user.user]
    );

    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyid.company_name]
    );

    const formResponse = await t.one(
      'INSERT INTO formresponse(company_id, form_id) values($1, 4) RETURNING response_id',
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

      req.flash('info', 'Form succesfully submitted.');
      res.redirect('/');
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          'error',
          'An error occured. Try again or please submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

// staff meeting tracker form
exports.staffmeetingtracker = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT * from company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    return { companyDetails };
  }).then((results) => {
    res.render('./forms/staffmeetingtracker', {
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
        name: 'attrib_id',
      },
      {
        name: 'value',
        skip(col) {
          return col.value === null || col.value === undefined;
        },
      },
      {
        name: 'response_id',
      },
    ],
    {
      table: 'formquestionresponse',
    }
  );

  db.tx(async (t) => {
    const useraccount = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name from company c inner join useraccount u on c.id = u.company_id where u.username = $1',
      [req.user.user]
    );

    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), useraccount.company_name]
    );

    const formresponse = await t.one(
      'INSERT INTO formresponse(form_id, company_id) VALUES (6, $1) RETURNING response_id',
      [useraccount.company_id]
    );

    return { useraccount, formresponse };
  })
    .then((results) => {
      var linesJanuary =
        req.body.januarydates.length > 0
          ? req.body.januarydates.split(', ' || ',' || ' ')
          : null;

      var linesFebruary =
        req.body.februarydates.length > 0
          ? req.body.februarydates.split(', ' || ',' || ' ')
          : null;

      var linesMarch =
        req.body.marchdates.length > 0
          ? req.body.marchdates.split(', ' || ',' || ' ')
          : null;

      var linesApril =
        req.body.aprildates.length > 0
          ? req.body.aprildates.split(', ' || ',' || ' ')
          : null;

      var linesMay =
        req.body.maydates.length > 0
          ? req.body.maydates.split(', ' || ',' || ' ')
          : null;

      var linesJune =
        req.body.junedates.length > 0
          ? req.body.junedates.split(', ' || ',' || ' ')
          : null;

      var linesJuly =
        req.body.julydates.length > 0
          ? req.body.julydates.split(', ' || ',' || ' ')
          : null;

      var linesAugust =
        req.body.augustdates.length > 0
          ? req.body.augustdates.split(', ' || ',' || ' ')
          : null;

      var linesSeptember =
        req.body.septemberdates.length > 0
          ? req.body.septemberdates.split(', ' || ',' || ' ')
          : null;

      var linesOctober =
        req.body.octoberdates.length > 0
          ? req.body.septemberdates.split(', ' || ',' || ' ')
          : null;

      var linesNovember =
        req.body.novemberdates.length > 0
          ? req.body.novemberdates.split(', ' || ',' || ' ')
          : null;

      var linesDecember =
        req.body.decemberdates.length > 0
          ? req.body.decemberdates.split(', ' || ',' || ' ')
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
            ' ' +
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
        'DELETE from formquestionresponse where value is null and response_id = $1',
        [parseInt(results.formresponse.response_id)]
      );

      req.flash('info', 'Form has been submitted. Thank you.');
      res.redirect('/');
    })
    .catch((error) => {
      console.log(error);
      if (error) {
        req.flash(
          'error',
          'There has been a error. Try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

// Staff Credential Tracking
exports.credentials = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT * from company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    const classTypes = await t.manyOrNone('SELECT * from classtypes');
    const staffMembers = await t.manyOrNone(
      'SELECT u.first_name, u.last_name, u.id, t.type, d.degree, dt.degree_type from useraccount u INNER JOIN usertypes t ON u.user_type = t.type_ref INNER JOIN degree_types dt on u.degree_type = dt.type_id INNER JOIN degrees d on u.degree =  d.degree_id WHERE u.company_id = $1 ORDER BY t.type ASC, u.last_name asc',
      [companyDetails.company_id]
    );

    return { companyDetails, staffMembers, classTypes };
  })
    .then((results) => {
      res.render('./forms/credentials', {
        user: req.user,
        currentYear,
        previousYear,
        nextYear,
        companyName: results.companyDetails,
        staffMembers: results.staffMembers,
        classTypes: results.classTypes,
      });
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'There has been a error. Your company may not have any Staff Members. Try again or submit a Support Ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.credentials_post = function (req, res, next) {
  db.tx(async (t) => {
    const companyAccount = await t.one(
      'SELECT c.id, u.company_id, c.company_name from company c INNER JOIN useraccount u on c.id = u.company_id where u.username = $1',
      [req.user.user]
    );
    const staffMembers = await t.manyOrNone(
      'SELECT u.first_name, u.last_name, u.id, d.degree, dt.degree_type from useraccount u INNER JOIN degree_types dt on u.degree_type = dt.type_id INNER JOIN degrees d on dt.type_id = d.degree_id INNER JOIN company c on u.company_id = c.id WHERE c.id = $1',
      [companyAccount.company_id]
    );
    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyAccount.company_name]
    );

    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) values (18, $1) returning response_id',
      [companyAccount.company_id]
    );
    return { companyAccount, staffMembers, insertForm };
  })
    .then((result) => {
      const cs = new pgp.helpers.ColumnSet(
        [
          {
            name: 'attrib_id',
          },
          {
            name: 'value',
          },
          {
            name: 'response_id',
          },
          {
            name: 'staff_id',
            def: null,
          },
        ],
        {
          table: 'formquestionresponse',
        }
      );

      const values = [
        {
          attrib_id: 249,
          value: result.companyAccount.company_name,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 250,
          value: req.body.date,
          response_id: result.insertForm.response_id,
        },
      ];

      const staffMembers = result.staffMembers;

      staffMembers.map((member) => {
        values.push(
          {
            attrib_id: 251,
            value: member.first_name + ' ' + member.last_name,
            response_id: result.insertForm.response_id,
            staff_id: member.id,
          },
          {
            attrib_id: 252,
            value:
              req.body[
                `${member.first_name}${member.last_name}credentialPreviousYear`
              ],
            response_id: result.insertForm.response_id,
            staff_id: member.id,
          },
          {
            attrib_id: 253,
            value:
              req.body[`${member.first_name}${member.last_name}credentialType`],
            response_id: result.insertForm.response_id,
            staff_id: member.id,
          },
          {
            attrib_id: 254,
            value: req.body[`${member.first_name}${member.last_name}inTod`],
            response_id: result.insertForm.response_id,
            staff_id: member.id,
          },

          {
            attrib_id: 255,
            value:
              req.body[`${member.first_name}${member.last_name}expirationDate`],
            response_id: result.insertForm.response_id,
            staff_id: member.id,
          }
        );
      });

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash('info', 'Thank you for your form submission.');
      res.redirect('/');
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'An error has occured. Please try again or submit a support ticket'
        );
        res.redirect('/');
      }
    });
};

// ECE Credit Tracking

exports.ececredittracking = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT * from company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    const classTypes = await t.manyOrNone('SELECT * from classtypes');
    const staffMembers = await t.manyOrNone(
      'SELECT u.first_name, u.last_name, u.id, t.type, d.degree, dt.degree_type from useraccount u INNER JOIN usertypes t ON u.user_type = t.type_ref INNER JOIN degree_types dt on u.degree_type = dt.type_id INNER JOIN degrees d on u.degree =  d.degree_id WHERE u.company_id = $1 ORDER BY t.type ASC, u.last_name asc',
      [companyDetails.company_id]
    );

    return { companyDetails, staffMembers, classTypes };
  })
    .then((results) => {
      res.render('./forms/ececredittracking', {
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
          'error',
          'There has been a error. Your company may not have any Staff Members. Try again or submit a Support Ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.ececredittrackingpost = function (req, res, next) {
  db.tx(async (t) => {
    const companyAccount = await t.one(
      'SELECT c.id, u.company_id, c.company_name from company c INNER JOIN useraccount u on c.id = u.company_id where u.username = $1',
      [req.user.user]
    );
    const staffMembers = await t.manyOrNone(
      'SELECT u.first_name, u.last_name, u.id, d.degree, dt.degree_type from useraccount u INNER JOIN degree_types dt on u.degree_type = dt.type_id INNER JOIN degrees d on dt.type_id = d.degree_id INNER JOIN company c on u.company_id = c.id WHERE c.id = $1',
      [companyAccount.company_id]
    );
    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyAccount.company_name]
    );

    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) values (7, $1) returning response_id',
      [companyAccount.company_id]
    );
    return { companyAccount, staffMembers, insertForm };
  })
    .then((result) => {
      const cs = new pgp.helpers.ColumnSet(
        [
          {
            name: 'attrib_id',
          },
          {
            name: 'value',
          },
          {
            name: 'response_id',
          },
          {
            name: 'staff_id',
            def: null,
          },
        ],
        {
          table: 'formquestionresponse',
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
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
              staff_id: member.id,
            },
            {
              attrib_id: 80,
              value: `${member.first_name} ${member.last_name}`,
              response_id: result.insertForm.response_id,
              staff_id: member.id,
            }
          );
        }
        return values;
      });

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash('info', 'Thank you for your form submission.');
      res.redirect('/');
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          'error',
          'There has been a error. Try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

// ecers report

// exports.ecersdata = function (req, res, next) {
//   db.tx(async (t) => {
//     const companyDetails = await t.one(
//       'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u  ON c.id = u.company_id  WHERE u.username = $1',
//       [req.user.user]
//     );
//     return { companyDetails };
//   })
//     .then((results) => {
//       res.render('./forms/ecersdata.pug', {
//         companyDetails: results.companyDetails,
//         currentYear,
//         user: req.user,
//         previousYear,
//         nextYear,
//       });
//     })
//     .catch((e) => {
//       if (e) {
//         console.log(e);
//         req.flash(
//           'error',
//           'An error has occured, please try again or submit a support ticket.'
//         );
//         res.redirect('/');
//       }
//     });
// };

// exports.ecersdatapost = function (req, res, next) {
//   res.send('NYI');
// };

// ipdip form
exports.ipdip = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    const staffMembers = await t.any(
      'SELECT u.first_name, u.last_name, t.type FROM useraccount u INNER JOIN usertypes t ON u.user_type = t.type_ref WHERE u.company_id = $1 ORDER BY t.type ASC, u.last_name ASC',
      [companyDetails.company_id]
    );
    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyDetails.company_name]
    );

    return { companyDetails, staffMembers };
  }).then((results) => {
    res.render('./forms/ipdp.pug', {
      companyDetails: results.companyDetails,
      staffMembers: results.staffMembers,
      currentYear,
      user: req.user,
      previousYear,
      nextYear,
    });
  });
};

exports.ipdippost = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyDetails.company_name]
    );

    const staffMembers = await t.any(
      'SELECT u.first_name, u.last_name, u.id from useraccount u where u.company_id = $1',
      [companyDetails.company_id]
    );
    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) VALUES(9, $1) RETURNING response_id',
      [companyDetails.company_id]
    );

    return { companyDetails, staffMembers, insertForm };
  })
    .then((results) => {
      const cs = new pgp.helpers.ColumnSet(
        [
          {
            name: 'attrib_id',
          },
          {
            name: 'value',
          },
          {
            name: 'response_id',
          },
          {
            name: 'staff_id',
            def: null,
          },
        ],
        {
          table: 'formquestionresponse',
        }
      );

      const values = [
        {
          attrib_id: 217,
          value: results.companyDetails.company_name,
          response_id: results.insertForm.response_id,
        },
        {
          attrib_id: 218,
          value: `${results.companyDetails.first_name} ${results.companyDetails.last_name}`,
          response_id: results.insertForm.response_id,
        },
        {
          attrib_id: 223,
          value: req.body[223],
          response_id: results.insertForm.response_id,
        },
      ];

      const staffList = results.staffMembers;

      staffList.map((staff) => {
        values.push(
          {
            attrib_id: 219,
            value: staff.first_name + ' ' + staff.last_name,
            response_id: results.insertForm.response_id,
            staff_id: staff.id,
          },
          {
            attrib_id: 220,
            value: req.body[`${staff.first_name}${staff.last_name}220`],
            response_id: results.insertForm.response_id,
            staff_id: staff.id,
          },
          {
            attrib_id: 221,
            value: req.body[`${staff.first_name}${staff.last_name}221`],
            response_id: results.insertForm.response_id,
            staff_id: staff.id,
          },
          {
            attrib_id: 222,
            value: req.body[`${staff.first_name}${staff.last_name}222`],
            response_id: results.insertForm.response_id,
            staff_id: staff.id,
          }
        );
        return values;
      });

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash('info', 'Thank you for your form submission.');
      res.redirect('/thanks');
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'An error has occured. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

// ASQ Consent Form
exports.asqconsent = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );

    return { companyDetails };
  })
    .then((results) => {
      res.render('./forms/asqconsent.pug', {
        companyDetails: results.companyDetails,
        currentYear,
        previousYear,
        nextYear,
        user: req.user,
      });
    })
    .catch((e) => {
      if (e) {
        req.flash(
          'error',
          'An error has occured. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.asqconsentpost = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id= u.company_id WHERE u.username = $1',
      [req.user.user]
    );
    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) VALUES(10, $1) RETURNING response_id',
      [companyDetails.company_id]
    );
    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyDetails.company_name]
    );

    return { companyDetails, insertForm };
  })
    .then((response) => {
      const cs = new pgp.helpers.ColumnSet(
        [
          {
            name: 'attrib_id',
          },
          {
            name: 'value',
          },
          {
            name: 'response_id',
          },
        ],
        {
          table: 'formquestionresponse',
        }
      );

      let values = [
        {
          attrib_id: 224,
          value: response.companyDetails.company_name,
          response_id: response.insertForm.response_id,
        },
        {
          attrib_id: 225,
          value:
            response.companyDetails.first_name +
            ' ' +
            response.companyDetails.last_name,
          response_id: response.insertForm.response_id,
        },
      ];

      let x = 226;

      while (x <= 245) {
        values.push({
          attrib_id: x,
          value: req.body[x],
          response_id: response.insertForm.response_id,
        });

        x++;
      }

      // for (const field in datahome) {
      //   values.push({
      //     attrib_id: parseInt(field),
      //     value: req.body[field],
      //   });
      // }

      console.log(values);

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash('info', 'Thank you for your form submission.');
      res.redirect('/thanks');
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'An error has occured. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

// Annual Report

exports.annualreport = function (req, res, next) {
  db.tx(async (t) => {
    const companyDetails = await t.one(
      'SELECT u.company_id, c.company_name, c.first_name,c.last_name, c.town, l.license_type from company c INNER JOIN license l ON c.license_type = l.id INNER JOIN useraccount u ON c.id = u.company_id WHERE u.username = $1',
      [req.user.user]
    );

    return { companyDetails };
  })
    .then((results) => {
      res.render('./forms/annualreport', {
        companyDetails: results.companyDetails,
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
          'error',
          'An error has occured. Try again or submit a support ticket'
        );
        res.redirect('/');
      }
    });
};

exports.annualreportpost = function (req, res, next) {
  let engagingfamilies = req.body.engagingfamilies;
  let extrafundingsources = req.body.extrafundingsources;

  db.tx(async (t) => {
    const companyAccount = await t.one(
      'SELECT c.id, u.company_id, c.company_name from company c INNER JOIN useraccount u on c.id = u.company_id where u.username=$1',
      [req.user.user]
    );
    const insertForm = await t.one(
      'INSERT INTO formresponse(form_id, company_id) values (8, $1) returning response_id',
      [companyAccount.company_id]
    );
    let profileUpdate = await db.none(
      'UPDATE company SET last_modified = to_timestamp($1 / 1000.0) WHERE company_name = $2',
      [Date.now(), companyAccount.company_name]
    );

    return { companyAccount, insertForm };
  })
    .then((result) => {
      console.log(req.body);
      const cs = new pgp.helpers.ColumnSet(
        ['attrib_id', 'value', 'response_id'],
        {
          table: 'formquestionresponse',
        }
      );

      const values = [
        {
          attrib_id: 95,
          value: req.body.date,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 96,
          value: req.body.numberofchildrenserved,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 131,
          value: req.body.agesofchildrenserved,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 97,
          value: req.body[`${result.companyAccount.company_id}1coosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 98,
          value:
            req.body[`${result.companyAccount.company_id}1outofcoosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 257,
          value: req.body[`${result.companyAccount.company_id}2coosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 258,
          value:
            req.body[`${result.companyAccount.company_id}2outofcoosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 259,
          value: req.body[`${result.companyAccount.company_id}3coosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 260,
          value:
            req.body[`${result.companyAccount.company_id}3outofcoosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 99,
          value: req.body[`${result.companyAccount.company_id}4coosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 100,
          value:
            req.body[`${result.companyAccount.company_id}4outofcoosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 261,
          value: req.body[`${result.companyAccount.company_id}5coosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 262,
          value:
            req.body[`${result.companyAccount.company_id}5outofcoosnumber`],
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 101,
          value: req.body.birthenrollmentcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 102,
          value: req.body.birthenrollmentoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 103,
          value: req.body.kindergartenenrollmentcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 104,
          value: req.body.kindergartenenrollmentoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 105,
          value: req.body.beforeafterenrollmentcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 106,
          value: req.body.beforeafterenrollmentoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 107,
          value: req.body.birthdailyattendancecoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 108,
          value: req.body.birthdailyattendanceoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 109,
          value: req.body.kindergarteneattendancecoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 110,
          value: req.body.kindergartenattendanceoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 111,
          value: req.body.beforeafterattendancecoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 112,
          value: req.body.beforeafterattendanceoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 113,
          value: req.body.birthspecialneedscoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 114,
          value: req.body.birthspecialneedsoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 115,
          value: req.body.kindergartenspecialneedscoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 116,
          value: req.body.kindergartenspecialneedsoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 117,
          value: req.body.beforeafterspecialneedscoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 118,
          value: req.body.beforeafterspecialneedsoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 119,
          value: req.body.birthpovertylevelcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 120,
          value: req.body.birthpovertyleveloutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 121,
          value: req.body.kindergartenpovertycoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 122,
          value: req.body.kindergartenpovertyoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 123,
          value: req.body.beforeafterpovertycoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 124,
          value: req.body.beforeafterpovertyoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 125,
          value: req.body.birthstatescholarshipcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 126,
          value: req.body.birthstatescholarshipoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 127,
          value: req.body.kindergartenstatescholarshipcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 128,
          value: req.body.kindergartenstatescholarshipoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 129,
          value: req.body.beforeafterstatescholarshipcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 130,
          value: req.body.beforeafterstatescholarshipoutofcoos,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 133,
          value: req.body.totalnumberofstaff,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 134,
          value: req.body.numberoffulltimestaff,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 135,
          value: req.body.numberofparttimestaff,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 148,
          value: req.body.familymaterialsvroom,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 149,
          value: req.body.parentteacherconferences,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 151,
          value: req.body.otherengagingways,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 153,
          value: req.body.staffeligibletoapplyforcredential,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 154,
          value: req.body.staffwithavalidnhcredential,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 155,
          value: req.body.staffwithnewcredential,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 162,
          value: req.body.staffeducationbarriers,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 180,
          value: req.body.currentasqparticipationneeds,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 181,
          value: req.body.childrenwhoreceivedfollowupassesment,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 182,
          value: req.body.studentsparticipatedinotherscreenings,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 183,
          value: req.body.developmentalscreeningstraining,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 189,
          value: req.body.asqsupportneeded,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 190,
          value: req.body.birtrainingdescription,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 196,
          value: req.body.birsupportneeded,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 197,
          value: req.body.birreportusages,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 198,
          value: req.body.ebastrainingdescription,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 204,
          value: req.body.ebassupportneeded,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 205,
          value: req.body.ebasresultsinform,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 206,
          value: req.body.ebasreportusages,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 207,
          value: req.body.staffleftpreviousyear,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 208,
          value: req.body.staffhiredreplacedpreviousyear,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 209,
          value: req.body.staffhirednewpositionpreviousyear,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 210,
          value: req.body.positionsremaininginpreviousyear,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 211,
          value: req.body.covideffectonstaffturnover,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 212,
          value: req.body.reasonsstaffleftinpreviousyear,
          response_id: result.insertForm.response_id,
        },
        {
          attrib_id: 213,
          value: req.body.covidimpactonprogram,
          response_id: result.insertForm.response_id,
        },

        // Evidence-Based Assesment Systems is NExt
      ];

      if (isEmpty(extrafundingsources) == false) {
        extrafundingsources.map((source) => {
          values.push({
            attrib_id: 214,
            value: source,
            response_id: result.insertForm.response_id,
          });
        });
      }

      if (isEmpty(engagingfamilies) == false) {
        engagingfamilies.map((source) => {
          values.push({
            attrib_id: 150,
            value: source,
            response_id: result.insertForm.response_id,
          });
        });
      }

      if (isEmpty(req.body.asqstafftrained) == false) {
        values.push({
          attrib_id: 136,
          value: req.body.asqstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.pyramidmodelfacestafftrained) == false) {
        values.push({
          attrib_id: 137,
          value: req.body.pyramidmodelfacestafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.pyramidmodelonlinestafftrained) == false) {
        values.push({
          attrib_id: 138,
          value: req.body.pyramidmodelonlinestafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.pyramidmodelplcstafftrained) == false) {
        values.push({
          attrib_id: 139,
          value: req.body.pyramidmodelplcstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.tsgoldstafftrained) == false) {
        values.push({
          attrib_id: 140,
          value: req.body.tsgoldstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.corstafftrained) == false) {
        values.push({
          attrib_id: 141,
          value: req.body.corstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.drdpstafftrained) == false) {
        values.push({
          attrib_id: 142,
          value: req.body.drdpstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.creativecurriculumstafftrained) == false) {
        values.push({
          attrib_id: 143,
          value: req.body.creativecurriculumstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.highscopestafftrained) == false) {
        values.push({
          attrib_id: 144,
          value: req.body.highscopestafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.strengtheningfamiliesstafftrained) == false) {
        values.push({
          attrib_id: 145,
          value: req.body.strengtheningfamiliesstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.ncpmistafftrained) == false) {
        values.push({
          attrib_id: 146,
          value: req.body.ncpmistafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.earlylearningstandardsstafftrained) == false) {
        values.push({
          attrib_id: 147,
          value: req.body.earlylearningstandardsstafftrained,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.otherwaysofengagingfamily) == false) {
        values.push({
          attrib_id: 152,
          value: req.body.otherwaysofengagingfamily,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.staffwithfamilychildcarecredential) == false) {
        {
          values.push({
            attrib_id: 156,
            value: req.body.staffwithfamilychildcarecredential,
            response_id: result.insertForm.response_id,
          });
        }
      }

      if (isEmpty(req.body.staffwithearlychildhoodteachercredential) == false) {
        values.push({
          attrib_id: 157,
          value: req.body.staffwithearlychildhoodteachercredential,
          response_id: result.insertForm.response_id,
        });
      }

      if (
        isEmpty(req.body.staffwithearlychildhoodmasterteachercredential) ==
        false
      ) {
        values.push({
          attrib_id: 158,
          value: req.body.staffwithearlychildhoodmasterteachercredential,
          response_id: result.insertForm.response_id,
        });
      }

      if (
        isEmpty(req.body.staffwithearlychildhoodadministratorcredential) ==
        false
      ) {
        values.push({
          attrib_id: 159,
          value: req.body.staffwithearlychildhoodadministratorcredential,
          response_id: result.insertForm.response_id,
        });
      }

      if (
        isEmpty(req.body.staffwithearlychildhoodmasterprofessionalcredential) ==
        false
      ) {
        {
          values.push({
            attrib_id: 160,
            value: req.body.staffwithearlychildhoodmasterprofessionalcredential,
            response_id: result.insertForm.response_id,
          });
        }
      }

      if (
        isEmpty(req.body.staffwithearlychildhoodinfanttoddlercredential) ==
        false
      ) {
        values.push({
          attrib_id: 161,
          value: req.body.staffwithearlychildhoodinfanttoddlercredential,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.stafftrainingstories) == false) {
        values.push({
          attrib_id: 162,
          value: req.body.stafftrainingstories,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.firststquarternotattempted) == false) {
        values.push({
          attrib_id: 164,
          value: req.body.firststquarternotattempted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.firstquarterinprogress) == false) {
        values.push({
          attrib_id: 168,
          value: req.body.firstquarterinprogress,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.firstquartercompletedwith80minimum) == false) {
        values.push({
          attrib_id: 172,
          value: req.body.firstquartercompletedwith80minimum,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.firstquartertotalcriteriacompleted) == false) {
        values.push({
          attrib_id: 176,
          value: req.body.firstquartertotalcriteriacompleted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.secondquarternotattempted) == false) {
        values.push({
          attrib_id: 165,
          value: req.body.secondquarternotattempted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.secondquarterinprogress) == false) {
        values.push({
          attrib_id: 169,
          value: req.body.secondquarterinprogress,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.secondquartercompletedwith80minimum) == false) {
        values.push({
          attrib_id: 173,
          value: req.body.secondquartercompletedwith80minimum,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.secondquartertotalcriteriacompleted) == false) {
        values.push({
          attrib_id: 177,
          value: req.body.secondquartertotalcriteriacompleted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.thirdquarternotattempted) == false) {
        values.push({
          attrib_id: 166,
          value: req.body.thirdquarternotattempted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.thirdquarterinprogress) == false) {
        values.push({
          attrib_id: 170,
          value: req.body.thirdquarterinprogress,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.thirdquartercompletedwith80minimum) == false) {
        values.push({
          attrib_id: 174,
          value: req.body.thirdquartercompletedwith80minimum,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.thirdquartertotalcriteriacompleted) == false) {
        values.push({
          attrib_id: 178,
          value: req.body.thirdquartertotalcriteriacompleted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.fourthquarternotattempted) == false) {
        values.push({
          attrib_id: 167,
          value: req.body.fourthquarternotattempted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.fourthquarterinprogress) == false) {
        values.push({
          attrib_id: 171,
          value: req.body.fourthquarterinprogress,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.fourthquartercompletedwith80minimum) == false) {
        values.push({
          attrib_id: 175,
          value: req.body.fourthquartercompletedwith80minimum,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.fourthquartertotalcriteriacompleted) == false) {
        values.push({
          attrib_id: 179,
          value: req.body.fourthquartertotalcriteriacompleted,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.asqintrainingfidelity) == false) {
        values.push({
          attrib_id: 184,
          value: req.body.asqintrainingfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.asqadoptionfidelity) == false) {
        values.push({
          attrib_id: 185,
          value: req.body.asqadoptionfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.asqpartialimplementationfidelity) == false) {
        values.push({
          attrib_id: 186,
          value: req.body.asqpartialimplementationfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.asqfullimplementationfidelity) == false) {
        values.push({
          attrib_id: 187,
          value: req.body.asqfullimplementationfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.asqfidelityfidelity) == false) {
        values.push({
          attrib_id: 188,
          value: req.body.asqfidelityfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.birintrainingfidelity) == false) {
        values.push({
          attrib_id: 191,
          value: req.body.birintrainingfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.biradoptionfidelity) == false) {
        values.push({
          attrib_id: 192,
          value: req.body.biradoptionfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.birpartialimplementationfidelity) == false) {
        values.push({
          attrib_id: 193,
          value: req.body.birpartialimplementationfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.birfullimplementationfidelity) == false) {
        values.push({
          attrib_id: 194,
          value: req.body.birfullimplementationfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.birfidelityfidelity) == false) {
        values.push({
          attrib_id: 195,
          value: req.body.birfidelityfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.ebasintrainingfidelity) == false) {
        values.push({
          attrib_id: 199,
          value: req.body.ebasintrainingfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.ebasadoptionfidelity) == false) {
        values.push({
          attrib_id: 200,
          value: req.body.ebasadoptionfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.ebaspartialimplementationfidelity) == false) {
        values.push({
          attrib_id: 201,
          value: req.body.ebaspartialimplementationfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.ebasfullimplementationfidelity) == false) {
        values.push({
          attrib_id: 202,
          value: req.body.ebasfullimplementationfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.ebasfidelityfidelity) == false) {
        values.push({
          attrib_id: 203,
          value: req.body.ebasfidelityfidelity,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.otherfundingreceivedcorona) == false) {
        values.push({
          attrib_id: 215,
          value: req.body.otherfundingreceivedcorona,
          response_id: result.insertForm.response_id,
        });
      }

      if (isEmpty(req.body.fundingreceivedhelpprogram) == false) {
        values.push({
          attrib_id: 216,
          value: req.body.fundingreceivedhelpprogram,
          response_id: result.insertForm.response_id,
        });
      }

      const query = pgp.helpers.insert(values, cs);
      const recordsResponse = db.none(query);

      req.flash('info', 'Thank you for your form submission.');
      res.redirect('/');
    })

    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'An error has occured. Please try again or submit a Support Ticket.'
        );
        res.redirect('/');
      }
    });
};
