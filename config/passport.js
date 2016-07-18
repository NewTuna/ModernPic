var LocalStrategy = require('passport-local').Strategy
    , bcrypt = require('bcrypt-nodejs')
    , async = require('async');

module.exports = function(passport) {
    // 사용자의 정보를 session에 저장
    passport.serializeUser(function(user, done) {
        //console.log('passport.serializeUser ====> ', user);
        console.log('===>>> 유저번호',user.user_num,'님의 회원 정보를 session에 저장했습니다.');
        done(null, user.user_num);
    });
    // 로그인이 되어 있을 경우 사용자 페이지에 접근할 경우 deserializeUser 메소드 실행, session에 저장된 값을 찾아서 return
    passport.deserializeUser(function(user_num, done) {
        global.connectionPool.getConnection(function(err, connection) {
            if (err) {
                return done(err);
            }
            var selectSql = 'SELECT user_num, user_id, password, nickname, facebook_token FROM User WHERE user_num = ?';
            connection.query(selectSql, [user_num], function(err, rows, fields) {
                var user = rows[0];
                connection.release();
                //console.log('===>>> 유저번호',user.user_num,'님의 회원정보를 DB에서 읽어왔습니다.');
                return done(null, user);
            });
        });
    });

    passport.use('local-signup', new LocalStrategy({
            usernameField: 'user_id',
            passwordField: 'user_password',
            passReqToCallback: true
        },
        function(req, user_id, user_password, done) {
            process.nextTick(function() {
                global.connectionPool.getConnection(function(err, connection) {
                    if (err) {
                        return done(err);
                    }
                    var selectSql = 'SELECT user_id FROM User WHERE user_id = ?';
                    connection.query(selectSql, [user_id], function(err, rows, fields) {
                        if (err) {
                            connection.release();
                            return done(err);
                        }
                        if (rows.length) {
                            connection.release();
                            return done(null, false);
                        } else {
                            async.waterfall([
                                    function generateSalt(callback) {
                                        var rounds = 10;
                                        bcrypt.genSalt(rounds, function(err, salt) {
                                            console.log('bcrypt.genSalt ====> ', salt, '(', salt.toString().length,')');
                                            callback(null, salt);
                                        });
                                    },
                                    function hashPassword(salt, callback) {
                                        bcrypt.hash(user_password, salt, null, function(err, hashPass) {
                                            console.log('bcrypt.hash ====> ', hashPass, '(', hashPass.length,')');
                                            var newUser = {};
                                            newUser.user_id = user_id;
                                            newUser.password = hashPass;
                                            newUser.nickname = req.body.user_nickname;
                                            newUser.house_name = req.body.house_name;
                                            callback(null, newUser);
                                        });
                                    }
                                ],
                                function(err, user) {
                                    if (err) {
                                        connection.release();
                                        return done(err);
                                    }
                                    console.log('user_id : ', user.user_id);
                                    console.log('password : ', user.password);
                                    console.log('nickname : ', user.nickname);

                                    var insertSql = 'INSERT INTO User(user_id, password, nickname, house_name) VALUES(?, ?, ?, ?)';
                                    connection.query(insertSql, [user.user_id, user.password, user.nickname, user.house_name], function(err, result) {
                                        if (err) {
                                            connection.release();
                                            return done(err);
                                        }
                                        user.user_num = result.insertId;
                                        connection.release();

                                        return done(null, user);
                                    });
                                });
                        }
                    });
                });
            });
        }));

    passport.use('local-login', new LocalStrategy({

            usernameField: 'user_id',
            passwordField: 'user_password',
            passReqToCallback: true
        },
        function(req, user_id, user_password, done) {
            process.nextTick(function() {

                console.log(user_id);

                global.connectionPool.getConnection(function(err, connection) {
                    if (err) {
                        return done(err);
                    }
                    var selectSql = 'SELECT user_num, user_id, password, nickname FROM User WHERE user_id = ?';
                    connection.query(selectSql, [user_id], function(err, rows, fields) {
                        if (err) {
                            connection.release();
                            return done(err);
                        }
                        if (!rows.length) {
                            connection.release();
                            return done(null, false);
                        }

                        var user = rows[0];
                        connection.release();
                        // 사용자가 입력한 pwd, DB에 저장된 pwd
                        bcrypt.compare(user_password, user.password, function(err, result) {
                            if (!result){
                                return done(null, false);
                            }
                            console.log('bcrypt.compare ====> ', user.password, '(', user,')');
                            return done(null, user);
                        });
                    });
                });
            });
        }));


    passport.use('local-modify', new LocalStrategy({
            usernameField: 'user_num',
            passwordField: 'user_password',
            passReqToCallback: true
        },
        function(req, user_num, user_password, done) {
            process.nextTick(function() {
                global.connectionPool.getConnection(function(err, connection) {
                    if (err) {
                        return done(err);
                    }
                    // select 안하면 User_num를 건내줄수 없다.
                    var selectSql = 'SELECT user_num, user_id FROM User WHERE user_num = ?';
                    connection.query(selectSql, [user_num], function(err, rows, fields) {
                        if (err) {
                            connection.release();
                            return done(err);
                        }
                        else {
                            async.waterfall([
                                    function generateSalt(callback) {
                                        var rounds = 10;
                                        bcrypt.genSalt(rounds, function(err, salt) {
                                            console.log('bcrypt.genSalt ====> ', salt, '(', salt.toString().length,')');
                                            callback(null, salt);
                                        });
                                    },
                                    function hashPassword(salt, callback) {
                                        bcrypt.hash(user_password, salt, null, function(err, hashPass) {
                                            console.log('bcrypt.hash ====> ', hashPass, '(', hashPass.length,')');
                                            var newUser = {};
                                            newUser.user_num = rows[0].user_num;
                                            newUser.password = hashPass;
                                            callback(null, newUser);
                                        });
                                    }
                                ],
                                function(err, user) {
                                    if (err) {
                                        connection.release();
                                        return done(err);
                                    }
                                    var userUpd = 'update User set password = ? where user_num = ?';
                                    connection.query(userUpd, [user.password, user.user_num], function(err, result) {
                                        if (err) {
                                            connection.release();
                                            return done(err);
                                        }
                                        connection.release();
                                        return done(null, user);
                                    });
                                });
                        }
                    });
                });
            });
        }));
};