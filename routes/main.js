var mysql = require('mysql');
var dbConfig = require('../config/database');
var async = require('async');
var upload = require('../routes/upload');

function listSampleRoom(req, res) {

    var user_num;
    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    var page = req.query.page;
    var count = req.query.count;

    if (!page) page = 0;
    if (!count) count = 5;

    var start = page * count;
    var end = count;

    // DB Connection
    connectionPool.getConnection(function (err, connection) {
        if(err){
            res.json({
                "success": 0,
                "result_msg": err.message,
                "result": null
            });
        }
        async.waterfall([function (callback) {
            // 관리자의 Room 정보를 검색하는 SQL
            var userSel = 'select u.user_num , r.room_num, r.room_name, r.room_img, r.color, r.reg_date, r.room_url, r.string_url' +
                ' From User u join Room r on u.user_num = r.user_num' +
                ' where u.user_num between 1 and 10 order by reg_date desc limit ?, ?';
            connection.query(userSel, [start, end], function(err, rows, fields){
                if (err){
                    callback(err);
                }
                else {
                    if(!rows.length){
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": "해당 방이 존재하지 않습니다.",
                            "result": null
                        });
                    }else{
                        var room_list = [];
                        async.each(rows, function(row, cb){
                            var room = {
                                "user": {
                                    "user_num": row.user_num
                                },
                                "room": {
                                    "room_num": row.room_num,
                                    "room_name": row.room_name,
                                    "room_img_url": row.room_img,
                                    "room_color": row.color,
                                    "source_name": row.string_url,
                                    "source_url": row.room_url
                                }
                            };
                            room_list.push(room);
                            cb();
                        }, function(err){
                            callback(null, room_list);
                        });
                    }
                }
            });
        }, function (room_list, callback) {
            async.each(room_list, function (each_room, cb1) {
                var itemSel = 'select m.room_num, p.product_num, p.product_name, p.price, i.img_path1, i.img_path2, i.img_path3,' +
                    ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike' +
                    ' from Manage m join Product p on m.product_num = p.product_num' +
                    ' join Image i on p.product_num = i.product_num' +
                    ' where m.room_num = ? order by rand()';
                connection.query(itemSel, [user_num ,each_room.room.room_num], function (err, rows, fields) {
                    if (err) {
                        res.json({
                            "success": 0,
                            "result_msg": err.message,
                            "result": null
                        });
                    } else {
                        if (!rows.length) {
                            connection.release();
                            res.json({
                                "success": 0,
                                "result_msg": "등록된 상품이 없습니다.",
                                "result": null
                            });
                        } else {
                            var item_list = [];
                            async.each(rows, function (row, cb2) {
                                var item = {
                                    "room_num": row.room_num,
                                    "item_num": row.product_num,
                                    "item_img_url": [ row.img_path1, row.img_path2, row.img_path3 ],
                                    "item_name": row.product_name,
                                    "price": row.price,
                                    "islike": row.islike
                                };
                                item_list.push(item);
                                cb2();
                            }, function (err) {
                                each_room.items = item_list;
                                cb1();
                            });
                        }
                    }

                });
            }, function (err) {
                callback(null, room_list);
            });
        }], function (err, result) {
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
                    "result_msg": null,
                    "totalPage":req.totalPage,
                    "result": {
                        "users" : result
                    }
                });
            }
        });
    });
}

