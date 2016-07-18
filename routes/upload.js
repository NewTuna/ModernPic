var _ = require('underscore'),
    async = require('async'),
    fstools = require('fs-tools'),
    fs = require('fs'),
    path = require('path'),
    mime = require('mime'),
    formidable = require('formidable');

exports.modifyRoom = function(req, res, next) {

    // 파일을 안 올리는 경우 (x-www-form-urlencoded)
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {

        console.log("urlencoded");

        var user_num = req.user.user_num;               // 사용자 번호
        var room_num = req.params.room_num;             // 사용자 Room 번호
        var room_img = req.body.room_img_url;              // 유저의 방 이미지
        var room_name = req.body.room_name;               // 변경하고자 하는 사용자 Room 이름
        var room_color = req.body.room_color;             // 변경하고자 하는 사용자 Room Color
        var room_ispublic = req.body.room_ispublic;       // 사용자 Room 공개여부 변경
        var ntime = new Date();

        connectionPool.getConnection(function(err, connection){

            var imgUpd = 'update Room set room_name = ?, room_img = ?, color = ?, open_close = ?, reg_date = ?' +
                ' where user_num = ? and room_num = ?';
            connection.query(imgUpd, [room_name, room_img, room_color, room_ispublic, ntime, user_num, room_num],
                function(err, result){
                    if(err){
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": err.message,
                            "result": null
                        });
                    }else{
                        connection.release();
                        res.json({
                            "success": 1,
                            "result_msg": "방 정보가 수정되었습니다.",
                            "result": null
                        });
                    }
                });
        });

    } else { // 파일을 올리는 경우 (multipart/form-data)

        console.log("multi-part");

        var form = new formidable.IncomingForm();
        // 이미지 저장 경로
        form.uploadDir = path.normalize(__dirname + '/../images/');
        // 확장명까지 보여준다.
        form.keepExtensions = true;

        form.parse(req, function (err, fields, files) {

            // 이미지 저장 경로
            var baseImageDir = __dirname + '/../images/';

            var user_num = req.user.user_num;               // 사용자 번호
            var room_num = req.params.room_num;             // 사용자 Room 번호
            var room_img = files.room_img_url;              // 유저의 방 이미지
            var room_name = fields.room_name;               // 변경하고자 하는 사용자 Room 이름
            var room_color = fields.room_color;             // 변경하고자 하는 사용자 Room Color
            var room_ispublic = fields.room_ispublic;       // 사용자 Room 공개여부 변경
            var ntime = new Date();

            connectionPool.getConnection(function(err, connection) {
                if (err) {
                    console.log(err);
                    res.json({
                        "success": 0,
                        "result_msg": err.message,
                        "result": null
                    });
                }
                async.waterfall([function (callback) {
                    // DB에 유저의 방 이미지가 존재하는지에 대한 SQL
                    var userSel = 'select room_img from Room where Room_num = ?';
                    connection.query(userSel, [room_num], function (err, rows, fields) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, rows);
                        }
                    });
                }, function(rows, callback){
                    // 유저의 방 이미지가 존재하면 기존 파일 삭제
                    fstools.remove(path.normalize(baseImageDir+rows[0].room_img), function(err){
                        if(err){
                            callback(err);
                        }else{       // 새로운 방 이미지 변경하는 SQL
                            var imgUpd = 'update Room set room_name = ?, room_img = ?, color = ?, open_close = ?, reg_date = ?' +
                                ' where user_num = ? and room_num = ?';
                            connection.query(imgUpd, [room_name, path.basename(room_img.path), room_color, room_ispublic,
                                ntime, user_num, room_num],function(err, result){
                                if(err){
                                    callback(err);
                                }else{
                                    callback();
                                }
                            });
                        }
                    });
                }], function (err) {
                    if (err) {
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": err.message,
                            "result": null
                        });
                    } else {
                        connection.release();
                        res.json({
                            "success": 1,
                            "result_msg": "방 정보가 수정되었습니다.",
                            "result": null
                        });
                    }
                });
            });
        });
    }
};

