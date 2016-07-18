var async = require('async')
    , bcrypt = require('bcrypt-nodejs')
    , nodemailer = require('nodemailer')
// , sesTransport = require('nodemailer-ses-transport')
    , cuid = require('cuid')
//, mailConfig = require('../config/auth')
    , upload = require('../routes/upload')
    , express = require('express')
    , request = require('request');


function findpassword(req, res){

    var user_id = req.body.user_id;
    connectionPool.getConnection(function(err, connection){
        if(err){
            res.json({
                "success" : 0,
                "result_msg" : err.message,
                "result" : null
            });
        }
        async.waterfall([function(callback){
            var userSel = 'select * from User where user_id = ?';
            connection.query(userSel, [user_id], function(err, rows, fields){
                if(err){
                    connection.release();
                    console.log("aa");
                    res.json({
                        "success" : 0,
                        "result_msg" : err.message,
                        "result" : null
                    });
                }else{
                    if(!rows.length){
                        connection.release();
                        res.json({
                            "success" : 0,
                            "result_msg" : "등록된 회원이 아닙니다.",
                            "result" : null
                        });
                    }else{
                        var i = 0;
                        async.whilst(
                            function(){
                                return i<rows.length;
                            },function(cb){
                                examine_id = rows[i].user_id;
                                i++;
                                cb();
                            },function(err){
                                connection.release();
                                callback(null, examine_id);
                            }
                        );
                    }
                }
            });
        }, function(examine_id, callback){

            var user = [];
            var transporter = nodemailer.createTransport(sesTransport({
                accessKeyId: authConfig.sesAuth.key,
                secretAccessKey: authConfig.sesAuth.secret,
                region: authConfig.sesAuth.region,
                // 1초에 하나의 메일만 전송한다.
                rateLimit : 1
            }));

            // 7자리의 유니크한 비밀번호를 만들어준다.
            var tempPass = cuid.slug();

            var mailOptions = {
                from: 'housepicmaster@gmail.com',
                to: examine_id,
                subject: '회원님의 임시비밀번호 입니다.',
                html: '회원님의 임시비밀번호는 다음과 같습니다 <br/><br/>'+
                    '<strong>'+tempPass+'</strong><br/><br/>'+
                    '회원님의 고객정보를 위해 비밀번호를 변경해주시 바랍니다.<br/><br/>' +
                    '오늘도 좋은 하루 되시길 바랍니다.'
            };
            transporter.sendMail(mailOptions, function (err, info) {
                if(err){
                    console.log("**여기서 에러 발생**");
                    res.json({
                        "success" : 0,
                        "result_msg" : err.message,
                        "result" : null
                    });
                }else{
                    res.json({
                        "success" : 0,
                        "result_msg" : "메일이 전송되었습니다.",
                        "result" : null
                    });
                    user.push(examine_id);
                    user.push(tempPass);
                    callback(null, user);
                }
            });
        }], function(err, result){
            if(err){
                connection.release();
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }else{
                async.waterfall([function(cb1){
                    var rounds = 10;
                    bcrypt.genSalt(rounds, function(err, salt){
                        cb1(null, salt);
                    });
                }, function(salt, cb1){
                    bcrypt.hash(result[1], salt, null, function(err, hashPass){
                        new_password = hashPass;
                        cb1(null, new_password);
                    });
                }], function (err, new_password) {
                    if(err){
                        console.log("dd");
                        res.json({
                            "success" : 0,
                            "result_msg" : err.message,
                            "result" : null
                        });
                    }else{
                        var pwdUpd = 'update User set password = ? where user_id = ?';
                        connection.query(pwdUpd, [new_password, result[0]], function(err, result){
                        });
                    }
                });

            }
        });
    });
}


function registerId(req, res, next){

    var user_num = req.user.user_num;
    var registrationId = req.body.registrationId;

    connectionPool.getConnection(function(err, connection){
        if (err){
            res.json({error : err});
        } else {
            var updateSql = 'update User set gcm_registration_id = ? where user_num = ?';
            connection.query(updateSql, [registrationId, user_num], function(err, result){
                if (err){
                    connection.release();
                    res.json({error : err});
                } else {
                    connection.release();
                    next();
                }
            });
        }
    });
}

