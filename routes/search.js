var async = require('async');

function searchCategory(req, res){

    var user_num;
    var category_num = req.params.category_num;
    var theme_num = req.params.theme_num;
    var option = req.query.option;

    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    connectionPool.getConnection(function(err, connection){
        if(err){
            connection.release();
            res.json({
                "success": 0,
                "result_msg": err.message,
                "result": null
            });
        }
        var item_list = [];
        var order = null;

        var themeSel ='select p.product_num, p.product_name, p.price, p.like_cnt,' +
            ' i.img_path1, i.img_path2, i.img_path3, c.category_num, y.theme_num1, y.theme_num2,' +
            ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike' +
            ' from Classify y join Product p on y.product_num = p.product_num' +
            ' join Category c on p.category_num = c.category_num' +
            ' join Image i on p.product_num = i.product_num' +
            ' where c.category_num = ? and (y.theme_num1 = ? or theme_num2 = ?) order by ';

        if(option == 'popularity'){
            order = 'p.like_cnt desc';
        }else if(option == 'lowprice'){
            order = 'p.price asc';
        }else if(option == 'highprice'){
            order = 'p.price desc';
        }else{
            order = 'p.reg_date desc';
        }

        // 상품들을 최신순, 인기순, 낮은가격순, 높은 가격순으로 정렬해준다.
        themeSel+=order;

        connection.query(themeSel, [user_num, category_num, theme_num, theme_num ], function(err, rows, fields){
            if(err){
                connection.release();
                res.json({
                    "success": 0,
                    "result_msg": err.message,
                    "result": null
                });
            }else{
                if(!rows.length){
                    connection.release();
                    res.json({
                        "success": 0,
                        "result_msg": "해당 상품이 존재하지 않습니다.",
                        "result": null
                    });
                }else{
                    var i = 0;
                    async.whilst(
                        function(){
                            return i<rows.length;
                        }, function(callback){
                            var item = {
                                "item_num": rows[i].product_num,
                                "item_img_url": [rows[i].img_path1, rows[i].img_path2, rows[i].img_path3],
                                "item_name": rows[i].product_name,
                                "price": rows[i].price,
                                "islike": rows[i].islike
                            };
                            item_list.push(item);
                            i++;
                            callback();
                        }, function(err){
                            connection.release();
                            res.json({
                                "success" : 1,
                                "result_msg" : null,
                                "result": {
                                    "items":item_list
                                }
                            });
                        }

                    );
                }
            }
        });
    });
}

function searchText(req, res){

    var user_num;
    var text_name = req.params.text_name;
    var theme_num = req.params.theme_num;
    var option = req.query.option;

    if(req.user) user_num = req.user.user_num;
    // 로그인 되어있지 않을 시에
    else user_num = 0;

    console.log(">>>", text_name);

    connectionPool.getConnection(function(err, connection){
        if(err){
            connection.release();
            res.json({
                "success": 0,
                "result_msg": err.message,
                "result": null
            });
        }
        var item_list = [];
        var order = null;

        var textSel = 'select p.product_num, c.category_name, p.brand, p.product_name, p.price, p.like_cnt, i.img_path1, i.img_path2, i.img_path3,' +
            ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0 ) islike' +
            ' from Category c join Product p on c.category_num = p.category_num' +
            ' join Classify y on p.product_num = y.product_num' +
            ' join Image i on i.product_num = p.product_num' +
            ' where concat(c.category_name,"/",p.product_name,"/",p.brand) like ' + '"%' +text_name+'%"' +
            ' and (y.theme_num1 = ? or theme_num2 = ?) order by ';

        if(option == 'popularity'){
            order = 'p.like_cnt desc';
        }else if(option == 'lowprice'){
            order = 'p.price asc';
        }else if(option == 'highprice'){
            order = 'p.price desc';
        }else{
            order = 'p.reg_date desc';
        }
        // 상품들을 최신순, 인기순, 낮은가격순, 높은 가격순으로 정렬해준다.
        textSel+=order;
        connection.query(textSel , [user_num, theme_num, theme_num], function(err, rows, fields){
            if(err){
                connection.release();
                res.json({
                    "success": 0,
                    "result_msg": err.message,
                    "result": null
                });
            }else{
                if(!rows.length){
                    connection.release();
                    res.json({
                        "success": 0,
                        "result_msg": "해당 상품이 존재하지 않습니다.",
                        "result": null
                    });
                }else{
                    async.each(rows, function(row, callback){
                        var item = {
                            "item_num": row.product_num,
                            "item_img_url": [row.img_path1, row.img_path2, row.img_path3],
                            "item_name": row.product_name,
                            "price": row.price,
                            "islike": row.islike
                        };
                        item_list.push(item);
                        callback();
                    }, function(err){
                        connection.release();
                        res.json({
                            "success" : 1,
                            "result_msg" : null,
                            "result": {
                                "items":item_list
                            }
                        });
                    });
                }
            }
        });
    });
}

module.exports = function(app){
    app.get('/item/category/:category_num/theme/:theme_num/search', searchCategory);
    app.get('/item/text/:text_name/theme/:theme_num/search', searchText);
};
