var async = require('async')
    ,push = require('../routes/push')
    ,upload = require('../routes/upload');


// 사용자 follow 하기
function followUser(req, res){
    var myuser_num = req.user.user_num;             // 사용자(자신)
    var another_user_num = req.params.user_num;     // following 하고 싶은 사용자

    connectionPool.getConnection(function(err, connection) {
        // connectionPool에 대한 error 발생시
        if (err) {
            res.json({
                "success": 0,
                "result_msg": err.message,
                "result": null
            });
        }
        async.waterfall([
            function (callback) {
                console.log("following 유저 번호 ===> ", myuser_num, "| follower 유저 번호 ===> ", another_user_num);
                // Follow table에 해당 to_user_num와 from_user_num가 존재여부에 대한 SQL
                var followUserSel = 'select to_user_num, from_user_num from Follow where to_user_num = ? and from_user_num = ?';
                connection.query(followUserSel, [another_user_num, myuser_num], function (err, rows, fields) {
                    // connection에 대한 error 발생시
                    if (err) {
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": err.message,
                            "result": null
                        });
                    }else{
                        // 사용자가 following한 정보가 존재하지 않을 경우
                        if (!rows.length) {
                            var user = {
                                "from_user_num": myuser_num,              // 사용자(자신)
                                "to_user_num": another_user_num           // following 하고 싶은 사용자
                            };
                            callback(null, user, false);

                        } else { // 사용자가 following한 정보가 존재 할 경우
                            var user = {
                                "from_user_num": rows[0].from_user_num,   // 사용자(자신)
                                "to_user_num": rows[0].to_user_num        // following 하고 싶은 사용자
                            };
                            callback(null, user, true);
                        }
                    }
                });
            }, function (user, userExist, callback) {
                if (userExist) {	 // true에 대해, 입력받은 팔로우 정보가 존재할 경우(팔로우 중인 경우)
                    console.log("following 유저 번호 ===> ", user.from_user_num, "| follower 유저 번호 ===> ", user.to_user_num);
                    // Follow table에서 해당 유저번호의 record를 삭제하는 SQL
                    var followUserDel = 'delete from Follow where to_user_num = ? and from_user_num = ?';
                    connection.query(followUserDel, [user.to_user_num, user.from_user_num], function (err, result) {
                        if (err) {
                            connection.release();
                            res.json({
                                "success": 0,
                                "result_msg": err.message,
                                "result": null
                            });
                        } else { // transaction 사용 (rollback, commit)
                            connection.beginTransaction(function (err) {
                                if (err) {
                                    connection.release();
                                    res.json({
                                        "success": 0,
                                        "result_msg": err.message,
                                        "result": null
                                    });
                                }
                                // follower 사용자의 follower_cnt를 - 1 내린다.
                                console.log("follow_Cnt && follower_Cnt - 1 감소");
                                var followerCntDel = 'update User set follower_cnt = (follower_cnt - 1) where user_num = ?';
                                connection.query(followerCntDel, [user.to_user_num], function (err, result) {
                                    if (err) {
                                        callback(err);
                                    }
                                    // following 사용자의 following_cnt를 -1 내린다.
                                    var followingCntDel = 'update User set following_cnt = (following_cnt - 1) where user_num = ?';
                                    connection.query(followingCntDel, [user.from_user_num], function (err, result) {
                                        if (err) {
                                            callback(err);
                                        }
                                        connection.commit(function (err) {
                                            if (err) {
                                                callback(err);
                                            }
                                            connection.release();
                                            res.json({
                                                "success": 1,
                                                "result_msg": "follow가 해제 되었습니다.",
                                                "result": null
                                            });
                                        });
                                    });
                                });
                            });
                        }
                    });
                } else {  // false에 대해, 입력받은 팔로우 정보가 없을 경우(팔로우 중이 아닌 경우)

                    console.log("following 유저 번호 ===> ", user.from_user_num, "| follower 유저 번호 ===> ", user.to_user_num);
                    // Follow table에서 해당 유저번호의 record를 추가하는 SQL
                    var followUserIns = 'insert into Follow(to_user_num, from_user_num) values (?, ?)';
                    connection.query(followUserIns, [user.to_user_num, user.from_user_num], function (err, result) {
                        if (err) {
                            connection.release();
                            res.json({
                                "success": 0,
                                "result_msg": err.message,
                                "result": null
                            });
                        } else {
                            // GCM 보내주는 Function
                            push.sendMessage(req, res, user.from_user_num, user.to_user_num);

                            // transaction 사용 (rollback, commit)
                            connection.beginTransaction(function (err) {
                                if (err) {
                                    connection.release();
                                    res.json({
                                        "success": 0,
                                        "result_msg": err.message,
                                        "result": null
                                    });
                                }
                                // follower 사용자의 follower_cnt를 + 1 올린다.
                                console.log("follow_Cnt && follower_Cnt + 1 증가");
                                var followerCntAdd = 'update User set follower_cnt = (follower_cnt + 1) where user_num = ?';
                                connection.query(followerCntAdd, [user.to_user_num], function (err, result) {
                                    if (err) {
                                        callback(err);
                                    }
                                    // following 사용자의 following_cnt를 + 1 올린다.
                                    var followingCntAdd = 'update User set following_cnt = (following_cnt + 1) where user_num = ?';
                                    connection.query(followingCntAdd, [user.from_user_num], function (err, result) {
                                        if (err) {
                                            callback(err);
                                        }
                                        connection.commit(function (err) {
                                            if (err) {
                                                callback(err);
                                            }
                                            connection.release();
                                            res.json({
                                                "success": 1,
                                                "result_msg": "follow가 성공했습니다.",
                                                "result": null
                                            });
                                        });
                                    });
                                });
                            });
                        }
                    });
                }
            }], function (err, result) {
            if (err) {                              // Error 발생시 rollback 실행
                connection.release();
                connection.rollback(function () {
                    res.json({
                        "success": 0,
                        "result_msg": err.message,
                        "result": null
                    });
                });
            }
        });
    });
}