exports.modifyUser = function (req, res) {

    // 파일을 안 올리는 경우 (x-www-form-urlencoded)
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {

        console.log("urlencoded");

        var user_num = req.user.user_num;
        var nickname = req.body.user_nickname;
        var house_name = req.body.house_name;
        var house_intro = req.body.house_intro;
        var alert = req.body.alert;
        // 유저 이미지
        var user_img = req.body.user_img_url;
        // 유저의 하우스 이미지
        var house_img = req.body.house_img_url;

        connectionPool.getConnection(function(err, connection){
            if (err){
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }
            var imgUpd = 'update User set nickname = ?, user_img = ?, house_img = ?, house_name = ?,' +
                ' house_intro = ?, alert = ? where user_num = ?';
            connection.query(imgUpd, [nickname, user_img, house_img, house_name, house_intro, alert, user_num],
                function(err, result){
                    if (err) {
                        connection.release();
                        res.json({
                            "success" : 0,
                            "result_msg" : err.message,
                            "result" : null
                        });
                    } else {
                        connection.release();
                        res.json({
                            "success" : 1,
                            "result_msg" : "개인정보가 수정되었습니다.",
                            "result" : null
                        });
                    }
                }
            );
        });
    } else { // 파일을 올리는 경우 (multipart/form-data)

        console.log("multi-part");

        var form = new formidable.IncomingForm();
        // 이미지 저장 경로
        form.uploadDir = path.normalize(__dirname + '/../images/');
        // 확장명까지 보여준다.
        form.keepExtensions = true;

        form.parse(req, function (err, fields, files) {

            // 이미지 저장 경로
            var baseImageDir = __dirname + '/../images/';

            var user_num = req.user.user_num;

            var nickname = fields.user_nickname;
            var house_name = fields.house_name;
            var house_intro = fields.house_intro;
            var alert = fields.alert;
            // 유저 이미지
            var user_img = files.user_img_url;
            // 유저의 하우스 이미지
            var house_img = files.house_img_url;

            connectionPool.getConnection(function(err, connection) {
                if (err) {
                    console.log(err);
                    res.json({
                        "success": 0,
                        "result_msg": err.message,
                        "result": null
                    });
                }
                async.waterfall([function (callback) {
                    // DB에 유저의 이미지와 하우스 이미지가 존재하는지에 대한 SQL
                    var userSel = 'select user_img, house_img from User where user_num = ?';
                    connection.query(userSel, [user_num], function (err, rows, fields) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, rows);
                        }
                    });
                }, function(rows, callback){
                    if (user_img && !house_img){ // 유저 이미지만 변경하고자 할때, 기존 파일 삭제
                        fstools.remove(path.normalize(baseImageDir+rows[0].user_img), function(err){
                            if(err){
                                callback(err);
                            }else{                 // 새로운 유저 이미지로 변경하는 SQL

                                var userImgSel = 'update User set nickname = ?, user_img = ?, house_name = ?,' +
                                    ' house_intro = ?, alert = ? where user_num = ?';
                                //var userImgSel = 'update User set user_img = ? where user_num = ?';
                                connection.query(userImgSel, [nickname, path.basename(user_img.path), house_name, house_intro, alert, user_num],
                                    function(err, result){
                                        if(err){
                                            callback(err);
                                        }else{
                                            callback();
                                        }
                                    });
                            }
                        });
                    }
                    if(house_img && !user_img){     // 하우스 이미지만 변경하고자 할때, 기존 파일 삭제
                        fstools.remove(path.normalize(baseImageDir+rows[0].house_img), function(err){
                            if(err){
                                callback(err);
                            }else{                  // 새로운 하우스 이미지로 변경하는 SQL
                                var houseImgSel = 'update User set nickname = ?, house_img = ?, house_name = ?,' +
                                    ' house_intro = ?, alert = ? where user_num = ?';
                                //var houseImgSel = 'update User set house_img = ? where user_num = ?';
                                connection.query(houseImgSel, [nickname, path.basename(house_img.path), house_name, house_intro, alert, user_num],
                                    function(err, result){
                                        if(err){
                                            callback(err);
                                        }else{
                                            callback();
                                        }
                                    });
                            }
                        });
                    }
                    if(house_img && user_img){
                        async.series([function(cb){
                            fstools.remove(path.normalize(baseImageDir+rows[0].user_img), function(err){
                                if(err){
                                    cb(err);
                                }else{                 // 새로운 유저 이미지로 변경하는 SQL
                                    var userImgSel = 'update User set nickname = ?, user_img = ?, house_name = ?,' +
                                        ' house_intro = ?, alert = ? where user_num = ?';
                                    //var ImgSel = 'update User set user_img = ? where user_num = ?';
                                    connection.query(userImgSel, [nickname, path.basename(user_img.path), house_name, house_intro, alert, user_num],
                                        function(err, result){
                                            if(err){
                                                cb(err);
                                            }else{
                                                cb();
                                            }
                                        });
                                }
                            });
                        }, function(cb){
                            fstools.remove(path.normalize(baseImageDir+rows[0].house_img), function(err){
                                if(err){
                                    cb(err);
                                }else{                  // 새로운 하우스 이미지로 변경하는 SQL
                                    var houseImgSel = 'update User set nickname = ?, house_img = ?, house_name = ?,' +
                                        ' house_intro = ?, alert = ? where user_num = ?';
                                    //var houseImgSel = 'update User set house_img = ? where user_num = ?';
                                    connection.query(houseImgSel, [nickname, path.basename(house_img.path), house_name, house_intro, alert, user_num],
                                        function(err, result){
                                            if(err){
                                                cb(err);
                                            }else{
                                                cb();
                                            }
                                        });
                                }
                            });
                        }],function(err){
                            if(err){
                                callback(err);
                            }else{
                                callback();
                            }
                        })
                    }
                }], function (err) {
                    if (err) {
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": err.message,
                            "result": null
                        });
                    } else {
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": "개인정보가 수정되었습니다.",
                            "result": null
                        });
                    }
                });
            });
        });
    }
};


