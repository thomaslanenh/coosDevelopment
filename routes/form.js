require('dotenv').config();
var express = require('express');
var db = require('../db');
var router = express.Router();
var currentYear = new Date().getFullYear();
var NodeGoogleDrive = require('node-google-drive');
const { path } = require('../app');
const { ColumnSet } = require('pg-promise');
const dirPath = require('path');
const pgp = require('pg-promise')({
  /* initialization options */
  capSQL: true, // capitalize all generated SQL
});
// controller inits
var homepage_controller = require('../controllers/homepageController');
var useraccount_controller = require('../controllers/useraccountController');
var companycreate_controller = require('../controllers/companycreationController');
var formcreate_controller = require('../controllers/formController');
var adminformview_controller = require('../controllers/adminFormView');
var userformview_controller = require('../controllers/userFormView');
var support_controller = require('../controllers/supportController');
var async = require('async');

const ROOT_FOLDER = '1LOJ5KvYGLbeU2-C6Sz9qyi-iSfnAfkhW',
  PATH_TO_CREDENTIALS = dirPath.resolve(`${__dirname}/my-credentials.json`);

// multer initiation and sets upload folder to be /uploads
var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
var upload = multer({ storage: storage });

var passport = require('passport');

// ensures authentication for user before letting them log in
function ensureAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.flash = 'error, You must be logged in to see this page.';
    res.redirect(403, '/login');
  }
}

// ensures user is a administrator AND authenticated before letting them to a ADMIN area.
function administratorCheck(req, res, next) {
  console.log(req.user);
  if (req.isAuthenticated() && req.user.user_type === '2') {
    next();
  } else {
    req.session.error = 'You must be a administrator to see this page.';
    res.redirect(403, '/login');
  }
}

router.get('/', homepage_controller.index);

//dynamically assign a company page to their ID.
router.get('/company/:id', useraccount_controller.companyhome);

// user account sections
router.get('/login', useraccount_controller.index);
router.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: `/`,
    successFlash: true,
    failureRedirect: '/login',
    failureFlash: true,
  })
);
router.get('/signup', useraccount_controller.signup);
router.post('/signup', useraccount_controller.signup_post);

router.get('/logout', useraccount_controller.logout);

router.get(
  '/:username/profile',
  ensureAuthentication,
  useraccount_controller.profile
);

// Company Staff Members
router.get(
  '/:companyid/staffMembers',
  ensureAuthentication,
  useraccount_controller.staffmembers
);

// Support Routes
router.get('/support', ensureAuthentication, support_controller.index);
router.post('/support', support_controller.indexpost);

// Support Messages Routes
router.get('/messages', ensureAuthentication, support_controller.messages);
// Support Message Detail
router.get(
  '/messages/:messageid',
  ensureAuthentication,
  support_controller.messagedetail
);
router.post('/messages/:messageid', support_controller.messagedetailpost);

// route to change due dates on forms
router.get('/duedates', administratorCheck, useraccount_controller.duedate);
router.post('/duedates', useraccount_controller.duedatepost);

// sets variables for company uploader to take the File input type. Sticks it in the "uplaods' folder"

var compUploader = upload.fields([
  { name: 'logo' },
  { name: 'business_picture' },
]);

// Route to Create a Company
router.get(
  '/createcompany',
  administratorCheck,
  companycreate_controller.createcompany
);

