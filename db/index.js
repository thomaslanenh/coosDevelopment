const monitor = require('pg-monitor')

const initOptions = {
    capSQL: true,
}
const pgp = require('pg-promise')(initOptions)

monitor.attach(initOptions)
const cn = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: "postgres",
    password: process.env.DB_PASS,
    port: 5432,
}

const db = pgp(cn)

  module.exports = db