var currentYear = new Date().getFullYear();

exports.index = function (req, res, next) {
  res.render("index", {title: "Coös County Director Network (CCDN) Training Quality Database", user: req.user, currentYear})
};
