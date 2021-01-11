var async = require("async");
const { Pool, Client } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: "postgres",
  password: process.env.DB_PASS,
  port: 5432,
});

exports.index = function (req, res) {
  res.render("login", { title: "Login" });
};

exports.signup = function (req, res) {
  async.parallel(
    {
      companys: function (callback) {
        pool.query("Select company_name, id FROM COMPANY", callback);
      },
    },
    function (err, results) {
      console.log(results.companys.rows);
      if (err) {
        next(err);
      }

      res.render("signup", {
        title: "Sign Up",
        companys: results.companys.rows,
      });
    }
  );
};

exports.signup_post = function(req,res,next){
  async.parallel(
    {
      companys: function(callback){
        pool.query("SELECT company_name, id FROM COMPANY", callback)
      }
    }, function(err, results){
      if (err){
        next(err)
      }

      pool.query("INSERT INTO useraccount(username, password, email, company_id) VALUES($1,$2,$3,$4)",[req.body.username,req.body.password,req.body.email,req.body.companyradio], (err,result) => {
        if (err) {
          res.render('signup', {title: "Sign Up", companys: results.companys.rows, error: 'Username or E-Mail already registered. Try Again.'})
        }
        else {
          pool.query("COMMIT")
          res.render('success', {title: 'Success', message: 'User Succesfully Signed-Up!'})
        }
      })
    }
  )
}


exports.companyhome = function (req, res, next) {
  async.parallel(
    {
      company: function (callback) {
        pool.query(
          "SELECT * FROM company WHERE id = $1",
          [req.params.id],
          callback
        );
      },
    },
    function (err, results) {
      if (err) {
        next(err);
      }
      let [foundcompany] = results.company.rows;
      res.render("companypage", {
        companylist: results.company.rows,
        title: foundcompany.company_name,
      });
    }
  );
};


exports.profile = function(req,res, next) {
  async.parallel({
    username: function(callback){
      pool.query('SELECT * FROM useraccount WHERE username = $1',[req.params.username], callback)
    }
  }, function(err,results){
    if (err) {
      next(err)
    }
    console.log(results.username.rows)
    res.render('profile', { title: `${req.user} Profile`, userinfo: results.username.rows})
  })
  
}