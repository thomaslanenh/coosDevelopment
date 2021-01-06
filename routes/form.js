require('dotenv').config()
var express = require('express')
var router = express.Router();
var homepage_controller = require('../controllers/homepageController')
const { Pool, Client } = require('pg')
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASS,
    port: 5432
})


router.get('/', homepage_controller.index )

router.get('/company/:id', function(req,res,next){
    pool.query(`SELECT * FROM companyprofile WHERE company_id = ${req.params.id}`, (err,results)=>{
        if (err){
            return next(err)
        }
        res.render('companypage', { companylist: results.rows })
        console.log(results.rows[0].company_name)
        pool.end()
    })
})

module.exports = router;