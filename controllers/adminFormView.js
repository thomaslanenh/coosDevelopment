const db = require('../db');

var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var nextYear = new Date().getFullYear() + 1;
var NodeGoogleDrive = require('node-google-drive');
const path = require('path');
const ROOT_FOLDER = '1LOJ5KvYGLbeU2-C6Sz9qyi-iSfnAfkhW',
  PATH_TO_CREDENTIALS = '../routes/my-credentials.json';

exports.index = async function (req, res, next) {
  db.tx(async (t) => {
    const companyList = await t.many(
      'select distinct fr.company_id, c.company_name from formresponse fr inner join company c on fr.company_id = c.id'
    );

    return { companyList };
  })
    .then((results) => {
      res.render('adminformview', {
        user: req.user,
        companyList: results.companyList.sort(),
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
          'An error has occured. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.formviewer = async function (req, res, next) {
  db.tx(async (t) => {
    const companyForms = await t.many(
      "SELECT f.form_id, c.company_name, c.id, f.response_id, TO_CHAR(f.date_submitted :: DATE,'mm-dd-yyyy'), f2.form_name from formresponse f INNER JOIN forms f2 on f.form_id = f2.form_id inner join company c on f.company_id = c.id WHERE f.company_id = $1 order by to_char desc LIMIT 1000",
      [req.params.companyid]
    );

    return { companyForms };
  })
    .then(async (results) => {
      // const creds_service_user = require(PATH_TO_CREDENTIALS);

      // const googleDriveInstance = new NodeGoogleDrive({
      //   ROOT_FOLDER: ROOT_FOLDER,
      // });

      // let gdrive = await googleDriveInstance.useServiceAccountAuth(
      //   creds_service_user
      // );

      // let receiptData = await googleDriveInstance.listFiles();

      // // receiptData = Object.entries(receiptData.files);

      // let compReceipts = [];

      // let stringCompanyName = results.companyForms[0].company_name.toString();

      // receiptData.files.forEach(async (i) => {
      //   let stringNa = i.name.toString();

      //   if (stringNa.startsWith(stringCompanyName)) {
      //     compReceipts.push(i);
      //   }
      //   return compReceipts;
      // });

      res.render('companyallforms', {
        user: req.user,
        companyForms: results.companyForms,
        previousYear,
        nextYear,
        currentYear,
      });
    })
    .catch((e) => {
      if (e) {
        console.log(e);
        req.flash(
          'error',
          'An error has occured or the company has no submitted forms yet. Please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};

exports.receiptviewer = async function (req, res, next) {
  const creds_service_user = require(PATH_TO_CREDENTIALS);

  const googleDriveInstance = new NodeGoogleDrive({
    ROOT_FOLDER: ROOT_FOLDER,
  });

  let gdrive = await googleDriveInstance.useServiceAccountAuth(
    creds_service_user
  );

  let receiptData = await googleDriveInstance.listFiles();

  // receiptData = Object.entries(receiptData.files);

  let compReceipts = [];

  let stringCompanyName = req.params.companyname;

  receiptData.files.forEach(async (i) => {
    let stringNa = i.name.toString();

    if (stringNa.startsWith(stringCompanyName)) {
      compReceipts.push(i);
    }
    return compReceipts;
  });

  res.render('receiptviewer', {
    user: req.user,
    compReceipts,
  });
};