// Room 안에 5개 이상의 상품을 등록한 사용자들의 Room과 상품들을 보여준다.
function listUserRoom(req, res) {
    var user_num;
    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    var page = req.query.page;
    var count = req.query.count;

    if (!page) page = 0;
    if (!count) count = 5;

    var start = page * count;
    var end = count;

    // DB Connection
    connectionPool.getConnection(function (err, connection) {
        if(err){
            res.json({
                "success": 0,
                "result_msg": err.message,
                "result": null
            });
        }
        async.waterfall([function (callback) {
            var roomSel = 'select r.user_num, m.room_num, m.product_num, count(m.room_num) as productCnt, r.reg_date' +
                ' from Manage m join Room r on m.room_num = r.room_num' +
                ' group by m.room_num having productCnt >= 5 and' +
                ' r.user_num not between 1 and 10 order by reg_date desc limit ?, ?';
            connection.query(roomSel, [start, end], function (err, rows, fields) {
                if (err) {
                    callback(err);
                } else {
                    if (!rows.length) {
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": "해당 방이 존재하지 않습니다.",
                            "result": null
                        });
                    } else {
                        var room_list = [];
                        async.each(rows, function (row, cb) {
                            var room = {
                                "room_num": row.room_num
                            };
                            room_list.push(room);
                            cb();
                        }, function (err) {
                            callback(null, room_list);
                        });
                    }
                }
            });
        }, function (room_list, callback) {
            var user_list = [];
            async.each(room_list, function (each_room, cb1) {
                var userSel = 'select u.user_num , u.nickname, u.user_img, r.room_num, r.room_name, r.room_img, r.color, r.reg_date' +
                    ' From User u join Room r on u.user_num = r.user_num' +
                    ' where r.room_num = ? and r.open_close = 1';
                connection.query(userSel, [each_room.room_num], function (err, rows, fields) {
                    if (err) {
                        callback(err);
                    }  else {
                        async.each(rows, function (row, cb2) {
                            var user = {
                                "user": {
                                    "user_name": row.nickname,
                                    "user_num": row.user_num,
                                    "user_img_url": row.user_img
                                },
                                "room": {
                                    "room_num": row.room_num,
                                    "room_name": row.room_name,
                                    "room_img_url": row.room_img,
                                    "room_color": row.color,
                                    "room_date": row.reg_date
                                }
                            };
                            user_list.push(user);
                            cb2();
                        }, function (err) {
                            cb1();
                        });
                    }

                });
            }, function (err) {
                callback(null, user_list);
            });
        }, function (user_list, callback) {
            async.each(user_list, function (each_user, cb3) {
                var itemSel = 'select m.room_num, p.product_num, p.product_name, p.price, i.img_path1, i.img_path2, i.img_path3,' +
                    ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike' +
                    ' from Manage m join Product p on m.product_num = p.product_num' +
                    ' join Image i on p.product_num = i.product_num' +
                    ' where m.room_num = ? order by rand()';
                connection.query(itemSel, [user_num, each_user.room.room_num], function (err, rows, fields) {
                    if (err) {
                        callback(err);
                    } else {
                        if (!rows.length) {
                            connection.release();
                            res.json({
                                "success": 0,
                                "result_msg": "등록된 상품이 없습니다.",
                                "result": null
                            });
                        } else {
                            var item_list = [];
                            async.each(rows, function (row, cb4) {
                                var item = {
                                    "room_num": row.room_num,
                                    "item_num": row.product_num,
                                    "item_img_url": [ row.img_path1, row.img_path2, row.img_path3 ],
                                    "item_name": row.product_name,
                                    "price": row.price,
                                    "islike": row.islike
                                };
                                item_list.push(item);
                                cb4();
                            }, function (err) {
                                each_user.items = item_list;

                                cb3();
                            });
                        }
                    }

                });
            }, function (err) {
                callback(null, user_list);
            });
        }], function (err, result) {
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
                    "result_msg": null,
                    "totalPage": req.totalPage,
                    "result": {
                        "users": result
                    }
                });
            }
        });
    });
}

/*
 function listFriendsRoom(req, res) {
 var user_num;
 if(req.user) user_num = req.user.user_num;
 // 로그인 되어있지 않을 시에
 else user_num = 0;

 var page = req.query.page;
 var count = req.query.count;

 if (!page) page = 0;
 if (!count) count = 5;

 var start = page * count;
 var end = count;

 // DB Connection
 connectionPool.getConnection(function (err, connection) {
 if(err){
 res.json({
 "success": 0,
 "result_msg": err.message,
 "result": null
 });
 }
 async.waterfall([function (callback) {
 var userSel = 'select room_num from Follow f join User u on f.to_user_num = u.user_num' +
 ' join Room r on u.user_num = r.user_num where from_user_num = ? order by r.reg_date desc limit ?, ?';
 connection.query(userSel, [user_num, start, end], function (err, rows, fields) {
 if (err) {
 callback(err);
 } else {
 if (!rows.length) {
 connection.release();
 res.json({
 "success": 0,
 "result_msg": "해당 방이 존재하지 않습니다.",
 "result": null
 });
 } else {
 var room_list = [];
 async.each(rows, function (row, cb) {
 var user = {
 "room_num": row.room_num
 };
 room_list.push(user);
 cb();
 }, function (err) {
 callback(null, room_list);
 });
 }
 }
 });
 }, function (room_list, callback) {
 var user_list = [];
 async.each(room_list, function(each_user, cb1){

 var userSel = 'select u.user_num , u.nickname, u.user_img, r.room_num, r.room_name, r.room_img, r.color, r.reg_date' +
 ' from Manage m join Room r on m.room_num = r.room_num' +
 ' join User u on r.user_num = u.user_num group by r.room_num' +
 ' having count(product_num) >= 5 and r.room_num = ?';
 connection.query(userSel, [each_user.room_num], function (err, rows, fields) {
 if (err) {
 callback(err);
 }  else {
 async.each(rows, function (row, cb2) {
 var user = {
 "user": {
 "user_name": row.nickname,
 "user_num": row.user_num,
 "user_img_url": row.user_img
 },
 "room": {
 "room_num": row.room_num,
 "room_name": row.room_name,
 "room_img_url": row.room_img,
 "room_color": row.color,
 "room_date": row.reg_date
 }
 };
 user_list.push(user);
 cb2();
 }, function (err) {
 cb1();
 });
 }
 });
 },function(err){
 callback(null, user_list);
 });
 }, function (user_list, callback) {
 async.each(user_list, function (each_user, cb3) {

 var itemSel = 'select m.room_num, p.product_num, p.product_name, p.price, i.img_path1, i.img_path2, i.img_path3,' +
 ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike' +
 ' from Manage m join Product p on m.product_num = p.product_num' +
 ' join Image i on p.product_num = i.product_num' +
 ' where m.room_num = ? order by rand()';
 connection.query(itemSel, [user_num, each_user.room.room_num], function (err, rows, fields) {
 if (err) {
 callback(err);
 } else {
 var item_list = [];
 async.each(rows, function (row, cb4) {
 var item = {
 "room_num": row.room_num,
 "item_num": row.product_num,
 "item_img_url": [ row.img_path1, row.img_path2, row.img_path3 ],
 "item_name": row.product_name,
 "price": row.price,
 "islike": row.islike
 };
 item_list.push(item);
 cb4();
 }, function (err) {
 each_user.items = item_list;
 cb3();
 });
 }
 });
 }, function (err) {
 callback(null, user_list);
 });
 }], function (err, result) {
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
 "result_msg": null,
 "totalPage": req.totalPage,
 "result": {
 "users": result
 }
 });
 }
 });
 });
 }*/

