const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
var currentYear = new Date().getFullYear();

exports.index = async function (req, res, next) {
  // queries the DB to return information about the selected form that brought them to this page.
  await db
    .any(
      `select c.company_name, f.form_responses, f3.attribute_name, f4.value 
            from company c 
            inner join formresponse f on c.id = f.company_id 
            inner join forms f2 on f.form_id = f2.form_id 
            inner join formquestion f3 on f2.form_id = f3.form_id 
            inner join formquestionresponse f4 on f3.attrib_id  = f4.attrib_id 
            where f.company_id = $1 AND f.form_id = $2 AND f.response_id = $3 AND f4.response_id = $3
            order by f3.attribute_name`,
      [req.params.companyid, req.params.formid, req.params.formresponseid]
    )
    .then((results) => {
      // create a doc
      const doc = new PDFDocument();

      // set up the file stream for the file
      doc.pipe(fs.createWriteStream('public/formdownloads/form.pdf'));

      // Adds info to the PDF.
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(results[0].company_name, {
          align: 'center',
          underline: 'true',
        })
        .moveDown();

      for (const result in results) {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(results[result].attribute_name + ':');
        doc
          .font('Helvetica')
          .fontSize(7)
          .text(results[result].value)
          .moveDown();
      }

      // ends Doc generation
      doc.end();

      // renders page.
      res.render('userformview', {
        companyForm: results,
        user: req.user,
        currentYear,
      });
    })
    .catch((error) => {
      if (error) {
        next(error);
      }
    });
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
