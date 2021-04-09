const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var nextYear = new Date().getFullYear() + 1;

exports.index = async function (req, res, next) {
  // queries the DB to return information about the selected form that brought them to this page.
  await db
    .any(
      `select f4.attrib_id, c.company_name, f2.form_name, f3.attribute_name, f4.value, f4.staff_id 
      from company c 
      inner join formresponse f on c.id = f.company_id 
      inner join forms f2 on f.form_id = f2.form_id 
      inner join formquestion f3 on f2.form_id = f3.form_id 
      inner join formquestionresponse f4 on f3.attrib_id  = f4.attrib_id 
      where f.company_id = $1 AND f.form_id = $2 AND f.response_id = $3 AND f4.response_id = $3
      order by case when f4.staff_id is null then f4.attrib_id else min(f4.attrib_id) over (partition by f4.staff_id) end,
   f4.staff_id,
    f4.attrib_id;

`,
      [
        parseInt(req.params.companyid),
        parseInt(req.params.formid),
        parseInt(req.params.formresponseid),
      ]
    )
    .then((results) => {
      // create a doc
      const doc = new PDFDocument();

      // set up the file stream for the file, might need to be randomized?
      doc.pipe(fs.createWriteStream('public/formdownloads/form.pdf'));

      // Adds info to the PDF.
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(results[0].company_name, {
          align: 'center',
          underline: 'true',
        })
        .text(results[0].form_name, {
          align: 'center',
        })
        .moveDown();

      results.map((data) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(data.attribute_name + ':');
        doc.font('Helvetica').fontSize(7).text(data.value).moveDown();
      });

      // ends Doc generation
      doc.end();

      // renders page.
      res.render('userformview', {
        companyForm: results,
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

exports.indexpost = function (req, res, next) {
  let inputValue = req.body.formSubmit;

  if (inputValue == 'deleteFORM') {
    console.log('Delete Hit');
    res.send('NYI Delete');
  } else {
    res.send('NYI Update');
  }
};

// view all forms by a company.
exports.viewall = function (req, res, next) {
  let accountInfo = {};
  let recentForms = {};

  // get neccesary information.
  db.tx(async (t) => {
    accountInfo = await t.one(
      'SELECT username, company_name, logo, company_id, email from useraccount INNER JOIN company on useraccount.company_id = company.id WHERE username = $1',
      [req.params.username]
    );
    recentForms = await t.any(
      "SELECT f.form_id, f.company_id, f.response_id, TO_CHAR(f.date_submitted :: DATE,'mm-dd-yyyy'), f2.form_name from formresponse f INNER JOIN forms f2 on f.form_id = f2.form_id WHERE f.company_id = $1 LIMIT 100",
      [accountInfo.company_id]
    );
    return { accountInfo, recentForms };
  })
    .then((results) => {
      res.render('viewall', {
        user: req.user,
        recentForms,
        accountInfo,
        currentYear,
      });
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          'error',
          'An error has occured, please try again or submit a support ticket.'
        );
        res.redirect('/');
      }
    });
};
