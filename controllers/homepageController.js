exports.index = function (req, res, next) {
  res.render("index", {title: "Mothership", user: req.user})
};