function profileUser(req, res) {
    var user_num = req.params.user_num;
    var userData;
    //console.log("===>>>",user_num,"님의 프로필에 접근하셨습니다.");
    connectionPool.getConnection(function (err, connection) {
        if(err){
            res.json({
                "success" : 0,
                "result_msg" : err.message,
                "result" : null
            });
        }
        async.parallel([function (callback) {
            var userSel = 'select user_num, nickname, user_img, follower_cnt, following_cnt,' +
                ' house_name, house_intro, house_img, alert from User where user_num = ?';
            connection.query(userSel, [user_num], function (err, rows, fields) {
                if (err) {
                    callback(err);
                }
                if (!rows.length) {
                    callback(err);
                } else {
                    async.each(rows, function(row, cb){
                        userData = {
                            "user_num": row.user_num,
                            "user_nickname": row.nickname,
                            "user_img_url": row.user_img,
                            "following_cnt": row.following_cnt,
                            "follower_cnt": row.follower_cnt,
                            "house_name": row.house_name,
                            "house_intro": row.house_intro,
                            "house_img_url": row.house_img,
                            "alert": row.alert
                        };
                        cb();
                    },function(err){
                        callback(null, userData);
                    });
                }
            });
        }, function (callback) {
            var room_list = [];
            var roomSel = 'select r.room_num, r.room_name, r.room_img, r.color, r.open_close' +
                ' from User u join Room r on u.user_num = r.user_num' +
                ' where u.user_num = ?';
            connection.query(roomSel, [user_num], function (err, rows, fields) {
                if (err) {
                    callback(err);
                }
                else {
                    async.each(rows, function(row, cb1){
                        var roomData = {
                            "room_num": row.room_num,
                            "room_name": row.room_name,
                            "room_img_url": row.room_img,
                            "room_color": row.color,
                            "room_ispublic": row.open_close
                        };
                        //console.log(row.room_name,"의 방 공개여부 보기 : ",row.open_close);
                        room_list.push(roomData);
                        cb1();
                    },function(err){
                        callback(null, room_list);
                    });
                }
            });

        }], function (err, results) {
            if (err) {
                connection.release();
                res.json({
                    "success": 0,
                    "result_msg": err.message,
                    "result": null
                });
            }else{
                connection.release();
                res.json({
                    "success" : 1,
                    "result_msg" : null,
                    "result" : {
                        user : results[0],
                        rooms : results[1]
                    }
                });
            }
        });
    });
}


function localLogout(req, res){

    req.logout();
    req.session.destroy();
    res.json({
        "success" : 1,
        "result_msg" : "로그아웃 되셨습니다.",
        "result" : null
    })
}

// 페이스북 로그아웃
function facebookLogout(req, res) {

    request(
        {
            url: "https://graph.facebook.com/v2.1/me/permissions?access_token=" + req.user.facebook_token,
            method: 'DELETE'
        },
        function(err, response, body) {
            if (err) {
                console.log(err);
                res.json(500, { error : err });
            } else {
                console.log("response.statusCode: ", response.statusCode);
                console.log("body: ", body);
                if (response.statusCode !== 200) {
                    res.json(400, { error : "Please, Check your request!!!" });
                } else {
                    req.logout();
                    req.session.destroy();

                    console.log("req.user: ", req.user);
                    res.json(200, { data : "logout successful!!!" });
                }
            }
        }
    );
}



module.exports = function(app, passport){
    app.post('/register', express.bodyParser(), passport.authenticate('local-signup'), function(req, res){
        res.json({
            "success" : 1,
            "result_msg" : "회원 가입이 완료되었습니다.",
            "result" : null
        });
    });

    app.post('/login', express.bodyParser(), passport.authenticate('local-login'), registerId, function(req, res){
        console.log('===>>> 유저번호', req.user.user_num,"님이 로그인 하셨습니다.");
        res.json({
            "success" : 1,
            "result_msg" : "로그인 되었습니다.",
            "result" : {
                "user_num" : req.user.user_num
            }
        });
    });

    app.post('/login/facebook', express.bodyParser(), passport.authenticate('facebook-token', { scope: ['email'] }), registerId,
        function(req, res){
            res.json({
                "success" : 1,
                "result_msg" : "Facebook으로 로그인 하셨습니다.",
                "result" : {
                    "user_num" : req.user.user_num
                }
            });
        });


    app.post('/user/:user_id/password/modify', express.bodyParser(), passport.authenticate('local-modify'),
        function(req, res){
            res.json({
                "success" : 1,
                "result_msg" : "비밀 번호가 변경 되었습니다.",
                "result" : null
            });
        });




    app.post('/findpwd', findpassword);

    app.post('/logout', localLogout);
    app.get('/logout/facebook', facebookLogout);
    // 사용자 개인정보 열람
    app.get('/user/:user_num/profile', profileUser);
    // 사용자 개인정보 수정
    app.post('/user/:user_num/profile/modify', upload.isLoggedIn, upload.modifyUser);
};
