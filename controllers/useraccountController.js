var async = require('async');
var bcrypt = require('bcrypt');
var passport = require('passport');
var session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const app = require('../app');
const db = require('../db');
var { body, validationResult } = require('express-validator');
const { errors } = require('pg-promise');
const pgPromise = require('pg-promise');
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var nextYear = new Date().getFullYear() + 1;
var isEmpty = require('lodash.isempty');
const { ColumnSet } = require('pg-promise');
const { NULL } = require('node-sass');
var todaysDate = new Date();

const pgp = require('pg-promise')({
  /* initialization options */
  capSQL: true, // capitalize all generated SQL
});

exports.index = function (req, res) {
  res.render('login', {
    title: 'Login',
    user: req.user,
    currentYear,
    previousYear,
    nextYear,
  });
};

exports.logout = function (req, res, next) {
  req.logout();
  res.redirect('/');
};

exports.duedate = function (req, res, next) {
  db.tx(async (t) => {
    const dueDates = await t.any(
      'SELECT form_name, id, duedate FROM formduedate INNER JOIN forms on form_reference = form_id ORDER BY form_name ASC'
    );
    return { dueDates };
  })
    .then((data) => {
      res.render('duedates', { duedates: data.dueDates, user: req.user });
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

exports.duedatepost = function (req, res, next) {
  db.tx(async (t) => {
    const dueDates = await t.any(
      'SELECT form_name, id, duedate FROM formduedate INNER JOIN forms on form_reference = form_id ORDER BY form_name ASC'
    );

    return { dueDates };
  })
    .then((data) => {
      const dataMulti = [];

      data.dueDates.map((date) => {
        dataMulti.push({
          id: date.id,
          duedate: req.body[`${date.id}`],
        });
        return dataMulti;
      });

      console.log(dataMulti);

      const cs = new pgp.helpers.ColumnSet(['?id', 'duedate'], {
        table: 'formduedate',
      });

      const query = pgp.helpers.update(dataMulti, cs) + 'WHERE v.id = t.id';

      const recordsResponse = db.none(query);

      req.flash('info', 'Thank you for updating the form due dates!');
      res.redirect('/thanks');
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash('error', 'An error has occured. Please try again.');
        res.redirect('/');
      }
    });
};

exports.signup = function (req, res) {
  db.tx(async (t) => {
    const companys = await t.any('SELECT company_name, id FROM company');
    const userTypes = await t.any('SELECT * from usertypes');
    const degreeTypes = await t.any('SELECT * from degree_types');
    const degrees = await t.any('SELECT * from degrees');
    return { companys, userTypes, degreeTypes, degrees };
  })
    .then((data) => {
      res.render('signup', {
        title: 'Sign Up',
        companys: data.companys,
        userTypes: data.userTypes,
        degreeTypes: data.degreeTypes,
        degrees: data.degrees,
        user: req.user,
        currentYear,
        nextYear,
        previousYear,
      });
    })
    .catch((err) => {
      if (err) {
        next(err);
      }
    });
};

exports.signup_post = [
  body('username')
    .isLength({ min: 1, max: 25 })
    .withMessage('Username must be under 25 characters.')
    .custom((value) => !/\s/.test(value))
    .withMessage('Username must not have spaces'),
  body('email')
    .isEmail()
    .withMessage('E-mail Address must be a valid e-mail address.'),
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors);
      req.flash('error', errors);
      res.redirect('/signup');
    } else {
      bcrypt.hash(req.body.password, 10, async function (error, hash) {
        if (error) {
          next(error);
        }

        db.tx(async (t) => {
          const companys = await t.any('SELECT company_name, id FROM company');

          if (req.body.radiodegree == '7') {
            const otherDegree = await t.one(
              'insert into degrees (degree) values ($1) returning degree_id',
              [req.body.otherdegree]
            );
            const useraccount = await t.one(
              'INSERT INTO useraccount(username, password,email, company_id, user_type, first_name, last_name, degree_type, degree) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
              [
                req.body.username,
                hash,
                req.body.email,
                req.body.companyradio,
                req.body.typeradio,
                req.body.firstname,
                req.body.lastname,
                req.body.radiodegreetype,
                otherDegree.degree_id,
              ]
            );
          } else {
            const useraccount = await t.one(
              'INSERT INTO useraccount(username, password,email, company_id, user_type, first_name, last_name, degree_type, degree) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
              [
                req.body.username,
                hash,
                req.body.email,
                req.body.companyradio,
                req.body.typeradio,
                req.body.firstname,
                req.body.lastname,
                req.body.radiodegreetype,
                req.body.radiodegree,
              ]
            );
          }
          return companys;
        })
          .then((data) => {
            req.flash('info', 'Thank you for signing up!');
            res.redirect('/thanks');
          })
          .catch((err) => {
            if (err) {
              req.flash(
                'info',
                'Username or E-Mail already registered. Try again.'
              );
              res.redirect('/signup');
            }
          });
      });
    }
  },
];

