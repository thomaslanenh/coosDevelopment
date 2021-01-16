
const pgp = require('pg-promise')({
    //init options
})

const cn = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: "postgres",
    password: process.env.DB_PASS,
    port: 5432,
}

const db = pgp(cn)

  module.exports = db