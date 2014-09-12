var port = 3701;

var _ = require('underscore');
var Mosaic = require('mosaic-commons');
require('mosaic-teleport');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var ServiceStubProvider = require('./ServiceStubProvider');

/* ------------------------------------------------------- */
// Creates and initializes an Express application
var workdir = process.cwd();
var app = express();
app.use(bodyParser.urlencoded({
    extended : false
}));
app.use(bodyParser.json());
app.use(cookieParser('optional secret string'));
app.use(express.static(workdir));

/* ------------------------------------------------------- */

var prefix = '/service';
var serviceOptions = {
    path : prefix,
    dir : workdir
};
var handlerProvider = new ServiceStubProvider(serviceOptions);

var mask = prefix + '/:service([^]*)';
app.get(mask + '.invalidate', ServiceStubProvider.handleRequest(function(req,
    res) {
    var path = ServiceStubProvider.getPath(req);
    return handlerProvider.removeEndpoint(path).then(function() {
        return 'OK';
    });
}));
app.all(mask, ServiceStubProvider.handleRequest(function(req, res) {
    var path = ServiceStubProvider.getPath(req);
    return handlerProvider.loadEndpoint(path).then(function(handler) {
        if (!handler) {
            throw new Error("Service handler is not defined." + //
            "Path: \'" + path + ".");
        }
        return handler.handle(req, res);
    });
}));

/* ------------------------------------------------------- */
// Start the server
app.listen(port);
console.log('http://localhost' + (port ? ':' + port : '') + '/');