exports.companyhome = function (req, res, next) {
  db.one('select * from company where id = $1', [req.params.id])
    .then((data) => {
      console.log(req.user);
      res.render('companypage', {
        companylist: data,
        title: 'Company Profile',
        user: req.user,
        currentYear,
        nextYear,
        previousYear,
      });
    })
    .catch((error) => {
      if (error) {
        next(error);
      }
    });
};

exports.profile = async function (req, res, next) {
  db.tx(async (t) => {
    const accountInfo = await t.one(
      'SELECT * from useraccount INNER JOIN company on useraccount.company_id = company.id WHERE username = $1',
      [req.params.username]
    );

    const recentForms = await t.any(
      "SELECT f.form_id, f.company_id, f.response_id, TO_CHAR(f.date_submitted :: DATE,'yyyy-mm-dd'), f2.form_name from formresponse f INNER JOIN forms f2 on f.form_id = f2.form_id WHERE f.company_id = $1 ORDER BY date_submitted DESC LIMIT 5",
      [accountInfo.company_id]
    );

    const submittedForms = await t.any(
      'select DISTINCT ON (form_id) form_id, date_submitted from formresponse where company_id = $1 ORDER BY form_id, date_submitted desc',
      [accountInfo.company_id]
    );

    const dueDates = await t.any(
      'SELECT id, form_reference, form_name, link, duedate from formduedate INNER JOIN forms on form_reference = form_id ORDER BY form_name ASC'
    );

    const messages = await db.manyOrNone(
      'SELECT subject_title, support_type, username, ticketid from helptickets h INNER JOIN useraccount u on h.sender_id = u.id where sender_id = $1 OR user_id = $1 ORDER BY date_submitted ASC LIMIT 10',
      [req.user.id]
    );

    return { accountInfo, recentForms, submittedForms, dueDates, messages };
  })
    .then((data) => {
      res.render('profile', {
        title: `${req.params.username}'s Profile`,
        userinfo: data.accountInfo,
        user: req.user,
        submittedForms: data.submittedForms,
        dueDates: data.dueDates,
        currentYear,
        nextYear,
        previousYear,
        todaysDate,
        recentForms: data.recentForms,
        ccdnLink: process.env.CCDN_SITE,
        supporttickets: data.messages,
      });
    })
    .catch((error) => {
      if (error) {
        next(error);
      }
    });
};

exports.staffmembers = function (req, res, next) {
  db.tx(async (t) => {
    const staffMembers = await t.any(
      'select u.first_name, u.last_name, c.company_name from useraccount u inner join company c on u.company_id = c.id where u.company_id = $1',
      [req.params.companyid]
    );

    return { staffMembers };
  })
    .then((results) => {
      res.render('staffmembers', {
        user: req.user,
        currentYear,
        nextYear,
        previousYear,
        staffMembers: results.staffMembers,
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
