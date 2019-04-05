var request = require('request');
var dotenv = require('dotenv').config();

var obj = {
    installer: {
        'cacheResourceIds': {
            'nsConnectionId': '',
            'nsExportId': '',
            'nsImportId': '',
            'flowId': ''
        },
        /*
         * options object contains the following properties:
         *     bearerToken - a one-time bearer token which can be used to invoke selected integrator.io API routes.
         *     _integrationId - _id of the integration that is created.
         *     opts - this field contains the connector license related information.
         *     _connectorId - _id of the connector being installed.
         *
         * The function needs to call back with the following arguments:
         *     err - Error object to convey a fatal error has occurred.
         *     response - No response is expected in this case.
         */
        connectorInstaller: function (options, callback) {
            var that = this;
            console.log('options: ' + JSON.stringify(options));
            //during installation just create NetSuite Connection
            var nsConnectionJSON = require('./resourceFiles/nsConnection.json');
            nsConnectionJSON['netsuite']['password'] = process.env.NS_PASSWORD;
            nsConnectionJSON['_connectorId'] = options['_connectorId'];
            nsConnectionJSON['_integrationId'] = options['_integrationId'];

            var createNSConnection = function () {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/connections',
                            'method': 'POST',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': nsConnectionJSON,
                            'json': true
                        },
                        function (errNSCon, resNSCon, bodyNSCon) {
                            //console.log('error ns connection: ' + errNSCon);
                            //console.log('response ns connection: ' + JSON.stringify(resNSCon));
                            //console.log('body ns connection: ' + bodyNSCon);
                            if (errNSCon) {
                                console.log(errNSCon);
                                reject(errNSCon);
                            }
                            console.log('NS connection# ' + bodyNSCon['_id'] + ' created!');
                            that.cacheResourceIds['nsConnectionId'] = bodyNSCon['_id'];
                            resolve(bodyNSCon['_id']);
                        });
                });
            };

            var updateIntegration = function () {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/integrations/' + options['_integrationId'],
                            'method': 'PUT',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': {
                                'name': 'NetSuite Custom Connector',
                                'mode': 'install',
                                'install': [{
                                    'name': 'NetSuite Connection',
                                    'description': 'Configure NetSuite account credentials',
                                    'imageURL': '/images/company-logos/netsuite.png',
                                    'completed': false,
                                    'installerFunction': 'verifyNetSuiteConnection',
                                    '_connectionId': that.cacheResourceIds['nsConnectionId']
                                }, {
                                    "name": "Integrator Bundle",
                                    "description": "Install Integrator Bundle in NetSuite",
                                    "imageURL": "/images/company-logos/netsuite.png",
                                    "installURL": "https://system.na1.netsuite.com/app/bundler/bundledetails.nl?sourcecompanyid=TSTDRV840553&domain=PRODUCTION&config=F&id=20038",
                                    "completed": false,
                                    "installerFunction": "verifyIntegratorBundleInstallation"
                                }]
                            },
                            'json': true
                        },
                        function (errUpdInt, resUpdInt, bodyUpdInt) {
                            //console.log('Integration error(if any): ' + errUpdInt);
                            //console.log('Integration resopnse: ' + JSON.stringify(resUpdInt));
                            //console.log('Integration body: ' + JSON.stringify(bodyUpdInt));
                            if (errUpdInt) {
                                console.log(errUpdInt);
                                reject(errUpdInt);
                            }
                            console.log('Integration# ' + bodyUpdInt['_id'] + ' updated!');
                            resolve(bodyUpdInt['_id']);
                        });
                });
            };

            //update install steps in integration document
            createNSConnection().then(result => {
                //update install property in integration resource
                return updateIntegration();
            }).then(function (result) {
                console.log('NS connection created and integration doc has been updated with install steps!');
                callback(null, null);
            });
        },
        /*
         * options object contains the following properties:
         *     bearerToken - a one-time bearer token which can be used to invoke selected integrator.io API routes.
         *     _integrationId - _id of the integration that is created.
         *     opts - this field contains the connector license related information.
         *
         * The function needs to call back with the following arguments:
         *     err - Error object to convey a fatal error has occurred.
         *     response - an object in the below format:
         *         {success: boolean, stepsToUpdate: [<array of install steps present in integration document which need to be updated.>]}
         */
        verifyNetSuiteConnection: function (options, callback) {
            var that = this;
            var testNSConnection = function () {
                return new Promise(function (resolve, reject) {
                    request({
                        'url': 'https://api.staging.integrator.io/v1/connections/' + that.cacheResourceIds['nsConnectionId'] + '/ping',
                        'method': 'GET',
                        'headers': {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + options['bearerToken']
                        },
                        'json': true
                    }, function (error, response, body) {
                        if (error)
                            reject(error);
                        console.log(body);
                        resolve(body);
                    });
                });
            };
            var createNSExport = function () {
                var exportJSON = require('./resourceFiles/nsExport.json');
                exportJSON['_connectionId'] = that.cacheResourceIds['nsConnectionId'];
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/exports',
                            'method': 'POST',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': exportJSON,
                            'json': true
                        },
                        function (errNSExp, resNSExp, bodyNSExp) {
                            if (errNSExp) {
                                console.log(errNSExp);
                                reject(errNSExp);
                            }
                            console.log('NS Export# ' + bodyNSExp['_id'] + ' created!');
                            that.cacheResourceIds['nsExportId'] = bodyNSExp['_id'];
                            resolve(bodyNSExp['_id']);
                        });
                });
            };
            var createNSImport = function () {
                var importJSON = require('./resourceFiles/nsImport.json');
                importJSON['_connectionId'] = that.cacheResourceIds['nsConnectionId'];
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/imports',
                            'method': 'POST',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': importJSON,
                            'json': true
                        },
                        function (errNSImp, resNSImp, bodyNSImp) {
                            if (errNSImp) {
                                console.log(errNSImp);
                                reject(errNSImp);
                            }
                            console.log('NS Import# ' + bodyNSImp['_id'] + ' created!');
                            that.cacheResourceIds['nsImportId'] = bodyNSImp['_id'];
                            resolve(bodyNSImp['_id']);
                        });
                });
            };
            var createFlow = function () {
                var flowJSON = require('./resourceFiles/flow.json');
                flowJSON['_exportId'] = that.cacheResourceIds['nsExportId'];
                flowJSON['_importId'] = that.cacheResourceIds['nsImportId'];
                flowJSON['_integrationId'] = options['_integrationId'];
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/flows',
                            'method': 'POST',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': flowJSON,
                            'json': true
                        },
                        function (errFlow, resFlow, bodyFlow) {
                            if (errFlow) {
                                console.log(errFlow);
                                reject(errFlow);
                            }
                            console.log('Flow# ' + bodyFlow['_id'] + ' created!');
                            that.cacheResourceIds['flowId'] = bodyFlow['_id'];
                            resolve(bodyFlow['_id']);
                        });
                });
            };

            testNSConnection().then(function (resultData) {
                return createNSExport();
            }).then(function (resultData) {
                return createNSImport();
            }).then(function (resultData) {
                return createFlow();
            }).then(function (resultData) {
                var installSteps = [{
                    'name': 'NetSuite Connection',
                    'description': 'Configure NetSuite account credentials',
                    'imageURL': '/images/company-logos/netsuite.png',
                    'completed': true,
                    'installerFunction': 'verifyNetSuiteConnection',
                    '_connectionId': that.cacheResourceIds['nsConnectionId']
                }];
                var response = {
                    'success': true,
                    'stepsToUpdate': installSteps
                };
                callback(null, response);
            }).catch(function (error) {
                //for failure scenario
                callback(error, {
                    'success': false,
                    'stepsToUpdate': [{
                        'name': 'NetSuite Connection',
                        'description': 'Configure NetSuite account credentials',
                        'imageURL': '/images/company-logos/netsuite.png',
                        'completed': false,
                        'installerFunction': 'verifyNetSuiteConnection',
                        '_connectionId': that.cacheResourceIds['nsConnectionId']
                    }]
                });
            });
        },
        /*
         * options object contains the following properties:
         *     bearerToken - a one-time bearer token which can be used to invoke selected integrator.io API routes.
         *     _integrationId - _id of the integration that is created.
         *     opts - this field contains the connector license related information.
         *
         * The function needs to call back with the following arguments:
         *     err - Error object to convey a fatal error has occurred.
         *     response - an object in the below format:
         *         {success: boolean, stepsToUpdate: [<array of install steps present in integration document which need to be updated.>]}
         */
        verifyIntegratorBundleInstallation: function (options, callback) {
            var that = this;
            var changeMode = function () {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/integrations/' + options['_integrationId'],
                            'method': 'PUT',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': {
                                'mode': 'settings',
                                'name': 'NetSuite Custom Connector',
                                'install': [{
                                    'name': 'NetSuite Connection',
                                    'description': 'Configure NetSuite account credentials',
                                    'imageURL': '/images/company-logos/netsuite.png',
                                    'completed': true,
                                    'installerFunction': 'verifyNetSuiteConnection',
                                    '_connectionId': that.cacheResourceIds['nsConnectionId']
                                }, {
                                    "name": "Integrator Bundle",
                                    "description": "Install Integrator Bundle in NetSuite",
                                    "imageURL": "/images/company-logos/netsuite.png",
                                    "installURL": "https://system.na1.netsuite.com/app/bundler/bundledetails.nl?sourcecompanyid=TSTDRV840553&domain=PRODUCTION&config=F&id=20038",
                                    "completed": true,
                                    "installerFunction": "verifyIntegratorBundleInstallation"
                                }],
                                'settings': {
                                    'sections': [{
                                        "fields": [
                                            {
                                                "tooltip": "By default all customer will be exported, to override this functionality set this checkbox and sync customers created/updated since last time the flow ran.",
                                                "name": "exports_delta_or_all__" + that.cacheResourceIds['nsExportId'],
                                                "type": "checkbox",
                                                "value": false,
                                                "label": "Export Delta Customer"
                                            },
                                            {
                                                "options": [
                                                    []
                                                ],
                                                "supportsRefresh": true,
                                                "name": "imports_add_name_prefix__" + that.cacheResourceIds['nsImportId'],
                                                "type": "select",
                                                "value": "",
                                                "required": false,
                                                "label": "Prefix for Customer Name",
                                                "tooltip": "Select the prefix that you want use in customer name. For example: Mr. John Shaw"
                                            }
                                        ],
                                        "flows": [
                                            {
                                                "showSchedule": true,
                                                "showMapping": true,
                                                "_id": that.cacheResourceIds['flowId']
                                            }
                                        ],
                                        "columns": 1,
                                        "title": "Order"
                                    }
                                    ]
                                }

                            },
                            'json': true
                        },
                        function (errUpdInt, resUpdInt, bodyUpdInt) {
                            if (errUpdInt) {
                                console.log(errUpdInt);
                                reject(errUpdInt);
                            }
                            console.log('Integration# ' + bodyUpdInt['_id'] + ' updated!');
                            resolve(bodyUpdInt['_id']);
                        });
                });
            };
            changeMode().then(function (result) {
                //when NS connection was tested the script had one of the bundles library included so return true now
                callback(null, {
                    'success': true,
                    'stepsToUpdate': [{
                        "name": "Integrator Bundle",
                        "description": "Install Integrator Bundle in NetSuite",
                        "imageURL": "/images/company-logos/netsuite.png",
                        "installURL": "https://system.na1.netsuite.com/app/bundler/bundledetails.nl?sourcecompanyid=TSTDRV840553&domain=PRODUCTION&config=F&id=20038",
                        "completed": true,
                        "installerFunction": "verifyIntegratorBundleInstallation"
                    }]
                });
            }).catch(function (error) {
                callback(error, {
                    'success': false,
                    'stepsToUpdate': [{
                        "name": "Integrator Bundle",
                        "description": "Install Integrator Bundle in NetSuite",
                        "imageURL": "/images/company-logos/netsuite.png",
                        "installURL": "https://system.na1.netsuite.com/app/bundler/bundledetails.nl?sourcecompanyid=TSTDRV840553&domain=PRODUCTION&config=F&id=20038",
                        "completed": false,
                        "installerFunction": "verifyIntegratorBundleInstallation"
                    }]
                });
            });
        }
    },
    settings: {
        /*
         * options object contains the following properties:
         *     bearerToken - a one-time bearer token which can be used to invoke selected integrator.io API routes.
         *     _integrationId - _id of the integration being installed.
         *     opts - this field contains the connector license related information.
         *     pending - a json object containing key value pairs of different fields involved in a setting that is being updated.
         *
         * The function needs to call back with the following arguments:
         *     err - Error object to convey a fatal error has occurred.
         *     response - {success: boolean, pending: {<updated key value pairs of different fields involved in a setting>}}
         */
        persistSettings: function (options, callback) {
            console.log(JSON.stringify(options));
            var exportId, importId;
            var keys = Object.keys(options['pending']);
            for (var j = 0; j < keys.length; j++) {
                if (keys[j].lastIndexOf('imports') > -1) {
                    importId = keys[j].split('__')[1];
                } else {
                    exportId = keys[j].split('__')[1];
                }
            }
            var prefix = options['pending']['imports_add_name_prefix__5ca629e2490fcb030b73a711'];
            var exportDelta = options['pending']['exports_delta_or_all__5ca629e1ec5c172792287e37']
            var fetchImport = function () {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/imports/' + importId,
                            'method': 'GET',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'json': true
                        },
                        function (errImp, resImp, bodyImp) {
                            if (errImp) {
                                console.log(errImp);
                                reject(errImp);
                            }
                            resolve(bodyImp);
                        });
                });
            };
            var updateImport = function (jsonData) {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/imports/' + importId,
                            'method': 'PUT',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': jsonData,
                            'json': true
                        },
                        function (errImp, resImp, bodyImp) {
                            if (errImp) {
                                console.log(errImp);
                                reject(errImp);
                            }
                            console.log('Import# ' + bodyImp['_id'] + ' updated!');
                            resolve(bodyImp['_id']);
                        });
                });
            };

            var fetchExport = function () {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/exports/' + exportId,
                            'method': 'GET',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'json': true
                        },
                        function (errExp, resExp, bodyExp) {
                            if (errExp) {
                                console.log(errExp);
                                reject(errExp);
                            }
                            resolve(bodyExp);
                        });
                });
            };
            var updateExport = function (jsonData) {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/exports/' + exportId,
                            'method': 'PUT',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': jsonData,
                            'json': true
                        },
                        function (errExp, resExp, bodyExp) {
                            if (errExp) {
                                console.log(errExp);
                                reject(errExp);
                            }
                            console.log('Export# ' + bodyExp['_id'] + ' updated!');
                            resolve(bodyExp['_id']);
                        });
                });
            };

            var updateSectionFields = function () {
                return new Promise(function (resolve, reject) {
                    request({
                            'url': 'https://api.staging.integrator.io/v1/integrations/' + options['_integrationId'],
                            'method': 'PUT',
                            'headers': {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + options['bearerToken']
                            },
                            'body': {
                                'mode': 'settings',
                                'name': 'NetSuite Custom Connector',
                                'settings': {
                                    'sections': [{
                                        "fields": [
                                            {
                                                "tooltip": "By default all customer will be exported, to override this functionality set this checkbox and sync customers created/updated since last time the flow ran.",
                                                "name": "exports_delta_or_all__5ca629e1ec5c172792287e37",
                                                "type": "checkbox",
                                                "value": exportDelta,
                                                "label": "Export Delta Customer"
                                            },
                                            {
                                                "options": [
                                                    [
                                                        "Mr. ",
                                                        "Mr. "
                                                    ], [
                                                        "Ms. ",
                                                        "Ms. "
                                                    ], [
                                                        "Mrs. ",
                                                        "Mrs. "
                                                    ]
                                                ],
                                                "supportsRefresh": true,
                                                "name": "imports_add_name_prefix__5ca629e2490fcb030b73a711",
                                                "type": "select",
                                                "value": prefix,
                                                "required": false,
                                                "label": "Prefix for Customer Name",
                                                "tooltip": "Select the prefix that you want use in customer name. For example: Mr. John Shaw"
                                            }
                                        ]
                                    }
                                    ]
                                }

                            },
                            'json': true
                        },
                        function (errUpdInt, resUpdInt, bodyUpdInt) {
                            if (errUpdInt) {
                                console.log(errUpdInt);
                                reject(errUpdInt);
                            }
                            console.log('Integration# ' + bodyUpdInt['_id'] + ' updated!');
                            resolve(bodyUpdInt['_id']);
                        });
                });
            };

            fetchExport().then(function (exportData) {
                if (exportDelta) {
                    exportData['type'] = 'delta';
                    exportData['delta'] = {};
                    exportData['delta']['dateField'] = 'lastmodifieddate';
                } else {
                    delete exportData['type'];
                    exportData['delta'];
                }
                console.log(JSON.stringify(exportData));
                return updateExport(exportData);
            }).then(function (result) {
                return fetchImport();
            }).then(function (importData) {
                //look for field 'custrecord219'
                var fields = importData['netsuite_da']['mapping']['fields'] || [];
                for (var i = 0; i < fields.length; i++) {
                    var field = fields[i];
                    if (field['extract'].toLowerCase().lastIndexOf('name') > -1) {
                        field['extract'] = '{{join "" "' + prefix + '" Name}}';
                    }
                }
                return updateImport(importData);
            }).then(function (result) {
                return updateSectionFields();
            }).then(function (result) {
                callback(null, {'success': true, 'pending': options['pending']});
            }).catch(function (err) {
                callback(err, {'success': false, 'pending': options['pending']})
            });
        },

        /*
         * options object contains the following properties:
         *     bearerToken - a one-time bearer token which can be used to invoke selected integrator.io API routes.
         *     _integrationId - _id of the integration being installed.
         *     opts - this field contains the connector license related information. It also contains all the information related to the field whose metadata is being refreshed and new metadata.
         *
         * The function needs to call back with the following arguments:
         *     err - Error object to convey a fatal error has occurred.
         *     response - json object containing the information related to the field which also contains any changes done to new metadata.
         */
        refreshMetadata: function (options, callback) {
            callback(null, {
                "options": [
                    [
                        "Mr. ",
                        "Mr. "
                    ], [
                        "Ms. ",
                        "Ms. "
                    ], [
                        "Mrs. ",
                        "Mrs. "
                    ]
                ],
                "supportsRefresh": true,
                "name": "imports_add_name_prefix__5ca629e2490fcb030b73a711",
                "type": "select",
                "value": "",
                "required": false,
                "label": "Prefix for Customer Name",
                "tooltip": "Select the prefix that you want use in customer name. For example: Mr. John Shaw"
            });
        }
    }
};

module.exports = obj;