exports.mdCount = function(req, res, next){

    connectionPool.getConnection(function(err, connection){
        var roomSel = 'select count(*) as pageCnt from Room where user_num between 1 and 10';
        connection.query(roomSel, function(err, rows, fields){
            if(err){
                connection.release();
                res.json({
                    "success": 0,
                    "result_msg": err.message,
                    "result": null
                });
            }
            connection.release();
            req.totalPage = rows[0].pageCnt;
            next();
        })
    });
};

exports.everyoneCount = function(req, res, next){

    connectionPool.getConnection(function(err, connection){
        var roomSel = 'select count(room_num) as pageCnt from Room' +
            ' where open_close = 1 and room_num in (select room_num from Manage group by room_num having count(*) >= 5)' +
            ' and user_num not between 1 and 10';
        connection.query(roomSel, function(err, rows, fields){
            if(err){
                connection.release();
                res.json({
                    "success": 0,
                    "result_msg": err.message,
                    "result": null
                });
            }
            connection.release();
            req.totalPage = rows[0].pageCnt;
            next();
        })
    });
};

exports.friendsCount = function(req, res, next){

    var user_num = req.user.user_num;

    connectionPool.getConnection(function(err, connection){
        var roomSel = 'select count(room_num) as pageCnt from Follow f' +
            ' join User u on f.to_user_num = u.user_num' +
            ' join Room r on u.user_num = r.user_num' +
            ' where from_user_num = ? and r.open_close = 1 and' +
            ' room_num in (select room_num from Manage group by room_num having count(*) >= 5)';
        connection.query(roomSel, [user_num], function(err, rows, fields){
            if(err){
                connection.release();
                res.json({
                    "success": 0,
                    "result_msg": err.message,
                    "result": null
                });
            }
            connection.release();
            req.totalPage = rows[0].pageCnt;
            next();
        })
    });
};

// 로그인한 회원을 인증하기 위한 함수
exports.isLoggedIn = function(req, res, next) {
    // ?�증
    if (req.isAuthenticated()) {
        return next();
    }
    return res.redirect('/sample/room/viewlist');
};


exports.getImage = function(req, res) {

    var imagepath = req.params.imagepath;

    console.log(req.params.imagepath);

    var filepath = path.normalize(__dirname + '/../images/' + imagepath);

    console.log("filepath: ", filepath);

    fs.exists(filepath, function(exists){
        console.log(exists);
        if(exists){
            res.statuscode = 200;
            res.set('Content-Type', mime.lookup(imagepath));
            var rs = fs.createReadStream(filepath);
            rs.pipe(res);
        }else{
            res.json({
                "success" : 0,
                "result_msg" : "사진이 존재하지 않습니다.",
                "result" : null
            });
        }
    });
};
