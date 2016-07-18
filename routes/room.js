var async = require('async'),
    path = require('path'),
    formidable = require('formidable'),
    upload = require('../routes/upload');


function newRoom(req, res) {

    //파일을 안 올리는 경우 (x-www-form-urlencoded)
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {

        console.log("urlencoded");

    } else { // 파일을 올리는 경우 (multipart/form-data)
        console.log("multi-part");

        var form = new formidable.IncomingForm();
        // 파일 저장 경로
        form.uploadDir = path.normalize(__dirname + '/../images/');
        // 확장명까지 보여준다.
        form.keepExtensions = true;
        // key   value(파일)
        form.parse(req, function (err, fields, files) {

            var baseImageDir = __dirname + '/../images/';

            var user_num = req.user.user_num;               // 사용자 번호
            var room_name = fields.room_name;               // 사용자 Room 번호
            var room_color = fields.room_color;             // 사용자 Room Color
            var room_ispublic = fields.room_ispublic;       // 사용자 Room 공개여부
            var ntime = new Date();                         // 사용자 Room 등록 시간
            var room_img = files.room_img_url;              // 사용자 Room Image

            connectionPool.getConnection(function(err, connection){
                if (err){
                    res.json({
                        "success" : 0,
                        "result_msg" : err.message,
                        "result" : null
                    });
                } else {
                    var roomAdd = 'insert into Room(room_name, user_num, room_img, color, open_close, reg_date) value (?, ?, ?, ?, ?, ?)';
                    connection.query(roomAdd, [room_name, user_num, path.basename(room_img.path), room_color, room_ispublic, ntime],
                        function (err, result) {
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
                                    "success" : 1,
                                    "result_msg" : "방을 생성하였습니다.",
                                    "result": null
                                });
                            }
                        });
                }
            });
        });
    }
}


//사용자 방 삭제하기
function delRoom(req, res){
    var user_num = req.user.user_num;        // 사용자 번호
    var room_num = req.params.room_num;      // 사용자 Room 번호

    connectionPool.getConnection(function(err, connection){
        async.series([function (callback){
            // 사용자의 Room 안에 있는 상품들을 삭제하는 SQL
            var itemDel = 'delete from Manage where room_num = ? and user_num = ?';
            connection.query(itemDel, [room_num, user_num], function(err, result){
                if(err){
                    callback(err);
                }else{
                    //connection.release();
                    callback(null);
                }
            });
        }, function(callback){
            // 사용자의 Room을 삭제하는 SQL
            var roomDel = 'delete from Room where user_num = ? and room_num = ?';
            connection.query(roomDel, [user_num, room_num], function(err, result){
                if(err){
                    callback(err);
                }else{
                    //connection.release();
                    callback(null);
                }
            });
        }],function(err,result){          // Error 발생시
            if(err){
                connection.release();
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }else{
                connection.release();     // 성공시
                res.json({
                    "success" : 1,
                    "result_msg" : "방이 삭제되었습니다.",
                    "result" : null
                });
            }
        });
    });
}



//사용자 방안에 존재하는 상품 보기
function listItem(req, res){

    var user_num;
    if(req.user) user_num = req.user.user_num;
    else user_num = 0;

    //var user_num = req.user.user_num;
    var room_num = req.params.room_num;          // 사용자 Room 번호
    connectionPool.getConnection(function(err, connection){
        if(err){
            res.json({
                "success" : 0,
                "result_msg" : err.message,
                "result" : null
            });
        }

        //upload.getImage(req, res, room_num);

        async.series([function(callback){
            var userSel = 'select user_num, room_num, room_name, room_img, open_close, color, reg_date' +
                ' from Room where room_num = ?';
            connection.query(userSel, [room_num], function(err, rows, fields){
                if(err){
                    callback(err);
                }else{
                    if(!rows.length){
                        connection.release();
                        res.json({
                            "success": 0,
                            "result_msg": "해당 사용자가 존재하지 않습니다.",
                            "result": null
                        });
                    }else{
                        var data = {
                            "user":{
                                "user_num": rows[0].user_num,
                                "room_num": rows[0].room_num
                            },
                            "room" : {
                                "room_num":rows[0].room_num,
                                "room_name": rows[0].room_name,
                                "room_img_url": rows[0].room_img,
                                "room_color": rows[0].color,
                                "room_date": rows[0].reg_date,
                                "room_ispublic": rows[0].open_close
                            }
                        };
                        callback(null, data);
                    }
                }
            });
        }, function(callback) {
            var item_list = [];
            var itemSel = 'select p.product_num, p.product_name, p.price, i.img_path1, i.img_path2, i.img_path3, m.reg_date,' +
                ' if(exists(select * from Manage where user_num = ? and product_num = p.product_num), 1, 0) as islike' +
                ' from Room r join Manage m on r.room_num = m.room_num' +
                ' join Product p on m.product_num = p.product_num' +
                ' join Image i on p.product_num = i.product_num where r.room_num = ? order by m.reg_date desc';
            connection.query(itemSel, [user_num, room_num], function (err, rows, fields) {
                if (err) {
                    callback(err);
                }else{
                    async.each(rows, function(row, cb1){
                        var item = {
                            "item_num": row.product_num,
                            "item_img_url": [row.img_path1, row.img_path2, row.img_path3 ],
                            "item_name": row.product_name,
                            "price": row.price,
                            "islike": row.islike
                        };
                        item_list.push(item);
                        cb1();
                    },function(err){
                        callback(null, item_list);
                    });
                }
            });
        }], function(err, results) {
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
                    "result": {
                        user : results[0].user,
                        room : results[0].room,
                        items: results[1]
                    }
                });
            }
        })
    });
}

module.exports = function(app){

    app.post('/user/:user_num/room/new', upload.isLoggedIn, newRoom);
    app.post('/user/:user_num/room/:room_num/del', upload.isLoggedIn, delRoom);
    app.post('/user/:user_num/room/:room_num/modify', upload.isLoggedIn, upload.modifyRoom);
    app.get('/user/:user_num/room/:room_num/item/viewlist', listItem);
    app.get('/images/:imagepath', upload.getImage);
};
