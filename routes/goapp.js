function goApp(req, res){
    var path = req.params.path;
    //console.log('goapp : ',path);
    res.render('GoApp', {
        title:'HousePic',
        path: path
    });
}

function policy(req, res){
    res.render('Policy', {
        title:'개인정보 보호정책'
    });
}

module.exports = function(app) {
    app.get('/goapp/path/:path', goApp);
    app.get('/policy', policy);

};
