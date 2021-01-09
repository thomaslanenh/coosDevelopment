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
  res.render("login", { title: 'Login'});
};

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
      let [ foundcompany ] = results.company.rows
      res.render("companypage", { companylist: results.company.rows, title: foundcompany.company_name });
    }
  );
};
