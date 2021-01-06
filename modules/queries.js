require('dotenv').config()
const Pool = require('pg').Pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_URL,
    database: 'databasecoos',
    password: process.env.DB_PASS,
    port: process.env.DB_PORT
})