router.post('/createcompany', compUploader, function (req, res, next) {
  console.log(req.files.logo[0].originalname);

  //transactionally adds the company to the database. Multer removes req.body access for multipart forms when the input
  // type is file, so req.files.x.x needs to be used.
  db.tx(async (t) => {
    const insertCompany = await db.none(
      `insert into company(company_name, address, town, state, zipcode,phone_number,website,description,logo,business_picture,first_name,last_name,codirector_name)
              values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        req.body.company_name,
        req.body.address,
        req.body.town,
        req.body.state,
        req.body.zipcode,
        req.body.phone_number,
        req.body.website,
        req.body.description,
        req.files.logo[0].originalname,
        req.files.business_picture[0].originalname,
        req.body.first_name,
        req.body.last_name,
        req.body.codirector_name,
      ]
    );
  })
    .then((data) => {
      res.redirect('/');
    })
    .catch((err) => {
      if (err) {
        req.flash('error', 'Something went wrong, contact DB admin');
        res.redirect('/createcompany');
      }
    });
});

// starting forms

// annual report
router.get(
  '/forms/annualreport',
  ensureAuthentication,
  formcreate_controller.annualreport
);
router.post('/forms/annualreport', formcreate_controller.annualreportpost);

// ecers report
// router.get(
//   '/forms/ecersdata',
//   ensureAuthentication,
//   formcreate_controller.ecersdata
// );
// router.post('/forms/ecersdata', formcreate_controller.ecersdatapost);

// ipdp report
router.get('/forms/ipdp', ensureAuthentication, formcreate_controller.ipdip);
router.post('/forms/ipdp', formcreate_controller.ipdippost);

// QIA Progress Form
router.get(
  '/forms/qiaprogress',
  ensureAuthentication,
  formcreate_controller.qiaprogress
);
router.post(
  '/forms/qiaprogress',
  ensureAuthentication,
  formcreate_controller.qiaprogress_post
);

// QIA Outcome Reporting Form
router.get(
  '/forms/qiaoutcome',
  ensureAuthentication,
  formcreate_controller.qiaoutcome
);

router.post(
  '/forms/qiaoutcome',
  ensureAuthentication,
  formcreate_controller.qiaoutcome_post
);

// QIA Detailed Budget Form

router.get(
  '/forms/qiabudget',
  ensureAuthentication,
  formcreate_controller.detailedbudget
);

router.post('/forms/qiabudget', formcreate_controller.detailedbudgetpost);

// Route & Logic to Upload Photos Before & After QIA
router.get(
  '/forms/submitphotos',
  ensureAuthentication,
  formcreate_controller.submitphotos
);

var storage = multer.memoryStorage();
var beforeafterUpload = multer({ storage: storage });
var beforePhotosUpload = beforeafterUpload.fields([
  { name: 'beforePhoto' },
  { name: 'afterPhoto' },
]);

router.post(
  '/forms/submitphotos',
  beforePhotosUpload,
  async function (req, res, next) {
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
        'INSERT INTO formresponse(company_id, form_id) VALUES ($1, $2) RETURNING response_id',
        [companyDetails.id, 14]
      );

      const insertData1 = await t.any(
        'INSERT INTO formquestionresponse(attrib_id, value, response_id) VALUES ($1, $2, $3)',
        [
          247,
          companyDetails.company_name + req.files.beforePhoto[0].originalname,
          insertedForm.response_id,
        ]
      );

      const insertData2 = await t.any(
        'INSERT INTO formquestionresponse(attrib_id, value, response_id) VALUES ($1, $2, $3)',
        [
          248,
          companyDetails.company_name + req.files.afterPhoto[0].originalname,
          insertedForm.response_id,
        ]
      );

      return { companyDetails, insertedForm };
    })
      .then(async (data) => {
        const creds_service_user = require(PATH_TO_CREDENTIALS);

        const googleDriveInstance = new NodeGoogleDrive({
          ROOT_FOLDER: '16JxQ0u4HR2JTMfnr9F0AuT6RwDREMbN8',
        });

        let gdrive = await googleDriveInstance.useServiceAccountAuth(
          creds_service_user
        );

        let uploadResponseBefore = await googleDriveInstance.create({
          source: req.files.beforePhoto[0].buffer,
          name:
            data.companyDetails.company_name +
            req.files.beforePhoto[0].originalname,
          mimeType: req.files.beforePhoto[0].mimetype,
        });

        let uploadResponseAfter = await googleDriveInstance.create({
          source: req.files.afterPhoto[0].buffer,
          name:
            data.companyDetails.company_name +
            req.files.afterPhoto[0].originalname,
          mimeType: req.files.afterPhoto[0].mimetype,
        });

        req.flash('info', 'Thank you for submitting the receipts.');
        res.redirect('/');
      })
      .catch((e) => {
        if (e) {
          console.log(e);
          req.flash(
            'error',
            'An error has occured. Please try again or submit a support ticket.'
          );
        }
      });
  }
);

// Submit Receipts

router.get(
  '/forms/submitreceipts',
  ensureAuthentication,
  formcreate_controller.submitreceipts
);

var receiptUpload = multer({ storage: storage });

router.post(
  '/forms/submitreceipts',
  receiptUpload.single('receipt'),
  async function (req, res, next) {
    db.tx(async (t) => {
      const companyDetails = await t.one(
        'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id= u.company_id WHERE u.username = $1',
        [req.user.user]
      );

      return { companyDetails };
    })
      .then(async (data) => {
        console.log(req.file.buffer);

        const creds_service_user = require(PATH_TO_CREDENTIALS);

        const googleDriveInstance = new NodeGoogleDrive({
          ROOT_FOLDER: ROOT_FOLDER,
        });

        let gdrive = await googleDriveInstance.useServiceAccountAuth(
          creds_service_user
        );

        let uploadResponse = await googleDriveInstance.create({
          source: req.file.buffer,
          name: data.companyDetails.company_name + req.file.originalname,
        });

        req.flash('info', 'Thank you for submitting the receipts.');
        res.redirect('/');
      })
      .catch((e) => {
        if (e) {
          console.log(e);
          req.flash(
            'error',
            'An error has occured. Please try again or submit a support ticket.'
          );
        }
      });
  }
);

// QIA Center Improvement Plan Form
router.get(
  '/forms/qiacenterimprovement',
  ensureAuthentication,
  formcreate_controller.centerimprovement
);

router.post(
  '/forms/qiacenterimprovement',
  ensureAuthentication,
  formcreate_controller.centerimprovementpost
);

// staff meeting tracker form
router.get(
  '/forms/staffmeetingtracker',
  ensureAuthentication,
  formcreate_controller.staffmeetingtracker
);

router.post(
  '/forms/staffmeetingtracker',
  formcreate_controller.staffmeetingtrackerpost
);

// ASQ Consent Form
router.get(
  '/forms/asqconsent',
  ensureAuthentication,
  formcreate_controller.asqconsent
);
router.post('/forms/asqconsent', formcreate_controller.asqconsentpost);

// ece credit tracking
router.get(
  '/forms/ececredittracking',
  ensureAuthentication,
  formcreate_controller.ececredittracking
);

router.post(
  '/forms/ececredittracking',
  formcreate_controller.ececredittrackingpost
);

// FORM POST SECTION

// form submit thank you page
router.get('/thanks', function (req, res, next) {
  res.render('thanks', { user: req.user, currentYear });
});

// form user view and download
router.get(
  '/:username/forms/:companyid/:formid/:formresponseid',
  ensureAuthentication,
  userformview_controller.index
);

//form user view delete and update

router.post(
  '/:username/forms/:companyid/:formid/:formresponseid',
  ensureAuthentication,
  userformview_controller.indexpost
);

// form administration view

router.get(
  '/admin/formbrowser',
  administratorCheck,
  adminformview_controller.index
);

// form administration individual company viewer
router.get(
  '/admin/formviewer/:companyid',
  administratorCheck,
  adminformview_controller.formviewer
);

// receipt viewer
router.get(
  '/admin/receiptviewer/:companyname',
  administratorCheck,
  adminformview_controller.receiptviewer
);

// view all user forms
router.get(
  '/:username/forms/:companyid/all',
  ensureAuthentication,
  userformview_controller.viewall
);

module.exports = router;
