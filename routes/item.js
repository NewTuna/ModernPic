var async = require('async')
    ,upload = require('../routes/upload');

//사용자 방안에 상품 추가/삭제하기
function newItem(req, res){
    var user_num = req.user.user_num;              // 사용자 번호
    var room_num = req.params.room_num;            // 사용자 Room 번호
    var item_num = req.params.item_num;            // 사용자 Room 안에 존재하는 Item 번호
    var ntime = new Date();                        // 사용자 Room 안에 Item이 등록된 시간

    connectionPool.getConnection(function(err, connection) {
        // connectionPool에 대한 error 발생시
        if(err){
            res.json({
                "success" : 0,
                "result_msg" : err.message,
                "result" : null
            });
        }
        async.waterfall([function (callback) {
            console.log("방 번호 ===> ", room_num, "| 상품 번호 ===> ", item_num);
            var item;
            // Manage table에 해당 room_num와 product_num가 존재여부에 대한 SQL
            var ItemSel = 'select user_num, room_num, product_num from Manage where user_num = ? and product_num = ?';
            connection.query(ItemSel, [user_num, item_num], function (err, rows, fields) {
                // connection에 대한 error 발생시
                if (err) {
                    connection.release();
                    callback(new Error(err.message));
                }else{

                    if (!rows.length) {                            // Room 안에 Item이 존재하지 않을 경우
                        item = {
                            "user_num": user_num,
                            "room_num": room_num,                  // Room 번호
                            "item_num": item_num,                   // Item 번호
                            "reg_date": ntime
                        };
                        callback(null, item, false);
                    } else {                                       // Room 안에 Item이 존재하는 경우
                        item = {
                            "user_num": user_num,
                            "room_num": rows[0].room_num,          // Room 번호(DB에 저장되어 있음)
                            "item_num": rows[0].product_num        // Item 번호(DB에 저장되어 있음)
                        };
                        callback(null, item, true);
                    }
                }
            });
            // 사용자 방안에 상품 삭제하기
        }, function (item, itemExist, callback) {
            if (itemExist) {	 // true에 대해, Room 안에 Item이 존재하는 경우
                console.log("방 번호 ===> ", item.room_num, "| 상품 번호 ===> ", item.item_num);

                connection.beginTransaction(function (err) {         // transaction (rollback, commit)
                    if (err) {
                        callback(err);
                    }
                    // Manage table에서 해당 유저번호의 record를 삭제하는 SQL
                    var itemDel = 'delete from Manage where user_num = ? and room_num = ? and product_num = ?';
                    connection.query(itemDel, [item.user_num, item.room_num, item.item_num], function (err, result) {
                        if (err) {
                            callback(err);
                        }
                        // 해당 Item의 likeCnt를 - 1 감소한다.
                        console.log("상품 번호 ===> ", item.item_num, "의 likeCnt가 - 1 감소하였습니다.");
                        var likeCntUpd = 'update Product set like_cnt = (like_cnt - 1) where product_num = ?';
                        connection.query(likeCntUpd, [item.item_num], function (err, result) {
                            if (err) {
                                callback(err);
                            }
                            // 사용자가 해당 Item의 좋아요 관계를 삭제한다.
                            connection.commit(function (err) {
                                if (err) {
                                    callback(err);
                                }
                                connection.release();
                                res.json({
                                    "success": 1,
                                    "result_msg": "상품이 삭제되었습니다.",
                                    "result": null
                                });
                            });
                        });
                    });
                });
            } else {  // false에 대해, Room 안에 Item이 존재하지 않을 경우
                console.log("방 번호 ===> ", item.room_num, "| 상품 번호 ===> ", item.item_num);
                connection.beginTransaction(function (err) {   // transaction 사용 (rollback, commit)
                    if (err) {
                        callback(err);
                    }
                    // Manage table에서 해당 유저번호의 record를 추가하는 SQL
                    var itemAdd = 'insert into Manage(user_num, room_num, product_num) values (?, ?, ?)';
                    connection.query(itemAdd, [item.user_num, item.room_num, item.item_num], function (err, result) {
                        if (err) {
                            callback(err);
                        }
                        // 해당 Item의 likeCnt를 + 1 올린다.
                        console.log("상품 번호 ===> ", item.item_num, "의 likeCnt가 + 1 증가하였습니다.");
                        var likeCntUpd = 'update Product set like_cnt = (like_cnt + 1) where product_num = ?';
                        connection.query(likeCntUpd, [item.item_num], function (err, result) {
                            if (err) {
                                callback(err);
                            }
                            // 해당 Room의 시간을 현재 시간으로 변경해준다.
                            var roomDateUpd = 'update Room set reg_date = ? where room_num = ?';
                            connection.query(roomDateUpd, [ntime, item.room_num], function(err, result){
                                if(err){
                                    callback(err);
                                }
                                // 사용자가 해당 Item의 좋아요 관계를 추가한다.
                                connection.commit(function (err) {
                                    if (err) {
                                        callback(err);
                                    }
                                    connection.release();
                                    res.json({                                 // 성공시
                                        "success": 1,
                                        "result_msg": "상품이 추가되었습니다.",
                                        "result": null
                                    });
                                });
                            });
                        });
                    });
                });
            }
        }],function (err, result) {
            if (err) {                    // Error 발생시 rollback 실행
                connection.release();
                connection.rollback(function () {
                    res.json({
                        "success" : 0,
                        "result_msg" : err.message,
                        "result" : null
                    });
                });
            }
        });
    });
}


