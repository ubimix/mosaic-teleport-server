var _ = require('underscore');
var Mosaic = require('mosaic-commons');
require('mosaic-teleport');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var ServiceStubProvider = require('./ServiceStubProvider');

var defaultPort = 3701;
var defaultPath = '/service';
var workdir = process.cwd();
var serviceOptions = {
    path : defaultPath,
    dir : workdir,
    port : defaultPort
};
_.extend(serviceOptions, ServiceStubProvider.toOptions(process.argv));
var port = (+serviceOptions.port) || defaultPort;

/* ------------------------------------------------------- */
// Creates and initializes an Express application
var app = express();
app.use(bodyParser.urlencoded({
    extended : false
}));
app.use(bodyParser.json());
app.use(cookieParser('optional secret string'));
app.use(express.static(workdir));

/* ------------------------------------------------------- */
var handlerProvider = new ServiceStubProvider(serviceOptions);
handlerProvider.registerInExpressApp(app);

/* ------------------------------------------------------- */
// Start the server
app.listen(port);
console.log('http://localhost' + (port ? ':' + port : '') + '/');
