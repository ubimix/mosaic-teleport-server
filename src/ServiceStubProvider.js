var Mosaic = require('mosaic-commons');
require('mosaic-teleport');
var Reloader = require('./Reloader');

var _ = require('underscore');
var FS = require('fs');
var Path = require('path');

var ApiDispatcher = Mosaic.Teleport.ApiDispatcher;

/**
 * This class is used to load and manage server-side server stubs automatically
 * handling requests and delegating them to local service scripts.
 */
var ServiceStubProvider = ApiDispatcher.extend({

    /** Initializes this instance. */
    initialize : function(options) {
        var that = this;
        var init = ApiDispatcher.prototype.initialize;
        init.apply(that, arguments);
        if (!that.options.dir) {
            throw Mosaic.Errors.newError('Root folder is not defined.').code(
                    404);
        }
        that._serviceLoader = new Reloader(require);
    },

    /**
     * Cleans up the server stub corresponding to the specified source key
     */
    removeEndpoint : function(path) {
        var that = this;
        return Mosaic.P.then(function() {
            var info = that._getServiceFileInfo(path);
            if (info) {
                that._serviceLoader.uncache(info.file);
            }
            return ApiDispatcher.prototype.removeEndpoint.call(that, path);
        });
    },

    /** Registers this stub in an Express application */
    registerInExpressApp : function(app) {
        var that = this;
        var servicePrefix = this.options.path || '';
        var mask = servicePrefix + '/:service([^]*)';
        var invalidateMask = mask + '.invalidate';
        app.get(invalidateMask, ServiceStubProvider.handleRequest(function(req,
                res) {
            var path = ServiceStubProvider.getPath(req);
            return that.removeEndpoint(path).then(function() {
                return 'OK';
            });
        }));
        app.all(mask, ServiceStubProvider.handleRequest(function(req, res) {
            var path = ServiceStubProvider.getPath(req);
            return that.loadEndpoint(path).then(function(handler) {
                if (!handler) {
                    throw new Error("Service handler is not defined." + //
                    "Path: \'" + path + ".");
                }
                return handler.handle(req, res);
            });
        }));
    },

    /** Loads a server-side endpoint used to handle requests */
    _loadEndpoint : function(path) {
        var that = this;
        return Mosaic.P.then(function() {
            var info = that._getServiceFileInfo(path);
            if (!info)
                return;
            return Mosaic.P.then(function() {
                var service = that._serviceLoader.load(info.file);
                if (_.isFunction(service)) {
                    return service(that.options);
                } else {
                    return service;
                }
            }).then(function(service) {
                if (!service)
                    return;
                return {
                    path : info.path,
                    instance : service
                };
            });
        });
    },

    /** Returns the name of a service file */
    _getServiceFileName : function() {
        return this.options.serviceFile || 'service.js';
    },

    /**
     * Returns a full file path to the service script corresponding to the given
     * source key.
     */
    _getServiceFileInfo : function(path) {
        var result;
        var that = this;
        var pathPrefix = that.options.path || '';
        if (pathPrefix) {
            path = path.substring(pathPrefix.length);
        }
        var array = path.split('\/');
        while (!result && array.length) {
            var p = array.join('/');
            var file = Path.join(that.options.dir, p);
            var serviceFile = this._getServiceFileName();
            file = Path.join(file, serviceFile);
            if (FS.existsSync(file)) {
                result = {
                    file : file,
                    path : pathPrefix + p
                };
                break;
            }
            array.pop();
        }
        return result;
    },

    /**
     * Creates and returns a new server stub providing remote access to the
     * given service instance.
     */
    _newServerStub : function(options) {
        var that = this;
        var serverOptions = _.extend({}, that.options, options, {
            beginHttpCall : function(params) {
                // Get the session ID from the request header
                var sessionId = params.req.get('x-session-id');
                if (sessionId) {
                    // Put the content of the session ID in the query;
                    // So this value became available to API instance
                    // methods.
                    params.req.query.sessionId = sessionId;
                }
            },
            endHttpCall : function(params) {
                var sessionId = params.result ? params.result.sessionId : null;
                if (sessionId) {
                    // Set a sessionId header
                    params.res.set('x-session-id', sessionId);
                    // params.res.cookie(''x-session-id', sessionId);
                }
            },
        });
        var parent = ApiDispatcher.prototype;
        var handler = parent._newServerStub.call(that, serverOptions);
        return handler;
    }
});

ServiceStubProvider.getPath = Mosaic.Teleport.ApiDescriptor.HttpServerStub.getPath;

ServiceStubProvider.handleRequest = function(action) {
    return function(req, res) {
        return Mosaic.P().then(function() {
            return action(req, res);
        }).then(null, function(err) {
            var statusCode = 400;
            var errMsg = err.message ? ('' + err.message) : ('' + err);
            if (-1 != errMsg.indexOf('permission denied')) {
                statusCode = 401;
            } else if (-1 != errMsg.indexOf('does not exist')) {
                statusCode = 404;
            }
            res.status(statusCode);
            res.send({
                msg : errMsg,
                stack : err.stack
            });
        }).done();
    };
};

ServiceStubProvider.toOptions = function(array) {
    var result = {};
    var key;
    for (var i = 0; i < array.length; i++) {
        var val = array[i] + '';
        if (val[0] == '-') {
            key = val.substring(1);
        } else {
            if (key) {
                result[key] = val;
            }
            key = undefined;
        }
    }
    return result;
};

module.exports = ServiceStubProvider;
