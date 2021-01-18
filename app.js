var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var formRouter = require("./routes/form");
var bcrypt = require("bcrypt");
var session = require("express-session");
var app = express();
var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;
var pstrat = require("./modules/passport");
var flash = require("express-flash");
const { Pool } = require("pg");
var bodyParser = require("body-parser");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "css")));
app.use('/uploads', express.static(process.cwd() + '/uploads'));
app.use(
  session({
    secret: "aperfectcirclefan2020",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());


app.use("/", formRouter);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: "postgres",
  password: process.env.DB_PASS,
  port: 5432,
});

passport.use(
  new LocalStrategy(function (username, password, done) {
    pool.query(
      "SELECT id,username,password,user_type from useraccount WHERE username = $1",
      [username],
      (err, result) => {
        if (err) {
          return done(err);
        }
        if (result.rows.length > 0) {
          bcrypt.compare(password, result.rows[0].password, (err, res) => {
            if (res) {
              done(null, {
                id: result.rows[0].id,
                user: result.rows[0].username,
                user_type: result.rows[0].user_type,
              });
            } else {
              done(null, false);
            }
          });
        } else {
          done(null, false);
        }
      }
    );
  })
);
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 404);
  res.render("error");
});

module.exports = app;
