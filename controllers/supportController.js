const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { userInfo } = require("os");
var currentYear = new Date().getFullYear();


exports.index = function(req,res,next) {
    let supportTypes = {}
    let userinfo = {}
    db.tx(async(t) => {
        const supportTypes = await t.many('select * from support_types st order by support_type ASC')
        const userinfo = await t.one('select id from useraccount WHERE username = $1', [req.user.user])
        return supportTypes
    }).then((results) => {
        res.render('support', {user: req.user, currentYear, supportTypes: results})
    }).catch(error => {
        if (error){
            req.flash('error', 'A error has occured. Please try again.')
            res.redirect('/')
        }
    })
}

exports.indexpost = function(req,res,next){
    console.log(req.body)
    db.tx(async(t) => {
        const userinfo = await t.one('select id from useraccount WHERE username = $1', [req.user.user])
        const supportticket = await t.none('insert into helptickets(message,user_id, support_type) values ($1, $2, $3)', [req.body.message, userinfo.id, req.body.support_type])
    }).then(results => {
        req.flash('info', 'Your ticket has been submitted. Thank you.')
        res.redirect('/thanks')
    }).catch(error => {
        if (error) {
            req.flash('error', 'A error has occured. Please try again.')
            res.redirect('/support')
        }
    })
}