var FacebookTokenStrategy = require('passport-facebook-token').Strategy
    , async = require('async')
    , configAuth = require('./auth');

module.exports = function(passport) {

    passport.serializeUser(function(user, done) {
        console.log('passport.serializeUser ====> ', user);
        return done(null, user.user_num);
    });

    passport.deserializeUser(function(user_num, done) {
        connectionPool.getConnection(function(err, connection) {
            if (err) {
                return done(err);
            }
            var userSel = 'SELECT user_num, facebook_id, facebook_token, facebook_email, facebook_name, facebook_photo FROM User WHERE user_num = ?';
            connection.query(userSel, [user_num], function(err, rows, fields) {
                var user = {};
                user.user_num = rows[0].user_num;
                user.facebookId = rows[0].facebook_id;
                user.facebookToken = rows[0].facebook_token;
                user.facebookEmail = rows[0].facebook_email;
                user.facebookName = rows[0].facebook_name;
                user.facebookPhoto = rows[0].facebook_photo;
                connection.release();
                console.log('passport.deserializeUser ====> ', user);
                return done(null, user);
            });
        });
    });

    passport.use(new FacebookTokenStrategy({
            clientID: configAuth.facebookAuth.clientID,
            clientSecret: configAuth.facebookAuth.clientSecret
        },
        function(accessToken, refreshToken, profile, done) {
            process.nextTick(function() {
                connectionPool.getConnection(function(err, connection) {
                    if (err) {
                        return done(err);
                    }
                    var facebookPhoto = "https://graph.facebook.com/v2.1/me/picture?access_token=" + accessToken;
                    var selectSql = 'SELECT user_num, facebook_id, facebook_token, facebook_email, facebook_name, facebook_photo FROM User WHERE facebook_id = ?';
                    connection.query(selectSql, [profile.id], function(err, rows, fields) {
                        if (err) {
                            connection.release();
                            return done(err);
                        }
                        if (rows.length) {
                            var user = {};
                            user.user_num = rows[0].user_num;
                            user.facebookId = rows[0].facebook_id;
                            user.facebookToken = rows[0].facebook_token;
                            user.facebookEmail = rows[0].facebook_email;
                            user.facebookName = rows[0].facebook_name;
                            user.facebookPhoto = rows[0].facebook_photo;
                            if (accessToken !== user.facebookToken) {
                                var updateSql = 'UPDATE User SET facebook_token = ?, facebook_photo = ? WHERE facebook_id = ?';
                                connection.query(updateSql, [accessToken, facebookPhoto, profile.id], function(err, result) {
                                    if (err) {
                                        connection.release();
                                        return done(err);
                                    }
                                    connection.release();
                                    return done(null, user);
                                });
                            } else {
                                connection.release();
                                console.log("1234");
                                console.log("user : ",user);

                                return done(null, user);
                            }
                        } else {
                            var newUser = {};

                            newUser.housename = profile.name.givenName + ' ' + profile.name.familyName+"님의 집";

                            newUser.facebookId = profile.id;
                            newUser.facebookToken = accessToken;
                            newUser.facebookEmail = profile.emails[0].value;
                            newUser.facebookName = profile.name.givenName + ' ' + profile.name.familyName;
                            newUser.facebookPhoto = "https://graph.facebook.com/v2.1/me/picture?access_token=" + accessToken;
                            var insertSql = 'INSERT INTO User(user_id, nickname, house_name, facebook_id, facebook_token, facebook_email, facebook_name, facebook_photo)' +
                                ' VALUES(?, ?, ?, ?, ?, ?, ?, ?)';
                            connection.query(insertSql, [newUser.facebookId, newUser.facebookName, newUser.housename, newUser.facebookId,
                                newUser.facebookToken, newUser.facebookEmail, newUser.facebookName, newUser.facebookPhoto], function(err, result) {
                                if (err) {
                                    connection.release();
                                    return done(err);
                                }
                                newUser.user_num = result.insertId;
                                connection.release();
                                console.log("1234");
                                return done(null, newUser);
                            });
                        }
                    });
                });
            });
        }));
};