// follower 된 사용자 리스트
function listFollowerUser(req, res){
    var user_num = req.params.user_num;
    connectionPool.getConnection(function(err, connection){
        var user_list = [];
        // follow 된 사용자 리스트에 대한 SQL
        var listFollowerUserSel = 'select f.to_user_num, f.from_user_num, u.user_img, u.nickname, u.follower_cnt'
            +' from Follow f join User u on f.from_user_num = u.user_num'
            +' where f.to_user_num = ?';
        connection.query(listFollowerUserSel, [user_num], function(err, rows, fields){
            if(err){
                connection.release();
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
                        "result_msg" : "Follwer가 존재하지 않습니다.",
                        "result" : null
                    });
                }else{
                    // 사용자 정보(사용자번호, 유저이미지, 유저닉네임, 팔로워수)를 data 객체에 담는다.
                    var i = 0;
                    async.whilst(
                        function(){
                            return i < rows.length;
                        },
                        function(callback){
                            var data = {
                                "user_num": rows[i].from_user_num,
                                "user_img_url": rows[i].user_img,
                                "user_nickname": rows[i].nickname,
                                "follower_cnt": rows[i].follower_cnt
                            };
                            user_list.push(data);
                            i++;
                            callback();
                        },
                        function(err){
                            var result = {
                                "users": user_list
                            };
                            connection.release();
                            res.json({
                                "success" : 1,
                                "result_msg" : "성공했습니다.",
                                "result" : result
                            });
                        }
                    );
                }
            }
        });
    });
}

// following 한 사용자 리스트
function listFollowingUser(req, res){
    var user_num = req.params.user_num;
    connectionPool.getConnection(function(err, connection){
        var user_list = [];
        // follow 한 사용자 리스트에 대한 SQL
        var listFollowingUserSel = 'select f.to_user_num, f.from_user_num, u.user_img, u.nickname, u.follower_cnt'
            +' from Follow f join User u on f.to_user_num = u.user_num'
            +' where f.from_user_num = ?';
        connection.query(listFollowingUserSel, [user_num], function(err, rows, fields){
            if(err){
                connection.release();
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
                        "result_msg" : "Follwing 한 사용자가 존재하지 않습니다.",
                        "result" : null
                    });
                }else{
                    // 사용자 정보(유저번호, 유저이미지, 유저닉네임, 팔로워수)를 data 객체에 담는다.
                    async.each(rows, function(row, callback){
                        var data = {
                            "user_num": row.to_user_num,
                            "user_img_url": row.user_img,
                            "user_nickname": row.nickname,
                            "follower_cnt": row.follower_cnt
                        };
                        user_list.push(data);
                        callback();
                    }, function(err){
                        var result = {
                            "users": user_list
                        };
                        connection.release();
                        res.json({
                            "success" : 1,
                            "result_msg" : null,
                            "result" : result
                        });
                    });
                }
            }
        });
    });
}

module.exports = function(app){

    app.post('/user/:user_num/follow', upload.isLoggedIn, followUser);
    app.get('/user/:user_num/followerList', listFollowerUser);
    app.get('/user/:user_num/followingList', listFollowingUser);
};
