const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { userInfo } = require("os");
var currentYear = new Date().getFullYear();

exports.index = function (req, res, next) {
  let supportTypes = {};
  let userinfo = {};
  db.tx(async (t) => {
    const supportTypes = await t.many(
      "select * from support_types st order by support_type ASC"
    );
    const userinfo = await t.one(
      "select id from useraccount WHERE username = $1",
      [req.user.user]
    );
    return supportTypes;
  })
    .then((results) => {
      res.render("support", {
        user: req.user,
        currentYear,
        supportTypes: results,
      });
    })
    .catch((error) => {
      if (error) {
        req.flash("error", "A error has occured. Please try again.");
        res.redirect("/");
      }
    });
};

exports.indexpost = function (req, res, next) {
  db.tx(async (t) => {
    // init user Ids
    const userinfo = await t.one(
      "select id from useraccount WHERE username = $1",
      [req.user.user]
    );

    // sets the message receipients depending on what type of support is selected. 
    const websiteAdmin = await t.one(
      "select id from useraccount WHERE username = $1",
      ["scAdmin"]
    );

    const ccdnAdmin = await t.one(
      "select id from useraccount WHERE username = $1",
      ["CCDNAnn"]
    );

    // This is what sets the corresponding ID to the support type. Website Support issues go to the Website Admin, defined above.
    let useID = "";
    req.body.support_type == 2
      ? (useID = websiteAdmin.id)
      : (useID = ccdnAdmin.id);
    console.log(useID);

    const added = await t.none(
      "INSERT INTO helptickets(message, user_id, support_type, sender_id, subject_title) VALUES ($1,$2,$3,$4,$5)",
      [req.body.message, useID, req.body.support_type, userinfo.id, req.body.subject]
    );
  })
    .then(async (results) => {
      req.flash("info", "Your ticket has been submitted. Thank you.");
      res.redirect("/thanks");
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash("error", "A error has occured. Please try again.");
        res.redirect("/support");
      }
    });
};

exports.messages = function (req, res, next) {
  let messages = [];
  db.tx(async (t) => {
    const userinfo = await t.one(
      "SELECT id from useraccount where username = $1",
      [req.user.user]
    );
    const messages = db.manyOrNone(
      "SELECT subject_title, support_type, username, ticketid from helptickets h INNER JOIN useraccount u on h.sender_id = u.id where sender_id = $1 OR user_id = $1 ORDER BY date_submitted ASC",
      [userinfo.id]
    );
    return messages;
  })
    .then((results) => {
      res.render("messages", {
        user: req.user,
        currentYear,
        supporttickets: results,
      });
    })
    .catch((error) => {
      req.flash(
        "error",
        "An error has occured. Please contact an administrator."
      );
      res.redirect("/");
    });
};

exports.messagedetail = function (req, res, next) {
  db.tx(async (t) => {
    const messageinfo = await t.one(
      "SELECT subject_title, ticketid, message, TO_CHAR(date_submitted, 'MON-DD-YYYY HH12:MIPM'), username, email, user_type, type ut, company_name from helptickets h INNER JOIN useraccount u on h.sender_id = u.id INNER JOIN usertypes ut on u.user_type = ut.type_ref  INNER JOIN company c on u.company_id = c.id where ticketid = $1",
      [req.params.messageid]
    );
    const messageloop = await t.manyOrNone(
      'SELECT * from messages m INNER JOIN useraccount u on m.sender_id = u.id INNER JOIN usertypes ut on u.user_type = ut.type_ref WHERE master_id = $1', [req.params.messageid]
    )
    return {messageinfo, messageloop};
  })
    .then((results) => {
      res.render("messageview", {
        user: req.user,
        currentYear,
        messageinfo: results.messageinfo,
        messageloop: results.messageloop
      });
    })
    .catch((error) => {
      if (error) {
        console.log(error);
        req.flash(
          "error",
          "There was a error with the message. Please submit a support ticket."
        );
        res.redirect("/");
      }
    });
};

exports.messagedetailpost = function (req, res, next) {
  db.tx(async (t) => {
    const userinfo = await t.one(
      "SELECT id from useraccount WHERE username = $1",
      [req.user.user]
    );
    const recipientinfo = await t.one(
      "SELECT sender_id from helptickets where ticketid = $1",
      [req.params.messageid]
    );
    const messagereply = await t.none(
      "INSERT INTO messages (message, master_id, recipient_id, sender_id) VALUES ($1,$2,$3,$4)",
      [req.body.reply, req.params.messageid, recipientinfo.sender_id, userinfo.id]
    );
  })
    .then((results) => {
      req.flash("info", "Reply sent.");
      res.redirect(`/messages/${req.params.messageid}`);
    })
    .catch((error) => {
      if (error) {
        req.flash(
          "error",
          "There was a error sending your message. Try again or submit a support ticket"
        );
        res.redirect(`/messages/${req.params.messageid}`);
      }
    });
};
