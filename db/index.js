const { Pool, Client } = require("pg");
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: "postgres",
    password: process.env.DB_PASS,
    port: 5432,
  });

  module.exports = {
      query: (text,params,callback) => {
          pool.query(text, params, callback)
      }
  }