//사용자 방안에 상품 이동하기
function moveItem(req, res){
    var user_num = req.user.user_num;                   // 사용자 번호
    var room_num = req.params.room_num;                 // 사용자 Room 번호
    var change_room_num = req.body.room_num;            // Item을 이동시키고자 하는 Room 번호
    var item_num = req.body.item_num;                   // 사용자 Room 안에 존재하는 Item 번호

    console.log(">> change : ",change_room_num,"item_num",item_num);
    connectionPool.getConnection(function(err, connection){
        if(err){
            connection.release();
            res.json({
                "success" : 0,
                "result_msg" : err.message,
                "result" : null
            });
        }
        async.waterfall([function(callback){
            // Item이 자신이 방의 존재하는 검사하는 SQL
            var itemSel = 'select * from Manage where room_num = ? and product_num = ?';
            connection.query(itemSel, [room_num, item_num], function(err, rows, fields){
                if(err){
                    callback(err);
                }else{
                    if(!rows.length){
                        callback(new Error("해당 상품이 존재하지 않습니다."));
                    }else{
                        var data = {
                            "room_num" : rows[0].room_num,
                            "item_num" : rows[0].product_num
                        };
                        callback(null, data);
                    }
                }
            });
        }, function(data, callback){
            // Item을 기존 방에서 다른 방으로 이동시키는 SQL
            var itemUpd = 'update Manage set room_num = ? where room_num = ? and product_num = ?';
            connection.query(itemUpd, [change_room_num, data.room_num , data.item_num], function(err, result){
                if(err){
                    callback(err);
                }else{
                    connection.release();
                    res.json({
                        "success" : 1,
                        "result_msg" : data.item_num+'번 상품이 '+change_room_num+'번 방으로 이동되었습니다.',
                        "result" : null
                    });
                }
            });
        }], function(err){
            if(err){
                connection.release();
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }
        });
    });
}

// 상품에 대한 상세 정보 보기
function detailsItem(req, res){
    var user_num;
    var item_num = req.params.item_num;         // Item 번호

    // 로그인 시
    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    connectionPool.getConnection(function(err, connection){
        if(err){
            callback(err);
        }
        console.log("user_num : ",user_num, "item_num : ",item_num);
        async.waterfall([function specificItem(callback){
                // 상품의 상세정보를 보여주는 SQL
                var itemViewSel = 'select p.product_num, p.category_num, p.product_name, p.brand, p.price, p.size, p.buy_path, p.like_cnt,'
                    +' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike,'
                    +' i.img_path1, i.img_path2, i.img_path3, c.theme_num1, c.theme_num2'
                    +' from Product p join Image i on p.product_num = i.product_num'
                    +' join Classify c on p.product_num = c.product_num'
                    +' where p.product_num = ?';
                connection.query(itemViewSel, [user_num, item_num], function(err, rows, fields){
                    if(err) {                             // Error 발생시, callback을 통해서 Option의 Error로 넘긴다
                        callback(err);
                    }else {
                        if (!rows.length) {
                            callback(new Error("해당 상품이 존재하지 않습니다."));
                        } else {
                            var item = {
                                "item_num": rows[0].product_num,
                                "item_name": rows[0].product_name,
                                "category_num": rows[0].category_num,
                                "brand": rows[0].brand,
                                "price": rows[0].price,
                                "link": rows[0].buy_path,
                                "item_size": rows[0].size,
                                "likeCnt": rows[0].like_cnt,
                                "item_img_url": [rows[0].img_path1, rows[0].img_path2, rows[0].img_path3],
                                "theme_num1": rows[0].theme_num1,
                                "theme_num2": rows[0].theme_num2,
                                "islike": rows[0].islike
                            };
                            callback(null, item);
                        }
                    }

                });
            }, function alikeItems(item, callback){
                var item_list = [];
                // 유사한 상품을 보여주는 SQL
                var selectSql = 'select p.product_num, p.category_num, i.img_path1, i.img_path2, i.img_path3, c.theme_num1, c.theme_num2' +
                    ' from Product p join Image i on p.product_num = i.product_num' +
                    ' join Classify c on p.product_num = c.product_num' +
                    ' where p.category_num = ? and (c.theme_num1 = ? or c.theme_num2 = ?)' +
                    ' order by rand() limit 0 , 9;';
                connection.query(selectSql, [item.category_num, item.theme_num1, item.theme_num2],
                    function(err, rows, fields){
                        if(err) {                        // Error 발생시, callback을 통해서 Option의 Error로 넘긴다.
                            callback(err);
                        }else{
                            if(!rows.length){               // DB에 저장된 값이 없는 경우
                                callback(new Error("유사한 상품들이 존재하지 않습니다."));
                            }else{                           // 성공시
                                var i = 0;
                                async.whilst(
                                    function(){
                                        return i < rows.length;
                                    },
                                    function(cb){
                                        var items = {
                                            "item_num": rows[i].product_num,
                                            "item_img_url":[rows[i].img_path1, rows[i].img_path2, rows[i].img_path3]
                                        };
                                        item_list.push(items);
                                        i++;
                                        cb();
                                    },function(err){
                                        var result = {
                                            "item": item,
                                            "items": item_list
                                        };
                                        callback(null, result);
                                    }
                                );
                            }
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
                    connection.release();
                    res.json({
                        "success" : 1,
                        "result_msg" : null,
                        "result" : result
                    });
                }
            }
        );
    });
}

module.exports = function(app){

    app.post('/user/:user_num/room/:room_num/item/:item_num/new', upload.isLoggedIn, newItem);
    app.post('/user/:user_num/room/:room_num/move', upload.isLoggedIn, moveItem);
    app.get('/item/:item_num/viewDetails', detailsItem);

};
