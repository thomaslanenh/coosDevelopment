exports.index = function (req, res, next) {
  res.render("index", {title: "Mothership"})
};

exports.companyprofile_detail = function(req,res,next){
    res.send("This will be the company profile detail page: " + req.params.id)
}