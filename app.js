var express = require('express')
    , http = require('http')
    , path = require('path')
    , mysql = require('mysql')
    , passport = require('passport')
    , flash = require('connect-flash')
    , dbConfig = require('./config/database')
    , upload = require('./routes/upload');


// sessions DB ?�성
var MySqlStore = require('connect-mysql')(express);

// 글로벌 객체�?만든??
global.connectionPool = mysql.createPool(dbConfig);

var storeOptions = {
    pool : connectionPool
};

require('./config/passport')(passport);
require('./config/passport-facebook')(passport);

var app = express();

// all environments
app.set('port', process.env.PORT || 80);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
// cookieParser ?�록
app.use(express.cookieParser());
// post�??�어??data 처리????


app.use(express.json());
app.use(express.urlencoded());

//app.use(express.bodyParser());


app.use(express.methodOverride());
app.use(express.session({
    secret: 'tacademy',
    // session??Store?�서 관�??�수 ?�도�??�정
    store : new MySqlStore(storeOptions),
    cookie : {
        maxAge : 300000
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

require('./routes/user')(app, passport);
require('./routes/goapp')(app);
require('./routes/follow')(app);
require('./routes/item')(app);
require('./routes/main')(app);
require('./routes/rank')(app);
require('./routes/room')(app);
require('./routes/search')(app);


http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
