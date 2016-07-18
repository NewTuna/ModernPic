var gcm = require('node-gcm');
var gcmConfig = require('../config/gcm');


exports.sendMessage = function (req, res, from_user, to_user) {

    var user_num = from_user;
    var to_user_num = to_user;
    // var to_user_num = req.params.to_user;

    connectionPool.getConnection(function(err, connection){
        if(err){
            res.json({
                "success" : 0,
                "result_msg" : err.message,
                "result" : null
            });
        }
        var followSel = 'select f.to_user_num, f.from_user_num, u.gcm_registration_id' +
            ' from Follow f join User u on f.to_user_num = u.user_num' +
            ' where f.to_user_num = ? and f.from_user_num = ?';
        connection.query(followSel, [to_user_num, user_num], function(err, rows, fields){
            if(err){
                res.json({
                    "success" : 0,
                    "result_msg" : err.message,
                    "result" : null
                });
            }else{
                var follow = {
                    "to_user": rows[0].to_user_num,
                    "from_user": rows[0].from_user_num,
                    "gcm_registration_id": rows[0].gcm_registration_id
                };
                var message = new gcm.Message();


                message.addDataWithKeyValue('from_user', follow.from_user);
                message.addDataWithKeyValue('to_user', follow.to_user);

                message.collapseKey = 'demo';      // 여러개를 받으면 최신것만 보이기
                message.delayWhileIdle = true;     // 화면 꺼져있을때
                message.timeToLive = 3;            //
                message.dryRun = false;            // 개발자용 ping보내는거

                var sender = new gcm.Sender(gcmConfig.apikey);

                var registrationIds = [];
                registrationIds.push(follow.gcm_registration_id);

                sender.send(message, registrationIds, 4, function(err, result){
                    if(err){
                        res.json({
                            "success" : 0,
                            "result_msg" : err.message,
                            "result" : null
                        });
                    }
                    console.log("마지막 입니다. ", message);
                    console.log("registrationIds :", registrationIds);
                    console.log("result : ", result);
                    connection.release();
                    res.json({
                        "success" : 1,
                        "result_msg" : "follow가 성립되었습니다.",
                        "result" : null
                    });

                });
            }
        });
    });
};
