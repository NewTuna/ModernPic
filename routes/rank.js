var async = require('async');

// Item에 대한 Ranking
function rankItem(req, res){
    var user_num;
    // 로그인 시
    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    connectionPool.getConnection(function(err, connection){
        var item_list = [];
        // Item의 likeCnt를 이용해서 순위를 정하는 SQL
        var rankItemSql= 'select p.product_num, p.price, p.product_name, p.like_cnt, i.img_path1, i.img_path2, i.img_path3,' +
            ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0) as islike' +
            ' from Product p join Image i on p.product_num = i.product_num where like_cnt <> 0' +
            ' order by like_cnt desc limit 100';
        connection.query(rankItemSql, [user_num], function(err, rows, fields){
            if(err){                              // Error 발생시
                connection.release();
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }else{
                if(!rows.length){                    // DB에 저장된 값이 없는 경우
                    connection.release();
                    res.json({
                        "success" : 1,
                        "result_msg" : "존재하는 상품이 없습니다.",
                        "result" : null
                    });
                }else{                                // 성공시
                    var i = 0;
                    async.whilst(
                        function(){
                          return i < rows.length;
                        },
                        function(callback){
                            var data = {
                                "item_num": rows[i].product_num,
                                "item_name": rows[i].product_name,
                                "price": rows[i].price,
                                "likeCnt": rows[i].like_cnt,
                                "item_img_url": [rows[i].img_path1, rows[i].img_path2, rows[i].img_path3],
                                "islike" : rows[i].islike
                            };
                            item_list.push(data);
                            i++;
                            callback();
                        },function(err){
                            var result = {
                                "items": item_list
                            };
                            connection.release();
                            res.json({
                                "success" : 1,
                                "result_msg" : null,
                                "result" : result
                            });
                        }
                    );
                }
            }
        });
    });
}


// 사용자에 대한 Ranking
function rankUser(req, res){
    connectionPool.getConnection(function(err, connection){
        var user_list = [];
        // 사용자의 follower_Cnt를 이용해서 순위를 정하는 SQL
        var rankUserSql = 'select user_num, user_img, nickname, house_name, follower_cnt' +
            ' from User where user_num not between 1 and 10 and follower_cnt <> 0 order by follower_cnt desc limit 100';
        connection.query(rankUserSql, function(err, rows, fields){
            if(err){                               // Error 발생시
                connection.release();
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }else{
                if(!rows.length){                     // DB에 저장된 값이 없는 경우
                    connection.release();
                    res.json({
                        "success" : 0,
                        "result_msg" : "유저가 존재하지 않습니다.",
                        "result" : null
                    });
                }else{                                 // 성공시
                    async.each(rows, function(row, callback){
                        var data = {
                            "user_num": row.user_num,
                            "user_img_url": row.user_img,
                            "user_nickname": row.nickname,
                            "house_name" : row.house_name,
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

    app.get('/item/rank', rankItem);
    app.get('/user/rank', rankUser);
};

