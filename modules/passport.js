const { Pool, Client } = require("pg");
var bcrypt = require('bcrypt')
var passport = require('passport')
var LocalStrategy = require("passport-local").Strategy;
const { nextTick } = require("async");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: "postgres",
  password: process.env.DB_PASS,
  port: 5432,
});
passport.use(new LocalStrategy(
    function(username, password, done){
      pool.query('SELECT * from useraccount WHERE username = $1', username, (err,result)=> {
        if (err){
          return done(err)
        }
        if (result.row[0].username == null) {
          return done(null, false, { message: "Incorrect Username"})
        }else {
          bcrypt.compare(pass, result.rows[0].password, function(err, results) {
            if (err) {
              return done(err)
            }
            else if (results){
              return done(null, user)
            }
            else {
              return done(null,false)
            }
          })
        }
      })
    }
  ))