function listFriendsRoom(req, res) {
    var user_num;
    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    var page = req.query.page;
    var count = req.query.count;

    if (!page) page = 0;
    if (!count) count = 5;

    var start = page * count;
    var end = count;

    // DB Connection
    connectionPool.getConnection(function (err, connection) {
        if(err){
            res.json({
                "success": 0,
                "result_msg": err.message,
                "result": null
            });
        }
        async.waterfall([function (callback) {
            var roomSel = 'select r.room_num from Follow f join User u on f.to_user_num = u.user_num' +
                ' join Room r on u.user_num = r.user_num' +
                ' where from_user_num = ? and r.open_close = 1' +
                ' and room_num in (select room_num from Manage group by room_num having count(*) >= 5)' +
                ' order by r.reg_date desc limit ?, ?;';
            connection.query(roomSel, [user_num, start, end], function (err, rows, fields) {
                if (err) {
                    callback(err);
                } else {
                    if (!rows.length) {
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": "해당 방이 존재하지 않습니다.",
                            "result": null
                        });
                    } else {
                        var room_list = [];
                        var i = 0;
                        async.whilst(
                            function(){
                                return i<rows.length;
                            }, function(cb){
                                var room_num = rows[i].room_num;
                                room_list.push(room_num);
                                i++;
                                cb();
                            }, function(err){
                                callback(null, room_list);
                            });
                    }
                }
            });
        }, function (room_list, callback) {
            var user_list = [];
            async.each(room_list, function(each_user, cb1){
                var userSel = 'select u.user_num , u.nickname, u.user_img, r.room_num, r.room_name, r.room_img, r.color, r.reg_date' +
                    ' from Manage m join Room r on m.room_num = r.room_num' +
                    ' join User u on r.user_num = u.user_num group by r.room_num' +
                    ' having count(product_num) >= 5 and r.room_num = ?';
                connection.query(userSel, [each_user], function (err, rows, fields) {
                    if (err) {
                        callback(err);
                    }  else {
                        async.each(rows, function (row, cb2) {
                            var user = {
                                "user": {
                                    "user_name": row.nickname,
                                    "user_num": row.user_num,
                                    "user_img_url": row.user_img
                                },
                                "room": {
                                    "room_num": row.room_num,
                                    "room_name": row.room_name,
                                    "room_img_url": row.room_img,
                                    "room_color": row.color,
                                    "room_date": row.reg_date
                                }
                            };
                            user_list.push(user);
                            cb2();
                        }, function (err) {
                            cb1();
                        });
                    }
                });
            },function(err){
                callback(null, user_list);
            });
        }, function (user_list, callback) {
            async.each(user_list, function (each_user, cb3) {

                var itemSel = 'select m.room_num, p.product_num, p.product_name, p.price, i.img_path1, i.img_path2, i.img_path3,' +
                    ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike' +
                    ' from Manage m join Product p on m.product_num = p.product_num' +
                    ' join Image i on p.product_num = i.product_num' +
                    ' where m.room_num = ? order by rand()';
                connection.query(itemSel, [user_num, each_user.room.room_num], function (err, rows, fields) {
                    if (err) {
                        callback(err);
                    } else {
                        var item_list = [];
                        async.each(rows, function (row, cb4) {
                            var item = {
                                "room_num": row.room_num,
                                "item_num": row.product_num,
                                "item_img_url": [ row.img_path1, row.img_path2, row.img_path3 ],
                                "item_name": row.product_name,
                                "price": row.price,
                                "islike": row.islike
                            };
                            item_list.push(item);
                            cb4();
                        }, function (err) {
                            each_user.items = item_list;
                            cb3();
                        });
                    }
                });
            }, function (err) {
                callback(null, user_list);
            });
        }], function (err, result) {
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
                    "result_msg": null,
                    "totalPage": req.totalPage,
                    "result": {
                        "users": result
                    }
                });
            }
        });
    });
}


module.exports = function(app){

    app.get('/sample/room/viewlist', upload.mdCount,listSampleRoom);
    app.get('/user/room/viewlist', upload.everyoneCount, listUserRoom);
    app.get('/user/:user_num/friends/room/viewlist', upload.isLoggedIn, upload.friendsCount, listFriendsRoom);
};
