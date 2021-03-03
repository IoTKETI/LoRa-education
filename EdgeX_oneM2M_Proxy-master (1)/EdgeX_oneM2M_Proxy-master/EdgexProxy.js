var mqtt = require('mqtt');
var CORS = require('cors')();
var async = require('async');
var express = require('express');
var bodyParser = require('body-parser');
var requestToServer = require('request');
var bodyGenerator = require('./domain/BodyGenerator');
var edgexProxy = express();

edgexProxy.use(CORS);
edgexProxy.use(bodyParser.json());
edgexProxy.use(bodyParser.urlencoded({extended: false}));

var mqtt_client = mqtt.connect('mqtt://203.253.128.161:1883');
var ae_Name = "disposable_iot";

var registerDevice = function (device_id, callBackResponse) {

    var bodyObject = bodyGenerator.ContainerBodyGenerator(device_id);

    var targetURL = "http://203.253.128.161:7579/Mobius/" + ae_Name;

    requestToServer({
        url: targetURL,
        method: 'POST',
        json: true,
        headers: { // Basic AE resource structure for registration
            'Accept': 'application/json',
            'X-M2M-RI': '12345',
            'X-M2M-Origin': 'Origin',
            'Content-type': 'application/json; ty=3'
        },
        body: bodyObject
    }, function (error, oneM2MResponse, body) {
        if(typeof(oneM2MResponse) !== 'undefined') {
            callBackResponse(oneM2MResponse.statusCode);
        }
    });
};

var registerSensoredValueFromEdgeX = function (concat_device_id, sensored_value, callBackResponse) {

    var targetURL = "http://203.253.128.161:7579/Mobius/" + ae_Name + "/" + concat_device_id;

    console.log(targetURL);

    var bodyObject = bodyGenerator.contentInstanceBodyGenerator(sensored_value);

    requestToServer({
        url: targetURL,
        method: 'POST',
        json: true,
        headers: { // Basic AE resource structure for registration
            'Accept': 'application/json',
            'X-M2M-RI': '12345',
            'X-M2M-Origin': 'Origin',
            'Content-type': 'application/json; ty=4'
        },
        body: bodyObject
    }, function (error, oneM2MResponse, body) {
        if(typeof(oneM2MResponse) !== 'undefined') {
            // if (oneM2MResponse.statusCode == 201) {
            //     console.log("Updated")
            // } else if (oneM2MResponse.statusCode == 404) {
            //     console.log("Error")
            // }
            callBackResponse(oneM2MResponse.statusCode);
        }
    });
};

mqtt_client.on('message', function (topic, message) {

    var iterationCount = 0;

    var rcvMessage = message.toString();
    var rcvMessage = JSON.parse(rcvMessage);

    var device_id = rcvMessage['device'];
    var readings = rcvMessage['readings'];

    async.whilst(
        function() {
            return iterationCount < readings.length
        },

        function (async_for_loop_callback) {

            var reading = readings[iterationCount];
            var sensored_value_type = reading ['name'];
            var sensored_value = reading ['value'];

            async.waterfall([
                function(callbackForDevice) {
                    var concat_device_id = device_id + ":" + sensored_value_type;

                    // Device registration
                    registerDevice(concat_device_id, function (statusCode) {
                        if(statusCode == 201) {
                            console.log("201, Container resource has been created");
                            callbackForDevice(null, concat_device_id);
                        } else if (statusCode == 409) {
                            console.log("409, Container resource has been already created");
                            callbackForDevice(null, concat_device_id);
                        } else {
                            console.log("This condition is going to be covered later");
                            callbackForDevice(null);
                        }
                    });
                },

                function(concat_device_id, callbackForValue) {
                    registerSensoredValueFromEdgeX(concat_device_id, sensored_value, function (statusCode) {
                        if(statusCode == 201) {
                            console.log("201, Data has been updated\n");
                            callbackForValue(null, statusCode)
                        } else if (statusCode == 404) {
                            console.log("404, Not found error has occurred\n");
                            callbackForValue(null, statusCode)
                        } else {
                            console.log("This condition is going to be covered later\n");
                        }
                    });
                }
            ], function (statusCode, result) {
                if(statusCode) {
                    if(statusCode == 201 || statusCode == 409) {
                        iterationCount++;  async_for_loop_callback (null, iterationCount);
                    } else {
                        iterationCount++;  async_for_loop_callback (null, iterationCount);
                    }
                } else { // Container → contentInstance → Subscription (success)
                    console.log("This condition is going to be covered later\n");
                }
            });
        }
    );
});

mqtt_client.on('connect', function () {
    mqtt_client.subscribe('edgex', function (err) {
        if (!err) {
            console.log("EdgeX Proxy is subscribing the EdgeX\n")
        }
    })
});

edgexProxy.listen(62577, function () {
    console.log('Server running at http://localhost:62577');
});