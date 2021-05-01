const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { ColumnSet } = require('pg-promise');
var currentYear = new Date().getFullYear();
var previousYear = new Date().getFullYear() - 1;
var nextYear = new Date().getFullYear() + 1;

const pgp = require('pg-promise')({
  /* initialization options */
  capSQL: true, // capitalize all generated SQL
});

exports.index = async function (req, res, next) {
  db.tx(async (t) => {
    // queries the DB to return information about the selected form that brought them to this page.
    const formResults = await db.many(
      `select f4.attrib_id, c.id, mt.measure_type, u.first_name, c.company_name, u.last_name, f4.date_modified, f4.record_id, f4.measure_id, c.company_name, f2.form_name, f3.attribute_name, f4.value, f4.staff_id 
  from company c 
  inner join formresponse f on c.id = f.company_id 
  inner join forms f2 on f.form_id = f2.form_id 
  inner join formquestion f3 on f2.form_id = f3.form_id 
  inner join formquestionresponse f4 on f3.attrib_id  = f4.attrib_id 
  inner join useraccount u on c.id = u.company_id
  inner join qualitymeasures mt on f4.measure_id = mt.measure_id
  where f.company_id = 2 AND f.form_id = 2 AND f.response_id = 69 AND f4.response_id = 69
  order by case when f4.staff_id is null then f4.attrib_id else min(f4.attrib_id) over (partition by f4.staff_id) end,
f4.staff_id,
f4.attrib_id;
`,
      [
        parseInt(req.params.companyid),
        parseInt(req.params.formid),
        parseInt(req.params.formresponseid),
      ]
    );

    const companyDetails = await db.one(
      'SELECT u.company_id, c.company_name, c.first_name, c.last_name, c.town FROM company c INNER JOIN useraccount u on c.id= u.company_id WHERE u.username = $1',
      [req.user.user]
    );

    return { formResults, companyDetails };
  })
    .then((results) => {
      // create a doc
      const doc = new PDFDocument();

      // set up the file stream for the file, might need to be randomized?
      doc.pipe(fs.createWriteStream('public/formdownloads/form.pdf'));

      // Adds info to the PDF.
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(results.companyDetails.company_name, {
          align: 'center',
          underline: 'true',
        })
        .text(results.formResults.form_name, {
          align: 'center',
        })
        .moveDown();

      results.formResults.map((data) => {
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
        companyForm: results.formResults,
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
  console.log(req.params);
  console.log('reqData: ', req.body['1']);
  if (inputValue == 'deleteFORM') {
    db.tx(async (t) => {
      const formResponsesDeleted = await t.result(
        'delete from formquestionresponse f2 where f2.response_id = $1 returning *',
        [req.params.formresponseid],
        (a) => a.rowCount
      );
      const formDeleted = await t.result(
        'delete from formresponse f where f.response_id = $1 RETURNING *',
        [req.params.formresponseid],
        (a) => a.rowCount
      );
      return { formResponsesDeleted, formDeleted };
    })
      .then((results) => {
        console.log(results.formResponsesDeleted);
        console.log(results.formDeleted);
        req.flash('info', 'Your form has been succesfully deleted.');
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
  } else {
    db.tx(async (t) => {
      const attributeNAME = await t.many(
        'select distinct f3.attribute_name, f.record_id, f.attrib_id from formquestionresponse f inner join formresponse f2 on f.response_id = f2.response_id inner join formquestion f3 on f.attrib_id = f3.attrib_id where f.response_id = $1 and f2.company_id = $2 and f2.form_id = $3',
        [req.params.formresponseid, req.params.companyid, req.params.formid]
      );

      return { attributeNAME };
    })
      .then((results) => {
        const cs = new pgp.helpers.ColumnSet(
          [
            '?record_id',
            {
              name: 'value',
            },
            {
              name: 'date_modified',
              mod: '^',
              def: 'CURRENT_TIMESTAMP',
            },
          ],
          {
            table: 'formquestionresponse',
          }
        );

        const attribs = results.attributeNAME;

        console.log(attribs);

        const dataMulti = [];

        attribs.map((data) => {
          let valueField = req.body[data.record_id.toString()];
          console.log('valueField: ', valueField);

          dataMulti.push({
            record_id: parseInt(data.record_id),
            value: valueField,
          });
        });

        const updater =
          pgp.helpers.update(dataMulti, cs) +
          ' WHERE v.record_id = t.record_id';

        db.tx(async (t) => {
          db.none(updater);
        })
          .then((data) => {
            req.flash('info', 'Your form has been succesfully updated.');
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
