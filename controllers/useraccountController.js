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
  res.render("login");
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
      res.render("companypage", { companylist: results.company.rows });
    }
  );
};
