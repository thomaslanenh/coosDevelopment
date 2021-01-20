var currentYear = new Date().getFullYear();

exports.index = async function (req, res, next) {
    await db
      .any(
        `select c.company_name, f.form_responses, f3.attribute_name, f4.value 
              from company c 
              inner join formresponse f on c.id = f.company_id 
              inner join forms f2 on f.form_id = f2.form_id 
              inner join formquestion f3 on f2.form_id = f3.form_id 
              inner join formquestionresponse f4 on f3.attrib_id  = f4.attrib_id 
              where f.company_id = $1 and f.form_id = $2 and f.response_id = $3
              order by f3.attribute_name`,
        [req.params.companyid, req.params.formid, req.params.formresponseid]
      )
      .then((results) => {
        // create a doc
        const doc = new PDFDocument();
  
        // set up the file stream for the file
        doc.pipe(fs.createWriteStream("public/formdownloads/form.pdf"));
  
        // Adds info to the PDF.
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(results[0].company_name, {
            align: 'center',
            underline: 'true'
          })
          .moveDown();
  
        for (const result in results) {
          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .text(results[result].attribute_name + ":")
          doc
            .font("Helvetica")
            .fontSize(7)
            .text(results[result].value).moveDown();
        }
  
        // ends Doc generation
        doc.end();
  
        // renders page.
        res.render("userformview", {
          companyForm: results,
          users: req.users,
          currentYear
        });
      })
      .catch((error) => {
        if (error) {
          next(error);
        }
      });
  };
  