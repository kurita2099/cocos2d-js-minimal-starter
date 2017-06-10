var cc = cc || {};
cc._tmp = cc._tmp || {};
cc._LogInfos = {};
var _p = window;
_p.gl;
_p.WebGLRenderingContext;
_p.DeviceOrientationEvent;
_p.DeviceMotionEvent;
_p.AudioContext;
if (!_p.AudioContext) {
    _p.webkitAudioContext;
}
_p.mozAudioContext;
_p = Object.prototype;
_p._super;
_p.ctor;
_p = null;
cc.ORIENTATION_PORTRAIT = 0;
cc.ORIENTATION_PORTRAIT_UPSIDE_DOWN = 1;
cc.ORIENTATION_LANDSCAPE_LEFT = 2;
cc.ORIENTATION_LANDSCAPE_RIGHT = 3;
cc._drawingUtil = null;
cc._renderContext = null;
cc._supportRender = false;
cc._canvas = null;
cc.container = null;
cc._gameDiv = null;
cc.newElement = function (x) {
    return document.createElement(x);
};
cc.each = function (obj, iterator, context) {
    if (!obj)
        return;
    if (obj instanceof Array) {
        for (var i = 0, li = obj.length; i < li; i++) {
            if (iterator.call(context, obj[i], i) === false)
                return;
        }
    } else {
        for (var key in obj) {
            if (iterator.call(context, obj[key], key) === false)
                return;
        }
    }
};
cc.extend = function(target) {
    var sources = arguments.length >= 2 ? Array.prototype.slice.call(arguments, 1) : [];
    cc.each(sources, function(src) {
        for(var key in src) {
            if (src.hasOwnProperty(key)) {
                target[key] = src[key];
            }
        }
    });
    return target;
};
cc.isFunction = function(obj) {
    return typeof obj === 'function';
};
cc.isNumber = function(obj) {
    return typeof obj === 'number' || Object.prototype.toString.call(obj) === '[object Number]';
};
cc.isString = function(obj) {
    return typeof obj === 'string' || Object.prototype.toString.call(obj) === '[object String]';
};
cc.isArray = function(obj) {
    return Array.isArray(obj) ||
        (typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Array]');
};
cc.isUndefined = function(obj) {
    return typeof obj === 'undefined';
};
cc.isObject = function(obj) {
    return typeof obj === "object" && Object.prototype.toString.call(obj) === '[object Object]';
};
cc.isCrossOrigin = function (url) {
    if (!url) {
        cc.log("invalid URL");
        return false;
    }
    var startIndex = url.indexOf("://");
    if (startIndex === -1)
        return false;
    var endIndex = url.indexOf("/", startIndex + 3);
    var urlOrigin = (endIndex === -1) ? url : url.substring(0, endIndex);
    return urlOrigin !== location.origin;
};
cc.AsyncPool = function(srcObj, limit, iterator, onEnd, target){
    var self = this;
    self._srcObj = srcObj;
    self._limit = limit;
    self._pool = [];
    self._iterator = iterator;
    self._iteratorTarget = target;
    self._onEnd = onEnd;
    self._onEndTarget = target;
    self._results = srcObj instanceof Array ? [] : {};
    self._errors = srcObj instanceof Array ? [] : {};
    cc.each(srcObj, function(value, index){
        self._pool.push({index : index, value : value});
    });
    self.size = self._pool.length;
    self.finishedSize = 0;
    self._workingSize = 0;
    self._limit = self._limit || self.size;
    self.onIterator = function(iterator, target){
        self._iterator = iterator;
        self._iteratorTarget = target;
    };
    self.onEnd = function(endCb, endCbTarget){
        self._onEnd = endCb;
        self._onEndTarget = endCbTarget;
    };
    self._handleItem = function(){
        var self = this;
        if(self._pool.length === 0 || self._workingSize >= self._limit)
            return;
        var item = self._pool.shift();
        var value = item.value, index = item.index;
        self._workingSize++;
        self._iterator.call(self._iteratorTarget, value, index,
            function(err, result) {
                self.finishedSize++;
                self._workingSize--;
                if (err) {
                    self._errors[this.index] = err;
                }
                else {
                    self._results[this.index] = result;
                }
                if (self.finishedSize === self.size) {
                    if (self._onEnd) {
                        var errors = self._errors.length === 0 ? null : self._errors;
                        self._onEnd.call(self._onEndTarget, errors, self._results);
                    }
                    return;
                }
                self._handleItem();
            }.bind(item),
            self);
    };
    self.flow = function(){
        var self = this;
        if(self._pool.length === 0) {
            if(self._onEnd)
                self._onEnd.call(self._onEndTarget, null, []);
            return;
        }
        for(var i = 0; i < self._limit; i++)
            self._handleItem();
    };
};
cc.async = {
    series : function(tasks, cb, target){
        var asyncPool = new cc.AsyncPool(tasks, 1, function(func, index, cb1){
            func.call(target, cb1);
        }, cb, target);
        asyncPool.flow();
        return asyncPool;
    },
    parallel : function(tasks, cb, target){
        var asyncPool = new cc.AsyncPool(tasks, 0, function(func, index, cb1){
            func.call(target, cb1);
        }, cb, target);
        asyncPool.flow();
        return asyncPool;
    },
    waterfall : function(tasks, cb, target){
        var args = [];
        var lastResults = [null];//the array to store the last results
        var asyncPool = new cc.AsyncPool(tasks, 1,
            function (func, index, cb1) {
                args.push(function (err) {
                    args = Array.prototype.slice.call(arguments, 1);
                    if(tasks.length - 1 === index) lastResults = lastResults.concat(args);//while the last task
                    cb1.apply(null, arguments);
                });
                func.apply(target, args);
            }, function (err) {
                if (!cb)
                    return;
                if (err)
                    return cb.call(target, err);
                cb.apply(target, lastResults);
            });
        asyncPool.flow();
        return asyncPool;
    },
    map : function(tasks, iterator, callback, target){
        var locIterator = iterator;
        if(typeof(iterator) === "object"){
            callback = iterator.cb;
            target = iterator.iteratorTarget;
            locIterator = iterator.iterator;
        }
        var asyncPool = new cc.AsyncPool(tasks, 0, locIterator, callback, target);
        asyncPool.flow();
        return asyncPool;
    },
    mapLimit : function(tasks, limit, iterator, cb, target){
        var asyncPool = new cc.AsyncPool(tasks, limit, iterator, cb, target);
        asyncPool.flow();
        return asyncPool;
    }
};
cc.path = {
    normalizeRE: /[^\.\/]+\/\.\.\//,
    join: function () {
        var l = arguments.length;
        var result = "";
        for (var i = 0; i < l; i++) {
            result = (result + (result === "" ? "" : "/") + arguments[i]).replace(/(\/|\\\\)$/, "");
        }
        return result;
    },
    extname: function (pathStr) {
        var temp = /(\.[^\.\/\?\\]*)(\?.*)?$/.exec(pathStr);
        return temp ? temp[1] : null;
    },
    mainFileName: function(fileName){
        if(fileName){
            var idx = fileName.lastIndexOf(".");
            if(idx !== -1)
                return fileName.substring(0,idx);
        }
        return fileName;
    },
    basename: function (pathStr, extname) {
        var index = pathStr.indexOf("?");
        if (index > 0) pathStr = pathStr.substring(0, index);
        var reg = /(\/|\\\\)([^(\/|\\\\)]+)$/g;
        var result = reg.exec(pathStr.replace(/(\/|\\\\)$/, ""));
        if (!result) return null;
        var baseName = result[2];
        if (extname && pathStr.substring(pathStr.length - extname.length).toLowerCase() === extname.toLowerCase())
            return baseName.substring(0, baseName.length - extname.length);
        return baseName;
    },
    dirname: function (pathStr) {
        return pathStr.replace(/((.*)(\/|\\|\\\\))?(.*?\..*$)?/, '$2');
    },
    changeExtname: function (pathStr, extname) {
        extname = extname || "";
        var index = pathStr.indexOf("?");
        var tempStr = "";
        if (index > 0) {
            tempStr = pathStr.substring(index);
            pathStr = pathStr.substring(0, index);
        }
        index = pathStr.lastIndexOf(".");
        if (index < 0) return pathStr + extname + tempStr;
        return pathStr.substring(0, index) + extname + tempStr;
    },
    changeBasename: function (pathStr, basename, isSameExt) {
        if (basename.indexOf(".") === 0) return this.changeExtname(pathStr, basename);
        var index = pathStr.indexOf("?");
        var tempStr = "";
        var ext = isSameExt ? this.extname(pathStr) : "";
        if (index > 0) {
            tempStr = pathStr.substring(index);
            pathStr = pathStr.substring(0, index);
        }
        index = pathStr.lastIndexOf("/");
        index = index <= 0 ? 0 : index + 1;
        return pathStr.substring(0, index) + basename + ext + tempStr;
    },
    _normalize: function(url){
        var oldUrl = url = String(url);
        do {
            oldUrl = url;
            url = url.replace(this.normalizeRE, "");
        } while(oldUrl.length !== url.length);
        return url;
    }
};
cc.loader = (function () {
    var _jsCache = {},
        _register = {},
        _langPathCache = {},
        _aliases = {},
        _queue = {},
        _urlRegExp = new RegExp(
            "^" +
                "(?:(?:https?|ftp)://)" +
                "(?:\\S+(?::\\S*)?@)?" +
                "(?:" +
                    "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
                    "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
                    "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
                "|" +
                    "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
                    "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
                    "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
                "|" +
                    "(?:localhost)" +
                ")" +
                "(?::\\d{2,5})?" +
                "(?:/\\S*)?" +
            "$", "i"
        );
    return {
        resPath: "",
        audioPath: "",
        cache: {},
        getXMLHttpRequest: function () {
            return window.XMLHttpRequest ? new window.XMLHttpRequest() : new ActiveXObject("MSXML2.XMLHTTP");
        },
        _getArgs4Js: function (args) {
            var a0 = args[0], a1 = args[1], a2 = args[2], results = ["", null, null];
            if (args.length === 1) {
                results[1] = a0 instanceof Array ? a0 : [a0];
            } else if (args.length === 2) {
                if (typeof a1 === "function") {
                    results[1] = a0 instanceof Array ? a0 : [a0];
                    results[2] = a1;
                } else {
                    results[0] = a0 || "";
                    results[1] = a1 instanceof Array ? a1 : [a1];
                }
            } else if (args.length === 3) {
                results[0] = a0 || "";
                results[1] = a1 instanceof Array ? a1 : [a1];
                results[2] = a2;
            } else throw new Error("arguments error to load js!");
            return results;
        },
        isLoading: function (url) {
            return (_queue[url] !== undefined);
        },
        loadJs: function (baseDir, jsList, cb) {
            var self = this,
                args = self._getArgs4Js(arguments);
            var preDir = args[0], list = args[1], callback = args[2];
            if (navigator.userAgent.indexOf("Trident/5") > -1) {
                self._loadJs4Dependency(preDir, list, 0, callback);
            } else {
                cc.async.map(list, function (item, index, cb1) {
                    var jsPath = cc.path.join(preDir, item);
                    if (_jsCache[jsPath]) return cb1(null);
                    self._createScript(jsPath, false, cb1);
                }, callback);
            }
        },
        loadJsWithImg: function (baseDir, jsList, cb) {
            var self = this, jsLoadingImg = self._loadJsImg(),
                args = self._getArgs4Js(arguments);
            this.loadJs(args[0], args[1], function (err) {
                if (err) throw new Error(err);
                jsLoadingImg.parentNode.removeChild(jsLoadingImg);//remove loading gif
                if (args[2]) args[2]();
            });
        },
        _createScript: function (jsPath, isAsync, cb) {
            var d = document, self = this, s = document.createElement('script');
            s.async = isAsync;
            _jsCache[jsPath] = true;
            if(cc.game.config["noCache"] && typeof jsPath === "string"){
                if(self._noCacheRex.test(jsPath))
                    s.src = jsPath + "&_t=" + (new Date() - 0);
                else
                    s.src = jsPath + "?_t=" + (new Date() - 0);
            }else{
                s.src = jsPath;
            }
            s.addEventListener('load', function () {
                s.parentNode.removeChild(s);
                this.removeEventListener('load', arguments.callee, false);
                cb();
            }, false);
            s.addEventListener('error', function () {
                s.parentNode.removeChild(s);
                cb("Load " + jsPath + " failed!");
            }, false);
            d.body.appendChild(s);
        },
        _loadJs4Dependency: function (baseDir, jsList, index, cb) {
            if (index >= jsList.length) {
                if (cb) cb();
                return;
            }
            var self = this;
            self._createScript(cc.path.join(baseDir, jsList[index]), false, function (err) {
                if (err) return cb(err);
                self._loadJs4Dependency(baseDir, jsList, index + 1, cb);
            });
        },
        _loadJsImg: function () {
            var d = document, jsLoadingImg = d.getElementById("cocos2d_loadJsImg");
            if (!jsLoadingImg) {
                jsLoadingImg = document.createElement('img');
                if (cc._loadingImage)
                    jsLoadingImg.src = cc._loadingImage;
                var canvasNode = d.getElementById(cc.game.config["id"]);
                canvasNode.style.backgroundColor = "transparent";
                canvasNode.parentNode.appendChild(jsLoadingImg);
                var canvasStyle = getComputedStyle ? getComputedStyle(canvasNode) : canvasNode.currentStyle;
                if (!canvasStyle)
                    canvasStyle = {width: canvasNode.width, height: canvasNode.height};
                jsLoadingImg.style.left = canvasNode.offsetLeft + (parseFloat(canvasStyle.width) - jsLoadingImg.width) / 2 + "px";
                jsLoadingImg.style.top = canvasNode.offsetTop + (parseFloat(canvasStyle.height) - jsLoadingImg.height) / 2 + "px";
                jsLoadingImg.style.position = "absolute";
            }
            return jsLoadingImg;
        },
        loadTxt: function (url, cb) {
            if (!cc._isNodeJs) {
                var xhr = this.getXMLHttpRequest(),
                    errInfo = "load " + url + " failed!";
                xhr.open("GET", url, true);
                if (/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) {
                    xhr.setRequestHeader("Accept-Charset", "utf-8");
                    xhr.onreadystatechange = function () {
                        if(xhr.readyState === 4)
                            xhr.status === 200 ? cb(null, xhr.responseText) : cb({status:xhr.status, errorMessage:errInfo}, null);
                    };
                } else {
                    if (xhr.overrideMimeType) xhr.overrideMimeType("text\/plain; charset=utf-8");
                    xhr.onload = function () {
                        if(xhr.readyState === 4)
                            xhr.status === 200 ? cb(null, xhr.responseText) : cb({status:xhr.status, errorMessage:errInfo}, null);
                    };
                    xhr.onerror = function(){
                        cb({status:xhr.status, errorMessage:errInfo}, null);
                    };
                }
                xhr.send(null);
            } else {
                var fs = require("fs");
                fs.readFile(url, function (err, data) {
                    err ? cb(err) : cb(null, data.toString());
                });
            }
        },
        _loadTxtSync: function (url) {
            if (!cc._isNodeJs) {
                var xhr = this.getXMLHttpRequest();
                xhr.open("GET", url, false);
                if (/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) {
                    xhr.setRequestHeader("Accept-Charset", "utf-8");
                } else {
                    if (xhr.overrideMimeType) xhr.overrideMimeType("text\/plain; charset=utf-8");
                }
                xhr.send(null);
                if (!xhr.readyState === 4 || xhr.status !== 200) {
                    return null;
                }
                return xhr.responseText;
            } else {
                var fs = require("fs");
                return fs.readFileSync(url).toString();
            }
        },
        loadCsb: function(url, cb){
            var xhr = new XMLHttpRequest(),
                errInfo = "load " + url + " failed!";
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function () {
                var arrayBuffer = xhr.response;
                if (arrayBuffer) {
                    window.msg = arrayBuffer;
                }
                if(xhr.readyState === 4)
                    xhr.status === 200 ? cb(null, xhr.response) : cb({status:xhr.status, errorMessage:errInfo}, null);
            };
            xhr.onerror = function(){
                cb({status:xhr.status, errorMessage:errInfo}, null);
            };
            xhr.send(null);
        },
        loadJson: function (url, cb) {
            this.loadTxt(url, function (err, txt) {
                if (err) {
                    cb(err);
                }
                else {
                    try {
                        var result = JSON.parse(txt);
                    }
                    catch (e) {
                        throw new Error("parse json [" + url + "] failed : " + e);
                        return;
                    }
                    cb(null, result);
                }
            });
        },
        _checkIsImageURL: function (url) {
            var ext = /(\.png)|(\.jpg)|(\.bmp)|(\.jpeg)|(\.gif)/.exec(url);
            return (ext != null);
        },
        loadImg: function (url, option, callback) {
            var opt = {
                isCrossOrigin: true
            };
            if (callback !== undefined)
                opt.isCrossOrigin = option.isCrossOrigin === undefined ? opt.isCrossOrigin : option.isCrossOrigin;
            else if (option !== undefined)
                callback = option;
            var img = this.getRes(url);
            if (img) {
                callback && callback(null, img);
                return img;
            }
            var queue = _queue[url];
            if (queue) {
                queue.callbacks.push(callback);
                return queue.img;
            }
            img = new Image();
            if (opt.isCrossOrigin && location.origin !== "file://")
                img.crossOrigin = "Anonymous";
            var loadCallback = function () {
                this.removeEventListener('load', loadCallback, false);
                this.removeEventListener('error', errorCallback, false);
                if (!_urlRegExp.test(url)) {
                    cc.loader.cache[url] = img;
                }
                var queue = _queue[url];
                if (queue) {
                    var callbacks = queue.callbacks;
                    for (var i = 0; i < callbacks.length; ++i) {
                        var cb = callbacks[i];
                        if (cb) {
                            cb(null, img);
                        }
                    }
                    queue.img = null;
                    delete _queue[url];
                }
            };
            var self = this;
            var errorCallback = function () {
                this.removeEventListener('error', errorCallback, false);
                if (img.crossOrigin && img.crossOrigin.toLowerCase() === "anonymous") {
                    opt.isCrossOrigin = false;
                    self.release(url);
                    cc.loader.loadImg(url, opt, callback);
                } else {
                    var queue = _queue[url];
                    if (queue) {
                        var callbacks = queue.callbacks;
                        for (var i = 0; i < callbacks.length; ++i) {
                            var cb = callbacks[i];
                            if (cb) {
                                cb("load image failed");
                            }
                        }
                        queue.img = null;
                        delete _queue[url];
                    }
                }
            };
            _queue[url] = {
                img: img,
                callbacks: callback ? [callback] : []
            };
            img.addEventListener("load", loadCallback);
            img.addEventListener("error", errorCallback);
            img.src = url;
            return img;
        },
        _loadResIterator: function (item, index, cb) {
            var self = this, url = null;
            var type = item.type;
            if (type) {
                type = "." + type.toLowerCase();
                url = item.src ? item.src : item.name + type;
            } else {
                url = item;
                type = cc.path.extname(url);
            }
            var obj = self.getRes(url);
            if (obj)
                return cb(null, obj);
            var loader = null;
            if (type) {
                loader = _register[type.toLowerCase()];
            }
            if (!loader) {
                cc.error("loader for [" + type + "] not exists!");
                return cb();
            }
            var realUrl = url;
            if (!_urlRegExp.test(url))
            {
                var basePath = loader.getBasePath ? loader.getBasePath() : self.resPath;
                realUrl = self.getUrl(basePath, url);
            }
            if(cc.game.config["noCache"] && typeof realUrl === "string"){
                if(self._noCacheRex.test(realUrl))
                    realUrl += "&_t=" + (new Date() - 0);
                else
                    realUrl += "?_t=" + (new Date() - 0);
            }
            loader.load(realUrl, url, item, function (err, data) {
                if (err) {
                    cc.log(err);
                    self.cache[url] = null;
                    delete self.cache[url];
                    cb({status:520, errorMessage:err}, null);
                } else {
                    self.cache[url] = data;
                    cb(null, data);
                }
            });
        },
        _noCacheRex: /\?/,
        getUrl: function (basePath, url) {
            var self = this, path = cc.path;
            if (basePath !== undefined && url === undefined) {
                url = basePath;
                var type = path.extname(url);
                type = type ? type.toLowerCase() : "";
                var loader = _register[type];
                if (!loader)
                    basePath = self.resPath;
                else
                    basePath = loader.getBasePath ? loader.getBasePath() : self.resPath;
            }
            url = cc.path.join(basePath || "", url);
            if (url.match(/[\/(\\\\)]lang[\/(\\\\)]/i)) {
                if (_langPathCache[url])
                    return _langPathCache[url];
                var extname = path.extname(url) || "";
                url = _langPathCache[url] = url.substring(0, url.length - extname.length) + "_" + cc.sys.language + extname;
            }
            return url;
        },
        load : function(resources, option, loadCallback){
            var self = this;
            var len = arguments.length;
            if(len === 0)
                throw new Error("arguments error!");
            if(len === 3){
                if(typeof option === "function"){
                    if(typeof loadCallback === "function")
                        option = {trigger : option, cb : loadCallback };
                    else
                        option = { cb : option, cbTarget : loadCallback};
                }
            }else if(len === 2){
                if(typeof option === "function")
                    option = {cb : option};
            }else if(len === 1){
                option = {};
            }
            if(!(resources instanceof Array))
                resources = [resources];
            var asyncPool = new cc.AsyncPool(
                resources, 0,
                function (value, index, AsyncPoolCallback, aPool) {
                    self._loadResIterator(value, index, function (err) {
                        var arr = Array.prototype.slice.call(arguments, 1);
                        if (option.trigger)
                            option.trigger.call(option.triggerTarget, arr[0], aPool.size, aPool.finishedSize);
                        AsyncPoolCallback(err, arr[0]);
                    });
                },
                option.cb, option.cbTarget);
            asyncPool.flow();
            return asyncPool;
        },
        _handleAliases: function (fileNames, cb) {
            var self = this;
            var resList = [];
            for (var key in fileNames) {
                var value = fileNames[key];
                _aliases[key] = value;
                resList.push(value);
            }
            this.load(resList, cb);
        },
        loadAliases: function (url, callback) {
            var self = this, dict = self.getRes(url);
            if (!dict) {
                self.load(url, function (err, results) {
                    self._handleAliases(results[0]["filenames"], callback);
                });
            } else
                self._handleAliases(dict["filenames"], callback);
        },
        register: function (extNames, loader) {
            if (!extNames || !loader) return;
            var self = this;
            if (typeof extNames === "string")
                return _register[extNames.trim().toLowerCase()] = loader;
            for (var i = 0, li = extNames.length; i < li; i++) {
                _register["." + extNames[i].trim().toLowerCase()] = loader;
            }
        },
        getRes: function (url) {
            return this.cache[url] || this.cache[_aliases[url]];
        },
        _getAliase: function (url) {
            return _aliases[url];
        },
        release: function (url) {
            var cache = this.cache;
            var queue = _queue[url];
            if (queue) {
                queue.img = null;
                delete _queue[url];
            }
            delete cache[url];
            delete cache[_aliases[url]];
            delete _aliases[url];
        },
        releaseAll: function () {
            var locCache = this.cache;
            for (var key in locCache)
                delete locCache[key];
            for (var key in _aliases)
                delete _aliases[key];
        }
    };
})();
cc.formatStr = function(){
    var args = arguments;
    var l = args.length;
    if(l < 1)
        return "";
    var str = args[0];
    var needToFormat = true;
    if(typeof str === "object"){
        needToFormat = false;
    }
    for(var i = 1; i < l; ++i){
        var arg = args[i];
        if(needToFormat){
            while(true){
                var result = null;
                if(typeof arg === "number"){
                    result = str.match(/(%d)|(%s)/);
                    if(result){
                        str = str.replace(/(%d)|(%s)/, arg);
                        break;
                    }
                }
                result = str.match(/%s/);
                if(result)
                    str = str.replace(/%s/, arg);
                else
                    str += "    " + arg;
                break;
            }
        }else
            str += "    " + arg;
    }
    return str;
};
(function () {
var _tmpCanvas1 = document.createElement("canvas"),
    _tmpCanvas2 = document.createElement("canvas");
cc.create3DContext = function (canvas, opt_attribs) {
    var names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
    var context = null;
    for (var ii = 0; ii < names.length; ++ii) {
        try {
            context = canvas.getContext(names[ii], opt_attribs);
        } catch (e) {
        }
        if (context) {
            break;
        }
    }
    return context;
};
var _initSys = function () {
    cc.sys = {};
    var sys = cc.sys;
    sys.LANGUAGE_ENGLISH = "en";
    sys.LANGUAGE_CHINESE = "zh";
    sys.LANGUAGE_FRENCH = "fr";
    sys.LANGUAGE_ITALIAN = "it";
    sys.LANGUAGE_GERMAN = "de";
    sys.LANGUAGE_SPANISH = "es";
    sys.LANGUAGE_DUTCH = "du";
    sys.LANGUAGE_RUSSIAN = "ru";
    sys.LANGUAGE_KOREAN = "ko";
    sys.LANGUAGE_JAPANESE = "ja";
    sys.LANGUAGE_HUNGARIAN = "hu";
    sys.LANGUAGE_PORTUGUESE = "pt";
    sys.LANGUAGE_ARABIC = "ar";
    sys.LANGUAGE_NORWEGIAN = "no";
    sys.LANGUAGE_POLISH = "pl";
    sys.LANGUAGE_UNKNOWN = "unkonwn";
    sys.OS_IOS = "iOS";
    sys.OS_ANDROID = "Android";
    sys.OS_WINDOWS = "Windows";
    sys.OS_MARMALADE = "Marmalade";
    sys.OS_LINUX = "Linux";
    sys.OS_BADA = "Bada";
    sys.OS_BLACKBERRY = "Blackberry";
    sys.OS_OSX = "OS X";
    sys.OS_WP8 = "WP8";
    sys.OS_WINRT = "WINRT";
    sys.OS_UNKNOWN = "Unknown";
    sys.UNKNOWN = -1;
    sys.WIN32 = 0;
    sys.LINUX = 1;
    sys.MACOS = 2;
    sys.ANDROID = 3;
    sys.IPHONE = 4;
    sys.IPAD = 5;
    sys.BLACKBERRY = 6;
    sys.NACL = 7;
    sys.EMSCRIPTEN = 8;
    sys.TIZEN = 9;
    sys.WINRT = 10;
    sys.WP8 = 11;
    sys.MOBILE_BROWSER = 100;
    sys.DESKTOP_BROWSER = 101;
    sys.BROWSER_TYPE_WECHAT = "wechat";
    sys.BROWSER_TYPE_ANDROID = "androidbrowser";
    sys.BROWSER_TYPE_IE = "ie";
    sys.BROWSER_TYPE_QQ = "qqbrowser";
    sys.BROWSER_TYPE_MOBILE_QQ = "mqqbrowser";
    sys.BROWSER_TYPE_UC = "ucbrowser";
    sys.BROWSER_TYPE_360 = "360browser";
    sys.BROWSER_TYPE_BAIDU_APP = "baiduboxapp";
    sys.BROWSER_TYPE_BAIDU = "baidubrowser";
    sys.BROWSER_TYPE_MAXTHON = "maxthon";
    sys.BROWSER_TYPE_OPERA = "opera";
    sys.BROWSER_TYPE_OUPENG = "oupeng";
    sys.BROWSER_TYPE_MIUI = "miuibrowser";
    sys.BROWSER_TYPE_FIREFOX = "firefox";
    sys.BROWSER_TYPE_SAFARI = "safari";
    sys.BROWSER_TYPE_CHROME = "chrome";
    sys.BROWSER_TYPE_LIEBAO = "liebao";
    sys.BROWSER_TYPE_QZONE = "qzone";
    sys.BROWSER_TYPE_SOUGOU = "sogou";
    sys.BROWSER_TYPE_UNKNOWN = "unknown";
    sys.isNative = false;
    var win = window, nav = win.navigator, doc = document, docEle = doc.documentElement;
    var ua = nav.userAgent.toLowerCase();
    sys.isMobile = ua.indexOf('mobile') !== -1 || ua.indexOf('android') !== -1;
    sys.platform = sys.isMobile ? sys.MOBILE_BROWSER : sys.DESKTOP_BROWSER;
    var currLanguage = nav.language;
    currLanguage = currLanguage ? currLanguage : nav.browserLanguage;
    currLanguage = currLanguage ? currLanguage.split("-")[0] : sys.LANGUAGE_ENGLISH;
    sys.language = currLanguage;
    var isAndroid = false, iOS = false, osVersion = '', osMainVersion = 0;
    var uaResult = /android (\d+(?:\.\d+)+)/i.exec(ua) || /android (\d+(?:\.\d+)+)/i.exec(nav.platform);
    if (uaResult) {
        isAndroid = true;
        osVersion = uaResult[1] || '';
        osMainVersion = parseInt(osVersion) || 0;
    }
    uaResult = /(iPad|iPhone|iPod).*OS ((\d+_?){2,3})/i.exec(ua);
    if (uaResult) {
        iOS = true;
        osVersion = uaResult[2] || '';
        osMainVersion = parseInt(osVersion) || 0;
    }
    var osName = sys.OS_UNKNOWN;
    if (nav.appVersion.indexOf("Win") !== -1) osName = sys.OS_WINDOWS;
    else if (iOS) osName = sys.OS_IOS;
    else if (nav.appVersion.indexOf("Mac") !== -1) osName = sys.OS_OSX;
    else if (nav.appVersion.indexOf("X11") !== -1 && nav.appVersion.indexOf("Linux") === -1) osName = sys.OS_UNIX;
    else if (isAndroid) osName = sys.OS_ANDROID;
    else if (nav.appVersion.indexOf("Linux") !== -1) osName = sys.OS_LINUX;
    sys.os = osName;
    sys.osVersion = osVersion;
    sys.osMainVersion = osMainVersion;
    sys.browserType = sys.BROWSER_TYPE_UNKNOWN;
    (function(){
        var typeReg1 = /mqqbrowser|sogou|qzone|liebao|micromessenger|ucbrowser|360 aphone|360browser|baiduboxapp|baidubrowser|maxthon|mxbrowser|trident|miuibrowser/i;
        var typeReg2 = /qqbrowser|chrome|safari|firefox|opr|oupeng|opera/i;
        var browserTypes = typeReg1.exec(ua);
        if(!browserTypes) browserTypes = typeReg2.exec(ua);
        var browserType = browserTypes ? browserTypes[0] : sys.BROWSER_TYPE_UNKNOWN;
        if (browserType === 'micromessenger')
            browserType = sys.BROWSER_TYPE_WECHAT;
        else if (browserType === "safari" && (ua.match(/android.*applewebkit/)))
            browserType = sys.BROWSER_TYPE_ANDROID;
        else if (browserType === "trident")
            browserType = sys.BROWSER_TYPE_IE;
        else if (browserType === "360 aphone")
            browserType = sys.BROWSER_TYPE_360;
        else if (browserType === "mxbrowser")
            browserType = sys.BROWSER_TYPE_MAXTHON;
        else if (browserType === "opr")
            browserType = sys.BROWSER_TYPE_OPERA;
        sys.browserType = browserType;
    })();
    sys.browserVersion = "";
    (function(){
        var versionReg1 = /(micromessenger|qq|mx|maxthon|baidu|sogou)(mobile)?(browser)?\/?([\d.]+)/i;
        var versionReg2 = /(msie |rv:|firefox|chrome|ucbrowser|oupeng|opera|opr|safari|miui)(mobile)?(browser)?\/?([\d.]+)/i;
        var tmp = ua.match(versionReg1);
        if(!tmp) tmp = ua.match(versionReg2);
        sys.browserVersion = tmp ? tmp[4] : "";
    })();
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    var ratio = window.devicePixelRatio || 1;
    sys.windowPixelResolution = {
        width: ratio * w,
        height: ratio * h
    };
    sys._checkWebGLRenderMode = function () {
        if (cc._renderType !== cc.game.RENDER_TYPE_WEBGL)
            throw new Error("This feature supports WebGL render mode only.");
    };
    sys._supportCanvasNewBlendModes = (function(){
        var canvas = _tmpCanvas1;
        canvas.width = 1;
        canvas.height = 1;
        var context = canvas.getContext('2d');
        context.fillStyle = '#000';
        context.fillRect(0,0,1,1);
        context.globalCompositeOperation = 'multiply';
        var canvas2 = _tmpCanvas2;
        canvas2.width = 1;
        canvas2.height = 1;
        var context2 = canvas2.getContext('2d');
        context2.fillStyle = '#fff';
        context2.fillRect(0,0,1,1);
        context.drawImage(canvas2, 0, 0, 1, 1);
        return context.getImageData(0,0,1,1).data[0] === 0;
    })();
    if (cc.sys.isMobile) {
        var fontStyle = document.createElement("style");
        fontStyle.type = "text/css";
        document.body.appendChild(fontStyle);
        fontStyle.textContent = "body,canvas,div{ -moz-user-select: none;-webkit-user-select: none;-ms-user-select: none;-khtml-user-select: none;"
                                + "-webkit-tap-highlight-color:rgba(0,0,0,0);}";
    }
    try {
        var localStorage = sys.localStorage = win.localStorage;
        localStorage.setItem("storage", "");
        localStorage.removeItem("storage");
        localStorage = null;
    } catch (e) {
        var warn = function () {
            cc.warn("Warning: localStorage isn't enabled. Please confirm browser cookie or privacy option");
        };
        sys.localStorage = {
            getItem : warn,
            setItem : warn,
            removeItem : warn,
            clear : warn
        };
    }
    var _supportCanvas = !!_tmpCanvas1.getContext("2d");
    var _supportWebGL = false;
    if (win.WebGLRenderingContext) {
        var tmpCanvas = document.createElement("CANVAS");
        try{
            var context = cc.create3DContext(tmpCanvas, {'stencil': true});
            if(context) {
                _supportWebGL = true;
            }
            if (_supportWebGL && sys.os === sys.OS_ANDROID) {
                var browserVer = parseFloat(sys.browserVersion);
                switch (sys.browserType) {
                case sys.BROWSER_TYPE_MOBILE_QQ:
                case sys.BROWSER_TYPE_BAIDU:
                case sys.BROWSER_TYPE_BAIDU_APP:
                    if (browserVer >= 6.2) {
                        _supportWebGL = true;
                    }
                    else {
                        _supportWebGL = false;
                    }
                    break;
                case sys.BROWSER_TYPE_CHROME:
                    if(browserVer >= 30.0) {
                      _supportWebGL = true;
                    } else {
                      _supportWebGL = false;
                    }
                    break;
                case sys.BROWSER_TYPE_ANDROID:
                    if (sys.osMainVersion && sys.osMainVersion >= 5) {
                        _supportWebGL = true;
                    }
                    break;
                case sys.BROWSER_TYPE_UNKNOWN:
                case sys.BROWSER_TYPE_360:
                case sys.BROWSER_TYPE_MIUI:
                case sys.BROWSER_TYPE_UC:
                    _supportWebGL = false;
                }
            }
        }
        catch (e) {}
        tmpCanvas = null;
    }
    var capabilities = sys.capabilities = {
        "canvas": _supportCanvas,
        "opengl": _supportWebGL
    };
    if (docEle['ontouchstart'] !== undefined || doc['ontouchstart'] !== undefined || nav.msPointerEnabled)
        capabilities["touches"] = true;
    if (docEle['onmouseup'] !== undefined)
        capabilities["mouse"] = true;
    if (docEle['onkeyup'] !== undefined)
        capabilities["keyboard"] = true;
    if (win.DeviceMotionEvent || win.DeviceOrientationEvent)
        capabilities["accelerometer"] = true;
    sys.garbageCollect = function () {
    };
    sys.dumpRoot = function () {
    };
    sys.restartVM = function () {
    };
    sys.cleanScript = function (jsfile) {
    };
    sys.isObjectValid = function (obj) {
        if (obj) return true;
        else return false;
    };
    sys.dump = function () {
        var self = this;
        var str = "";
        str += "isMobile : " + self.isMobile + "\r\n";
        str += "language : " + self.language + "\r\n";
        str += "browserType : " + self.browserType + "\r\n";
        str += "browserVersion : " + self.browserVersion + "\r\n";
        str += "capabilities : " + JSON.stringify(self.capabilities) + "\r\n";
        str += "os : " + self.os + "\r\n";
        str += "osVersion : " + self.osVersion + "\r\n";
        str += "platform : " + self.platform + "\r\n";
        str += "Using " + (cc._renderType === cc.game.RENDER_TYPE_WEBGL ? "WEBGL" : "CANVAS") + " renderer." + "\r\n";
        cc.log(str);
    };
    sys.openURL = function(url){
        window.open(url);
    };
};
_initSys();
_tmpCanvas1 = null;
_tmpCanvas2 = null;
cc.log = cc.warn = cc.error = cc.assert = function () {
};
var _config = null,
    _jsAddedCache = {},
    _engineInitCalled = false,
    _engineLoadedCallback = null;
cc._engineLoaded = false;
function _determineRenderType(config) {
    var CONFIG_KEY = cc.game.CONFIG_KEY,
        userRenderMode = parseInt(config[CONFIG_KEY.renderMode]) || 0;
    if (isNaN(userRenderMode) || userRenderMode > 2 || userRenderMode < 0)
        config[CONFIG_KEY.renderMode] = 0;
    cc._renderType = cc.game.RENDER_TYPE_CANVAS;
    cc._supportRender = false;
    if (userRenderMode === 0) {
        if (cc.sys.capabilities["opengl"]) {
            cc._renderType = cc.game.RENDER_TYPE_WEBGL;
            cc._supportRender = true;
        }
        else if (cc.sys.capabilities["canvas"]) {
            cc._renderType = cc.game.RENDER_TYPE_CANVAS;
            cc._supportRender = true;
        }
    }
    else if (userRenderMode === 1 && cc.sys.capabilities["canvas"]) {
        cc._renderType = cc.game.RENDER_TYPE_CANVAS;
        cc._supportRender = true;
    }
    else if (userRenderMode === 2 && cc.sys.capabilities["opengl"]) {
        cc._renderType = cc.game.RENDER_TYPE_WEBGL;
        cc._supportRender = true;
    }
}
function _getJsListOfModule(moduleMap, moduleName, dir) {
    if (_jsAddedCache[moduleName]) return null;
    dir = dir || "";
    var jsList = [];
    var tempList = moduleMap[moduleName];
    if (!tempList) throw new Error("can not find module [" + moduleName + "]");
    var ccPath = cc.path;
    for (var i = 0, li = tempList.length; i < li; i++) {
        var item = tempList[i];
        if (_jsAddedCache[item]) continue;
        var extname = ccPath.extname(item);
        if (!extname) {
            var arr = _getJsListOfModule(moduleMap, item, dir);
            if (arr) jsList = jsList.concat(arr);
        } else if (extname.toLowerCase() === ".js") jsList.push(ccPath.join(dir, item));
        _jsAddedCache[item] = 1;
    }
    return jsList;
}
function _afterEngineLoaded(config) {
    if (cc._initDebugSetting)
        cc._initDebugSetting(config[cc.game.CONFIG_KEY.debugMode]);
    cc._engineLoaded = true;
    cc.log(cc.ENGINE_VERSION);
    if (_engineLoadedCallback) _engineLoadedCallback();
}
function _load(config) {
    var self = this;
    var CONFIG_KEY = cc.game.CONFIG_KEY, engineDir = config[CONFIG_KEY.engineDir], loader = cc.loader;
    if (cc.Class) {
        _afterEngineLoaded(config);
    } else {
        var ccModulesPath = cc.path.join(engineDir, "moduleConfig.json");
        loader.loadJson(ccModulesPath, function (err, modulesJson) {
            if (err) throw new Error(err);
            var modules = config["modules"] || [];
            var moduleMap = modulesJson["module"];
            var jsList = [];
            if (cc.sys.capabilities["opengl"] && modules.indexOf("base4webgl") < 0) modules.splice(0, 0, "base4webgl");
            else if (modules.indexOf("core") < 0) modules.splice(0, 0, "core");
            for (var i = 0, li = modules.length; i < li; i++) {
                var arr = _getJsListOfModule(moduleMap, modules[i], engineDir);
                if (arr) jsList = jsList.concat(arr);
            }
            cc.loader.loadJsWithImg(jsList, function (err) {
                if (err) throw err;
                _afterEngineLoaded(config);
            });
        });
    }
}
function _windowLoaded() {
    this.removeEventListener('load', _windowLoaded, false);
    _load(cc.game.config);
}
cc.initEngine = function (config, cb) {
    if (_engineInitCalled) {
        var previousCallback = _engineLoadedCallback;
        _engineLoadedCallback = function () {
            previousCallback && previousCallback();
            cb && cb();
        }
        return;
    }
    _engineLoadedCallback = cb;
    if (!cc.game.config && config) {
        cc.game.config = config;
    }
    else if (!cc.game.config) {
        cc.game._loadConfig();
    }
    config = cc.game.config;
    _determineRenderType(config);
    document.body ? _load(config) : cc._addEventListener(window, 'load', _windowLoaded, false);
    _engineInitCalled = true;
};
})();
cc.game = {
    DEBUG_MODE_NONE: 0,
    DEBUG_MODE_INFO: 1,
    DEBUG_MODE_WARN: 2,
    DEBUG_MODE_ERROR: 3,
    DEBUG_MODE_INFO_FOR_WEB_PAGE: 4,
    DEBUG_MODE_WARN_FOR_WEB_PAGE: 5,
    DEBUG_MODE_ERROR_FOR_WEB_PAGE: 6,
    EVENT_HIDE: "game_on_hide",
    EVENT_SHOW: "game_on_show",
    EVENT_RESIZE: "game_on_resize",
    EVENT_RENDERER_INITED: "renderer_inited",
    RENDER_TYPE_CANVAS: 0,
    RENDER_TYPE_WEBGL: 1,
    RENDER_TYPE_OPENGL: 2,
    _eventHide: null,
    _eventShow: null,
    CONFIG_KEY: {
        width: "width",
        height: "height",
        engineDir: "engineDir",
        modules: "modules",
        debugMode: "debugMode",
        showFPS: "showFPS",
        frameRate: "frameRate",
        id: "id",
        renderMode: "renderMode",
        jsList: "jsList"
    },
    _paused: true,//whether the game is paused
    _prepareCalled: false,//whether the prepare function has been called
    _prepared: false,//whether the engine has prepared
    _rendererInitialized: false,
    _renderContext: null,
    _intervalId: null,//interval target of main
    _lastTime: null,
    _frameTime: null,
    frame: null,
    container: null,
    canvas: null,
    config: null,
    onStart: null,
    onStop: null,
    setFrameRate: function (frameRate) {
        var self = this, config = self.config, CONFIG_KEY = self.CONFIG_KEY;
        config[CONFIG_KEY.frameRate] = frameRate;
        if (self._intervalId)
            window.cancelAnimationFrame(self._intervalId);
        self._paused = true;
        self._setAnimFrame();
        self._runMainLoop();
    },
    step: function () {
        cc.director.mainLoop();
    },
    pause: function () {
        if (this._paused) return;
        this._paused = true;
        if (cc.audioEngine) {
            cc.audioEngine.stopAllEffects();
            cc.audioEngine.pauseMusic();
        }
        if (this._intervalId)
            window.cancelAnimationFrame(this._intervalId);
        this._intervalId = 0;
    },
    resume: function () {
        if (!this._paused) return;
        this._paused = false;
        if (cc.audioEngine) {
            cc.audioEngine.resumeMusic();
        }
        this._runMainLoop();
    },
    isPaused: function () {
        return this._paused;
    },
    restart: function () {
        cc.director.popToSceneStackLevel(0);
        cc.audioEngine && cc.audioEngine.end();
        cc.game.onStart();
    },
    end: function () {
        close();
    },
    prepare: function (cb) {
        var self = this,
            config = self.config,
            CONFIG_KEY = self.CONFIG_KEY;
        this._loadConfig();
        if (this._prepared) {
            if (cb) cb();
            return;
        }
        if (this._prepareCalled) {
            return;
        }
        if (cc._engineLoaded) {
            this._prepareCalled = true;
            this._initRenderer(config[CONFIG_KEY.width], config[CONFIG_KEY.height]);
            cc.view = cc.EGLView._getInstance();
            cc.director = cc.Director._getInstance();
            if (cc.director.setOpenGLView)
                cc.director.setOpenGLView(cc.view);
            cc.winSize = cc.director.getWinSize();
            this._initEvents();
            this._setAnimFrame();
            this._runMainLoop();
            var jsList = config[CONFIG_KEY.jsList];
            if (jsList) {
                cc.loader.loadJsWithImg(jsList, function (err) {
                    if (err) throw new Error(err);
                    self._prepared = true;
                    if (cb) cb();
                });
            }
            else {
                if (cb) cb();
            }
            return;
        }
        cc.initEngine(this.config, function () {
            self.prepare(cb);
        });
    },
    run: function (config, onStart) {
        if (typeof config === 'function') {
            cc.game.onStart = config;
        }
        else {
            if (config) {
                if (typeof config === 'string') {
                    if (!cc.game.config) this._loadConfig();
                    cc.game.config[cc.game.CONFIG_KEY.id] = config;
                } else {
                    cc.game.config = config;
                }
            }
            if (typeof onStart === 'function') {
                cc.game.onStart = onStart;
            }
        }
        this.prepare(cc.game.onStart && cc.game.onStart.bind(cc.game));
    },
    _setAnimFrame: function () {
        this._lastTime = new Date();
        this._frameTime = 1000 / cc.game.config[cc.game.CONFIG_KEY.frameRate];
        if((cc.sys.os === cc.sys.OS_IOS && cc.sys.browserType === cc.sys.BROWSER_TYPE_WECHAT) || cc.game.config[cc.game.CONFIG_KEY.frameRate] !== 60) {
            window.requestAnimFrame = this._stTime;
            window.cancelAnimationFrame = this._ctTime;
        }
        else {
            window.requestAnimFrame = window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            this._stTime;
            window.cancelAnimationFrame = window.cancelAnimationFrame ||
            window.cancelRequestAnimationFrame ||
            window.msCancelRequestAnimationFrame ||
            window.mozCancelRequestAnimationFrame ||
            window.oCancelRequestAnimationFrame ||
            window.webkitCancelRequestAnimationFrame ||
            window.msCancelAnimationFrame ||
            window.mozCancelAnimationFrame ||
            window.webkitCancelAnimationFrame ||
            window.oCancelAnimationFrame ||
            this._ctTime;
        }
    },
    _stTime: function(callback){
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, cc.game._frameTime - (currTime - cc.game._lastTime));
        var id = window.setTimeout(function() { callback(); },
            timeToCall);
        cc.game._lastTime = currTime + timeToCall;
        return id;
    },
    _ctTime: function(id){
        window.clearTimeout(id);
    },
    _runMainLoop: function () {
        var self = this, callback, config = self.config, CONFIG_KEY = self.CONFIG_KEY,
            director = cc.director;
        director.setDisplayStats(config[CONFIG_KEY.showFPS]);
        callback = function () {
            if (!self._paused) {
                director.mainLoop();
                if(self._intervalId)
                    window.cancelAnimationFrame(self._intervalId);
                self._intervalId = window.requestAnimFrame(callback);
            }
        };
        window.requestAnimFrame(callback);
        self._paused = false;
    },
    _loadConfig: function () {
        if (this.config) {
            this._initConfig(this.config);
            return;
        }
        if (document["ccConfig"]) {
            this._initConfig(document["ccConfig"]);
        }
        else {
            var data = {};
            try {
                var cocos_script = document.getElementsByTagName('script');
                for(var i = 0; i < cocos_script.length; i++){
                    var _t = cocos_script[i].getAttribute('cocos');
                    if(_t === '' || _t) {
                        break;
                    }
                }
                var _src, txt, _resPath;
                if(i < cocos_script.length){
                    _src = cocos_script[i].src;
                    if(_src){
                        _resPath = /(.*)\//.exec(_src)[0];
                        cc.loader.resPath = _resPath;
                        _src = cc.path.join(_resPath, 'project.json');
                    }
                    txt = cc.loader._loadTxtSync(_src);
                }
                if(!txt){
                    txt = cc.loader._loadTxtSync("project.json");
                }
                data = JSON.parse(txt);
            } catch (e) {
                cc.log("Failed to read or parse project.json");
            }
            this._initConfig(data);
        }
    },
    _initConfig: function (config) {
        var CONFIG_KEY = this.CONFIG_KEY,
            modules = config[CONFIG_KEY.modules];
        config[CONFIG_KEY.showFPS] = typeof config[CONFIG_KEY.showFPS] === 'undefined' ? true : config[CONFIG_KEY.showFPS];
        config[CONFIG_KEY.engineDir] = config[CONFIG_KEY.engineDir] || "frameworks/cocos2d-html5";
        if (config[CONFIG_KEY.debugMode] == null)
            config[CONFIG_KEY.debugMode] = 0;
        config[CONFIG_KEY.frameRate] = config[CONFIG_KEY.frameRate] || 60;
        if (config[CONFIG_KEY.renderMode] == null)
            config[CONFIG_KEY.renderMode] = 0;
        if (config[CONFIG_KEY.registerSystemEvent] == null)
            config[CONFIG_KEY.registerSystemEvent] = true;
        if (modules && modules.indexOf("core") < 0) modules.splice(0, 0, "core");
        modules && (config[CONFIG_KEY.modules] = modules);
        this.config = config;
    },
    _initRenderer: function (width, height) {
        if (this._rendererInitialized) return;
        if (!cc._supportRender) {
            throw new Error("The renderer doesn't support the renderMode " + this.config[this.CONFIG_KEY.renderMode]);
        }
        var el = this.config[cc.game.CONFIG_KEY.id],
            win = window,
            element = cc.$(el) || cc.$('#' + el),
            localCanvas, localContainer, localConStyle;
        if (element.tagName === "CANVAS") {
            width = width || element.width;
            height = height || element.height;
            this.canvas = cc._canvas = localCanvas = element;
            this.container = cc.container = localContainer = document.createElement("DIV");
            if (localCanvas.parentNode)
                localCanvas.parentNode.insertBefore(localContainer, localCanvas);
        } else {
            if (element.tagName !== "DIV") {
                cc.log("Warning: target element is not a DIV or CANVAS");
            }
            width = width || element.clientWidth;
            height = height || element.clientHeight;
            this.canvas = cc._canvas = localCanvas = document.createElement("CANVAS");
            this.container = cc.container = localContainer = document.createElement("DIV");
            element.appendChild(localContainer);
        }
        localContainer.setAttribute('id', 'Cocos2dGameContainer');
        localContainer.appendChild(localCanvas);
        this.frame = (localContainer.parentNode === document.body) ? document.documentElement : localContainer.parentNode;
        localCanvas.addClass("gameCanvas");
        localCanvas.setAttribute("width", width || 480);
        localCanvas.setAttribute("height", height || 320);
        localCanvas.setAttribute("tabindex", 99);
        if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
            this._renderContext = cc._renderContext = cc.webglContext
             = cc.create3DContext(localCanvas, {
                'stencil': true,
                'antialias': !cc.sys.isMobile,
                'alpha': false
            });
        }
        if (this._renderContext) {
            cc.renderer = cc.rendererWebGL;
            win.gl = this._renderContext;
            cc.renderer.init();
            cc.shaderCache._init();
            cc._drawingUtil = new cc.DrawingPrimitiveWebGL(this._renderContext);
            cc.textureCache._initializingRenderer();
            cc.glExt = {};
            cc.glExt.instanced_arrays = win.gl.getExtension("ANGLE_instanced_arrays");
            cc.glExt.element_uint = win.gl.getExtension("OES_element_index_uint");
        } else {
            cc._renderType = cc.game.RENDER_TYPE_CANVAS;
            cc.renderer = cc.rendererCanvas;
            this._renderContext = cc._renderContext = new cc.CanvasContextWrapper(localCanvas.getContext("2d"));
            cc._drawingUtil = cc.DrawingPrimitiveCanvas ? new cc.DrawingPrimitiveCanvas(this._renderContext) : null;
        }
        cc._gameDiv = localContainer;
        cc.game.canvas.oncontextmenu = function () {
            if (!cc._isContextMenuEnable) return false;
        };
        this.dispatchEvent(this.EVENT_RENDERER_INITED, true);
        this._rendererInitialized = true;
    },
    _initEvents: function () {
        var win = window, self = this, hidden, visibilityChange, _undef = "undefined";
        this._eventHide = this._eventHide || new cc.EventCustom(this.EVENT_HIDE);
        this._eventHide.setUserData(this);
        this._eventShow = this._eventShow || new cc.EventCustom(this.EVENT_SHOW);
        this._eventShow.setUserData(this);
        if (this.config[this.CONFIG_KEY.registerSystemEvent])
            cc.inputManager.registerSystemEvent(this.canvas);
        if (!cc.isUndefined(document.hidden)) {
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (!cc.isUndefined(document.mozHidden)) {
            hidden = "mozHidden";
            visibilityChange = "mozvisibilitychange";
        } else if (!cc.isUndefined(document.msHidden)) {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (!cc.isUndefined(document.webkitHidden)) {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }
        var onHidden = function () {
            if (cc.eventManager && cc.game._eventHide)
                cc.eventManager.dispatchEvent(cc.game._eventHide);
        };
        var onShow = function () {
            if (cc.eventManager && cc.game._eventShow)
                cc.eventManager.dispatchEvent(cc.game._eventShow);
        };
        if (hidden) {
            document.addEventListener(visibilityChange, function () {
                if (document[hidden]) onHidden();
                else onShow();
            }, false);
        } else {
            win.addEventListener("blur", onHidden, false);
            win.addEventListener("focus", onShow, false);
        }
        if(navigator.userAgent.indexOf("MicroMessenger") > -1){
            win.onfocus = function(){ onShow() };
        }
        if ("onpageshow" in window && "onpagehide" in window) {
            win.addEventListener("pagehide", onHidden, false);
            win.addEventListener("pageshow", onShow, false);
        }
        cc.eventManager.addCustomListener(cc.game.EVENT_HIDE, function () {
            cc.game.pause();
        });
        cc.eventManager.addCustomListener(cc.game.EVENT_SHOW, function () {
            cc.game.resume();
        });
    }
};
Function.prototype.bind = Function.prototype.bind || function (oThis) {
    if (!cc.isFunction(this)) {
        throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }
    var aArgs = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP = function () {},
        fBound = function () {
            return fToBind.apply(this instanceof fNOP && oThis
                ? this
                : oThis,
                aArgs.concat(Array.prototype.slice.call(arguments)));
        };
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
    return fBound;
};
cc._urlRegExp = new RegExp(
    "^" +
        "(?:(?:https?|ftp)://)" +
        "(?:\\S+(?::\\S*)?@)?" +
        "(?:" +
            "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
            "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
            "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
        "|" +
            "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
            "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
            "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
        "|" +
            "(?:localhost)" +
        ")" +
        "(?::\\d{2,5})?" +
        "(?:/\\S*)?" +
    "$", "i"
);
cc.SimplePool = function () {
    this._pool = [];
};
cc.SimplePool.prototype = {
    constructor: cc.SimplePool,
    size: function () {
        return this._pool.length;
    },
    put: function (obj) {
        if (obj && this._pool.indexOf(obj) === -1) {
            this._pool.unshift(obj);
        }
    },
    get: function () {
        var last = this._pool.length-1;
        if (last < 0) {
            return null;
        }
        else {
            var obj = this._pool[last];
            this._pool.length = last;
            return obj;
        }
    },
    find: function (finder, end) {
        var found, i, obj, pool = this._pool, last = pool.length-1;
        for (i = pool.length; i >= 0; --i) {
            obj = pool[i];
            found = finder(i, obj);
            if (found) {
                pool[i] = pool[last];
                pool.length = last;
                return obj;
            }
        }
        if (end) {
            var index = end();
            if (index >= 0) {
                pool[index] = pool[last];
                pool.length = last;
                return obj;
            }
        }
        return null;
    }
};
cc.EventHelper = function(){};
cc.EventHelper.prototype = {
    constructor: cc.EventHelper,
    apply: function ( object ) {
        object.addEventListener = cc.EventHelper.prototype.addEventListener;
        object.hasEventListener = cc.EventHelper.prototype.hasEventListener;
        object.removeEventListener = cc.EventHelper.prototype.removeEventListener;
        object.dispatchEvent = cc.EventHelper.prototype.dispatchEvent;
    },
    addEventListener: function ( type, listener, target ) {
        if(type === "load" && this._textureLoaded){
            setTimeout(function(){
                listener.call(target);
            }, 0);
            return;
        }
        if ( this._listeners === undefined )
            this._listeners = {};
        var listeners = this._listeners;
        if ( listeners[ type ] === undefined )
            listeners[ type ] = [];
        if ( !this.hasEventListener(type, listener, target))
            listeners[ type ].push( {callback:listener, eventTarget: target} );
    },
    hasEventListener: function ( type, listener, target ) {
        if ( this._listeners === undefined )
            return false;
        var listeners = this._listeners;
        if ( listeners[ type ] !== undefined ) {
            for(var i = 0, len = listeners.length; i < len ; i++){
                var selListener = listeners[i];
                if(selListener.callback === listener && selListener.eventTarget === target)
                    return true;
            }
        }
        return false;
    },
    removeEventListener: function( type, listener, target){
        if ( this._listeners === undefined )
            return;
        var listeners = this._listeners;
        var listenerArray = listeners[ type ];
        if ( listenerArray !== undefined ) {
            for(var i = 0; i < listenerArray.length ; ){
                var selListener = listenerArray[i];
                if(selListener.eventTarget === target && selListener.callback === listener)
                    listenerArray.splice( i, 1 );
                else
                    i++
            }
        }
    },
    removeEventTarget: function( type, listener, target){
        if ( this._listeners === undefined )
            return;
        var listeners = this._listeners;
        var listenerArray = listeners[ type ];
        if ( listenerArray !== undefined ) {
            for(var i = 0; i < listenerArray.length ; ){
                var selListener = listenerArray[i];
                if(selListener.eventTarget === target)
                    listenerArray.splice( i, 1 );
                else
                    i++
            }
        }
    },
    dispatchEvent: function ( event, clearAfterDispatch ) {
        if ( this._listeners === undefined )
            return;
        if(clearAfterDispatch == null)
            clearAfterDispatch = true;
        var listeners = this._listeners;
        var listenerArray = listeners[ event];
        if ( listenerArray !== undefined ) {
            var array = [];
            var length = listenerArray.length;
            for ( var i = 0; i < length; i ++ ) {
                array[ i ] = listenerArray[ i ];
            }
            for ( i = 0; i < length; i ++ ) {
                array[ i ].callback.call( array[i].eventTarget, this );
            }
            if(clearAfterDispatch)
                listenerArray.length = 0;
        }
    }
};
cc.EventHelper.prototype.apply(cc.game);
var cc = cc || {};
cc._loadingImage = "data:image/gif;base64,R0lGODlhEAAQALMNAD8/P7+/vyoqKlVVVX9/fxUVFUBAQGBgYMDAwC8vL5CQkP///wAAAP///wAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFAAANACwAAAAAEAAQAAAEO5DJSau9OOvNex0IMnDIsiCkiW6g6BmKYlBFkhSUEgQKlQCARG6nEBwOgl+QApMdCIRD7YZ5RjlGpCUCACH5BAUAAA0ALAAAAgAOAA4AAAQ6kLGB0JA4M7QW0hrngRllkYyhKAYqKUGguAws0ypLS8JxCLQDgXAIDg+FRKIA6v0SAECCBpXSkstMBAAh+QQFAAANACwAAAAACgAQAAAEOJDJORAac6K1kDSKYmydpASBUl0mqmRfaGTCcQgwcxDEke+9XO2WkxQSiUIuAQAkls0n7JgsWq8RACH5BAUAAA0ALAAAAAAOAA4AAAQ6kMlplDIzTxWC0oxwHALnDQgySAdBHNWFLAvCukc215JIZihVIZEogDIJACBxnCSXTcmwGK1ar1hrBAAh+QQFAAANACwAAAAAEAAKAAAEN5DJKc4RM+tDyNFTkSQF5xmKYmQJACTVpQSBwrpJNteZSGYoFWjIGCAQA2IGsVgglBOmEyoxIiMAIfkEBQAADQAsAgAAAA4ADgAABDmQSVZSKjPPBEDSGucJxyGA1XUQxAFma/tOpDlnhqIYN6MEAUXvF+zldrMBAjHoIRYLhBMqvSmZkggAIfkEBQAADQAsBgAAAAoAEAAABDeQyUmrnSWlYhMASfeFVbZdjHAcgnUQxOHCcqWylKEohqUEAYVkgEAMfkEJYrFA6HhKJsJCNFoiACH5BAUAAA0ALAIAAgAOAA4AAAQ3kMlJq704611SKloCAEk4lln3DQgyUMJxCBKyLAh1EMRR3wiDQmHY9SQslyIQUMRmlmVTIyRaIgA7";
cc._fpsImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAAgCAYAAAD9qabkAAAKQ2lDQ1BJQ0MgcHJvZmlsZQAAeNqdU3dYk/cWPt/3ZQ9WQtjwsZdsgQAiI6wIyBBZohCSAGGEEBJAxYWIClYUFRGcSFXEgtUKSJ2I4qAouGdBiohai1VcOO4f3Ke1fXrv7e371/u855zn/M55zw+AERImkeaiagA5UoU8Otgfj09IxMm9gAIVSOAEIBDmy8JnBcUAAPADeXh+dLA//AGvbwACAHDVLiQSx+H/g7pQJlcAIJEA4CIS5wsBkFIAyC5UyBQAyBgAsFOzZAoAlAAAbHl8QiIAqg0A7PRJPgUA2KmT3BcA2KIcqQgAjQEAmShHJAJAuwBgVYFSLALAwgCgrEAiLgTArgGAWbYyRwKAvQUAdo5YkA9AYACAmUIszAAgOAIAQx4TzQMgTAOgMNK/4KlfcIW4SAEAwMuVzZdL0jMUuJXQGnfy8ODiIeLCbLFCYRcpEGYJ5CKcl5sjE0jnA0zODAAAGvnRwf44P5Dn5uTh5mbnbO/0xaL+a/BvIj4h8d/+vIwCBAAQTs/v2l/l5dYDcMcBsHW/a6lbANpWAGjf+V0z2wmgWgrQevmLeTj8QB6eoVDIPB0cCgsL7SViob0w44s+/zPhb+CLfvb8QB7+23rwAHGaQJmtwKOD/XFhbnauUo7nywRCMW735yP+x4V//Y4p0eI0sVwsFYrxWIm4UCJNx3m5UpFEIcmV4hLpfzLxH5b9CZN3DQCshk/ATrYHtctswH7uAQKLDljSdgBAfvMtjBoLkQAQZzQyefcAAJO/+Y9AKwEAzZek4wAAvOgYXKiUF0zGCAAARKCBKrBBBwzBFKzADpzBHbzAFwJhBkRADCTAPBBCBuSAHAqhGJZBGVTAOtgEtbADGqARmuEQtMExOA3n4BJcgetwFwZgGJ7CGLyGCQRByAgTYSE6iBFijtgizggXmY4EImFINJKApCDpiBRRIsXIcqQCqUJqkV1II/ItchQ5jVxA+pDbyCAyivyKvEcxlIGyUQPUAnVAuagfGorGoHPRdDQPXYCWomvRGrQePYC2oqfRS+h1dAB9io5jgNExDmaM2WFcjIdFYIlYGibHFmPlWDVWjzVjHVg3dhUbwJ5h7wgkAouAE+wIXoQQwmyCkJBHWExYQ6gl7CO0EroIVwmDhDHCJyKTqE+0JXoS+cR4YjqxkFhGrCbuIR4hniVeJw4TX5NIJA7JkuROCiElkDJJC0lrSNtILaRTpD7SEGmcTCbrkG3J3uQIsoCsIJeRt5APkE+S+8nD5LcUOsWI4kwJoiRSpJQSSjVlP+UEpZ8yQpmgqlHNqZ7UCKqIOp9aSW2gdlAvU4epEzR1miXNmxZDy6Qto9XQmmlnafdoL+l0ugndgx5Fl9CX0mvoB+nn6YP0dwwNhg2Dx0hiKBlrGXsZpxi3GS+ZTKYF05eZyFQw1zIbmWeYD5hvVVgq9ip8FZHKEpU6lVaVfpXnqlRVc1U/1XmqC1SrVQ+rXlZ9pkZVs1DjqQnUFqvVqR1Vu6k2rs5Sd1KPUM9RX6O+X/2C+mMNsoaFRqCGSKNUY7fGGY0hFsYyZfFYQtZyVgPrLGuYTWJbsvnsTHYF+xt2L3tMU0NzqmasZpFmneZxzQEOxrHg8DnZnErOIc4NznstAy0/LbHWaq1mrX6tN9p62r7aYu1y7Rbt69rvdXCdQJ0snfU6bTr3dQm6NrpRuoW623XP6j7TY+t56Qn1yvUO6d3RR/Vt9KP1F+rv1u/RHzcwNAg2kBlsMThj8MyQY+hrmGm40fCE4agRy2i6kcRoo9FJoye4Ju6HZ+M1eBc+ZqxvHGKsNN5l3Gs8YWJpMtukxKTF5L4pzZRrmma60bTTdMzMyCzcrNisyeyOOdWca55hvtm82/yNhaVFnMVKizaLx5balnzLBZZNlvesmFY+VnlW9VbXrEnWXOss623WV2xQG1ebDJs6m8u2qK2brcR2m23fFOIUjynSKfVTbtox7PzsCuya7AbtOfZh9iX2bfbPHcwcEh3WO3Q7fHJ0dcx2bHC866ThNMOpxKnD6VdnG2ehc53zNRemS5DLEpd2lxdTbaeKp26fesuV5RruutK10/Wjm7ub3K3ZbdTdzD3Ffav7TS6bG8ldwz3vQfTw91jicczjnaebp8LzkOcvXnZeWV77vR5Ps5wmntYwbcjbxFvgvct7YDo+PWX6zukDPsY+Ap96n4e+pr4i3z2+I37Wfpl+B/ye+zv6y/2P+L/hefIW8U4FYAHBAeUBvYEagbMDawMfBJkEpQc1BY0FuwYvDD4VQgwJDVkfcpNvwBfyG/ljM9xnLJrRFcoInRVaG/owzCZMHtYRjobPCN8Qfm+m+UzpzLYIiOBHbIi4H2kZmRf5fRQpKjKqLupRtFN0cXT3LNas5Fn7Z72O8Y+pjLk722q2cnZnrGpsUmxj7Ju4gLiquIF4h/hF8ZcSdBMkCe2J5MTYxD2J43MC52yaM5zkmlSWdGOu5dyiuRfm6c7Lnnc8WTVZkHw4hZgSl7I/5YMgQlAvGE/lp25NHRPyhJuFT0W+oo2iUbG3uEo8kuadVpX2ON07fUP6aIZPRnXGMwlPUit5kRmSuSPzTVZE1t6sz9lx2S05lJyUnKNSDWmWtCvXMLcot09mKyuTDeR55m3KG5OHyvfkI/lz89sVbIVM0aO0Uq5QDhZML6greFsYW3i4SL1IWtQz32b+6vkjC4IWfL2QsFC4sLPYuHhZ8eAiv0W7FiOLUxd3LjFdUrpkeGnw0n3LaMuylv1Q4lhSVfJqedzyjlKD0qWlQyuCVzSVqZTJy26u9Fq5YxVhlWRV72qX1VtWfyoXlV+scKyorviwRrjm4ldOX9V89Xlt2treSrfK7etI66Trbqz3Wb+vSr1qQdXQhvANrRvxjeUbX21K3nShemr1js20zcrNAzVhNe1bzLas2/KhNqP2ep1/XctW/a2rt77ZJtrWv913e/MOgx0VO97vlOy8tSt4V2u9RX31btLugt2PGmIbur/mft24R3dPxZ6Pe6V7B/ZF7+tqdG9s3K+/v7IJbVI2jR5IOnDlm4Bv2pvtmne1cFoqDsJB5cEn36Z8e+NQ6KHOw9zDzd+Zf7f1COtIeSvSOr91rC2jbaA9ob3v6IyjnR1eHUe+t/9+7zHjY3XHNY9XnqCdKD3x+eSCk+OnZKeenU4/PdSZ3Hn3TPyZa11RXb1nQ8+ePxd07ky3X/fJ897nj13wvHD0Ivdi2yW3S609rj1HfnD94UivW2/rZffL7Vc8rnT0Tes70e/Tf/pqwNVz1/jXLl2feb3vxuwbt24m3Ry4Jbr1+Hb27Rd3Cu5M3F16j3iv/L7a/eoH+g/qf7T+sWXAbeD4YMBgz8NZD+8OCYee/pT/04fh0kfMR9UjRiONj50fHxsNGr3yZM6T4aeypxPPyn5W/3nrc6vn3/3i+0vPWPzY8Av5i8+/rnmp83Lvq6mvOscjxx+8znk98ab8rc7bfe+477rfx70fmSj8QP5Q89H6Y8en0E/3Pud8/vwv94Tz+4A5JREAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfcAgcQLxxUBNp/AAAQZ0lEQVR42u2be3QVVZbGv1N17829eRLyIKAEOiISEtPhJTJAYuyBDmhWjAEx4iAGBhxA4wABbVAMWUAeykMCM+HRTcBRWkNH2l5moS0LCCrQTkYeQWBQSCAIgYRXEpKbW/XNH5zS4noR7faPEeu31l0h4dSpvc+t/Z199jkFWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhY/H9D/MR9qfKnLj/00U71aqfJn9+HCkCR/Wk36ddsgyJ/1wF4fkDfqqm9/gPsUeTnVr6a2xlQfnxdI7zs0W7irzD17Ytb2WT7EeNv/r4ox1O3Quf2QP2pgt9utwfout4FQE8AVBSlnaRmfvAURQkg2RlAbwB9AThlW5L0GaiKojhJhgOIBqDa7XaPrusdPtr5kQwF0BVAAoBIABRCKDd5aFUhRDAAw57eAOwAhKIoupft3zoqhB1AqLwuHIBut9uFt02qqvqRDJR2dAEQJj/BAOjn56dqmma+xiaECAEQAWAggLsB6A6HQ2iaZggBhBAqgEAAnQB0kzaEmT4hAITT6VQ8Ho/HJAKKECJQtr8LwD1y/A1/vcdfEUIEyfZ9AcQbYvZ942Px88L2UwlJR0dH0EMPPbRj5syZPUeNGrXR7Xb/641xIwJ1XY9NSUlZm52dfW+XLl1w8uRJzJ8//+OGhoYJqqqe1TSt1Wsm9NN1PSIqKmr12rVrR5WUlHy1bdu2AQCumWc3IYRD1/UwVVXnFRQUTIuNjUVzczN2797dWFJSkq8oymZd15sAGAEnFEUJ1nX9nzIzM1dnZmZGh4SE4OTJk5g5c+Zf29vbp9pstrMej6fVOyhIhgAYU1hY+B+hoaGoqKg4XVlZea+XTULTNFdCQsLGiRMnPuR2u3UhBOV9eeDAAWXTpk095DUe6WsoyRE5OTlr0tLSAux2O/bs2cO5c+e+pijKUpIXSHaQVAGkvPLKK++6XK4OksJLCFlXV2cvKSlJBFAjhU+x2WwhHo9nUHp6+urMzMy7wsLCUF9fjxdffPHjxsbGiTab7WuPx9NiEutOuq4PyMjI+M+srKyYqKgoHD58GDNmzNjq8XhyVFU9b/q+LH7hBAEYu3PnTlZVVRFAGgCX6f/tAHoOHDjwa0p27txp/JO9e/f+QM7cipw9nfL3kQBKt2zZQpJ87rnn6mQmoHilw2EACs+cOUOSrK+vZ1NTE0nyo48+IoBpxswoBcMJ4Ndjx471kOTFixe5d+9ekqTH42H//v13A4jyzpAURfEH0H/OnDnthu1z5sw558MmFUCPWbNmnaMP3nrrLZoyDmP8Hl68eDFJ8siRI9/Yc+zYMQKYKdtAztrTrl27xptRXV1NAKMAOAyBBBA/Y8aMdpLs6Ojgxx9//E37+++//29yvFXppwvAwMcee8xjtDHsuXLlCqOjo//ia3wsfpkoALqFhoZuIckJEyackimm3dQmEMDUmpoakmRISMhhAHOHDx/eQJIbN24kgKEyMAHAFRMTs2XXrl1saWkhSZ0kp0+ffhrAr3wEW/S8efOukORLL72kA1gKYMPWrVtJkk899dRJAHeYrgsEsIQkjx8/TgDvAPjd448/3kaSb7zxBmUa7vC6z53BwcFbSHL9+vU6Sc6aNes8gF5ewWAH0PfVV18lSQL4DMBGIcQ6AKtcLleBFC2jXtFt8ODBe0iyoqKCAJYByC8qKmJDQwOzsrK+MAmqo1OnTveHhoa+GRkZ+XZkZOSWiIiIvzgcjk9mzpypkWRmZuZpmbYbGV4AgPnNzc1sa2sjgN0A5iQmJtaSZHl5OQHcb/K3s81mW0uSTU1NBFAFYFbfvn1Pk+Tbb79NAA8IIVzW42/hByA+Pz/fLR/2ZXIda05NI/z9/TeR5J49ewhgqlxTrtI0jY2NjQQw3zTLuWJiYjaUlJToS5Ys6fjkk080kwDEeAmADcA9GzZsIElGRUW9CyAWwLApU6Y0kOSKFSsog9QICGdERMTGsrIyZmVlEcC9AB4IDw/fTpLbtm0jgN94CUAnAJmVlZVcs2aNZ/LkyRdJcvbs2b4EwAkgZfPmzTxw4AABFAN4BkC6vFeUSewcAO5duXIlSTIhIaEawGMAxgKYAmAGgCS73e5vrKVk/yGythANYEhCQsIhkly+fDkBpKqqGmL6DgIALDKN/3yZpVWQZGVlJQE8aPI3KiMjo5okV61aRQAjAPQBMPfIkSN0u90EUCBtsPiFEwpgbn19PdetW2fM5N4zQ9ekpKQqkty0aRMBpMjiWM6JEydIkoqirJUFJ6iq6pAPVy8A6cZMehMBUACEuVyuFwG8HBwcPEIWx367ZMkSjSQXLVrUJouTRorrkAHdA8BdQogsAOsKCwtJkmPGjDkvMw2bDDo/ADEjRoz4XylyFbm5uY0mAbjLyyZ/AOOrq6tZVlbWsWDBgo69e/eyoqKCgwcPPg4gSQaoIRbp27dvN7KF+tLSUr28vJwFBQXtMpvpYRIM7+wrAkDeqVOnePbsWQIoNKfzpiXPg8uXLydJJicnNwF4f+nSpW6STEtLq5fjYwhk1wkTJtSQ5Ouvv04AqTKj+N2xY8dIkgEBAW/Ie1v8wncRegwZMmQvSfbr12+3Ua33WqPfOWbMmP0kWVpaSgCDZAqcfejQIWNZsEGKgvnh9gfQb9myZd8nAEJVVZtMkUNk8CcNHTq0liR1XWdYWNhmH1mJIme80OnTp18x1rp5eXkEsNJms92Fb7e/IgEsvHz5Mp999tkmAI/l5uZeMC0B7vEqqAYAyL106RJJsra2lpWVld+sucePH38ZQG+5NncBeOrgwYMkqbe3t/Po0aOsra011wAWyl0H7x0JJ4DE+fPnu0kyPT29DsDdUrBuyNKEEAkAdpw/f/6GeoEM8GUmfwEgPCIiopwkGxsbabPZPgOw6L777vvm4p49e26VGYjFLxUhhD+ApLKyMp44ccIoVnXybgbgzkcfffRzklyzZg0BDJYCMMmoCwQFBXkLgLGWvvcWAgBToSsKwNPTp09vMR7UuLi4rwH0lgU8c/Db5ezbeeTIkRWzZ8++aMxu+fn5BPCADBwHgP4LFy701NXVEUAJgAnPP/98kyxMNgHo53A4zH77BQQETMvPz7+Um5vbBuAlAFMSExPPmdbVL0qh8Acw8fDhw5SCchVAEYAVb775JknyhRdeaJYztHfxMwLAaqNwCGC2FArv8x0hAHKNLGPKlCme5OTk/Zs3bzb7O0wKiiG8KXl5ed8IxenTp0mSR48e1UmyW7duWywBuD2xyQcgFECgoih+8H1gyJgZV5Lkyy+/3CbTRIePtl2HDBmyw1QBHyGDdXZdXR1JUghRKkXBjOMHCoBdpr0L3nvvPZLkF198wejo6O0A4lVVDTb74HQ6AwD8Wq7Jh8rgGgDgQ13XjVR8qaxJuADMbmlpYXl5uV5UVNRWUFDgfv/993Vj/ZydnU1c37eHXML4S3viAcQqitJD2l104cIFY8lTKsXSBWBMVVWVcd9yed2A1NTUQ6Zl00CvLMMOoHdubm6zFIlWOf5+PsY/Kj09vdrU11QAwwGsv3jxIk21m2DZr10I0RXAuAcffPBgaWkpV69eTYfDcdiwUxY0w6xw+flX8L1xApjevXv3lREREaW6rofB93aPDUDQpEmTMgHgtddeqwBwEd/utZvpqK6uPgEAcXFxkA94NwB9unfvjrNnz4LklwDcf08iIqv66Zs2bXrl4YcfxooVKxAbG7uqrq5uAYA2TdOEqqpGYIi2tjbl6aeffu/YsWPv5uTk7JaC1wHg4Pnz542MwoVvTx+21dbWYvjw4WLixIl+2dnZ9lGjRgmSTE1NRUpKCkwFTGiaxtTU1OXTpk3707Bhw/6g67pDipnT4biuj7qut+Lbk3Vf1tTUXI9qu91Pjq1QFEUBgJaWFgBo8yGOQ8eNGxcAAOvXr/8QwBUfYygAKL169eoCABcuXACAWtn2hOGv0+kMNO1KiPDw8F4A4rZv3/7R1KlTR0+bNu1ht9u9r1+/fqitrQXJgwDarRC6/QjPzs4+QJIffPCB9/aQmSAA43ft2mW0e1QGoi8CAPyLsZccExNTC2BlRkbGRdOyYJCP2csBIN6UAZzCd7cBbQCijYp/dXU1ExMTz6SmptaMHj36f9LS0vYlJCRsl6mxIWSdu3fv/g5J7t+/nwC2AShMTk6+SJKff/45AWRLYbD7+fndAeDf5BJnLoCCyZMnt5JkdnZ2C4B/F0KEm1Pu+Pj4rST55ZdfEsBWAK+mpaVdMo3raDn7KwDuSEpK+m+S3LBhAwG8DuCtHTt2UBbpjgC408vvcFVV15HkuXPnjMp+p5uMf0RcXNyHJNnQ0EBVVfcCWBQXF3fG+Jv0yxABPwB5LS0tRmFxN4BlTzzxxGWSXLx4sS5F3GGFy+1Hp5SUlJq6ujoWFxdTpsZ2H+0iIyMj/0iSWVlZX5mr5jfJFroPGzasxlhTnjp1iiTZ3NxMl8tlrCd9pfa9SkpKSJI5OTmnZOageLUZZqxvfVFWVkZcPwdgNwnSCKPqb17jkmR8fPzfZMDZ5CRsFBmNI7h95s2b1yhT7/MAYmStwCx4vy0uLqa3v5qmEcCfvSr1QQAeXb16NY3Cm3HQ55133iGAp+SxZTNhKSkpfzUddkrFjYevzAQCeGjp0qXfsYckY2NjTwD4leGDLCL2HTdunNtoY+zWSHFcIHdsFCtcfuZ1vO9Eqs3m7/F47sb1k2qX/f3997W2tl7BjWfpBYDOzzzzzIVJkyZh0KBBCwEsB3AJvl9AETabLcDj8dwRFRW1ctasWb8JCgpSzp07d62wsPC/Wltb8xRFadR1/ZqPXYbgAQMGbI2Pjw/+6quv9ldVVT0r01ezuPRJSUn5Y9euXXVd11WzDaqq6kePHm3+7LPPRgO4KlNuxWazhXo8nuTk5OSXMjIyEl0uFxoaGtqKior+dPXq1VdUVT0jj7r68ieoT58+vx8yZMjdx48fP1JVVTVF9m20VW02WyfZf97YsWPjXS4X6urqWvPy8jYCWCyEuEDS8FdVFKWzruv//OSTTy5OTk7uqWkaPv3007qysrJ8RVH+LI8ym8/rB3Tu3HnRI488knLo0KG2ffv2ZQI4C98vP6mqqoZqmpaclpa2cOTIkX39/f3R0NDQUVxc/G5TU9PLqqrWa5rWLH1QVFUN0TStX1JSUvH48eP7BwYG4uDBg1cKCgpeBbBe2u+2Qug2EwD5N5sMPuNtMe8XP4TT6Qxoa2sbIGeXvUKIK7d4IISiKC5d1wPljOfA9bPwzYqiXNV13dd6Uqiq6qdpml2mpe02m63d4/G4vcTF5fF47LJf71nJA6BZVVW3pmntuPHlmAD5wk6Q9NnbHp9vHaqq6tA0zU/64PZhk1FfCZB9G/23ALiqKEqzD39tpvbGUqoFwFUhRLP3yzpCCDtJpxyXDulfG27+pqRR3DXsUWVd4Yq0x/taVQjhIhksC8L+ABpM9ljBf5sKwI8pIBr75L5E4vvu+UNeG/a+hv+AL7yFH8qPtOfHjtOP6V/Bja8D6z/B2Nys/1u9Xv33tLf4GfF/LC4GCJwByWIAAAAASUVORK5CYII=";
cc._loaderImage = "data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAAlAAD/4QMpaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjAtYzA2MCA2MS4xMzQ3NzcsIDIwMTAvMDIvMTItMTc6MzI6MDAgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjM4MDBEMDY2QTU1MjExRTFBQTAzQjEzMUNFNzMxRkQwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjM4MDBEMDY1QTU1MjExRTFBQTAzQjEzMUNFNzMxRkQwIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzUgV2luZG93cyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkU2RTk0OEM4OERCNDExRTE5NEUyRkE3M0M3QkE1NTlEIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkU2RTk0OEM5OERCNDExRTE5NEUyRkE3M0M3QkE1NTlEIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+/+4ADkFkb2JlAGTAAAAAAf/bAIQADQkJCQoJDQoKDRMMCwwTFhENDREWGhUVFhUVGhkUFhUVFhQZGR0fIB8dGScnKionJzk4ODg5QEBAQEBAQEBAQAEODAwOEA4RDw8RFA4RDhQVERISERUfFRUXFRUfKB0ZGRkZHSgjJiAgICYjLCwoKCwsNzc1NzdAQEBAQEBAQEBA/8AAEQgAyACgAwEiAAIRAQMRAf/EALAAAAEFAQEAAAAAAAAAAAAAAAQAAgMFBgcBAQEAAwEBAAAAAAAAAAAAAAAAAQMEAgUQAAIBAgIEBwoLBgQGAwAAAAECAwAEEQUhMRIGQVFxsTITFGGBwdEiQlKSMzWRoeFicqKyI1NzFYJjJDQWB9KjVCbxwkNkJWXik3QRAAIBAgMFBQcDBQEAAAAAAAABAhEDIRIEMUFRcTJhwVIUBZGhsSJyEzOB0ULhYpIjUxX/2gAMAwEAAhEDEQA/AMJSpUqAVKlXuFAeUq9wpUB5XuFe4V6ooDzZHDox0CnGMinzwl7Z8NajaHeoO3vmTBZBtp9YUIqTEV5ROxHKnWRnaU8VRMhFBUjpV7hSoSeUq9pUB5Sr2lhQHlKvcK8oBV7hSFSRrtaKAZs07YNPM1pG2xJIAw1jSeandry/8X4m8VCKkWwaWwam7Xl/4v1W8VLtmX/i/VbxUoKkWwakSM407tmX/i/VbxUmzGwjQsjdY41IARie/U0IbZO0kNtCXnOCkEBeFu4KI3Bs7DNb27ya+jDx3kJeEnpJJEcQVbWDsk17u5urd591ucZkWhym2Vnd9RkCDEpFxDRpbw0bunu5mlp2De2FMLYXOD2wB2xbOeraUcYGJ72mlSUiqzzdzMd3Z3mixltA2yzcK/NlHM1DQyRXce1HocdNOEfJXZ88y9ZojOqhiBszIRiHQ8Y4cK5TvHuzLljHNMqxNoDjLFraHHnjPxcNCGVbxEUzYNTx5jZSxhpW6qTzlwJ+DCvO2Zf+L9VvFSgqyHYNLYNTdssPxfibxUu15f8Ai/VPiqCakOwa82DU/a8v/F+JvFTDdWPBL8R8VKCvYRYV5UzoMAy6QdIIqI0B4KJtxiRQwou16QoGUkntH5Tz0RbZbmF2hktraSVBo2lUkY8tDye0flPPXTslVUyiyVRsjqUOA4yMT8dW2ram2m6UVTNq9S7EIyUVJydMTn/6DnP+im9Wl+g5z/opvVrpteEhQWY4AaSTwAVf5WPiZh/9S5/zj7zltzlmYWkfWXNvJDGTgGcYDHirR7i7mSbwXParsFMrgb7w6jKw/wCmnc9I14kF3vpvCljbMyWMOJL4aEiB8qU/ObUK7HYWVrl1pFZWiCOCBQqKOLjPGTrNZZqKbUXVHq2nNwTuJRk1VpbgXN8s7Rk5ym0UQQzhIG2NAjhxHWbI+gCBVjBBFbwxwQqEiiUJGg1BVGAFe7dV28WYLYZFmF2Th1UD7JGjymGyn1iK5OyzIBGB1HgrLZhamzumQAGJwSqnSCh1q3GOCodxt4cxurdcpzuN4cyhiWaF5Bg09udUmnWw1H/jV9nFuJ7Quo+8h8peThFA+047vduyMtk7fYqTl07YFdfUufMPzT5p71UdtlmYXaGS2t3mQHAsgxANdadYJopLe4QS2867EsZ4QfCNYrCFbjdDPmgkYyWFxgVf04ifJf6ScNdRUW1XBb6FU5TjF5EpSSrGu/s5lN+g5z/opvVpfoOc/wCim9WtdHnatvObJXDW7xLGhB8nrPaY9/HCr+tEdPCVaSeDoYLnqF63lzW4/PFSW3ecxbI84VSzWUwUaSdg0DXXK5nvAipnd6qgKvWnQO7pri9ZUEmm3Vl2j1kr8pRlFRyquBNZjGxQ/S56Y1S2fu9OVueon11Szahoou06QoQUXadIVCD2FJJ7R+U89dMydv8Axdn+TH9muZye0flPPXQstlK5Tbka1gUjlC1q0vVLkeb6r+O3Tx9xcY1nt8c0NrZCyiOE1108NYjGv1joo7Js1jzKyScYLIvkzL6LDwHXVJksH9Sb49dKNq0tj1jA6uriOCL+02FWX7iVtZX1/AzaHTyeoauKn2MX9W79zebiZCuR5MjSrhfXuEtwTrUeZH+yNfdrRNcxI6IzhXlJEak6WIGJ2Rw4ChWnChndtlVBLMdQA0k1gbXNMzzDfDLs6mjaPKppJbWwJ1bOwwxw43OnHh71YT3DpfWUJmFlb5jHHDdeXBHIsrRea5TSqvxqG04cNN62vetoCS4tre5mgnkGE9q+3DKOkuI2WX6LDQRRHWDh1UCtwj7QRg2wdl8Djgw1qe7XvW0BQ3kfZ7mSLgU+T9E6RVbnuVrnWVSWqj+Lt8ZbRuHEdKPkYVcZ2MJY5fSGyeVar45+rkWQHAqccalPE5km1htWK5nK4Wnt5FuUBUwOMG4nGkA/BXUrW4S6torlOjMgcd/xVn7rLo7zKs0uEjCNeSvdwoBhgsZxX1l2j36k3Lu+uyprdj5Vs5A+i/lD48a0aaVJOPi7jB6lbzWozpjB48pf1NDXNN4vfl7+Z4BXS65pvF78vfzPAK71XTHmZ/S/yT+jvJ7L3fHytz1E+upbL+Qj5W56jfXWRnsIYKLtekKEFGWvSFQgyjk9o/Keet3YthlMP/5x9msJJ7R+U89biyb/AMXEv7gD6tadL1T+kwepRrC39ZkLDMbiwMvUHRPG0bjlGg8ore/23sxBldxfMPLupNhT8yL/AORNZbdzJ484scytxgLqJY5LZj6Q2sV5G1Vud1mjjyG0ij0NEGSZToKyhjtqw4waztuiXA3qKTbSxltfGhbZlE95ZtZqxVbgiOZhrER9ph3Svk9+pJILZ4Y4DGBFCUMKjRsGPobPFhUfW0NJmljE2xJcIrcI2vFUEln1lRXd6lrazXT9GCNpD+yNqoI7mOVduNw6nzlOIoPOUa6yye1XXcbMR5GdQ3xY0BSbj31/FcTQZirJ+q431q7anbHCTZ72Bw7lbPrKBMcBWNNgbMBBh+bsjBdni0VJ1lARZs6yWiupxCuMDy6KpS2IwOo6DTr3Mre3e5tZZVUM4ZBjqOOJoWO4jkXajcOOMHGgDISvWIrdAkKR80+TzVl908bPPL3LzxOuHdifxVfiTAg92qI/w+/8gGgSyN/mR7XPVlp0lF/3L3mbVKtu5Hjbk/8AHE2Fc03i9+Xv5ngFdKNc13i9+Xv5ngFaNV0x5nn+l/kn9HeEWXu+PlbnqJ9dS2Xu9OVueon11kZ7CGCjLXpCgxRlr0hUIPYUcntH5Tz1s8vb+Bt1/dqPirGSe0flPPWusG/g4Py15q06XqlyMWvVYQ+ruI9xJOqzO9hOto/sP8tbGOFIrmWeM7IuMDMnAXXQJOUjQeOsJk0nY96ip0CYunrjaHx1t+srPJUbXBm2LrFPikwTOb+T+VhbZxGMrDXp83x1QSy2tucJpUjPETp+Cn5/ftaRvKvtp3Kx48HG3erHMzOxZiWZtLMdJNQSbbL71Vk6yynViOkqnEEfOWtPbXi3EQkGg6mXiNckjeSJxJGxR10qw0GtxuxmvbImD4CZMFlA4fRfv0BqesqqzTMZNMEDbIHtHH2QeCiZJSqMQdOGiue53mz3czQwsRbIcNHnkec3c4qAMuriz68gTIToxwOOnlp0MjxMJYW741Gs3RVldtbygE/dMcHX/moDaxTiWNZB53B3arb8/wC+4SOF4sf/AKxU9kcBsfOGHfoUHtG/RbzY5Die5HHhXdvavqiZ9Q8Jdlq4/gbKua7xe/L38zwCuhpf2Uk/Zo50kmwJKIdogDjw1VzzeL35e/meAVp1LTgqY4nn+mRauzqmqwrjzCLL3fHytz1E+upLL+Qj5W56jfXWRnroYKLtekKEFF2vSFQg9hSSe0flPPWosm/hIfoLzVl5PaPynnrRWb/w0X0F5q06XqlyM2sVYx5gmbFre/t71NY2T+0h8VbSO5SWNJUOKSAMp7jDGspmMPaLRlXS6eWve1/FRO7WYdbZm1Y/eW/R7qHxHRXGojlm3ulid6aVbaW+OALvgCLq2Hm9WxHKWqjhj6xsK1e8dm15l4niG1LZkswGsxtrPeOmsvayBJA1VItlWjptLuTdPMo7LtjRDq9naK4+WF9IrUW7BaHOljGqVHB7w2hzVoZt87d8vaNYSLl02CcRsDEbJbj71Uu7UBkvJ7/D7q2QoDxySaAO8MTXdxRVMpRp5XZOWdF/ms7R5XdyKfKWJsO/5PhrG5XlNxmEywW6bTnTxAAcJNbGSMXkM1pjgbiNo1PziPJ+Os7u7m/6ReM00ZOgxSpqYYHT3wRXMKN4ll9zUG4bQfNshu8sZVuEA2hirA4qe/VOwwrVbzbww5mI44UKRRYkbWG0S3JWctbd7u5WFfOOLHiUdJqmaipfLsIsObhWe001lMkMVvJNjhghIALMcBxCs7fxXQmkupx1bXDswGPlaTidVaEyKNXkoo4eBV+Sq7L7Vs9zcBgeyQ4GQ/MB1crmoim2orezqcowTuSeEY48jQ7oZX2PLzdyLhNd6RjrEY6I7+uspvH78vfzPAK6UAAAFGAGgAcArmu8Xvy9/M8ArTfio24RW5nnaG67uou3H/KPuqT2X8hHytz1G+upLL3enK3PUb66ys9RDBRdr0hQgou06QqEGUkntH5Tz1e238vF9BeaqKT2j8p56vbb+Xi+gvNWjTdUuRn1XTHmTh8KrJTJlt8t1CPIY44cGnpJVjTJYkmjaN9Ib4u7V923njTethRauZJV3PaW1rfLIiXEDYg6R4VYc9CXW7thfOZbKdbGZtLW8uPVY/u3GrkNUkM9zlcxUjbhfWOA90cRq4gv4LhdqN+VToNYWmnRm9NNVWNTyHc6VWBv8wt4YeHqm6xyPmroq1Z7WGFLSxTq7WLSuPSdjrkfumq5yHXDUeA92oO2SKpVumNAaoJLMXH3myp0rpJ4uKhc3tbDM5BMri1zAj79j7KTiY8TcdBpcsith0286o+sPCagEX9Pzg4zXUCp6QYse8oouCG3tk6m1BYv05W6T+IdyolxbHDAAa2OgDlNCz3ryN2WxBd5PJMg1t81eId2ukqnLlTBbfcuY+9uJLiRcvtPvHdsHK+cfRHcHDWsyawjyy0WBcDI3lTP6TeIcFV+S5OmXx9bJg1048o8Cj0V8Jq2DVu09nL80up7OxHi+oal3P8AXB/IsZS8T/YOV65zvCcc7vfzPAK3ivWCz445zeH954BXOr6I8yfSfyz+jvCLP3fHytz1G+upLP3fHytz1E+usbPaQ0UXadIUIKLtekKhB7Ckk9o/Keer22/l4/oLzVRSe0flPPV7b/y8X0F5q0abqlyM+q6Y8yQsBTDMor1o8aiaE1pbluMqS3sbLLHIhSRQyngqukhaJ9uBjo+H5aOa3ao2t34qouRlLajTalGP8v0IY8ylXQ+PKPFU/bYXOLPge6CKia0LaxTOxHu1Q7cuBd9yPEJ7TbjXKO8CajbMIF6CNIeNvJHjqIWJ7tSpYkalqVblwIdyG+RGXur0hXYJFxal+Dhq5y3slkv3Y2pD0pTr+QUClpJRUdo9XW4OLrTHtM16cZLLWkeC7y4jvlNEpcRtw1Ux27Ci448NZrTFy3nn3IQWxlgGrDZ3pza7/M8ArZo+ArF5171uvp+CqdV0R5l/psUrs2vB3hdl7vTlbnqJ9dS2Xu+PlbnqJ9dY2eshooq16QoQUXa9IVCD2FLJ7RuU89WNtmUSQqkgYMgw0accKrpPaPynnrZWG4Vi+VWmY5tnMWXG+XrIYnA0rhj0mdcTgdNdwnKDqjmduM1SRR/qlr8/4KX6pa8T/BVzDuLZXudRZblmbxXcPUNPc3KqCIwrbOzgrHEnHjoyD+3eSXkht7DeKG4umDGOJVUklfouThXfmbnZ7Cvy1vt9pmv1W1+d8FL9VteJvgq5yrcOGfLmzHN80iyyETPbptAEFo2ZG8pmUa1OFNn3Ky6W/sbDKM5hv5bx2WTZA+7RF2y52WOPJTzE+z2Dy1vt9pT/AKpacTerS/U7Tib1a04/t7kDXPY03jhN0W6sQ7K7W3q2dnrMccaDy/8At80kuZfqWYxWNtlcvUPPhiGYhWDeUy7IwYU8xPs9g8tb7faUn6pacTerTxm9oOBvVq3v9z927aynuId44LiWKNnjhAXF2UYhRg516qpsryjLr21665zFLSTaK9U2GOA87SwqY37knRU+BzOzags0s1Oyr+BKM6sxwP6tSDPLMen6vy0rvdm3Sxlu7K/S7WDDrFUDUTxgnTU826eXW7KlxmqQuwDBXUKcD+1Xee/wXuKX5XDGWLapSVcOyhEM/seJ/V+WnjeGx4pPV+Wkm6kKZlFay3Jlt7iFpYZY8ASVK6DjtDDA0f8A0Tl340/1f8Ndx8xJVWXB0KbktFFpNzdVXAC/qOwA0CQni2flrO3Vwbm5lnI2TKxbDirX/wBE5d+NcfV/wVR7xZPa5U9utvI8nWhmbbw0YEAYYAVxfhfy5rlKR4Fulu6X7mW1mzT8S4Yis/5CPlbnqJ9dSWfu9OVueon11mZvQ2i7XpChKKtekKhBlNJ7R+U89bDfGTb3a3ZX0Lcj6kdY+T2j8p560288m1kWQr6MJ+ylSAr+2cnV5renjs3H1loX+3j9XvbbtxLN9lqW4UnV5jdnjtXHxihtyZNjeSBu5J9k1BJe7xy7W5CJ/wCzuD/mTVTf2+fq97LJuLrPsNRueS7W6aJ/38x+vLVXuY+xvHaNxbf2GoCezf8A36j/APsSf8w1sLnqczTefJluYoLm5uo5F61sBshItP1cNFYe1f8A3ir/APfE/wCZUe9bB94r5jwuPsrQFhmG4l/Z2M17HdW90tuu3IkTHaCjWdIw0VVZdks9/C06yJFEp2dp+E1bbqybGTZ8vpQD7L1XRv8A7blT96Oda7tpNuuNE37Cq9KSisjyuUoxrStKllHbLlWTXsMs8chuSuwEPDqwoLe5y+YRE/gLzmqRekvKKtd4327yM/ulHxmrHJStySWVRyrjxKI2XC/CTlnlPPKTpTdFbP0L1bgrf5Lp0G3dPhQHwV0S1lzBsns3sESR8Crh9WAJGjSOKuU3E+zdZQ3oJh8IArdZXFDmOTpHa3i2+YrI2KtKy4ricBsBuHHgFXSo440+Wa2qqxjvM9uMoy+WvzWpLCWWWE28HxL6e43ojgkeSCBY1Ri5BGIUDT51cl3vm276BBqSEH4WbxV0tlkyXJcxTMb+OW6uY9mGHrCzDQwwAbTp2uKuTZ9N1uYsfRRR8WPhrm419mSSjRyiqxVK7y23B/ftuTm2oSdJyzNVw3BFn7vTlbnqF9dS2fu9OVueon11lZuQ2iLdsGFD05H2dNQGV0ntG5Tz1dWm9N1b2kVq8EVwsI2UaQaQOKhmitZGLOmk68DhSFvY+gfWNSAg7z3Qvo7yKCKIohiaNR5LKxx8qpxvjcqS0VpbxvwOAcRQPZ7D0G9Y0uz2HoH1jUCpLY7zXlpbm3eKO5QuzjrBqZji3x17PvNcyT288VvDBJbMWUovS2hslW7mFQ9nsPQPrGl2ew9A+saCod/WNxtbYsrfb17WBxx5ddD2281xC88klvDcSXEnWuzrqOGGC9zRUPZ7D0G9Y0uzWHoH1jQVCLreq6ntZbaO3it1mGy7RjTs1X2mYy20ZiCq8ZOODcdEdmsPQb1jS7PYegfWNdJuLqnQiSUlRqpFLmryxtH1Ma7Qw2gNNPOdSt0oI27p007s9h6B9Y0uz2HoH1jXX3Z+I4+1b8IJdX89xLHKQFMXQUahpxoiPN5P+onfU+A0/s9h6DesaXZ7D0D6xpG7OLbUtu0StW5JJx2bBsmbtiSiEk+cxoCWWSaVpZOk2vDVo0VYdnsPQb1jSNvZcCH1jSd2c+p1XAmFqEOmOPEfaH+BQd1ueo211IzrgFUYKNAAqI1WztCpUqVCRUqVKgFSpUqAVKlSoBUqVKgFSpUqAVKlSoBUqVKgFSpUqAVKlSoD/9k=";
cc.loader.loadBinary = function (url, cb) {
    var self = this;
    var xhr = this.getXMLHttpRequest(),
        errInfo = "load " + url + " failed!";
    xhr.open("GET", url, true);
    if (cc.loader.loadBinary._IEFilter) {
        xhr.setRequestHeader("Accept-Charset", "x-user-defined");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var fileContents = cc._convertResponseBodyToText(xhr["responseBody"]);
                cb(null, self._str2Uint8Array(fileContents));
            } else cb(errInfo);
        };
    } else {
        if (xhr.overrideMimeType) xhr.overrideMimeType("text\/plain; charset=x-user-defined");
        xhr.onload = function () {
            xhr.readyState === 4 && xhr.status === 200 ? cb(null, self._str2Uint8Array(xhr.responseText)) : cb(errInfo);
        };
    }
    xhr.send(null);
};
cc.loader.loadBinary._IEFilter = (/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent) && window.IEBinaryToArray_ByteStr && window.IEBinaryToArray_ByteStr_Last);
cc.loader._str2Uint8Array = function (strData) {
    if (!strData)
        return null;
    var arrData = new Uint8Array(strData.length);
    for (var i = 0; i < strData.length; i++) {
        arrData[i] = strData.charCodeAt(i) & 0xff;
    }
    return arrData;
};
cc.loader.loadBinarySync = function (url) {
    var self = this;
    var req = this.getXMLHttpRequest();
    var errInfo = "load " + url + " failed!";
    req.open('GET', url, false);
    var arrayInfo = null;
    if (cc.loader.loadBinary._IEFilter) {
        req.setRequestHeader("Accept-Charset", "x-user-defined");
        req.send(null);
        if (req.status !== 200) {
            cc.log(errInfo);
            return null;
        }
        var fileContents = cc._convertResponseBodyToText(req["responseBody"]);
        if (fileContents) {
            arrayInfo = self._str2Uint8Array(fileContents);
        }
    } else {
        if (req.overrideMimeType)
            req.overrideMimeType('text\/plain; charset=x-user-defined');
        req.send(null);
        if (req.status !== 200) {
            cc.log(errInfo);
            return null;
        }
        arrayInfo = this._str2Uint8Array(req.responseText);
    }
    return arrayInfo;
};
window.Uint8Array = window.Uint8Array || window.Array;
if (cc.loader.loadBinary._IEFilter) {
    var IEBinaryToArray_ByteStr_Script =
        "<!-- IEBinaryToArray_ByteStr -->\r\n" +
            "Function IEBinaryToArray_ByteStr(Binary)\r\n" +
            "   IEBinaryToArray_ByteStr = CStr(Binary)\r\n" +
            "End Function\r\n" +
            "Function IEBinaryToArray_ByteStr_Last(Binary)\r\n" +
            "   Dim lastIndex\r\n" +
            "   lastIndex = LenB(Binary)\r\n" +
            "   if lastIndex mod 2 Then\r\n" +
            "       IEBinaryToArray_ByteStr_Last = Chr( AscB( MidB( Binary, lastIndex, 1 ) ) )\r\n" +
            "   Else\r\n" +
            "       IEBinaryToArray_ByteStr_Last = " + '""' + "\r\n" +
            "   End If\r\n" +
            "End Function\r\n";// +
    var myVBScript = document.createElement('script');
    myVBScript.type = "text/vbscript";
    myVBScript.textContent = IEBinaryToArray_ByteStr_Script;
    document.body.appendChild(myVBScript);
    cc._convertResponseBodyToText = function (binary) {
        var byteMapping = {};
        for (var i = 0; i < 256; i++) {
            for (var j = 0; j < 256; j++) {
                byteMapping[ String.fromCharCode(i + j * 256) ] =
                    String.fromCharCode(i) + String.fromCharCode(j);
            }
        }
        var rawBytes = IEBinaryToArray_ByteStr(binary);
        var lastChr = IEBinaryToArray_ByteStr_Last(binary);
        return rawBytes.replace(/[\s\S]/g,
            function (match) {
                return byteMapping[match];
            }) + lastChr;
    };
}
var cc = cc || {};
var ClassManager = {
    id : (0|(Math.random()*998)),
    instanceId : (0|(Math.random()*998)),
    getNewID : function(){
        return this.id++;
    },
    getNewInstanceId : function(){
        return this.instanceId++;
    }
};
(function () {
    var fnTest = /\b_super\b/;
    cc.Class = function () {
    };
    cc.Class.extend = function (props) {
        var _super = this.prototype;
        var prototype = Object.create(_super);
        var classId = ClassManager.getNewID();
        ClassManager[classId] = _super;
        var desc = { writable: true, enumerable: false, configurable: true };
	    prototype.__instanceId = null;
	    function Class() {
		    this.__instanceId = ClassManager.getNewInstanceId();
		    if (this.ctor)
			    this.ctor.apply(this, arguments);
	    }
	    Class.id = classId;
	    desc.value = classId;
	    Object.defineProperty(prototype, '__pid', desc);
	    Class.prototype = prototype;
	    desc.value = Class;
	    Object.defineProperty(Class.prototype, 'constructor', desc);
	    this.__getters__ && (Class.__getters__ = cc.clone(this.__getters__));
	    this.__setters__ && (Class.__setters__ = cc.clone(this.__setters__));
        for(var idx = 0, li = arguments.length; idx < li; ++idx) {
            var prop = arguments[idx];
            for (var name in prop) {
                var isFunc = (typeof prop[name] === "function");
                var override = (typeof _super[name] === "function");
                var hasSuperCall = fnTest.test(prop[name]);
                if (isFunc && override && hasSuperCall) {
                    desc.value = (function (name, fn) {
                        return function () {
                            var tmp = this._super;
                            this._super = _super[name];
                            var ret = fn.apply(this, arguments);
                            this._super = tmp;
                            return ret;
                        };
                    })(name, prop[name]);
                    Object.defineProperty(prototype, name, desc);
                } else if (isFunc) {
                    desc.value = prop[name];
                    Object.defineProperty(prototype, name, desc);
                } else {
                    prototype[name] = prop[name];
                }
                if (isFunc) {
                    var getter, setter, propertyName;
                    if (this.__getters__ && this.__getters__[name]) {
                        propertyName = this.__getters__[name];
                        for (var i in this.__setters__) {
                            if (this.__setters__[i] === propertyName) {
                                setter = i;
                                break;
                            }
                        }
                        cc.defineGetterSetter(prototype, propertyName, prop[name], prop[setter] ? prop[setter] : prototype[setter], name, setter);
                    }
                    if (this.__setters__ && this.__setters__[name]) {
                        propertyName = this.__setters__[name];
                        for (var i in this.__getters__) {
                            if (this.__getters__[i] === propertyName) {
                                getter = i;
                                break;
                            }
                        }
                        cc.defineGetterSetter(prototype, propertyName, prop[getter] ? prop[getter] : prototype[getter], prop[name], getter, name);
                    }
                }
            }
        }
        Class.extend = cc.Class.extend;
        Class.implement = function (prop) {
            for (var name in prop) {
                prototype[name] = prop[name];
            }
        };
        return Class;
    };
})();
cc.defineGetterSetter = function (proto, prop, getter, setter, getterName, setterName){
    if (proto.__defineGetter__) {
        getter && proto.__defineGetter__(prop, getter);
        setter && proto.__defineSetter__(prop, setter);
    } else if (Object.defineProperty) {
        var desc = { enumerable: false, configurable: true };
        getter && (desc.get = getter);
        setter && (desc.set = setter);
        Object.defineProperty(proto, prop, desc);
    } else {
        throw new Error("browser does not support getters");
    }
    if(!getterName && !setterName) {
        var hasGetter = (getter != null), hasSetter = (setter != undefined), props = Object.getOwnPropertyNames(proto);
        for (var i = 0; i < props.length; i++) {
            var name = props[i];
            if( (proto.__lookupGetter__ ? proto.__lookupGetter__(name)
                                        : Object.getOwnPropertyDescriptor(proto, name))
                || typeof proto[name] !== "function" )
                continue;
            var func = proto[name];
            if (hasGetter && func === getter) {
                getterName = name;
                if(!hasSetter || setterName) break;
            }
            if (hasSetter && func === setter) {
                setterName = name;
                if(!hasGetter || getterName) break;
            }
        }
    }
    var ctor = proto.constructor;
    if (getterName) {
        if (!ctor.__getters__) {
            ctor.__getters__ = {};
        }
        ctor.__getters__[getterName] = prop;
    }
    if (setterName) {
        if (!ctor.__setters__) {
            ctor.__setters__ = {};
        }
        ctor.__setters__[setterName] = prop;
    }
};
cc.clone = function (obj) {
    var newObj = (obj.constructor) ? new obj.constructor : {};
    for (var key in obj) {
        var copy = obj[key];
        if (((typeof copy) === "object") && copy &&
            !(copy instanceof cc.Node) && !(copy instanceof HTMLElement)) {
            newObj[key] = cc.clone(copy);
        } else {
            newObj[key] = copy;
        }
    }
    return newObj;
};
cc.inject = function(srcPrototype, destPrototype){
    for(var key in srcPrototype)
        destPrototype[key] = srcPrototype[key];
};
cc.Point = function (x, y) {
    this.x = x || 0;
    this.y = y || 0;
};
cc.p = function (x, y) {
    if (x === undefined)
        return {x: 0, y: 0};
    if (y === undefined)
        return {x: x.x, y: x.y};
    return {x: x, y: y};
};
cc.pointEqualToPoint = function (point1, point2) {
    return point1 && point2 && (point1.x === point2.x) && (point1.y === point2.y);
};
cc.Size = function (width, height) {
    this.width = width || 0;
    this.height = height || 0;
};
cc.size = function (w, h) {
    if (w === undefined)
        return {width: 0, height: 0};
    if (h === undefined)
        return {width: w.width, height: w.height};
    return {width: w, height: h};
};
cc.sizeEqualToSize = function (size1, size2) {
    return (size1 && size2 && (size1.width === size2.width) && (size1.height === size2.height));
};
cc.Rect = function (x, y, width, height) {
    this.x = x||0;
    this.y = y||0;
    this.width = width||0;
    this.height = height||0;
};
cc.rect = function (x, y, w, h) {
    if (x === undefined)
        return {x: 0, y: 0, width: 0, height: 0};
    if (y === undefined)
        return {x: x.x, y: x.y, width: x.width, height: x.height};
    return {x: x, y: y, width: w, height: h };
};
cc.rectEqualToRect = function (rect1, rect2) {
    return rect1 && rect2 && (rect1.x === rect2.x) && (rect1.y === rect2.y) && (rect1.width === rect2.width) && (rect1.height === rect2.height);
};
cc._rectEqualToZero = function(rect){
    return rect && (rect.x === 0) && (rect.y === 0) && (rect.width === 0) && (rect.height === 0);
};
cc.rectContainsRect = function (rect1, rect2) {
    if (!rect1 || !rect2)
        return false;
    return !((rect1.x >= rect2.x) || (rect1.y >= rect2.y) ||
        ( rect1.x + rect1.width <= rect2.x + rect2.width) ||
        ( rect1.y + rect1.height <= rect2.y + rect2.height));
};
cc.rectGetMaxX = function (rect) {
    return (rect.x + rect.width);
};
cc.rectGetMidX = function (rect) {
    return (rect.x + rect.width / 2.0);
};
cc.rectGetMinX = function (rect) {
    return rect.x;
};
cc.rectGetMaxY = function (rect) {
    return(rect.y + rect.height);
};
cc.rectGetMidY = function (rect) {
    return rect.y + rect.height / 2.0;
};
cc.rectGetMinY = function (rect) {
    return rect.y;
};
cc.rectContainsPoint = function (rect, point) {
    return (point.x >= cc.rectGetMinX(rect) && point.x <= cc.rectGetMaxX(rect) &&
        point.y >= cc.rectGetMinY(rect) && point.y <= cc.rectGetMaxY(rect)) ;
};
cc.rectIntersectsRect = function (ra, rb) {
    var maxax = ra.x + ra.width,
        maxay = ra.y + ra.height,
        maxbx = rb.x + rb.width,
        maxby = rb.y + rb.height;
    return !(maxax < rb.x || maxbx < ra.x || maxay < rb.y || maxby < ra.y);
};
cc.rectOverlapsRect = function (rectA, rectB) {
    return !((rectA.x + rectA.width < rectB.x) ||
        (rectB.x + rectB.width < rectA.x) ||
        (rectA.y + rectA.height < rectB.y) ||
        (rectB.y + rectB.height < rectA.y));
};
cc.rectUnion = function (rectA, rectB) {
    var rect = cc.rect(0, 0, 0, 0);
    rect.x = Math.min(rectA.x, rectB.x);
    rect.y = Math.min(rectA.y, rectB.y);
    rect.width = Math.max(rectA.x + rectA.width, rectB.x + rectB.width) - rect.x;
    rect.height = Math.max(rectA.y + rectA.height, rectB.y + rectB.height) - rect.y;
    return rect;
};
cc.rectIntersection = function (rectA, rectB) {
    var intersection = cc.rect(
        Math.max(cc.rectGetMinX(rectA), cc.rectGetMinX(rectB)),
        Math.max(cc.rectGetMinY(rectA), cc.rectGetMinY(rectB)),
        0, 0);
    intersection.width = Math.min(cc.rectGetMaxX(rectA), cc.rectGetMaxX(rectB)) - cc.rectGetMinX(intersection);
    intersection.height = Math.min(cc.rectGetMaxY(rectA), cc.rectGetMaxY(rectB)) - cc.rectGetMinY(intersection);
    return intersection;
};
cc.SAXParser = cc.Class.extend({
    _parser: null,
    _isSupportDOMParser: null,
    ctor: function () {
        if (window.DOMParser) {
            this._isSupportDOMParser = true;
            this._parser = new DOMParser();
        } else {
            this._isSupportDOMParser = false;
        }
    },
    parse : function(xmlTxt){
        return this._parseXML(xmlTxt);
    },
    _parseXML: function (textxml) {
        var xmlDoc;
        if (this._isSupportDOMParser) {
            xmlDoc = this._parser.parseFromString(textxml, "text/xml");
        } else {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(textxml);
        }
        return xmlDoc;
    }
});
cc.PlistParser = cc.SAXParser.extend({
    parse : function (xmlTxt) {
        var xmlDoc = this._parseXML(xmlTxt);
        var plist = xmlDoc.documentElement;
        if (plist.tagName !== 'plist') {
            cc.warn("Not a plist file!");
            return {};
        }
        var node = null;
        for (var i = 0, len = plist.childNodes.length; i < len; i++) {
            node = plist.childNodes[i];
            if (node.nodeType === 1)
                break;
        }
        xmlDoc = null;
        return this._parseNode(node);
    },
    _parseNode: function (node) {
        var data = null, tagName = node.tagName;
        if(tagName === "dict"){
            data = this._parseDict(node);
        }else if(tagName === "array"){
            data = this._parseArray(node);
        }else if(tagName === "string"){
            if (node.childNodes.length === 1)
                data = node.firstChild.nodeValue;
            else {
                data = "";
                for (var i = 0; i < node.childNodes.length; i++)
                    data += node.childNodes[i].nodeValue;
            }
        }else if(tagName === "false"){
            data = false;
        }else if(tagName === "true"){
            data = true;
        }else if(tagName === "real"){
            data = parseFloat(node.firstChild.nodeValue);
        }else if(tagName === "integer"){
            data = parseInt(node.firstChild.nodeValue, 10);
        }
        return data;
    },
    _parseArray: function (node) {
        var data = [];
        for (var i = 0, len = node.childNodes.length; i < len; i++) {
            var child = node.childNodes[i];
            if (child.nodeType !== 1)
                continue;
            data.push(this._parseNode(child));
        }
        return data;
    },
    _parseDict: function (node) {
        var data = {};
        var key = null;
        for (var i = 0, len = node.childNodes.length; i < len; i++) {
            var child = node.childNodes[i];
            if (child.nodeType !== 1)
                continue;
            if (child.tagName === 'key')
                key = child.firstChild.nodeValue;
            else
                data[key] = this._parseNode(child);
        }
        return data;
    }
});
cc.saxParser = new cc.SAXParser();
cc.plistParser = new cc.PlistParser();
cc._txtLoader = {
    load : function(realUrl, url, res, cb){
        cc.loader.loadTxt(realUrl, cb);
    }
};
cc.loader.register(["txt", "xml", "vsh", "fsh", "atlas"], cc._txtLoader);
cc._jsonLoader = {
    load : function(realUrl, url, res, cb){
        cc.loader.loadJson(realUrl, cb);
    }
};
cc.loader.register(["json", "ExportJson"], cc._jsonLoader);
cc._jsLoader = {
    load : function(realUrl, url, res, cb){
        cc.loader.loadJs(realUrl, cb);
    }
};
cc.loader.register(["js"], cc._jsLoader);
cc._imgLoader = {
    load : function(realUrl, url, res, cb){
        var callback;
        if (cc.loader.isLoading(realUrl)) {
            callback = cb;
        }
        else {
            callback = function(err, img){
                if(err)
                    return cb(err);
                cc.loader.cache[url] = img;
                cc.textureCache.handleLoadedTexture(url);
                cb(null, img);
            };
        }
        cc.loader.loadImg(realUrl, callback);
    }
};
cc.loader.register(["png", "jpg", "bmp","jpeg","gif", "ico", "tiff", "webp"], cc._imgLoader);
cc._serverImgLoader = {
    load : function(realUrl, url, res, cb){
        cc._imgLoader.load(res.src, url, res, cb);
    }
};
cc.loader.register(["serverImg"], cc._serverImgLoader);
cc._plistLoader = {
    load : function(realUrl, url, res, cb){
        cc.loader.loadTxt(realUrl, function(err, txt){
            if(err)
                return cb(err);
            cb(null, cc.plistParser.parse(txt));
        });
    }
};
cc.loader.register(["plist"], cc._plistLoader);
cc._fontLoader = {
    TYPE : {
        ".eot" : "embedded-opentype",
        ".ttf" : "truetype",
        ".ttc" : "truetype",
        ".woff" : "woff",
        ".svg" : "svg"
    },
    _loadFont : function(name, srcs, type){
        var doc = document, path = cc.path, TYPE = this.TYPE, fontStyle = document.createElement("style");
        fontStyle.type = "text/css";
        doc.body.appendChild(fontStyle);
        var fontStr = "";
        if(isNaN(name - 0))
            fontStr += "@font-face { font-family:" + name + "; src:";
        else
            fontStr += "@font-face { font-family:'" + name + "'; src:";
        if(srcs instanceof Array){
            for(var i = 0, li = srcs.length; i < li; i++){
                var src = srcs[i];
                type = path.extname(src).toLowerCase();
                fontStr += "url('" + srcs[i] + "') format('" + TYPE[type] + "')";
                fontStr += (i === li - 1) ? ";" : ",";
            }
        }else{
            type = type.toLowerCase();
            fontStr += "url('" + srcs + "') format('" + TYPE[type] + "');";
        }
        fontStyle.textContent += fontStr + "}";
        var preloadDiv = document.createElement("div");
        var _divStyle =  preloadDiv.style;
        _divStyle.fontFamily = name;
        preloadDiv.innerHTML = ".";
        _divStyle.position = "absolute";
        _divStyle.left = "-100px";
        _divStyle.top = "-100px";
        doc.body.appendChild(preloadDiv);
    },
    load : function(realUrl, url, res, cb){
        var self = this;
        var type = res.type, name = res.name, srcs = res.srcs;
        if(cc.isString(res)){
            type = cc.path.extname(res);
            name = cc.path.basename(res, type);
            self._loadFont(name, res, type);
        }else{
            self._loadFont(name, srcs);
        }
        if(document.fonts){
            document.fonts.load("1em " + name).then(function(){
                cb(null, true);
            }, function(err){
                cb(err);
            });
        }else{
            cb(null, true);
        }
    }
};
cc.loader.register(["font", "eot", "ttf", "woff", "svg", "ttc"], cc._fontLoader);
cc._binaryLoader = {
    load : function(realUrl, url, res, cb){
        cc.loader.loadBinary(realUrl, cb);
    }
};
cc._csbLoader = {
    load: function(realUrl, url, res, cb){
        cc.loader.loadCsb(realUrl, cb);
    }
};
cc.loader.register(["csb"], cc._csbLoader);
window["CocosEngine"] = cc.ENGINE_VERSION = "Cocos2d-JS v3.13";
cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL = 0;
cc.DIRECTOR_STATS_POSITION = cc.p(0, 0);
cc.DIRECTOR_FPS_INTERVAL = 0.5;
cc.COCOSNODE_RENDER_SUBPIXEL = 1;
cc.SPRITEBATCHNODE_RENDER_SUBPIXEL = 1;
cc.OPTIMIZE_BLEND_FUNC_FOR_PREMULTIPLIED_ALPHA = 1;
cc.TEXTURE_ATLAS_USE_TRIANGLE_STRIP = 0;
cc.TEXTURE_ATLAS_USE_VAO = 0;
cc.TEXTURE_NPOT_SUPPORT = 0;
cc.RETINA_DISPLAY_SUPPORT = 1;
cc.RETINA_DISPLAY_FILENAME_SUFFIX = "-hd";
cc.USE_LA88_LABELS = 1;
cc.SPRITE_DEBUG_DRAW = 0;
cc.SPRITEBATCHNODE_DEBUG_DRAW = 0;
cc.LABELBMFONT_DEBUG_DRAW = 0;
cc.LABELATLAS_DEBUG_DRAW = 0;
cc.IS_RETINA_DISPLAY_SUPPORTED = 1;
cc.DEFAULT_ENGINE = cc.ENGINE_VERSION + "-canvas";
cc.ENABLE_STACKABLE_ACTIONS = 1;
cc.ENABLE_GL_STATE_CACHE = 1;
cc.$ = function (x) {
    var parent = (this === cc) ? document : this;
    var el = (x instanceof HTMLElement) ? x : parent.querySelector(x);
    if (el) {
        el.find = el.find || cc.$;
        el.hasClass = el.hasClass || function (cls) {
            return this.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
        };
        el.addClass = el.addClass || function (cls) {
            if (!this.hasClass(cls)) {
                if (this.className) {
                    this.className += " ";
                }
                this.className += cls;
            }
            return this;
        };
        el.removeClass = el.removeClass || function (cls) {
            if (this.hasClass(cls)) {
                this.className = this.className.replace(cls, '');
            }
            return this;
        };
        el.remove = el.remove || function () {
            if (this.parentNode)
                this.parentNode.removeChild(this);
            return this;
        };
        el.appendTo = el.appendTo || function (x) {
            x.appendChild(this);
            return this;
        };
        el.prependTo = el.prependTo || function (x) {
            ( x.childNodes[0]) ? x.insertBefore(this, x.childNodes[0]) : x.appendChild(this);
            return this;
        };
        el.transforms = el.transforms || function () {
            this.style[cc.$.trans] = cc.$.translate(this.position) + cc.$.rotate(this.rotation) + cc.$.scale(this.scale) + cc.$.skew(this.skew);
            return this;
        };
        el.position = el.position || {x: 0, y: 0};
        el.rotation = el.rotation || 0;
        el.scale = el.scale || {x: 1, y: 1};
        el.skew = el.skew || {x: 0, y: 0};
        el.translates = function (x, y) {
            this.position.x = x;
            this.position.y = y;
            this.transforms();
            return this
        };
        el.rotate = function (x) {
            this.rotation = x;
            this.transforms();
            return this
        };
        el.resize = function (x, y) {
            this.scale.x = x;
            this.scale.y = y;
            this.transforms();
            return this
        };
        el.setSkew = function (x, y) {
            this.skew.x = x;
            this.skew.y = y;
            this.transforms();
            return this
        };
    }
    return el;
};
switch (cc.sys.browserType) {
    case cc.sys.BROWSER_TYPE_FIREFOX:
        cc.$.pfx = "Moz";
        cc.$.hd = true;
        break;
    case cc.sys.BROWSER_TYPE_CHROME:
    case cc.sys.BROWSER_TYPE_SAFARI:
        cc.$.pfx = "webkit";
        cc.$.hd = true;
        break;
    case cc.sys.BROWSER_TYPE_OPERA:
        cc.$.pfx = "O";
        cc.$.hd = false;
        break;
    case cc.sys.BROWSER_TYPE_IE:
        cc.$.pfx = "ms";
        cc.$.hd = false;
        break;
    default:
        cc.$.pfx = "webkit";
        cc.$.hd = true;
}
cc.$.trans = cc.$.pfx + "Transform";
cc.$.translate = (cc.$.hd) ? function (a) {
    return "translate3d(" + a.x + "px, " + a.y + "px, 0) "
} : function (a) {
    return "translate(" + a.x + "px, " + a.y + "px) "
};
cc.$.rotate = (cc.$.hd) ? function (a) {
    return "rotateZ(" + a + "deg) ";
} : function (a) {
    return "rotate(" + a + "deg) ";
};
cc.$.scale = function (a) {
    return "scale(" + a.x + ", " + a.y + ") "
};
cc.$.skew = function (a) {
    return "skewX(" + -a.x + "deg) skewY(" + a.y + "deg)";
};
cc.$new = function (x) {
    return cc.$(document.createElement(x))
};
cc.$.findpos = function (obj) {
    var curleft = 0;
    var curtop = 0;
    do {
        curleft += obj.offsetLeft;
        curtop += obj.offsetTop;
    } while (obj = obj.offsetParent);
    return {x: curleft, y: curtop};
};
cc.INVALID_INDEX = -1;
cc.PI = Math.PI;
cc.FLT_MAX = parseFloat('3.402823466e+38F');
cc.FLT_MIN = parseFloat("1.175494351e-38F");
cc.RAD = cc.PI / 180;
cc.DEG = 180 / cc.PI;
cc.UINT_MAX = 0xffffffff;
cc.swap = function (x, y, ref) {
    if (cc.isObject(ref) && !cc.isUndefined(ref.x) && !cc.isUndefined(ref.y)) {
        var tmp = ref[x];
        ref[x] = ref[y];
        ref[y] = tmp;
    } else
        cc.log(cc._LogInfos.swap);
};
cc.lerp = function (a, b, r) {
    return a + (b - a) * r;
};
cc.rand = function () {
	return Math.random() * 0xffffff;
};
cc.randomMinus1To1 = function () {
    return (Math.random() - 0.5) * 2;
};
cc.random0To1 = Math.random;
cc.degreesToRadians = function (angle) {
    return angle * cc.RAD;
};
cc.radiansToDegrees = function (angle) {
    return angle * cc.DEG;
};
cc.radiansToDegress = function (angle) {
    cc.log(cc._LogInfos.radiansToDegress);
    return angle * cc.DEG;
};
cc.REPEAT_FOREVER = Number.MAX_VALUE - 1;
cc.nodeDrawSetup = function (node) {
    if (node._shaderProgram) {
        node._shaderProgram.use();
        node._shaderProgram.setUniformForModelViewAndProjectionMatrixWithMat4();
    }
};
cc.enableDefaultGLStates = function () {
};
cc.disableDefaultGLStates = function () {
};
cc.incrementGLDraws = function (addNumber) {
    cc.g_NumberOfDraws += addNumber;
};
cc.FLT_EPSILON = 0.0000001192092896;
cc.contentScaleFactor = cc.IS_RETINA_DISPLAY_SUPPORTED ? function () {
    return cc.director.getContentScaleFactor();
} : function () {
    return 1;
};
cc.pointPointsToPixels = function (points) {
    var scale = cc.contentScaleFactor();
    return cc.p(points.x * scale, points.y * scale);
};
cc.pointPixelsToPoints = function (pixels) {
	var scale = cc.contentScaleFactor();
	return cc.p(pixels.x / scale, pixels.y / scale);
};
cc._pointPixelsToPointsOut = function(pixels, outPoint){
	var scale = cc.contentScaleFactor();
	outPoint.x = pixels.x / scale;
	outPoint.y = pixels.y / scale;
};
cc.sizePointsToPixels = function (sizeInPoints) {
    var scale = cc.contentScaleFactor();
    return cc.size(sizeInPoints.width * scale, sizeInPoints.height * scale);
};
cc.sizePixelsToPoints = function (sizeInPixels) {
    var scale = cc.contentScaleFactor();
    return cc.size(sizeInPixels.width / scale, sizeInPixels.height / scale);
};
cc._sizePixelsToPointsOut = function (sizeInPixels, outSize) {
    var scale = cc.contentScaleFactor();
    outSize.width = sizeInPixels.width / scale;
    outSize.height = sizeInPixels.height / scale;
};
cc.rectPixelsToPoints = cc.IS_RETINA_DISPLAY_SUPPORTED ? function (pixel) {
    var scale = cc.contentScaleFactor();
    return cc.rect(pixel.x / scale, pixel.y / scale,
        pixel.width / scale, pixel.height / scale);
} : function (p) {
    return p;
};
cc.rectPointsToPixels = cc.IS_RETINA_DISPLAY_SUPPORTED ? function (point) {
   var scale = cc.contentScaleFactor();
    return cc.rect(point.x * scale, point.y * scale,
        point.width * scale, point.height * scale);
} : function (p) {
    return p;
};
cc.ONE = 1;
cc.ZERO = 0;
cc.SRC_ALPHA = 0x0302;
cc.SRC_ALPHA_SATURATE = 0x308;
cc.SRC_COLOR = 0x300;
cc.DST_ALPHA = 0x304;
cc.DST_COLOR = 0x306;
cc.ONE_MINUS_SRC_ALPHA = 0x0303;
cc.ONE_MINUS_SRC_COLOR = 0x301;
cc.ONE_MINUS_DST_ALPHA = 0x305;
cc.ONE_MINUS_DST_COLOR = 0x0307;
cc.ONE_MINUS_CONSTANT_ALPHA	= 0x8004;
cc.ONE_MINUS_CONSTANT_COLOR	= 0x8002;
cc.LINEAR	= 0x2601;
cc.REPEAT	= 0x2901;
cc.CLAMP_TO_EDGE	= 0x812f;
cc.MIRRORED_REPEAT   = 0x8370;
cc.BLEND_SRC = cc.SRC_ALPHA;
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType === cc.game.RENDER_TYPE_WEBGL
         && cc.OPTIMIZE_BLEND_FUNC_FOR_PREMULTIPLIED_ALPHA) {
        cc.BLEND_SRC = cc.ONE;
    }
});
cc.BLEND_DST = cc.ONE_MINUS_SRC_ALPHA;
cc.checkGLErrorDebug = function () {
    if (cc.renderMode === cc.game.RENDER_TYPE_WEBGL) {
        var _error = cc._renderContext.getError();
        if (_error) {
            cc.log(cc._LogInfos.checkGLErrorDebug, _error);
        }
    }
};
cc.ORIENTATION_PORTRAIT = 1;
cc.ORIENTATION_LANDSCAPE = 2;
cc.ORIENTATION_AUTO = 3;
cc.VERTEX_ATTRIB_FLAG_NONE = 0;
cc.VERTEX_ATTRIB_FLAG_POSITION = 1 << 0;
cc.VERTEX_ATTRIB_FLAG_COLOR = 1 << 1;
cc.VERTEX_ATTRIB_FLAG_TEX_COORDS = 1 << 2;
cc.VERTEX_ATTRIB_FLAG_POS_COLOR_TEX = ( cc.VERTEX_ATTRIB_FLAG_POSITION | cc.VERTEX_ATTRIB_FLAG_COLOR | cc.VERTEX_ATTRIB_FLAG_TEX_COORDS );
cc.GL_ALL = 0;
cc.VERTEX_ATTRIB_POSITION = 0;
cc.VERTEX_ATTRIB_COLOR = 1;
cc.VERTEX_ATTRIB_TEX_COORDS = 2;
cc.VERTEX_ATTRIB_MAX = 7;
cc.UNIFORM_PMATRIX = 0;
cc.UNIFORM_MVMATRIX = 1;
cc.UNIFORM_MVPMATRIX = 2;
cc.UNIFORM_TIME = 3;
cc.UNIFORM_SINTIME = 4;
cc.UNIFORM_COSTIME = 5;
cc.UNIFORM_RANDOM01 = 6;
cc.UNIFORM_SAMPLER = 7;
cc.UNIFORM_MAX = 8;
cc.SHADER_POSITION_TEXTURECOLOR = "ShaderPositionTextureColor";
cc.SHADER_SPRITE_POSITION_TEXTURECOLOR = "ShaderSpritePositionTextureColor";
cc.SHADER_POSITION_TEXTURECOLORALPHATEST = "ShaderPositionTextureColorAlphaTest";
cc.SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST = "ShaderSpritePositionTextureColorAlphaTest";
cc.SHADER_POSITION_COLOR = "ShaderPositionColor";
cc.SHADER_SPRITE_POSITION_COLOR = "ShaderSpritePositionColor";
cc.SHADER_POSITION_TEXTURE = "ShaderPositionTexture";
cc.SHADER_POSITION_TEXTURE_UCOLOR = "ShaderPositionTexture_uColor";
cc.SHADER_POSITION_TEXTUREA8COLOR = "ShaderPositionTextureA8Color";
cc.SHADER_POSITION_UCOLOR = "ShaderPosition_uColor";
cc.SHADER_POSITION_LENGTHTEXTURECOLOR = "ShaderPositionLengthTextureColor";
cc.UNIFORM_PMATRIX_S = "CC_PMatrix";
cc.UNIFORM_MVMATRIX_S = "CC_MVMatrix";
cc.UNIFORM_MVPMATRIX_S = "CC_MVPMatrix";
cc.UNIFORM_TIME_S = "CC_Time";
cc.UNIFORM_SINTIME_S = "CC_SinTime";
cc.UNIFORM_COSTIME_S = "CC_CosTime";
cc.UNIFORM_RANDOM01_S = "CC_Random01";
cc.UNIFORM_SAMPLER_S = "CC_Texture0";
cc.UNIFORM_ALPHA_TEST_VALUE_S = "CC_alpha_value";
cc.ATTRIBUTE_NAME_COLOR = "a_color";
cc.ATTRIBUTE_NAME_POSITION = "a_position";
cc.ATTRIBUTE_NAME_TEX_COORD = "a_texCoord";
cc.ATTRIBUTE_NAME_MVMAT = "a_mvMatrix";
cc.ITEM_SIZE = 32;
cc.CURRENT_ITEM = 0xc0c05001;
cc.ZOOM_ACTION_TAG = 0xc0c05002;
cc.NORMAL_TAG = 8801;
cc.SELECTED_TAG = 8802;
cc.DISABLE_TAG = 8803;
cc.arrayVerifyType = function (arr, type) {
    if (arr && arr.length > 0) {
        for (var i = 0; i < arr.length; i++) {
            if (!(arr[i] instanceof  type)) {
                cc.log("element type is wrong!");
                return false;
            }
        }
    }
    return true;
};
cc.arrayRemoveObject = function (arr, delObj) {
    for (var i = 0, l = arr.length; i < l; i++) {
        if (arr[i] === delObj) {
            arr.splice(i, 1);
            break;
        }
    }
};
cc.arrayRemoveArray = function (arr, minusArr) {
    for (var i = 0, l = minusArr.length; i < l; i++) {
        cc.arrayRemoveObject(arr, minusArr[i]);
    }
};
cc.arrayAppendObjectsToIndex = function(arr, addObjs,index){
    arr.splice.apply(arr, [index, 0].concat(addObjs));
    return arr;
};
cc.copyArray = function(arr){
    var i, len = arr.length, arr_clone = new Array(len);
    for (i = 0; i < len; i += 1)
        arr_clone[i] = arr[i];
    return arr_clone;
};
cc._tmp.PrototypeColor = function () {
    var _p = cc.color;
    _p._getWhite = function () {
        return _p(255, 255, 255);
    };
    _p._getYellow = function () {
        return _p(255, 255, 0);
    };
    _p._getBlue = function () {
        return  _p(0, 0, 255);
    };
    _p._getGreen = function () {
        return _p(0, 255, 0);
    };
    _p._getRed = function () {
        return _p(255, 0, 0);
    };
    _p._getMagenta = function () {
        return _p(255, 0, 255);
    };
    _p._getBlack = function () {
        return _p(0, 0, 0);
    };
    _p._getOrange = function () {
        return _p(255, 127, 0);
    };
    _p._getGray = function () {
        return _p(166, 166, 166);
    };
    _p.WHITE;
    cc.defineGetterSetter(_p, "WHITE", _p._getWhite);
    _p.YELLOW;
    cc.defineGetterSetter(_p, "YELLOW", _p._getYellow);
    _p.BLUE;
    cc.defineGetterSetter(_p, "BLUE", _p._getBlue);
    _p.GREEN;
    cc.defineGetterSetter(_p, "GREEN", _p._getGreen);
    _p.RED;
    cc.defineGetterSetter(_p, "RED", _p._getRed);
    _p.MAGENTA;
    cc.defineGetterSetter(_p, "MAGENTA", _p._getMagenta);
    _p.BLACK;
    cc.defineGetterSetter(_p, "BLACK", _p._getBlack);
    _p.ORANGE;
    cc.defineGetterSetter(_p, "ORANGE", _p._getOrange);
    _p.GRAY;
    cc.defineGetterSetter(_p, "GRAY", _p._getGray);
    cc.BlendFunc._disable = function(){
        return new cc.BlendFunc(cc.ONE, cc.ZERO);
    };
    cc.BlendFunc._alphaPremultiplied = function(){
        return new cc.BlendFunc(cc.ONE, cc.ONE_MINUS_SRC_ALPHA);
    };
    cc.BlendFunc._alphaNonPremultiplied = function(){
        return new cc.BlendFunc(cc.SRC_ALPHA, cc.ONE_MINUS_SRC_ALPHA);
    };
    cc.BlendFunc._additive = function(){
        return new cc.BlendFunc(cc.SRC_ALPHA, cc.ONE);
    };
    cc.BlendFunc.DISABLE;
    cc.defineGetterSetter(cc.BlendFunc, "DISABLE", cc.BlendFunc._disable);
    cc.BlendFunc.ALPHA_PREMULTIPLIED;
    cc.defineGetterSetter(cc.BlendFunc, "ALPHA_PREMULTIPLIED", cc.BlendFunc._alphaPremultiplied);
    cc.BlendFunc.ALPHA_NON_PREMULTIPLIED;
    cc.defineGetterSetter(cc.BlendFunc, "ALPHA_NON_PREMULTIPLIED", cc.BlendFunc._alphaNonPremultiplied);
    cc.BlendFunc.ADDITIVE;
    cc.defineGetterSetter(cc.BlendFunc, "ADDITIVE", cc.BlendFunc._additive);
};
var cc = cc || {};
cc._tmp = cc._tmp || {};
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType !== cc.game.RENDER_TYPE_WEBGL) {
        return;
    }
    cc.color = function (r, g, b, a, arrayBuffer, offset) {
        if (r === undefined)
            return new cc.Color(0, 0, 0, 255, arrayBuffer, offset);
        if (cc.isString(r)) {
            var color = cc.hexToColor(r);
            return new cc.Color(color.r, color.g, color.b, color.a);
        }
        if (cc.isObject(r))
            return new cc.Color(r.r, r.g, r.b, r.a, r.arrayBuffer, r.offset);
        return new cc.Color(r, g, b, a, arrayBuffer, offset);
    };
    cc.Color = function (r, g, b, a, arrayBuffer, offset) {
        this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.Color.BYTES_PER_ELEMENT);
        this._offset = offset || 0;
        var locArrayBuffer = this._arrayBuffer, locOffset = this._offset;
        this._view = new Uint8Array(locArrayBuffer, locOffset, 4);
        this._view[0] = r || 0;
        this._view[1] = g || 0;
        this._view[2] = b || 0;
        this._view[3] = (a == null) ? 255 : a;
        if (a === undefined)
            this.a_undefined = true;
    };
    cc.Color.BYTES_PER_ELEMENT = 4;
    var _p = cc.Color.prototype;
    _p._getR = function () {
        return this._view[0];
    };
    _p._setR = function (value) {
        this._view[0] = value < 0 ? 0 : value;
    };
    _p._getG = function () {
        return this._view[1];
    };
    _p._setG = function (value) {
        this._view[1] = value < 0 ? 0 : value;
    };
    _p._getB = function () {
        return this._view[2];
    };
    _p._setB = function (value) {
        this._view[2] = value < 0 ? 0 : value;
    };
    _p._getA = function () {
        return this._view[3];
    };
    _p._setA = function (value) {
        this._view[3] = value < 0 ? 0 : value;
    };
    _p.r;
    cc.defineGetterSetter(_p, "r", _p._getR, _p._setR);
    _p.g;
    cc.defineGetterSetter(_p, "g", _p._getG, _p._setG);
    _p.b;
    cc.defineGetterSetter(_p, "b", _p._getB, _p._setB);
    _p.a;
    cc.defineGetterSetter(_p, "a", _p._getA, _p._setA);
    cc.assert(cc.isFunction(cc._tmp.PrototypeColor), cc._LogInfos.MissingFile, "CCTypesPropertyDefine.js");
    cc._tmp.PrototypeColor();
    delete cc._tmp.PrototypeColor;
});
cc.Color = function (r, g, b, a) {
    this.r = r || 0;
    this.g = g || 0;
    this.b = b || 0;
    this.a = (a == null) ? 255 : a;
};
cc.color = function (r, g, b, a) {
    if (r === undefined)
        return {r: 0, g: 0, b: 0, a: 255};
    if (cc.isString(r))
        return cc.hexToColor(r);
    if (cc.isObject(r))
        return {r: r.r, g: r.g, b: r.b, a: (r.a == null) ? 255 : r.a};
    return  {r: r, g: g, b: b, a: (a == null ? 255 : a)};
};
cc.colorEqual = function (color1, color2) {
    return color1.r === color2.r && color1.g === color2.g && color1.b === color2.b;
};
cc.Acceleration = function (x, y, z, timestamp) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.timestamp = timestamp || 0;
};
cc.Vertex2F = function (x, y, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.Vertex2F.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    this._view = new Float32Array(this._arrayBuffer, this._offset, 2);
    this._view[0] = x || 0;
    this._view[1] = y || 0;
};
cc.Vertex2F.BYTES_PER_ELEMENT = 8;
_p = cc.Vertex2F.prototype;
_p._getX = function () {
    return this._view[0];
};
_p._setX = function (xValue) {
    this._view[0] = xValue;
};
_p._getY = function () {
    return this._view[1];
};
_p._setY = function (yValue) {
    this._view[1] = yValue;
};
_p.x;
cc.defineGetterSetter(_p, "x", _p._getX, _p._setX);
_p.y;
cc.defineGetterSetter(_p, "y", _p._getY, _p._setY);
cc.Vertex3F = function (x, y, z, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.Vertex3F.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset;
    this._view = new Float32Array(locArrayBuffer, locOffset, 3);
    this._view[0] = x || 0;
    this._view[1] = y || 0;
    this._view[2] = z || 0;
};
cc.Vertex3F.BYTES_PER_ELEMENT = 12;
_p = cc.Vertex3F.prototype;
_p._getX = function () {
    return this._view[0];
};
_p._setX = function (xValue) {
    this._view[0] = xValue;
};
_p._getY = function () {
    return this._view[1];
};
_p._setY = function (yValue) {
    this._view[1] = yValue;
};
_p._getZ = function () {
    return this._view[2];
};
_p._setZ = function (zValue) {
    this._view[2] = zValue;
};
_p.x;
cc.defineGetterSetter(_p, "x", _p._getX, _p._setX);
_p.y;
cc.defineGetterSetter(_p, "y", _p._getY, _p._setY);
_p.z;
cc.defineGetterSetter(_p, "z", _p._getZ, _p._setZ);
cc.Tex2F = function (u, v, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.Tex2F.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    this._view = new Float32Array(this._arrayBuffer, this._offset, 2);
    this._view[0] = u || 0;
    this._view[1] = v || 0;
};
cc.Tex2F.BYTES_PER_ELEMENT = 8;
_p = cc.Tex2F.prototype;
_p._getU = function () {
    return this._view[0];
};
_p._setU = function (xValue) {
    this._view[0] = xValue;
};
_p._getV = function () {
    return this._view[1];
};
_p._setV = function (yValue) {
    this._view[1] = yValue;
};
_p.u;
cc.defineGetterSetter(_p, "u", _p._getU, _p._setU);
_p.v;
cc.defineGetterSetter(_p, "v", _p._getV, _p._setV);
cc.Quad2 = function (tl, tr, bl, br, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.Quad2.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset, locElementLen = cc.Vertex2F.BYTES_PER_ELEMENT;
    this._tl = tl ? new cc.Vertex2F(tl.x, tl.y, locArrayBuffer, locOffset) : new cc.Vertex2F(0, 0, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._tr = tr ? new cc.Vertex2F(tr.x, tr.y, locArrayBuffer, locOffset) : new cc.Vertex2F(0, 0, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._bl = bl ? new cc.Vertex2F(bl.x, bl.y, locArrayBuffer, locOffset) : new cc.Vertex2F(0, 0, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._br = br ? new cc.Vertex2F(br.x, br.y, locArrayBuffer, locOffset) : new cc.Vertex2F(0, 0, locArrayBuffer, locOffset);
};
cc.Quad2.BYTES_PER_ELEMENT = 32;
_p = cc.Quad2.prototype;
_p._getTL = function () {
    return this._tl;
};
_p._setTL = function (tlValue) {
    this._tl._view[0] = tlValue.x;
    this._tl._view[1] = tlValue.y;
};
_p._getTR = function () {
    return this._tr;
};
_p._setTR = function (trValue) {
    this._tr._view[0] = trValue.x;
    this._tr._view[1] = trValue.y;
};
_p._getBL = function() {
    return this._bl;
};
_p._setBL = function (blValue) {
    this._bl._view[0] = blValue.x;
    this._bl._view[1] = blValue.y;
};
_p._getBR = function () {
    return this._br;
};
_p._setBR = function (brValue) {
    this._br._view[0] = brValue.x;
    this._br._view[1] = brValue.y;
};
_p.tl;
cc.defineGetterSetter(_p, "tl", _p._getTL, _p._setTL);
_p.tr;
cc.defineGetterSetter(_p, "tr", _p._getTR, _p._setTR);
_p.bl;
cc.defineGetterSetter(_p, "bl", _p._getBL, _p._setBL);
_p.br;
cc.defineGetterSetter(_p, "br", _p._getBR, _p._setBR);
cc.Quad3 = function (bl, br, tl, tr, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.Quad3.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset, locElementLen = cc.Vertex3F.BYTES_PER_ELEMENT;
    this.bl = bl ? new cc.Vertex3F(bl.x, bl.y, bl.z, locArrayBuffer, locOffset) : new cc.Vertex3F(0, 0, 0, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this.br = br ? new cc.Vertex3F(br.x, br.y, br.z, locArrayBuffer, locOffset) : new cc.Vertex3F(0, 0, 0, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this.tl = tl ? new cc.Vertex3F(tl.x, tl.y, tl.z, locArrayBuffer, locOffset) : new cc.Vertex3F(0, 0, 0, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this.tr = tr ? new cc.Vertex3F(tr.x, tr.y, tr.z, locArrayBuffer, locOffset) : new cc.Vertex3F(0, 0, 0, locArrayBuffer, locOffset);
};
cc.Quad3.BYTES_PER_ELEMENT = 48;
cc.V3F_C4B_T2F = function (vertices, colors, texCoords, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.V3F_C4B_T2F.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset;
    this._vertices = vertices ? new cc.Vertex3F(vertices.x, vertices.y, vertices.z, locArrayBuffer, locOffset) :
        new cc.Vertex3F(0, 0, 0, locArrayBuffer, locOffset);
    locOffset += cc.Vertex3F.BYTES_PER_ELEMENT;
    this._colors = colors ? new cc.Color(colors.r, colors.g, colors.b, colors.a, locArrayBuffer, locOffset) :
        new cc.Color(0, 0, 0, 0, locArrayBuffer, locOffset);
    locOffset += cc.Color.BYTES_PER_ELEMENT;
    this._texCoords = texCoords ? new cc.Tex2F(texCoords.u, texCoords.v, locArrayBuffer, locOffset) :
        new cc.Tex2F(0, 0, locArrayBuffer, locOffset);
};
cc.V3F_C4B_T2F.BYTES_PER_ELEMENT = 24;
_p = cc.V3F_C4B_T2F.prototype;
_p._getVertices = function () {
    return this._vertices;
};
_p._setVertices = function (verticesValue) {
    var locVertices = this._vertices;
    locVertices._view[0] = verticesValue.x;
    locVertices._view[1] = verticesValue.y;
    locVertices._view[2] = verticesValue.z;
};
_p._getColor = function () {
    return this._colors;
};
_p._setColor = function (colorValue) {
    var locColors = this._colors;
    locColors._view[0] = colorValue.r;
    locColors._view[1] = colorValue.g;
    locColors._view[2] = colorValue.b;
    locColors._view[3] = colorValue.a;
};
_p._getTexCoords = function () {
    return this._texCoords;
};
_p._setTexCoords = function (texValue) {
    this._texCoords._view[0] = texValue.u;
    this._texCoords._view[1] = texValue.v;
};
_p.vertices;
cc.defineGetterSetter(_p, "vertices", _p._getVertices, _p._setVertices);
_p.colors;
cc.defineGetterSetter(_p, "colors", _p._getColor, _p._setColor);
_p.texCoords;
cc.defineGetterSetter(_p, "texCoords", _p._getTexCoords, _p._setTexCoords);
cc.V3F_C4B_T2F_Quad = function (tl, bl, tr, br, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset, locElementLen = cc.V3F_C4B_T2F.BYTES_PER_ELEMENT;
    this._tl = tl ? new cc.V3F_C4B_T2F(tl.vertices, tl.colors, tl.texCoords, locArrayBuffer, locOffset) :
        new cc.V3F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._bl = bl ? new cc.V3F_C4B_T2F(bl.vertices, bl.colors, bl.texCoords, locArrayBuffer, locOffset) :
        new cc.V3F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._tr = tr ? new cc.V3F_C4B_T2F(tr.vertices, tr.colors, tr.texCoords, locArrayBuffer, locOffset) :
        new cc.V3F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._br = br ? new cc.V3F_C4B_T2F(br.vertices, br.colors, br.texCoords, locArrayBuffer, locOffset) :
        new cc.V3F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
};
cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT = 96;
_p = cc.V3F_C4B_T2F_Quad.prototype;
_p._getTL = function () {
    return this._tl;
};
_p._setTL = function (tlValue) {
    var locTl = this._tl;
    locTl.vertices = tlValue.vertices;
    locTl.colors = tlValue.colors;
    locTl.texCoords = tlValue.texCoords;
};
_p._getBL = function () {
    return this._bl;
};
_p._setBL = function (blValue) {
    var locBl = this._bl;
    locBl.vertices = blValue.vertices;
    locBl.colors = blValue.colors;
    locBl.texCoords = blValue.texCoords;
};
_p._getTR = function () {
    return this._tr;
};
_p._setTR = function (trValue) {
    var locTr = this._tr;
    locTr.vertices = trValue.vertices;
    locTr.colors = trValue.colors;
    locTr.texCoords = trValue.texCoords;
};
_p._getBR = function () {
    return this._br;
};
_p._setBR = function (brValue) {
    var locBr = this._br;
    locBr.vertices = brValue.vertices;
    locBr.colors = brValue.colors;
    locBr.texCoords = brValue.texCoords;
};
_p._getArrayBuffer = function () {
    return this._arrayBuffer;
};
_p.tl;
cc.defineGetterSetter(_p, "tl", _p._getTL, _p._setTL);
_p.tr;
cc.defineGetterSetter(_p, "tr", _p._getTR, _p._setTR);
_p.bl;
cc.defineGetterSetter(_p, "bl", _p._getBL, _p._setBL);
_p.br;
cc.defineGetterSetter(_p, "br", _p._getBR, _p._setBR);
_p.arrayBuffer;
cc.defineGetterSetter(_p, "arrayBuffer", _p._getArrayBuffer, null);
cc.V3F_C4B_T2F_QuadZero = function () {
    return new cc.V3F_C4B_T2F_Quad();
};
cc.V3F_C4B_T2F_QuadCopy = function (sourceQuad) {
    if (!sourceQuad)
        return  cc.V3F_C4B_T2F_QuadZero();
    var srcTL = sourceQuad.tl, srcBL = sourceQuad.bl, srcTR = sourceQuad.tr, srcBR = sourceQuad.br;
    return {
        tl: {vertices: {x: srcTL.vertices.x, y: srcTL.vertices.y, z: srcTL.vertices.z},
            colors: {r: srcTL.colors.r, g: srcTL.colors.g, b: srcTL.colors.b, a: srcTL.colors.a},
            texCoords: {u: srcTL.texCoords.u, v: srcTL.texCoords.v}},
        bl: {vertices: {x: srcBL.vertices.x, y: srcBL.vertices.y, z: srcBL.vertices.z},
            colors: {r: srcBL.colors.r, g: srcBL.colors.g, b: srcBL.colors.b, a: srcBL.colors.a},
            texCoords: {u: srcBL.texCoords.u, v: srcBL.texCoords.v}},
        tr: {vertices: {x: srcTR.vertices.x, y: srcTR.vertices.y, z: srcTR.vertices.z},
            colors: {r: srcTR.colors.r, g: srcTR.colors.g, b: srcTR.colors.b, a: srcTR.colors.a},
            texCoords: {u: srcTR.texCoords.u, v: srcTR.texCoords.v}},
        br: {vertices: {x: srcBR.vertices.x, y: srcBR.vertices.y, z: srcBR.vertices.z},
            colors: {r: srcBR.colors.r, g: srcBR.colors.g, b: srcBR.colors.b, a: srcBR.colors.a},
            texCoords: {u: srcBR.texCoords.u, v: srcBR.texCoords.v}}
    };
};
cc.V3F_C4B_T2F_QuadsCopy = function (sourceQuads) {
    if (!sourceQuads)
        return [];
    var retArr = [];
    for (var i = 0; i < sourceQuads.length; i++) {
        retArr.push(cc.V3F_C4B_T2F_QuadCopy(sourceQuads[i]));
    }
    return retArr;
};
cc.V2F_C4B_T2F = function (vertices, colors, texCoords, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.V2F_C4B_T2F.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset;
    this._vertices = vertices ? new cc.Vertex2F(vertices.x, vertices.y, locArrayBuffer, locOffset) :
        new cc.Vertex2F(0, 0, locArrayBuffer, locOffset);
    locOffset += cc.Vertex2F.BYTES_PER_ELEMENT;
    this._colors = colors ? cc.color(colors.r, colors.g, colors.b, colors.a, locArrayBuffer, locOffset) :
        cc.color(0, 0, 0, 0, locArrayBuffer, locOffset);
    locOffset += cc.Color.BYTES_PER_ELEMENT;
    this._texCoords = texCoords ? new cc.Tex2F(texCoords.u, texCoords.v, locArrayBuffer, locOffset) :
        new cc.Tex2F(0, 0, locArrayBuffer, locOffset);
};
cc.V2F_C4B_T2F.BYTES_PER_ELEMENT = 20;
_p = cc.V2F_C4B_T2F.prototype;
_p._getVertices = function () {
    return this._vertices;
};
_p._setVertices = function (verticesValue) {
    this._vertices._view[0] = verticesValue.x;
    this._vertices._view[1] = verticesValue.y;
};
_p._getColor = function () {
    return this._colors;
};
_p._setColor = function (colorValue) {
    var locColors = this._colors;
    locColors._view[0] = colorValue.r;
    locColors._view[1] = colorValue.g;
    locColors._view[2] = colorValue.b;
    locColors._view[3] = colorValue.a;
};
_p._getTexCoords = function () {
    return this._texCoords;
};
_p._setTexCoords = function (texValue) {
    this._texCoords._view[0] = texValue.u;
    this._texCoords._view[1] = texValue.v;
};
_p.vertices;
cc.defineGetterSetter(_p, "vertices", _p._getVertices, _p._setVertices);
_p.colors;
cc.defineGetterSetter(_p, "colors", _p._getColor, _p._setColor);
_p.texCoords;
cc.defineGetterSetter(_p, "texCoords", _p._getTexCoords, _p._setTexCoords);
cc.V2F_C4B_T2F_Triangle = function (a, b, c, arrayBuffer, offset) {
    this._arrayBuffer = arrayBuffer || new ArrayBuffer(cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT);
    this._offset = offset || 0;
    var locArrayBuffer = this._arrayBuffer, locOffset = this._offset, locElementLen = cc.V2F_C4B_T2F.BYTES_PER_ELEMENT;
    this._a = a ? new cc.V2F_C4B_T2F(a.vertices, a.colors, a.texCoords, locArrayBuffer, locOffset) :
        new cc.V2F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._b = b ? new cc.V2F_C4B_T2F(b.vertices, b.colors, b.texCoords, locArrayBuffer, locOffset) :
        new cc.V2F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
    locOffset += locElementLen;
    this._c = c ? new cc.V2F_C4B_T2F(c.vertices, c.colors, c.texCoords, locArrayBuffer, locOffset) :
        new cc.V2F_C4B_T2F(null, null, null, locArrayBuffer, locOffset);
};
cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT = 60;
_p = cc.V2F_C4B_T2F_Triangle.prototype;
_p._getA = function () {
    return this._a;
};
_p._setA = function (aValue) {
    var locA = this._a;
    locA.vertices = aValue.vertices;
    locA.colors = aValue.colors;
    locA.texCoords = aValue.texCoords;
};
_p._getB = function () {
    return this._b;
};
_p._setB = function (bValue) {
    var locB = this._b;
    locB.vertices = bValue.vertices;
    locB.colors = bValue.colors;
    locB.texCoords = bValue.texCoords;
};
_p._getC = function () {
    return this._c;
};
_p._setC = function (cValue) {
    var locC = this._c;
    locC.vertices = cValue.vertices;
    locC.colors = cValue.colors;
    locC.texCoords = cValue.texCoords;
};
_p.a;
cc.defineGetterSetter(_p, "a", _p._getA, _p._setA);
_p.b;
cc.defineGetterSetter(_p, "b", _p._getB, _p._setB);
_p.c;
cc.defineGetterSetter(_p, "c", _p._getC, _p._setC);
cc.vertex2 = function (x, y) {
    return new cc.Vertex2F(x, y);
};
cc.vertex3 = function (x, y, z) {
    return new cc.Vertex3F(x, y, z);
};
cc.tex2 = function (u, v) {
    return new cc.Tex2F(u, v);
};
cc.BlendFunc = function (src1, dst1) {
    this.src = src1;
    this.dst = dst1;
};
cc.blendFuncDisable = function () {
    return new cc.BlendFunc(cc.ONE, cc.ZERO);
};
cc.hexToColor = function (hex) {
    hex = hex.replace(/^#?/, "0x");
    var c = parseInt(hex);
    var r = c >> 16;
    var g = (c >> 8) % 256;
    var b = c % 256;
    return cc.color(r, g, b);
};
cc.colorToHex = function (color) {
    var hR = color.r.toString(16), hG = color.g.toString(16), hB = color.b.toString(16);
    return "#" + (color.r < 16 ? ("0" + hR) : hR) + (color.g < 16 ? ("0" + hG) : hG) + (color.b < 16 ? ("0" + hB) : hB);
};
cc.TEXT_ALIGNMENT_LEFT = 0;
cc.TEXT_ALIGNMENT_CENTER = 1;
cc.TEXT_ALIGNMENT_RIGHT = 2;
cc.VERTICAL_TEXT_ALIGNMENT_TOP = 0;
cc.VERTICAL_TEXT_ALIGNMENT_CENTER = 1;
cc.VERTICAL_TEXT_ALIGNMENT_BOTTOM = 2;
cc._Dictionary = cc.Class.extend({
    _keyMapTb: null,
    _valueMapTb: null,
    __currId: 0,
    ctor: function () {
        this._keyMapTb = {};
        this._valueMapTb = {};
        this.__currId = 2 << (0 | (Math.random() * 10));
    },
    __getKey: function () {
        this.__currId++;
        return "key_" + this.__currId;
    },
    setObject: function (value, key) {
        if (key == null)
            return;
        var keyId = this.__getKey();
        this._keyMapTb[keyId] = key;
        this._valueMapTb[keyId] = value;
    },
    objectForKey: function (key) {
        if (key == null)
            return null;
        var locKeyMapTb = this._keyMapTb;
        for (var keyId in locKeyMapTb) {
            if (locKeyMapTb[keyId] === key)
                return this._valueMapTb[keyId];
        }
        return null;
    },
    valueForKey: function (key) {
        return this.objectForKey(key);
    },
    removeObjectForKey: function (key) {
        if (key == null)
            return;
        var locKeyMapTb = this._keyMapTb;
        for (var keyId in locKeyMapTb) {
            if (locKeyMapTb[keyId] === key) {
                delete this._valueMapTb[keyId];
                delete locKeyMapTb[keyId];
                return;
            }
        }
    },
    removeObjectsForKeys: function (keys) {
        if (keys == null)
            return;
        for (var i = 0; i < keys.length; i++)
            this.removeObjectForKey(keys[i]);
    },
    allKeys: function () {
        var keyArr = [], locKeyMapTb = this._keyMapTb;
        for (var key in locKeyMapTb)
            keyArr.push(locKeyMapTb[key]);
        return keyArr;
    },
    removeAllObjects: function () {
        this._keyMapTb = {};
        this._valueMapTb = {};
    },
    count: function () {
        return this.allKeys().length;
    }
});
cc.FontDefinition = function (properties) {
    var _t = this;
    _t.fontName = "Arial";
    _t.fontSize = 12;
    _t.textAlign = cc.TEXT_ALIGNMENT_CENTER;
    _t.verticalAlign = cc.VERTICAL_TEXT_ALIGNMENT_TOP;
    _t.fillStyle = cc.color(255, 255, 255, 255);
    _t.boundingWidth = 0;
    _t.boundingHeight = 0;
    _t.strokeEnabled = false;
    _t.strokeStyle = cc.color(255, 255, 255, 255);
    _t.lineWidth = 1;
    _t.lineHeight = "normal";
    _t.fontStyle = "normal";
    _t.fontWeight = "normal";
    _t.shadowEnabled = false;
    _t.shadowOffsetX = 0;
    _t.shadowOffsetY = 0;
    _t.shadowBlur = 0;
    _t.shadowOpacity = 1.0;
    if(properties && properties instanceof Object){
         for(var key in properties){
             _t[key] = properties[key];
         }
    }
};
cc.FontDefinition.prototype._getCanvasFontStr = function(){
    var lineHeight = !this.lineHeight.charAt ? this.lineHeight+"px" : this.lineHeight;
    return this.fontStyle + " " + this.fontWeight + " " + this.fontSize + "px/"+lineHeight+" '" + this.fontName + "'";
};
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType === cc.game.RENDER_TYPE_CANVAS) {
        cc.assert(cc.isFunction(cc._tmp.PrototypeColor), cc._LogInfos.MissingFile, "CCTypesPropertyDefine.js");
        cc._tmp.PrototypeColor();
        delete cc._tmp.PrototypeColor;
    }
});
cc.Touches = [];
cc.TouchesIntergerDict = {};
cc.DENSITYDPI_DEVICE = "device-dpi";
cc.DENSITYDPI_HIGH = "high-dpi";
cc.DENSITYDPI_MEDIUM = "medium-dpi";
cc.DENSITYDPI_LOW = "low-dpi";
var __BrowserGetter = {
    init: function(){
        this.html = document.getElementsByTagName("html")[0];
    },
    availWidth: function(frame){
        if(!frame || frame === this.html)
            return window.innerWidth;
        else
            return frame.clientWidth;
    },
    availHeight: function(frame){
        if(!frame || frame === this.html)
            return window.innerHeight;
        else
            return frame.clientHeight;
    },
    meta: {
        "width": "device-width"
    },
    adaptationType: cc.sys.browserType
};
if(window.navigator.userAgent.indexOf("OS 8_1_") > -1)
    __BrowserGetter.adaptationType = cc.sys.BROWSER_TYPE_MIUI;
if(cc.sys.os === cc.sys.OS_IOS)
    __BrowserGetter.adaptationType = cc.sys.BROWSER_TYPE_SAFARI;
switch(__BrowserGetter.adaptationType){
    case cc.sys.BROWSER_TYPE_SAFARI:
        __BrowserGetter.meta["minimal-ui"] = "true";
        __BrowserGetter.availWidth = function(frame){
            return frame.clientWidth;
        };
        __BrowserGetter.availHeight = function(frame){
            return frame.clientHeight;
        };
        break;
    case cc.sys.BROWSER_TYPE_CHROME:
        __BrowserGetter.__defineGetter__("target-densitydpi", function(){
            return cc.view._targetDensityDPI;
        });
    case cc.sys.BROWSER_TYPE_SOUGOU:
    case cc.sys.BROWSER_TYPE_UC:
        __BrowserGetter.availWidth = function(frame){
            return frame.clientWidth;
        };
        __BrowserGetter.availHeight = function(frame){
            return frame.clientHeight;
        };
        break;
    case cc.sys.BROWSER_TYPE_MIUI:
        __BrowserGetter.init = function(view){
            if(view.__resizeWithBrowserSize) return;
            var resize = function(){
                view.setDesignResolutionSize(
                    view._designResolutionSize.width,
                    view._designResolutionSize.height,
                    view._resolutionPolicy
                );
                window.removeEventListener("resize", resize, false);
            };
            window.addEventListener("resize", resize, false);
        };
        break;
}
var _scissorRect = cc.rect();
cc.EGLView = cc.Class.extend({
    _delegate: null,
    _frameSize: null,
    _designResolutionSize: null,
    _originalDesignResolutionSize: null,
    _viewPortRect: null,
    _visibleRect: null,
    _retinaEnabled: false,
    _autoFullScreen: false,
    _devicePixelRatio: 1,
    _viewName: "",
    _resizeCallback: null,
    _scaleX: 1,
    _originalScaleX: 1,
    _scaleY: 1,
    _originalScaleY: 1,
    _isRotated: false,
    _orientation: 3,
    _resolutionPolicy: null,
    _rpExactFit: null,
    _rpShowAll: null,
    _rpNoBorder: null,
    _rpFixedHeight: null,
    _rpFixedWidth: null,
    _initialized: false,
    _contentTranslateLeftTop: null,
    _frame: null,
    _frameZoomFactor: 1.0,
    __resizeWithBrowserSize: false,
    _isAdjustViewPort: true,
    _targetDensityDPI: null,
    ctor: function () {
        var _t = this, d = document, _strategyer = cc.ContainerStrategy, _strategy = cc.ContentStrategy;
        __BrowserGetter.init(this);
        _t._frame = (cc.container.parentNode === d.body) ? d.documentElement : cc.container.parentNode;
        _t._frameSize = cc.size(0, 0);
        _t._initFrameSize();
        var w = cc._canvas.width, h = cc._canvas.height;
        _t._designResolutionSize = cc.size(w, h);
        _t._originalDesignResolutionSize = cc.size(w, h);
        _t._viewPortRect = cc.rect(0, 0, w, h);
        _t._visibleRect = cc.rect(0, 0, w, h);
        _t._contentTranslateLeftTop = {left: 0, top: 0};
        _t._viewName = "Cocos2dHTML5";
        var sys = cc.sys;
        _t.enableRetina(sys.os === sys.OS_IOS || sys.os === sys.OS_OSX);
        _t.enableAutoFullScreen(sys.isMobile && sys.browserType !== sys.BROWSER_TYPE_BAIDU);
        cc.visibleRect && cc.visibleRect.init(_t._visibleRect);
        _t._rpExactFit = new cc.ResolutionPolicy(_strategyer.EQUAL_TO_FRAME, _strategy.EXACT_FIT);
        _t._rpShowAll = new cc.ResolutionPolicy(_strategyer.PROPORTION_TO_FRAME, _strategy.SHOW_ALL);
        _t._rpNoBorder = new cc.ResolutionPolicy(_strategyer.EQUAL_TO_FRAME, _strategy.NO_BORDER);
        _t._rpFixedHeight = new cc.ResolutionPolicy(_strategyer.EQUAL_TO_FRAME, _strategy.FIXED_HEIGHT);
        _t._rpFixedWidth = new cc.ResolutionPolicy(_strategyer.EQUAL_TO_FRAME, _strategy.FIXED_WIDTH);
        _t._targetDensityDPI = cc.DENSITYDPI_HIGH;
    },
    _resizeEvent: function () {
        var view;
        if (this.setDesignResolutionSize) {
            view = this;
        } else {
            view = cc.view;
        }
        var prevFrameW = view._frameSize.width, prevFrameH = view._frameSize.height, prevRotated = view._isRotated;
        view._initFrameSize();
        if (view._isRotated === prevRotated && view._frameSize.width === prevFrameW && view._frameSize.height === prevFrameH)
            return;
        if (view._resizeCallback) {
            view._resizeCallback.call();
        }
        var width = view._originalDesignResolutionSize.width;
        var height = view._originalDesignResolutionSize.height;
        if (width > 0) {
            view.setDesignResolutionSize(width, height, view._resolutionPolicy);
        }
    },
    setTargetDensityDPI: function(densityDPI){
        this._targetDensityDPI = densityDPI;
        this._adjustViewportMeta();
    },
    getTargetDensityDPI: function(){
        return this._targetDensityDPI;
    },
    resizeWithBrowserSize: function (enabled) {
        if (enabled) {
            if (!this.__resizeWithBrowserSize) {
                this.__resizeWithBrowserSize = true;
                window.addEventListener('resize', this._resizeEvent);
                window.addEventListener('orientationchange', this._resizeEvent);
            }
        } else {
            if (this.__resizeWithBrowserSize) {
                this.__resizeWithBrowserSize = false;
                window.removeEventListener('resize', this._resizeEvent);
                window.removeEventListener('orientationchange', this._resizeEvent);
            }
        }
    },
    setResizeCallback: function (callback) {
        if (cc.isFunction(callback) || callback == null) {
            this._resizeCallback = callback;
        }
    },
    setOrientation: function (orientation) {
        orientation = orientation & cc.ORIENTATION_AUTO;
        if (orientation) {
            this._orientation = orientation;
        }
    },
    _initFrameSize: function () {
        var locFrameSize = this._frameSize;
        var w = __BrowserGetter.availWidth(this._frame);
        var h = __BrowserGetter.availHeight(this._frame);
        var isLandscape = w >= h;
        if (!cc.sys.isMobile ||
            (isLandscape && this._orientation & cc.ORIENTATION_LANDSCAPE) ||
            (!isLandscape && this._orientation & cc.ORIENTATION_PORTRAIT)) {
            locFrameSize.width = w;
            locFrameSize.height = h;
            cc.container.style['-webkit-transform'] = 'rotate(0deg)';
            cc.container.style.transform = 'rotate(0deg)';
            this._isRotated = false;
        }
        else {
            locFrameSize.width = h;
            locFrameSize.height = w;
            cc.container.style['-webkit-transform'] = 'rotate(90deg)';
            cc.container.style.transform = 'rotate(90deg)';
            cc.container.style['-webkit-transform-origin'] = '0px 0px 0px';
            cc.container.style.transformOrigin = '0px 0px 0px';
            this._isRotated = true;
        }
    },
    _adjustSizeKeepCanvasSize: function () {
        var designWidth = this._originalDesignResolutionSize.width;
        var designHeight = this._originalDesignResolutionSize.height;
        if (designWidth > 0)
            this.setDesignResolutionSize(designWidth, designHeight, this._resolutionPolicy);
    },
    _setViewportMeta: function (metas, overwrite) {
        var vp = document.getElementById("cocosMetaElement");
        if(vp && overwrite){
            document.head.removeChild(vp);
        }
        var elems = document.getElementsByName("viewport"),
            currentVP = elems ? elems[0] : null,
            content, key, pattern;
        content = currentVP ? currentVP.content : "";
        vp = vp || document.createElement("meta");
        vp.id = "cocosMetaElement";
        vp.name = "viewport";
        vp.content = "";
        for (key in metas) {
            if (content.indexOf(key) == -1) {
                content += "," + key + "=" + metas[key];
            }
            else if (overwrite) {
                pattern = new RegExp(key+"\s*=\s*[^,]+");
                content.replace(pattern, key + "=" + metas[key]);
            }
        }
        if(/^,/.test(content))
            content = content.substr(1);
        vp.content = content;
        if (currentVP)
            currentVP.content = content;
        document.head.appendChild(vp);
    },
    _adjustViewportMeta: function () {
        if (this._isAdjustViewPort) {
            this._setViewportMeta(__BrowserGetter.meta, false);
            this._isAdjustViewPort = false;
        }
    },
    _setScaleXYForRenderTexture: function () {
        var scaleFactor = cc.contentScaleFactor();
        this._scaleX = scaleFactor;
        this._scaleY = scaleFactor;
    },
    _resetScale: function () {
        this._scaleX = this._originalScaleX;
        this._scaleY = this._originalScaleY;
    },
    _adjustSizeToBrowser: function () {
    },
    initialize: function () {
        this._initialized = true;
    },
    adjustViewPort: function (enabled) {
        this._isAdjustViewPort = enabled;
    },
    enableRetina: function(enabled) {
        this._retinaEnabled = enabled ? true : false;
    },
    isRetinaEnabled: function() {
        return this._retinaEnabled;
    },
    enableAutoFullScreen: function(enabled) {
        if (enabled && enabled !== this._autoFullScreen && cc.sys.isMobile && this._frame === document.documentElement) {
            this._autoFullScreen = true;
            cc.screen.autoFullScreen(this._frame);
        }
        else {
            this._autoFullScreen = false;
        }
    },
    isAutoFullScreenEnabled: function() {
        return this._autoFullScreen;
    },
    end: function () {
    },
    isOpenGLReady: function () {
        return (cc.game.canvas && cc._renderContext);
    },
    setFrameZoomFactor: function (zoomFactor) {
        this._frameZoomFactor = zoomFactor;
        this.centerWindow();
        cc.director.setProjection(cc.director.getProjection());
    },
    swapBuffers: function () {
    },
    setIMEKeyboardState: function (isOpen) {
    },
    setContentTranslateLeftTop: function (offsetLeft, offsetTop) {
        this._contentTranslateLeftTop = {left: offsetLeft, top: offsetTop};
    },
    getContentTranslateLeftTop: function () {
        return this._contentTranslateLeftTop;
    },
    getCanvasSize: function () {
        return cc.size(cc._canvas.width, cc._canvas.height);
    },
    getFrameSize: function () {
        return cc.size(this._frameSize.width, this._frameSize.height);
    },
    setFrameSize: function (width, height) {
        this._frameSize.width = width;
        this._frameSize.height = height;
        this._frame.style.width = width + "px";
        this._frame.style.height = height + "px";
        this._resizeEvent();
        cc.director.setProjection(cc.director.getProjection());
    },
    centerWindow: function () {
    },
    getVisibleSize: function () {
        return cc.size(this._visibleRect.width,this._visibleRect.height);
    },
    getVisibleSizeInPixel: function () {
        return cc.size( this._visibleRect.width * this._scaleX,
                        this._visibleRect.height * this._scaleY );
    },
    getVisibleOrigin: function () {
        return cc.p(this._visibleRect.x,this._visibleRect.y);
    },
    getVisibleOriginInPixel: function () {
        return cc.p(this._visibleRect.x * this._scaleX,
                    this._visibleRect.y * this._scaleY);
    },
    canSetContentScaleFactor: function () {
        return true;
    },
    getResolutionPolicy: function () {
        return this._resolutionPolicy;
    },
    setResolutionPolicy: function (resolutionPolicy) {
        var _t = this;
        if (resolutionPolicy instanceof cc.ResolutionPolicy) {
            _t._resolutionPolicy = resolutionPolicy;
        }
        else {
            var _locPolicy = cc.ResolutionPolicy;
            if(resolutionPolicy === _locPolicy.EXACT_FIT)
                _t._resolutionPolicy = _t._rpExactFit;
            if(resolutionPolicy === _locPolicy.SHOW_ALL)
                _t._resolutionPolicy = _t._rpShowAll;
            if(resolutionPolicy === _locPolicy.NO_BORDER)
                _t._resolutionPolicy = _t._rpNoBorder;
            if(resolutionPolicy === _locPolicy.FIXED_HEIGHT)
                _t._resolutionPolicy = _t._rpFixedHeight;
            if(resolutionPolicy === _locPolicy.FIXED_WIDTH)
                _t._resolutionPolicy = _t._rpFixedWidth;
        }
    },
    setDesignResolutionSize: function (width, height, resolutionPolicy) {
        if( !(width > 0 || height > 0) ){
            cc.log(cc._LogInfos.EGLView_setDesignResolutionSize);
            return;
        }
        this.setResolutionPolicy(resolutionPolicy);
        var policy = this._resolutionPolicy;
        if (!policy){
            cc.log(cc._LogInfos.EGLView_setDesignResolutionSize_2);
            return;
        }
        policy.preApply(this);
        if(cc.sys.isMobile)
            this._adjustViewportMeta();
        this._initFrameSize();
        this._originalDesignResolutionSize.width = this._designResolutionSize.width = width;
        this._originalDesignResolutionSize.height = this._designResolutionSize.height = height;
        var result = policy.apply(this, this._designResolutionSize);
        if(result.scale && result.scale.length === 2){
            this._scaleX = result.scale[0];
            this._scaleY = result.scale[1];
        }
        if(result.viewport){
            var vp = this._viewPortRect,
                vb = this._visibleRect,
                rv = result.viewport;
            vp.x = rv.x;
            vp.y = rv.y;
            vp.width = rv.width;
            vp.height = rv.height;
            vb.x = -vp.x / this._scaleX;
            vb.y = -vp.y / this._scaleY;
            vb.width = cc._canvas.width / this._scaleX;
            vb.height = cc._canvas.height / this._scaleY;
            cc._renderContext.setOffset && cc._renderContext.setOffset(vp.x, -vp.y);
        }
        var director = cc.director;
        director._winSizeInPoints.width = this._designResolutionSize.width;
        director._winSizeInPoints.height = this._designResolutionSize.height;
        policy.postApply(this);
        cc.winSize.width = director._winSizeInPoints.width;
        cc.winSize.height = director._winSizeInPoints.height;
        if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
            director.setGLDefaultValues();
        }
        this._originalScaleX = this._scaleX;
        this._originalScaleY = this._scaleY;
        if (cc.DOM)
            cc.DOM._resetEGLViewDiv();
        cc.visibleRect && cc.visibleRect.init(this._visibleRect);
    },
    getDesignResolutionSize: function () {
        return cc.size(this._designResolutionSize.width, this._designResolutionSize.height);
    },
    setRealPixelResolution: function (width, height, resolutionPolicy) {
        this._setViewportMeta({"width": width, "target-densitydpi": cc.DENSITYDPI_DEVICE}, true);
        document.body.style.width = width + "px";
        document.body.style.left = "0px";
        document.body.style.top = "0px";
        this.setDesignResolutionSize(width, height, resolutionPolicy);
    },
    setViewPortInPoints: function (x, y, w, h) {
        var locFrameZoomFactor = this._frameZoomFactor, locScaleX = this._scaleX, locScaleY = this._scaleY;
        cc._renderContext.viewport((x * locScaleX * locFrameZoomFactor + this._viewPortRect.x * locFrameZoomFactor),
            (y * locScaleY * locFrameZoomFactor + this._viewPortRect.y * locFrameZoomFactor),
            (w * locScaleX * locFrameZoomFactor),
            (h * locScaleY * locFrameZoomFactor));
    },
    setScissorInPoints: function (x, y, w, h) {
        var zoomFactor = this._frameZoomFactor, scaleX = this._scaleX, scaleY = this._scaleY;
        _scissorRect.x = x;
        _scissorRect.y = y;
        _scissorRect.width = w;
        _scissorRect.height = h;
        cc._renderContext.scissor(x * scaleX * zoomFactor + this._viewPortRect.x * zoomFactor,
                                  y * scaleY * zoomFactor + this._viewPortRect.y * zoomFactor,
                                  w * scaleX * zoomFactor,
                                  h * scaleY * zoomFactor);
    },
    isScissorEnabled: function () {
        return cc._renderContext.isEnabled(gl.SCISSOR_TEST);
    },
    getScissorRect: function () {
        return cc.rect(_scissorRect);
    },
    setViewName: function (viewName) {
        if (viewName != null && viewName.length > 0) {
            this._viewName = viewName;
        }
    },
    getViewName: function () {
        return this._viewName;
    },
    getViewPortRect: function () {
        return this._viewPortRect;
    },
    getScaleX: function () {
        return this._scaleX;
    },
    getScaleY: function () {
        return this._scaleY;
    },
    getDevicePixelRatio: function() {
        return this._devicePixelRatio;
    },
    convertToLocationInView: function (tx, ty, relatedPos) {
        var x = this._devicePixelRatio * (tx - relatedPos.left);
        var y = this._devicePixelRatio * (relatedPos.top + relatedPos.height - ty);
        return this._isRotated ? {x: this._viewPortRect.width - y, y: x} : {x: x, y: y};
    },
    _convertMouseToLocationInView: function(point, relatedPos) {
        var locViewPortRect = this._viewPortRect, _t = this;
        point.x = ((_t._devicePixelRatio * (point.x - relatedPos.left)) - locViewPortRect.x) / _t._scaleX;
        point.y = (_t._devicePixelRatio * (relatedPos.top + relatedPos.height - point.y) - locViewPortRect.y) / _t._scaleY;
    },
    _convertPointWithScale: function (point) {
        var viewport = this._viewPortRect;
        point.x = (point.x - viewport.x) / this._scaleX;
        point.y = (point.y - viewport.y) / this._scaleY;
    },
    _convertTouchesWithScale: function (touches) {
        var viewport = this._viewPortRect, scaleX = this._scaleX, scaleY = this._scaleY,
            selTouch, selPoint, selPrePoint;
        for( var i = 0; i < touches.length; i++){
            selTouch = touches[i];
            selPoint = selTouch._point;
            selPrePoint = selTouch._prevPoint;
            selPoint.x = (selPoint.x - viewport.x) / scaleX;
            selPoint.y = (selPoint.y - viewport.y) / scaleY;
            selPrePoint.x = (selPrePoint.x - viewport.x) / scaleX;
            selPrePoint.y = (selPrePoint.y - viewport.y) / scaleY;
        }
    }
});
cc.EGLView._getInstance = function () {
    if (!this._instance) {
        this._instance = this._instance || new cc.EGLView();
        this._instance.initialize();
    }
    return this._instance;
};
cc.ContainerStrategy = cc.Class.extend({
    preApply: function (view) {
    },
    apply: function (view, designedResolution) {
    },
    postApply: function (view) {
    },
    _setupContainer: function (view, w, h) {
        var locCanvas = cc.game.canvas, locContainer = cc.game.container;
        locContainer.style.width = locCanvas.style.width = w + 'px';
        locContainer.style.height = locCanvas.style.height = h + 'px';
        var devicePixelRatio = view._devicePixelRatio = 1;
        if (view.isRetinaEnabled())
            devicePixelRatio = view._devicePixelRatio = Math.min(2, window.devicePixelRatio || 1);
        locCanvas.width = w * devicePixelRatio;
        locCanvas.height = h * devicePixelRatio;
        cc._renderContext.resetCache && cc._renderContext.resetCache();
    },
    _fixContainer: function () {
        document.body.insertBefore(cc.container, document.body.firstChild);
        var bs = document.body.style;
        bs.width = window.innerWidth + "px";
        bs.height = window.innerHeight + "px";
        bs.overflow = "hidden";
        var contStyle = cc.container.style;
        contStyle.position = "fixed";
        contStyle.left = contStyle.top = "0px";
        document.body.scrollTop = 0;
    }
});
cc.ContentStrategy = cc.Class.extend({
    _result: {
        scale: [1, 1],
        viewport: null
    },
    _buildResult: function (containerW, containerH, contentW, contentH, scaleX, scaleY) {
        Math.abs(containerW - contentW) < 2 && (contentW = containerW);
        Math.abs(containerH - contentH) < 2 && (contentH = containerH);
        var viewport = cc.rect(Math.round((containerW - contentW) / 2),
                               Math.round((containerH - contentH) / 2),
                               contentW, contentH);
        if (cc._renderType === cc.game.RENDER_TYPE_CANVAS){
        }
        this._result.scale = [scaleX, scaleY];
        this._result.viewport = viewport;
        return this._result;
    },
    preApply: function (view) {
    },
    apply: function (view, designedResolution) {
        return {"scale": [1, 1]};
    },
    postApply: function (view) {
    }
});
(function () {
    var EqualToFrame = cc.ContainerStrategy.extend({
        apply: function (view) {
            var frameH = view._frameSize.height, containerStyle = cc.container.style;
            this._setupContainer(view, view._frameSize.width, view._frameSize.height);
            if (view._isRotated) {
                containerStyle.marginLeft = frameH + 'px';
            }
            else {
                containerStyle.margin = '0px';
            }
        }
    });
    var ProportionalToFrame = cc.ContainerStrategy.extend({
        apply: function (view, designedResolution) {
            var frameW = view._frameSize.width, frameH = view._frameSize.height, containerStyle = cc.container.style,
                designW = designedResolution.width, designH = designedResolution.height,
                scaleX = frameW / designW, scaleY = frameH / designH,
                containerW, containerH;
            scaleX < scaleY ? (containerW = frameW, containerH = designH * scaleX) : (containerW = designW * scaleY, containerH = frameH);
            var offx = Math.round((frameW - containerW) / 2);
            var offy = Math.round((frameH - containerH) / 2);
            containerW = frameW - 2 * offx;
            containerH = frameH - 2 * offy;
            this._setupContainer(view, containerW, containerH);
            if (view._isRotated) {
                containerStyle.marginLeft = frameH + 'px';
            }
            else {
                containerStyle.margin = '0px';
            }
            containerStyle.paddingLeft = offx + "px";
            containerStyle.paddingRight = offx + "px";
            containerStyle.paddingTop = offy + "px";
            containerStyle.paddingBottom = offy + "px";
        }
    });
    var EqualToWindow = EqualToFrame.extend({
        preApply: function (view) {
            this._super(view);
            view._frame = document.documentElement;
        },
        apply: function (view) {
            this._super(view);
            this._fixContainer();
        }
    });
    var ProportionalToWindow = ProportionalToFrame.extend({
        preApply: function (view) {
            this._super(view);
            view._frame = document.documentElement;
        },
        apply: function (view, designedResolution) {
            this._super(view, designedResolution);
            this._fixContainer();
        }
    });
    var OriginalContainer = cc.ContainerStrategy.extend({
        apply: function (view) {
            this._setupContainer(view, cc._canvas.width, cc._canvas.height);
        }
    });
    cc.ContainerStrategy.EQUAL_TO_FRAME = new EqualToFrame();
    cc.ContainerStrategy.PROPORTION_TO_FRAME = new ProportionalToFrame();
    cc.ContainerStrategy.ORIGINAL_CONTAINER = new OriginalContainer();
    var ExactFit = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                scaleX = containerW / designedResolution.width, scaleY = containerH / designedResolution.height;
            return this._buildResult(containerW, containerH, containerW, containerH, scaleX, scaleY);
        }
    });
    var ShowAll = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designW = designedResolution.width, designH = designedResolution.height,
                scaleX = containerW / designW, scaleY = containerH / designH, scale = 0,
                contentW, contentH;
            scaleX < scaleY ? (scale = scaleX, contentW = containerW, contentH = designH * scale)
                : (scale = scaleY, contentW = designW * scale, contentH = containerH);
            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        }
    });
    var NoBorder = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designW = designedResolution.width, designH = designedResolution.height,
                scaleX = containerW / designW, scaleY = containerH / designH, scale,
                contentW, contentH;
            scaleX < scaleY ? (scale = scaleY, contentW = designW * scale, contentH = containerH)
                : (scale = scaleX, contentW = containerW, contentH = designH * scale);
            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        }
    });
    var FixedHeight = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designH = designedResolution.height, scale = containerH / designH,
                contentW = containerW, contentH = containerH;
            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        },
        postApply: function (view) {
            cc.director._winSizeInPoints = view.getVisibleSize();
        }
    });
    var FixedWidth = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designW = designedResolution.width, scale = containerW / designW,
                contentW = containerW, contentH = containerH;
            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        },
        postApply: function (view) {
            cc.director._winSizeInPoints = view.getVisibleSize();
        }
    });
    cc.ContentStrategy.EXACT_FIT = new ExactFit();
    cc.ContentStrategy.SHOW_ALL = new ShowAll();
    cc.ContentStrategy.NO_BORDER = new NoBorder();
    cc.ContentStrategy.FIXED_HEIGHT = new FixedHeight();
    cc.ContentStrategy.FIXED_WIDTH = new FixedWidth();
})();
cc.ResolutionPolicy = cc.Class.extend({
    _containerStrategy: null,
    _contentStrategy: null,
    ctor: function (containerStg, contentStg) {
        this.setContainerStrategy(containerStg);
        this.setContentStrategy(contentStg);
    },
    preApply: function (view) {
        this._containerStrategy.preApply(view);
        this._contentStrategy.preApply(view);
    },
    apply: function (view, designedResolution) {
        this._containerStrategy.apply(view, designedResolution);
        return this._contentStrategy.apply(view, designedResolution);
    },
    postApply: function (view) {
        this._containerStrategy.postApply(view);
        this._contentStrategy.postApply(view);
    },
    setContainerStrategy: function (containerStg) {
        if (containerStg instanceof cc.ContainerStrategy)
            this._containerStrategy = containerStg;
    },
    setContentStrategy: function (contentStg) {
        if (contentStg instanceof cc.ContentStrategy)
            this._contentStrategy = contentStg;
    }
});
cc.ResolutionPolicy.EXACT_FIT = 0;
cc.ResolutionPolicy.NO_BORDER = 1;
cc.ResolutionPolicy.SHOW_ALL = 2;
cc.ResolutionPolicy.FIXED_HEIGHT = 3;
cc.ResolutionPolicy.FIXED_WIDTH = 4;
cc.ResolutionPolicy.UNKNOWN = 5;
cc.screen = {
    _supportsFullScreen: false,
    _preOnFullScreenChange: null,
    _touchEvent: "",
    _fn: null,
    _fnMap: [
        [
            'requestFullscreen',
            'exitFullscreen',
            'fullscreenchange',
            'fullscreenEnabled',
            'fullscreenElement'
        ],
        [
            'requestFullScreen',
            'exitFullScreen',
            'fullScreenchange',
            'fullScreenEnabled',
            'fullScreenElement'
        ],
        [
            'webkitRequestFullScreen',
            'webkitCancelFullScreen',
            'webkitfullscreenchange',
            'webkitIsFullScreen',
            'webkitCurrentFullScreenElement'
        ],
        [
            'mozRequestFullScreen',
            'mozCancelFullScreen',
            'mozfullscreenchange',
            'mozFullScreen',
            'mozFullScreenElement'
        ],
        [
            'msRequestFullscreen',
            'msExitFullscreen',
            'MSFullscreenChange',
            'msFullscreenEnabled',
            'msFullscreenElement'
        ]
    ],
    init: function () {
        this._fn = {};
        var i, val, map = this._fnMap, valL;
        for (i = 0, l = map.length; i < l; i++) {
            val = map[i];
            if (val && val[1] in document) {
                for (i = 0, valL = val.length; i < valL; i++) {
                    this._fn[map[0][i]] = val[i];
                }
                break;
            }
        }
        this._supportsFullScreen = (typeof this._fn.requestFullscreen !== 'undefined');
        this._touchEvent = ('ontouchstart' in window) ? 'touchstart' : 'mousedown';
    },
    fullScreen: function () {
        if(!this._supportsFullScreen)   return false;
        else if( document[this._fn.fullscreenElement] === undefined || document[this._fn.fullscreenElement] === null )
            return false;
        else
            return true;
    },
    requestFullScreen: function (element, onFullScreenChange) {
        if (!this._supportsFullScreen) {
            return;
        }
        element = element || document.documentElement;
        if (onFullScreenChange) {
            var eventName = this._fn.fullscreenchange;
            if (this._preOnFullScreenChange) {
                document.removeEventListener(eventName, this._preOnFullScreenChange);
            }
            this._preOnFullScreenChange = onFullScreenChange;
            document.addEventListener(eventName, onFullScreenChange, false);
        }
        return element[this._fn.requestFullscreen]();
    },
    exitFullScreen: function () {
        return this._supportsFullScreen ? document[this._fn.exitFullscreen]() : true;
    },
    autoFullScreen: function (element, onFullScreenChange) {
        element = element || document.body;
        var touchTarget = cc.game.canvas || element;
        var theScreen = this;
        function callback() {
            touchTarget.removeEventListener(theScreen._touchEvent, callback);
            theScreen.requestFullScreen(element, onFullScreenChange);
        }
        this.requestFullScreen(element, onFullScreenChange);
        touchTarget.addEventListener(this._touchEvent, callback);
    }
};
cc.screen.init();
cc.visibleRect = {
    topLeft:cc.p(0,0),
    topRight:cc.p(0,0),
    top:cc.p(0,0),
    bottomLeft:cc.p(0,0),
    bottomRight:cc.p(0,0),
    bottom:cc.p(0,0),
    center:cc.p(0,0),
    left:cc.p(0,0),
    right:cc.p(0,0),
    width:0,
    height:0,
    init:function(visibleRect){
        var w = this.width = visibleRect.width;
        var h = this.height = visibleRect.height;
        var l = visibleRect.x,
            b = visibleRect.y,
            t = b + h,
            r = l + w;
        this.topLeft.x = l;
        this.topLeft.y = t;
        this.topRight.x = r;
        this.topRight.y = t;
        this.top.x = l + w/2;
        this.top.y = t;
        this.bottomLeft.x = l;
        this.bottomLeft.y = b;
        this.bottomRight.x = r;
        this.bottomRight.y = b;
        this.bottom.x = l + w/2;
        this.bottom.y = b;
        this.center.x = l + w/2;
        this.center.y = b + h/2;
        this.left.x = l;
        this.left.y = b + h/2;
        this.right.x = r;
        this.right.y = b + h/2;
    }
};
cc.UIInterfaceOrientationLandscapeLeft = -90;
cc.UIInterfaceOrientationLandscapeRight = 90;
cc.UIInterfaceOrientationPortraitUpsideDown = 180;
cc.UIInterfaceOrientationPortrait = 0;
cc.inputManager = {
    _mousePressed: false,
    _isRegisterEvent: false,
    _preTouchPoint: cc.p(0,0),
    _prevMousePoint: cc.p(0,0),
    _preTouchPool: [],
    _preTouchPoolPointer: 0,
    _touches: [],
    _touchesIntegerDict:{},
    _indexBitsUsed: 0,
    _maxTouches: 5,
    _accelEnabled: false,
    _accelInterval: 1/30,
    _accelMinus: 1,
    _accelCurTime: 0,
    _acceleration: null,
    _accelDeviceEvent: null,
    _getUnUsedIndex: function () {
        var temp = this._indexBitsUsed;
        for (var i = 0; i < this._maxTouches; i++) {
            if (!(temp & 0x00000001)) {
                this._indexBitsUsed |= (1 << i);
                return i;
            }
            temp >>= 1;
        }
        return -1;
    },
    _removeUsedIndexBit: function (index) {
        if (index < 0 || index >= this._maxTouches)
            return;
        var temp = 1 << index;
        temp = ~temp;
        this._indexBitsUsed &= temp;
    },
    _glView: null,
    handleTouchesBegin: function (touches) {
        var selTouch, index, curTouch, touchID, handleTouches = [], locTouchIntDict = this._touchesIntegerDict;
        for(var i = 0, len = touches.length; i< len; i ++){
            selTouch = touches[i];
            touchID = selTouch.getID();
            index = locTouchIntDict[touchID];
            if(index == null){
                var unusedIndex = this._getUnUsedIndex();
                if (unusedIndex === -1) {
                    cc.log(cc._LogInfos.inputManager_handleTouchesBegin, unusedIndex);
                    continue;
                }
                curTouch = this._touches[unusedIndex] = new cc.Touch(selTouch._point.x, selTouch._point.y, selTouch.getID());
                curTouch._setPrevPoint(selTouch._prevPoint);
                locTouchIntDict[touchID] = unusedIndex;
                handleTouches.push(curTouch);
            }
        }
        if(handleTouches.length > 0){
            this._glView._convertTouchesWithScale(handleTouches);
            var touchEvent = new cc.EventTouch(handleTouches);
            touchEvent._eventCode = cc.EventTouch.EventCode.BEGAN;
            cc.eventManager.dispatchEvent(touchEvent);
        }
    },
    handleTouchesMove: function(touches){
        var selTouch, index, touchID, handleTouches = [], locTouches = this._touches;
        for(var i = 0, len = touches.length; i< len; i ++){
            selTouch = touches[i];
            touchID = selTouch.getID();
            index = this._touchesIntegerDict[touchID];
            if(index == null){
                continue;
            }
            if(locTouches[index]){
                locTouches[index]._setPoint(selTouch._point);
                locTouches[index]._setPrevPoint(selTouch._prevPoint);
                handleTouches.push(locTouches[index]);
            }
        }
        if(handleTouches.length > 0){
            this._glView._convertTouchesWithScale(handleTouches);
            var touchEvent = new cc.EventTouch(handleTouches);
            touchEvent._eventCode = cc.EventTouch.EventCode.MOVED;
            cc.eventManager.dispatchEvent(touchEvent);
        }
    },
    handleTouchesEnd: function(touches){
        var handleTouches = this.getSetOfTouchesEndOrCancel(touches);
        if(handleTouches.length > 0) {
            this._glView._convertTouchesWithScale(handleTouches);
            var touchEvent = new cc.EventTouch(handleTouches);
            touchEvent._eventCode = cc.EventTouch.EventCode.ENDED;
            cc.eventManager.dispatchEvent(touchEvent);
        }
    },
    handleTouchesCancel: function(touches){
        var handleTouches = this.getSetOfTouchesEndOrCancel(touches);
        if(handleTouches.length > 0) {
            this._glView._convertTouchesWithScale(handleTouches);
            var touchEvent = new cc.EventTouch(handleTouches);
            touchEvent._eventCode = cc.EventTouch.EventCode.CANCELLED;
            cc.eventManager.dispatchEvent(touchEvent);
        }
    },
    getSetOfTouchesEndOrCancel: function(touches) {
        var selTouch, index, touchID, handleTouches = [], locTouches = this._touches, locTouchesIntDict = this._touchesIntegerDict;
        for(var i = 0, len = touches.length; i< len; i ++){
            selTouch = touches[i];
            touchID = selTouch.getID();
            index = locTouchesIntDict[touchID];
            if(index == null){
                continue;
            }
            if(locTouches[index]){
                locTouches[index]._setPoint(selTouch._point);
                locTouches[index]._setPrevPoint(selTouch._prevPoint);
                handleTouches.push(locTouches[index]);
                this._removeUsedIndexBit(index);
                delete locTouchesIntDict[touchID];
            }
        }
        return handleTouches;
    },
    getHTMLElementPosition: function (element) {
        var docElem = document.documentElement;
        var win = window;
        var box = null;
        if (cc.isFunction(element.getBoundingClientRect)) {
            box = element.getBoundingClientRect();
        } else {
            box = {
                left: 0,
                top: 0,
                width: parseInt(element.style.width),
                height: parseInt(element.style.height)
            };
        }
        return {
            left: box.left + win.pageXOffset - docElem.clientLeft,
            top: box.top + win.pageYOffset - docElem.clientTop,
            width: box.width,
            height: box.height
        };
    },
    getPreTouch: function(touch){
        var preTouch = null;
        var locPreTouchPool = this._preTouchPool;
        var id = touch.getID();
        for (var i = locPreTouchPool.length - 1; i >= 0; i--) {
            if (locPreTouchPool[i].getID() === id) {
                preTouch = locPreTouchPool[i];
                break;
            }
        }
        if (!preTouch)
            preTouch = touch;
        return preTouch;
    },
    setPreTouch: function(touch){
        var find = false;
        var locPreTouchPool = this._preTouchPool;
        var id = touch.getID();
        for (var i = locPreTouchPool.length - 1; i >= 0; i--) {
            if (locPreTouchPool[i].getID() === id) {
                locPreTouchPool[i] = touch;
                find = true;
                break;
            }
        }
        if (!find) {
            if (locPreTouchPool.length <= 50) {
                locPreTouchPool.push(touch);
            } else {
                locPreTouchPool[this._preTouchPoolPointer] = touch;
                this._preTouchPoolPointer = (this._preTouchPoolPointer + 1) % 50;
            }
        }
    },
    getTouchByXY: function(tx, ty, pos){
        var locPreTouch = this._preTouchPoint;
        var location = this._glView.convertToLocationInView(tx, ty, pos);
        var touch = new cc.Touch(location.x,  location.y);
        touch._setPrevPoint(locPreTouch.x, locPreTouch.y);
        locPreTouch.x = location.x;
        locPreTouch.y = location.y;
        return touch;
    },
    getMouseEvent: function(location, pos, eventType){
        var locPreMouse = this._prevMousePoint;
        this._glView._convertMouseToLocationInView(location, pos);
        var mouseEvent = new cc.EventMouse(eventType);
        mouseEvent.setLocation(location.x, location.y);
        mouseEvent._setPrevCursor(locPreMouse.x, locPreMouse.y);
        locPreMouse.x = location.x;
        locPreMouse.y = location.y;
        return mouseEvent;
    },
    getPointByEvent: function(event, pos){
        if (event.pageX != null)
            return {x: event.pageX, y: event.pageY};
        pos.left -= document.body.scrollLeft;
        pos.top -= document.body.scrollTop;
        return {x: event.clientX, y: event.clientY};
    },
    getTouchesByEvent: function(event, pos){
        var touchArr = [], locView = this._glView;
        var touch_event, touch, preLocation;
        var locPreTouch = this._preTouchPoint;
        var length = event.changedTouches.length;
        for (var i = 0; i < length; i++) {
            touch_event = event.changedTouches[i];
            if (touch_event) {
                var location;
                if (cc.sys.BROWSER_TYPE_FIREFOX === cc.sys.browserType)
                    location = locView.convertToLocationInView(touch_event.pageX, touch_event.pageY, pos);
                else
                    location = locView.convertToLocationInView(touch_event.clientX, touch_event.clientY, pos);
                if (touch_event.identifier != null) {
                    touch = new cc.Touch(location.x, location.y, touch_event.identifier);
                    preLocation = this.getPreTouch(touch).getLocation();
                    touch._setPrevPoint(preLocation.x, preLocation.y);
                    this.setPreTouch(touch);
                } else {
                    touch = new cc.Touch(location.x, location.y);
                    touch._setPrevPoint(locPreTouch.x, locPreTouch.y);
                }
                locPreTouch.x = location.x;
                locPreTouch.y = location.y;
                touchArr.push(touch);
            }
        }
        return touchArr;
    },
    registerSystemEvent: function(element){
        if(this._isRegisterEvent) return;
        var locView = this._glView = cc.view;
        var selfPointer = this;
        var supportMouse = ('mouse' in cc.sys.capabilities), supportTouches = ('touches' in cc.sys.capabilities);
        var prohibition = false;
        if( cc.sys.isMobile)
            prohibition = true;
        if (supportMouse) {
            window.addEventListener('mousedown', function () {
                selfPointer._mousePressed = true;
            }, false);
            window.addEventListener('mouseup', function (event) {
                if(prohibition) return;
                var savePressed = selfPointer._mousePressed;
                selfPointer._mousePressed = false;
                if(!savePressed)
                    return;
                var pos = selfPointer.getHTMLElementPosition(element);
                var location = selfPointer.getPointByEvent(event, pos);
                if (!cc.rectContainsPoint(new cc.Rect(pos.left, pos.top, pos.width, pos.height), location)){
                    selfPointer.handleTouchesEnd([selfPointer.getTouchByXY(location.x, location.y, pos)]);
                    var mouseEvent = selfPointer.getMouseEvent(location,pos,cc.EventMouse.UP);
                    mouseEvent.setButton(event.button);
                    cc.eventManager.dispatchEvent(mouseEvent);
                }
            }, false);
            element.addEventListener("mousedown", function (event) {
                if(prohibition) return;
                selfPointer._mousePressed = true;
                var pos = selfPointer.getHTMLElementPosition(element);
                var location = selfPointer.getPointByEvent(event, pos);
                selfPointer.handleTouchesBegin([selfPointer.getTouchByXY(location.x, location.y, pos)]);
                var mouseEvent = selfPointer.getMouseEvent(location,pos,cc.EventMouse.DOWN);
                mouseEvent.setButton(event.button);
                cc.eventManager.dispatchEvent(mouseEvent);
                event.stopPropagation();
                event.preventDefault();
                element.focus();
            }, false);
            element.addEventListener("mouseup", function (event) {
                if(prohibition) return;
                selfPointer._mousePressed = false;
                var pos = selfPointer.getHTMLElementPosition(element);
                var location = selfPointer.getPointByEvent(event, pos);
                selfPointer.handleTouchesEnd([selfPointer.getTouchByXY(location.x, location.y, pos)]);
                var mouseEvent = selfPointer.getMouseEvent(location,pos,cc.EventMouse.UP);
                mouseEvent.setButton(event.button);
                cc.eventManager.dispatchEvent(mouseEvent);
                event.stopPropagation();
                event.preventDefault();
            }, false);
            element.addEventListener("mousemove", function (event) {
                if(prohibition) return;
                var pos = selfPointer.getHTMLElementPosition(element);
                var location = selfPointer.getPointByEvent(event, pos);
                selfPointer.handleTouchesMove([selfPointer.getTouchByXY(location.x, location.y, pos)]);
                var mouseEvent = selfPointer.getMouseEvent(location,pos,cc.EventMouse.MOVE);
                if(selfPointer._mousePressed)
                    mouseEvent.setButton(event.button);
                else
                    mouseEvent.setButton(null);
                cc.eventManager.dispatchEvent(mouseEvent);
                event.stopPropagation();
                event.preventDefault();
            }, false);
            element.addEventListener("mousewheel", function (event) {
                var pos = selfPointer.getHTMLElementPosition(element);
                var location = selfPointer.getPointByEvent(event, pos);
                var mouseEvent = selfPointer.getMouseEvent(location,pos,cc.EventMouse.SCROLL);
                mouseEvent.setButton(event.button);
                mouseEvent.setScrollData(0, event.wheelDelta);
                cc.eventManager.dispatchEvent(mouseEvent);
                event.stopPropagation();
                event.preventDefault();
            }, false);
            element.addEventListener("DOMMouseScroll", function(event) {
                var pos = selfPointer.getHTMLElementPosition(element);
                var location = selfPointer.getPointByEvent(event, pos);
                var mouseEvent = selfPointer.getMouseEvent(location,pos,cc.EventMouse.SCROLL);
                mouseEvent.setButton(event.button);
                mouseEvent.setScrollData(0, event.detail * -120);
                cc.eventManager.dispatchEvent(mouseEvent);
                event.stopPropagation();
                event.preventDefault();
            }, false);
        }
        if(window.navigator.msPointerEnabled){
            var _pointerEventsMap = {
                "MSPointerDown"     : selfPointer.handleTouchesBegin,
                "MSPointerMove"     : selfPointer.handleTouchesMove,
                "MSPointerUp"       : selfPointer.handleTouchesEnd,
                "MSPointerCancel"   : selfPointer.handleTouchesCancel
            };
            for(var eventName in _pointerEventsMap){
                (function(_pointerEvent, _touchEvent){
                    element.addEventListener(_pointerEvent, function (event){
                        var pos = selfPointer.getHTMLElementPosition(element);
                        pos.left -= document.documentElement.scrollLeft;
                        pos.top -= document.documentElement.scrollTop;
                        _touchEvent.call(selfPointer, [selfPointer.getTouchByXY(event.clientX, event.clientY, pos)]);
                        event.stopPropagation();
                    }, false);
                })(eventName, _pointerEventsMap[eventName]);
            }
        }
        if(supportTouches) {
            element.addEventListener("touchstart", function (event) {
                if (!event.changedTouches) return;
                var pos = selfPointer.getHTMLElementPosition(element);
                pos.left -= document.body.scrollLeft;
                pos.top -= document.body.scrollTop;
                selfPointer.handleTouchesBegin(selfPointer.getTouchesByEvent(event, pos));
                event.stopPropagation();
                event.preventDefault();
                element.focus();
            }, false);
            element.addEventListener("touchmove", function (event) {
                if (!event.changedTouches) return;
                var pos = selfPointer.getHTMLElementPosition(element);
                pos.left -= document.body.scrollLeft;
                pos.top -= document.body.scrollTop;
                selfPointer.handleTouchesMove(selfPointer.getTouchesByEvent(event, pos));
                event.stopPropagation();
                event.preventDefault();
            }, false);
            element.addEventListener("touchend", function (event) {
                if (!event.changedTouches) return;
                var pos = selfPointer.getHTMLElementPosition(element);
                pos.left -= document.body.scrollLeft;
                pos.top -= document.body.scrollTop;
                selfPointer.handleTouchesEnd(selfPointer.getTouchesByEvent(event, pos));
                event.stopPropagation();
                event.preventDefault();
            }, false);
            element.addEventListener("touchcancel", function (event) {
                if (!event.changedTouches) return;
                var pos = selfPointer.getHTMLElementPosition(element);
                pos.left -= document.body.scrollLeft;
                pos.top -= document.body.scrollTop;
                selfPointer.handleTouchesCancel(selfPointer.getTouchesByEvent(event, pos));
                event.stopPropagation();
                event.preventDefault();
            }, false);
        }
        this._registerKeyboardEvent();
        this._registerAccelerometerEvent();
        this._isRegisterEvent = true;
    },
    _registerKeyboardEvent: function(){},
    _registerAccelerometerEvent: function(){},
    update:function(dt){
        if(this._accelCurTime > this._accelInterval){
            this._accelCurTime -= this._accelInterval;
            cc.eventManager.dispatchEvent(new cc.EventAcceleration(this._acceleration));
        }
        this._accelCurTime += dt;
    }
};
cc.AffineTransform = function (a, b, c, d, tx, ty) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
};
cc.affineTransformMake = function (a, b, c, d, tx, ty) {
    return {a: a, b: b, c: c, d: d, tx: tx, ty: ty};
};
cc.pointApplyAffineTransform = function (point, transOrY, t) {
    var x, y;
    if (t === undefined) {
        t = transOrY;
        x = point.x;
        y = point.y;
    } else {
        x = point;
        y = transOrY;
    }
    return {x: t.a * x + t.c * y + t.tx, y: t.b * x + t.d * y + t.ty};
};
cc._pointApplyAffineTransform = function (x, y, t) {
    return cc.pointApplyAffineTransform(x, y, t);
};
cc.sizeApplyAffineTransform = function (size, t) {
    return {width: t.a * size.width + t.c * size.height, height: t.b * size.width + t.d * size.height};
};
cc.affineTransformMakeIdentity = function () {
    return {a: 1.0, b: 0.0, c: 0.0, d: 1.0, tx: 0.0, ty: 0.0};
};
cc.affineTransformIdentity = function () {
    return {a: 1.0, b: 0.0, c: 0.0, d: 1.0, tx: 0.0, ty: 0.0};
};
cc.rectApplyAffineTransform = function (rect, anAffineTransform) {
    var top = cc.rectGetMinY(rect);
    var left = cc.rectGetMinX(rect);
    var right = cc.rectGetMaxX(rect);
    var bottom = cc.rectGetMaxY(rect);
    var topLeft = cc.pointApplyAffineTransform(left, top, anAffineTransform);
    var topRight = cc.pointApplyAffineTransform(right, top, anAffineTransform);
    var bottomLeft = cc.pointApplyAffineTransform(left, bottom, anAffineTransform);
    var bottomRight = cc.pointApplyAffineTransform(right, bottom, anAffineTransform);
    var minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    var maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    var minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    var maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    return cc.rect(minX, minY, (maxX - minX), (maxY - minY));
};
cc._rectApplyAffineTransformIn = function(rect, anAffineTransform){
    var top = cc.rectGetMinY(rect);
    var left = cc.rectGetMinX(rect);
    var right = cc.rectGetMaxX(rect);
    var bottom = cc.rectGetMaxY(rect);
    var topLeft = cc.pointApplyAffineTransform(left, top, anAffineTransform);
    var topRight = cc.pointApplyAffineTransform(right, top, anAffineTransform);
    var bottomLeft = cc.pointApplyAffineTransform(left, bottom, anAffineTransform);
    var bottomRight = cc.pointApplyAffineTransform(right, bottom, anAffineTransform);
    var minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    var maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    var minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    var maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    rect.x = minX;
    rect.y = minY;
    rect.width = maxX - minX;
    rect.height = maxY - minY;
    return rect;
};
cc.affineTransformTranslate = function (t, tx, ty) {
    return {
        a: t.a,
        b: t.b,
        c: t.c,
        d: t.d,
        tx: t.tx + t.a * tx + t.c * ty,
        ty: t.ty + t.b * tx + t.d * ty
    };
};
cc.affineTransformScale = function (t, sx, sy) {
    return {a: t.a * sx, b: t.b * sx, c: t.c * sy, d: t.d * sy, tx: t.tx, ty: t.ty};
};
cc.affineTransformRotate = function (aTransform, anAngle) {
    var fSin = Math.sin(anAngle);
    var fCos = Math.cos(anAngle);
    return {a: aTransform.a * fCos + aTransform.c * fSin,
        b: aTransform.b * fCos + aTransform.d * fSin,
        c: aTransform.c * fCos - aTransform.a * fSin,
        d: aTransform.d * fCos - aTransform.b * fSin,
        tx: aTransform.tx,
        ty: aTransform.ty};
};
cc.affineTransformConcat = function (t1, t2) {
    return {a: t1.a * t2.a + t1.b * t2.c,
        b: t1.a * t2.b + t1.b * t2.d,
        c: t1.c * t2.a + t1.d * t2.c,
        d: t1.c * t2.b + t1.d * t2.d,
        tx: t1.tx * t2.a + t1.ty * t2.c + t2.tx,
        ty: t1.tx * t2.b + t1.ty * t2.d + t2.ty};
};
cc.affineTransformConcatIn = function (t1, t2) {
    var a = t1.a, b = t1.b, c = t1.c, d = t1.d, tx = t1.tx, ty = t1.ty;
    t1.a = a * t2.a + b * t2.c;
    t1.b = a * t2.b + b * t2.d;
    t1.c = c * t2.a + d * t2.c;
    t1.d = c * t2.b + d * t2.d;
    t1.tx = tx * t2.a + ty * t2.c + t2.tx;
    t1.ty = tx * t2.b + ty * t2.d + t2.ty;
    return t1;
};
cc.affineTransformEqualToTransform = function (t1, t2) {
    return ((t1.a === t2.a) && (t1.b === t2.b) && (t1.c === t2.c) && (t1.d === t2.d) && (t1.tx === t2.tx) && (t1.ty === t2.ty));
};
cc.affineTransformInvert = function (t) {
    var determinant = 1 / (t.a * t.d - t.b * t.c);
    return {a: determinant * t.d, b: -determinant * t.b, c: -determinant * t.c, d: determinant * t.a,
        tx: determinant * (t.c * t.ty - t.d * t.tx), ty: determinant * (t.b * t.tx - t.a * t.ty)};
};
cc.POINT_EPSILON = parseFloat('1.192092896e-07F');
cc.pNeg = function (point) {
    return cc.p(-point.x, -point.y);
};
cc.pAdd = function (v1, v2) {
    return cc.p(v1.x + v2.x, v1.y + v2.y);
};
cc.pSub = function (v1, v2) {
    return cc.p(v1.x - v2.x, v1.y - v2.y);
};
cc.pMult = function (point, floatVar) {
    return cc.p(point.x * floatVar, point.y * floatVar);
};
cc.pMidpoint = function (v1, v2) {
    return cc.pMult(cc.pAdd(v1, v2), 0.5);
};
cc.pDot = function (v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
};
cc.pCross = function (v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
};
cc.pPerp = function (point) {
    return cc.p(-point.y, point.x);
};
cc.pRPerp = function (point) {
    return cc.p(point.y, -point.x);
};
cc.pProject = function (v1, v2) {
    return cc.pMult(v2, cc.pDot(v1, v2) / cc.pDot(v2, v2));
};
cc.pRotate = function (v1, v2) {
    return cc.p(v1.x * v2.x - v1.y * v2.y, v1.x * v2.y + v1.y * v2.x);
};
cc.pUnrotate = function (v1, v2) {
    return cc.p(v1.x * v2.x + v1.y * v2.y, v1.y * v2.x - v1.x * v2.y);
};
cc.pLengthSQ = function (v) {
    return cc.pDot(v, v);
};
cc.pDistanceSQ = function(point1, point2){
    return cc.pLengthSQ(cc.pSub(point1,point2));
};
cc.pLength = function (v) {
    return Math.sqrt(cc.pLengthSQ(v));
};
cc.pDistance = function (v1, v2) {
    return cc.pLength(cc.pSub(v1, v2));
};
cc.pNormalize = function (v) {
    var n = cc.pLength(v);
    return n === 0 ? cc.p(v) : cc.pMult(v, 1.0 / n);
};
cc.pForAngle = function (a) {
    return cc.p(Math.cos(a), Math.sin(a));
};
cc.pToAngle = function (v) {
    return Math.atan2(v.y, v.x);
};
cc.clampf = function (value, min_inclusive, max_inclusive) {
    if (min_inclusive > max_inclusive) {
        var temp = min_inclusive;
        min_inclusive = max_inclusive;
        max_inclusive = temp;
    }
    return value < min_inclusive ? min_inclusive : value < max_inclusive ? value : max_inclusive;
};
cc.pClamp = function (p, min_inclusive, max_inclusive) {
    return cc.p(cc.clampf(p.x, min_inclusive.x, max_inclusive.x), cc.clampf(p.y, min_inclusive.y, max_inclusive.y));
};
cc.pFromSize = function (s) {
    return cc.p(s.width, s.height);
};
cc.pCompOp = function (p, opFunc) {
    return cc.p(opFunc(p.x), opFunc(p.y));
};
cc.pLerp = function (a, b, alpha) {
    return cc.pAdd(cc.pMult(a, 1 - alpha), cc.pMult(b, alpha));
};
cc.pFuzzyEqual = function (a, b, variance) {
    if (a.x - variance <= b.x && b.x <= a.x + variance) {
        if (a.y - variance <= b.y && b.y <= a.y + variance)
            return true;
    }
    return false;
};
cc.pCompMult = function (a, b) {
    return cc.p(a.x * b.x, a.y * b.y);
};
cc.pAngleSigned = function (a, b) {
    var a2 = cc.pNormalize(a);
    var b2 = cc.pNormalize(b);
    var angle = Math.atan2(a2.x * b2.y - a2.y * b2.x, cc.pDot(a2, b2));
    if (Math.abs(angle) < cc.POINT_EPSILON)
        return 0.0;
    return angle;
};
cc.pAngle = function (a, b) {
    var angle = Math.acos(cc.pDot(cc.pNormalize(a), cc.pNormalize(b)));
    if (Math.abs(angle) < cc.POINT_EPSILON) return 0.0;
    return angle;
};
cc.pRotateByAngle = function (v, pivot, angle) {
    var r = cc.pSub(v, pivot);
    var cosa = Math.cos(angle), sina = Math.sin(angle);
    var t = r.x;
    r.x = t * cosa - r.y * sina + pivot.x;
    r.y = t * sina + r.y * cosa + pivot.y;
    return r;
};
cc.pLineIntersect = function (A, B, C, D, retP) {
    if ((A.x === B.x && A.y === B.y) || (C.x === D.x && C.y === D.y)) {
        return false;
    }
    var BAx = B.x - A.x;
    var BAy = B.y - A.y;
    var DCx = D.x - C.x;
    var DCy = D.y - C.y;
    var ACx = A.x - C.x;
    var ACy = A.y - C.y;
    var denom = DCy * BAx - DCx * BAy;
    retP.x = DCx * ACy - DCy * ACx;
    retP.y = BAx * ACy - BAy * ACx;
    if (denom === 0) {
        if (retP.x === 0 || retP.y === 0) {
            return true;
        }
        return false;
    }
    retP.x = retP.x / denom;
    retP.y = retP.y / denom;
    return true;
};
cc.pSegmentIntersect = function (A, B, C, D) {
    var retP = cc.p(0, 0);
    if (cc.pLineIntersect(A, B, C, D, retP))
        if (retP.x >= 0.0 && retP.x <= 1.0 && retP.y >= 0.0 && retP.y <= 1.0)
            return true;
    return false;
};
cc.pIntersectPoint = function (A, B, C, D) {
    var retP = cc.p(0, 0);
    if (cc.pLineIntersect(A, B, C, D, retP)) {
        var P = cc.p(0, 0);
        P.x = A.x + retP.x * (B.x - A.x);
        P.y = A.y + retP.x * (B.y - A.y);
        return P;
    }
    return cc.p(0,0);
};
cc.pSameAs = function (A, B) {
    if ((A != null) && (B != null)) {
        return (A.x === B.x && A.y === B.y);
    }
    return false;
};
cc.pZeroIn = function(v) {
    v.x = 0;
    v.y = 0;
};
cc.pIn = function(v1, v2) {
    v1.x = v2.x;
    v1.y = v2.y;
};
cc.pMultIn = function(point, floatVar) {
    point.x *= floatVar;
    point.y *= floatVar;
};
cc.pSubIn = function(v1, v2) {
    v1.x -= v2.x;
    v1.y -= v2.y;
};
cc.pAddIn = function(v1, v2) {
    v1.x += v2.x;
    v1.y += v2.y;
};
cc.pNormalizeIn = function(v) {
    cc.pMultIn(v, 1.0 / Math.sqrt(v.x * v.x + v.y * v.y));
};
cc.Touch = cc.Class.extend({
    _point:null,
    _prevPoint:null,
    _id:0,
    _startPointCaptured: false,
    _startPoint:null,
    ctor:function (x, y, id) {
        this.setTouchInfo(id, x, y);
    },
    getLocation:function () {
        return {x: this._point.x, y: this._point.y};
    },
	getLocationX: function () {
		return this._point.x;
	},
	getLocationY: function () {
		return this._point.y;
	},
    getPreviousLocation:function () {
        return {x: this._prevPoint.x, y: this._prevPoint.y};
    },
    getStartLocation: function() {
        return {x: this._startPoint.x, y: this._startPoint.y};
    },
    getDelta:function () {
        return cc.pSub(this._point, this._prevPoint);
    },
    getLocationInView: function() {
        return {x: this._point.x, y: this._point.y};
    },
    getPreviousLocationInView: function(){
        return {x: this._prevPoint.x, y: this._prevPoint.y};
    },
    getStartLocationInView: function(){
        return {x: this._startPoint.x, y: this._startPoint.y};
    },
    getID:function () {
        return this._id;
    },
    getId:function () {
        cc.log("getId is deprecated. Please use getID instead.");
        return this._id;
    },
    setTouchInfo:function (id, x, y) {
        this._prevPoint = this._point;
        this._point = cc.p(x || 0, y || 0);
        this._id = id;
        if (!this._startPointCaptured) {
            this._startPoint = cc.p(this._point);
            cc.view._convertPointWithScale(this._startPoint);
            this._startPointCaptured = true;
        }
    },
    _setPoint: function(x, y){
        if(y === undefined){
            this._point.x = x.x;
            this._point.y = x.y;
        }else{
            this._point.x = x;
            this._point.y = y;
        }
    },
    _setPrevPoint:function (x, y) {
        if(y === undefined)
            this._prevPoint = cc.p(x.x, x.y);
        else
            this._prevPoint = cc.p(x || 0, y || 0);
    }
});
cc.Event = cc.Class.extend({
    _type: 0,
    _isStopped: false,
    _currentTarget: null,
    _setCurrentTarget: function (target) {
        this._currentTarget = target;
    },
    ctor: function (type) {
        this._type = type;
    },
    getType: function () {
        return this._type;
    },
    stopPropagation: function () {
        this._isStopped = true;
    },
    isStopped: function () {
        return this._isStopped;
    },
    getCurrentTarget: function () {
        return this._currentTarget;
    }
});
cc.Event.TOUCH = 0;
cc.Event.KEYBOARD = 1;
cc.Event.ACCELERATION = 2;
cc.Event.MOUSE = 3;
cc.Event.FOCUS = 4;
cc.Event.CUSTOM = 6;
cc.EventCustom = cc.Event.extend({
    _eventName: null,
    _userData: null,
    ctor: function (eventName) {
        cc.Event.prototype.ctor.call(this, cc.Event.CUSTOM);
        this._eventName = eventName;
    },
    setUserData: function (data) {
        this._userData = data;
    },
    getUserData: function () {
        return this._userData;
    },
    getEventName: function () {
        return this._eventName;
    }
});
cc.EventMouse = cc.Event.extend({
    _eventType: 0,
    _button: 0,
    _x: 0,
    _y: 0,
    _prevX: 0,
    _prevY: 0,
    _scrollX: 0,
    _scrollY: 0,
    ctor: function (eventType) {
        cc.Event.prototype.ctor.call(this, cc.Event.MOUSE);
        this._eventType = eventType;
    },
    setScrollData: function (scrollX, scrollY) {
        this._scrollX = scrollX;
        this._scrollY = scrollY;
    },
    getScrollX: function () {
        return this._scrollX;
    },
    getScrollY: function () {
        return this._scrollY;
    },
    setLocation: function (x, y) {
        this._x = x;
        this._y = y;
    },
    getLocation: function () {
        return {x: this._x, y: this._y};
    },
	getLocationInView: function() {
		return {x: this._x, y: cc.view._designResolutionSize.height - this._y};
	},
    _setPrevCursor: function (x, y) {
        this._prevX = x;
        this._prevY = y;
    },
    getDelta: function () {
        return {x: this._x - this._prevX, y: this._y - this._prevY};
    },
    getDeltaX: function () {
        return this._x - this._prevX;
    },
    getDeltaY: function () {
        return this._y - this._prevY;
    },
    setButton: function (button) {
        this._button = button;
    },
    getButton: function () {
        return this._button;
    },
    getLocationX: function () {
        return this._x;
    },
    getLocationY: function () {
        return this._y;
    }
});
cc.EventMouse.NONE = 0;
cc.EventMouse.DOWN = 1;
cc.EventMouse.UP = 2;
cc.EventMouse.MOVE = 3;
cc.EventMouse.SCROLL = 4;
cc.EventMouse.BUTTON_LEFT = 0;
cc.EventMouse.BUTTON_RIGHT = 2;
cc.EventMouse.BUTTON_MIDDLE = 1;
cc.EventMouse.BUTTON_4 = 3;
cc.EventMouse.BUTTON_5 = 4;
cc.EventMouse.BUTTON_6 = 5;
cc.EventMouse.BUTTON_7 = 6;
cc.EventMouse.BUTTON_8 = 7;
cc.EventTouch = cc.Event.extend({
    _eventCode: 0,
    _touches: null,
    ctor: function (arr) {
        cc.Event.prototype.ctor.call(this, cc.Event.TOUCH);
        this._touches = arr || [];
    },
    getEventCode: function () {
        return this._eventCode;
    },
    getTouches: function () {
        return this._touches;
    },
    _setEventCode: function (eventCode) {
        this._eventCode = eventCode;
    },
    _setTouches: function (touches) {
        this._touches = touches;
    }
});
cc.EventTouch.MAX_TOUCHES = 5;
cc.EventTouch.EventCode = {BEGAN: 0, MOVED: 1, ENDED: 2, CANCELLED: 3};
cc.EventFocus = cc.Event.extend({
    _widgetGetFocus: null,
    _widgetLoseFocus: null,
    ctor: function(widgetLoseFocus, widgetGetFocus){
        cc.Event.prototype.ctor.call(this, cc.Event.FOCUS);
        this._widgetGetFocus = widgetGetFocus;
        this._widgetLoseFocus = widgetLoseFocus;
    }
});
cc.EventListener = cc.Class.extend({
    _onEvent: null,
    _type: 0,
    _listenerID: null,
    _registered: false,
    _fixedPriority: 0,
    _node: null,
    _paused: true,
    _isEnabled: true,
    ctor: function (type, listenerID, callback) {
        this._onEvent = callback;
        this._type = type || 0;
        this._listenerID = listenerID || "";
    },
    _setPaused: function (paused) {
        this._paused = paused;
    },
    _isPaused: function () {
        return this._paused;
    },
    _setRegistered: function (registered) {
        this._registered = registered;
    },
    _isRegistered: function () {
        return this._registered;
    },
    _getType: function () {
        return this._type;
    },
    _getListenerID: function () {
        return this._listenerID;
    },
    _setFixedPriority: function (fixedPriority) {
        this._fixedPriority = fixedPriority;
    },
    _getFixedPriority: function () {
        return this._fixedPriority;
    },
    _setSceneGraphPriority: function (node) {
        this._node = node;
    },
    _getSceneGraphPriority: function () {
        return this._node;
    },
    checkAvailable: function () {
        return this._onEvent !== null;
    },
    clone: function () {
        return null;
    },
    setEnabled: function(enabled){
        this._isEnabled = enabled;
    },
    isEnabled: function(){
        return this._isEnabled;
    },
    retain:function () {
    },
    release:function () {
    }
});
cc.EventListener.UNKNOWN = 0;
cc.EventListener.TOUCH_ONE_BY_ONE = 1;
cc.EventListener.TOUCH_ALL_AT_ONCE = 2;
cc.EventListener.KEYBOARD = 3;
cc.EventListener.MOUSE = 4;
cc.EventListener.ACCELERATION = 6;
cc.EventListener.FOCUS = 7;
cc.EventListener.CUSTOM = 8;
cc._EventListenerCustom = cc.EventListener.extend({
    _onCustomEvent: null,
    ctor: function (listenerId, callback) {
        this._onCustomEvent = callback;
        var selfPointer = this;
        var listener = function (event) {
            if (selfPointer._onCustomEvent !== null)
                selfPointer._onCustomEvent(event);
        };
        cc.EventListener.prototype.ctor.call(this, cc.EventListener.CUSTOM, listenerId, listener);
    },
    checkAvailable: function () {
        return (cc.EventListener.prototype.checkAvailable.call(this) && this._onCustomEvent !== null);
    },
    clone: function () {
        return new cc._EventListenerCustom(this._listenerID, this._onCustomEvent);
    }
});
cc._EventListenerCustom.create = function (eventName, callback) {
    return new cc._EventListenerCustom(eventName, callback);
};
cc._EventListenerMouse = cc.EventListener.extend({
    onMouseDown: null,
    onMouseUp: null,
    onMouseMove: null,
    onMouseScroll: null,
    ctor: function () {
        var selfPointer = this;
        var listener = function (event) {
            var eventType = cc.EventMouse;
            switch (event._eventType) {
                case eventType.DOWN:
                    if (selfPointer.onMouseDown)
                        selfPointer.onMouseDown(event);
                    break;
                case eventType.UP:
                    if (selfPointer.onMouseUp)
                        selfPointer.onMouseUp(event);
                    break;
                case eventType.MOVE:
                    if (selfPointer.onMouseMove)
                        selfPointer.onMouseMove(event);
                    break;
                case eventType.SCROLL:
                    if (selfPointer.onMouseScroll)
                        selfPointer.onMouseScroll(event);
                    break;
                default:
                    break;
            }
        };
        cc.EventListener.prototype.ctor.call(this, cc.EventListener.MOUSE, cc._EventListenerMouse.LISTENER_ID, listener);
    },
    clone: function () {
        var eventListener = new cc._EventListenerMouse();
        eventListener.onMouseDown = this.onMouseDown;
        eventListener.onMouseUp = this.onMouseUp;
        eventListener.onMouseMove = this.onMouseMove;
        eventListener.onMouseScroll = this.onMouseScroll;
        return eventListener;
    },
    checkAvailable: function () {
        return true;
    }
});
cc._EventListenerMouse.LISTENER_ID = "__cc_mouse";
cc._EventListenerMouse.create = function () {
    return new cc._EventListenerMouse();
};
cc._EventListenerTouchOneByOne = cc.EventListener.extend({
    _claimedTouches: null,
    swallowTouches: false,
    onTouchBegan: null,
    onTouchMoved: null,
    onTouchEnded: null,
    onTouchCancelled: null,
    ctor: function () {
        cc.EventListener.prototype.ctor.call(this, cc.EventListener.TOUCH_ONE_BY_ONE, cc._EventListenerTouchOneByOne.LISTENER_ID, null);
        this._claimedTouches = [];
    },
    setSwallowTouches: function (needSwallow) {
        this.swallowTouches = needSwallow;
    },
    isSwallowTouches: function(){
        return this.swallowTouches;
    },
    clone: function () {
        var eventListener = new cc._EventListenerTouchOneByOne();
        eventListener.onTouchBegan = this.onTouchBegan;
        eventListener.onTouchMoved = this.onTouchMoved;
        eventListener.onTouchEnded = this.onTouchEnded;
        eventListener.onTouchCancelled = this.onTouchCancelled;
        eventListener.swallowTouches = this.swallowTouches;
        return eventListener;
    },
    checkAvailable: function () {
        if(!this.onTouchBegan){
            cc.log(cc._LogInfos._EventListenerTouchOneByOne_checkAvailable);
            return false;
        }
        return true;
    }
});
cc._EventListenerTouchOneByOne.LISTENER_ID = "__cc_touch_one_by_one";
cc._EventListenerTouchOneByOne.create = function () {
    return new cc._EventListenerTouchOneByOne();
};
cc._EventListenerTouchAllAtOnce = cc.EventListener.extend({
    onTouchesBegan: null,
    onTouchesMoved: null,
    onTouchesEnded: null,
    onTouchesCancelled: null,
    ctor: function(){
       cc.EventListener.prototype.ctor.call(this, cc.EventListener.TOUCH_ALL_AT_ONCE, cc._EventListenerTouchAllAtOnce.LISTENER_ID, null);
    },
    clone: function(){
        var eventListener = new cc._EventListenerTouchAllAtOnce();
        eventListener.onTouchesBegan = this.onTouchesBegan;
        eventListener.onTouchesMoved = this.onTouchesMoved;
        eventListener.onTouchesEnded = this.onTouchesEnded;
        eventListener.onTouchesCancelled = this.onTouchesCancelled;
        return eventListener;
    },
    checkAvailable: function(){
        if (this.onTouchesBegan === null && this.onTouchesMoved === null
            && this.onTouchesEnded === null && this.onTouchesCancelled === null) {
            cc.log(cc._LogInfos._EventListenerTouchAllAtOnce_checkAvailable);
            return false;
        }
        return true;
    }
});
cc._EventListenerTouchAllAtOnce.LISTENER_ID = "__cc_touch_all_at_once";
cc._EventListenerTouchAllAtOnce.create = function(){
     return new cc._EventListenerTouchAllAtOnce();
};
cc.EventListener.create = function(argObj){
    cc.assert(argObj&&argObj.event, cc._LogInfos.EventListener_create);
    var listenerType = argObj.event;
    delete argObj.event;
    var listener = null;
    if(listenerType === cc.EventListener.TOUCH_ONE_BY_ONE)
        listener = new cc._EventListenerTouchOneByOne();
    else if(listenerType === cc.EventListener.TOUCH_ALL_AT_ONCE)
        listener = new cc._EventListenerTouchAllAtOnce();
    else if(listenerType === cc.EventListener.MOUSE)
        listener = new cc._EventListenerMouse();
    else if(listenerType === cc.EventListener.CUSTOM){
        listener = new cc._EventListenerCustom(argObj.eventName, argObj.callback);
        delete argObj.eventName;
        delete argObj.callback;
    } else if(listenerType === cc.EventListener.KEYBOARD)
        listener = new cc._EventListenerKeyboard();
    else if(listenerType === cc.EventListener.ACCELERATION){
        listener = new cc._EventListenerAcceleration(argObj.callback);
        delete argObj.callback;
    } else if(listenerType === cc.EventListener.FOCUS)
        listener = new cc._EventListenerFocus();
    for(var key in argObj) {
        listener[key] = argObj[key];
    }
    return listener;
};
cc._EventListenerFocus = cc.EventListener.extend({
    clone: function(){
        var listener = new cc._EventListenerFocus();
        listener.onFocusChanged = this.onFocusChanged;
        return listener;
    },
    checkAvailable: function(){
        if(!this.onFocusChanged){
            cc.log("Invalid EventListenerFocus!");
            return false;
        }
        return true;
    },
    onFocusChanged: null,
    ctor: function(){
        var listener = function(event){
            if(this.onFocusChanged)
                this.onFocusChanged(event._widgetLoseFocus, event._widgetGetFocus);
        };
        cc.EventListener.prototype.ctor.call(this, cc.EventListener.FOCUS, cc._EventListenerFocus.LISTENER_ID, listener);
    }
});
cc._EventListenerFocus.LISTENER_ID = "__cc_focus_event";
cc._EventListenerVector = cc.Class.extend({
    _fixedListeners: null,
    _sceneGraphListeners: null,
    gt0Index: 0,
    ctor: function () {
        this._fixedListeners = [];
        this._sceneGraphListeners = [];
    },
    size: function () {
        return this._fixedListeners.length + this._sceneGraphListeners.length;
    },
    empty: function () {
        return (this._fixedListeners.length === 0) && (this._sceneGraphListeners.length === 0);
    },
    push: function (listener) {
        if (listener._getFixedPriority() === 0)
            this._sceneGraphListeners.push(listener);
        else
            this._fixedListeners.push(listener);
    },
    clearSceneGraphListeners: function () {
        this._sceneGraphListeners.length = 0;
    },
    clearFixedListeners: function () {
        this._fixedListeners.length = 0;
    },
    clear: function () {
        this._sceneGraphListeners.length = 0;
        this._fixedListeners.length = 0;
    },
    getFixedPriorityListeners: function () {
        return this._fixedListeners;
    },
    getSceneGraphPriorityListeners: function () {
        return this._sceneGraphListeners;
    }
});
cc.__getListenerID = function (event) {
    var eventType = cc.Event, getType = event.getType();
    if(getType === eventType.ACCELERATION)
        return cc._EventListenerAcceleration.LISTENER_ID;
    if(getType === eventType.CUSTOM)
        return event.getEventName();
    if(getType === eventType.KEYBOARD)
        return cc._EventListenerKeyboard.LISTENER_ID;
    if(getType === eventType.MOUSE)
        return cc._EventListenerMouse.LISTENER_ID;
    if(getType === eventType.FOCUS)
        return cc._EventListenerFocus.LISTENER_ID;
    if(getType === eventType.TOUCH){
        cc.log(cc._LogInfos.__getListenerID);
    }
    return "";
};
cc.eventManager = {
    DIRTY_NONE:0,
    DIRTY_FIXED_PRIORITY:1 <<0,
    DIRTY_SCENE_GRAPH_PRIORITY : 1<< 1,
    DIRTY_ALL: 3,
    _listenersMap: {},
    _priorityDirtyFlagMap: {},
    _nodeListenersMap: {},
    _nodePriorityMap: {},
    _globalZOrderNodeMap: {},
    _toAddedListeners: [],
    _toRemovedListeners: [],
    _dirtyNodes: [],
    _inDispatch: 0,
    _isEnabled: false,
    _nodePriorityIndex: 0,
    _internalCustomListenerIDs:[cc.game.EVENT_HIDE, cc.game.EVENT_SHOW],
    _setDirtyForNode: function (node) {
        if (this._nodeListenersMap[node.__instanceId] != null)
            this._dirtyNodes.push(node);
        var _children = node.getChildren();
        for(var i = 0, len = _children.length; i < len; i++)
            this._setDirtyForNode(_children[i]);
    },
    pauseTarget: function (node, recursive) {
        var listeners = this._nodeListenersMap[node.__instanceId], i, len;
        if (listeners) {
            for ( i = 0, len = listeners.length; i < len; i++)
                listeners[i]._setPaused(true);
        }
        if (recursive === true) {
            var locChildren = node.getChildren();
            for ( i = 0, len = locChildren.length; i< len; i++)
                this.pauseTarget(locChildren[i], true);
        }
    },
    resumeTarget: function (node, recursive) {
        var listeners = this._nodeListenersMap[node.__instanceId], i, len;
        if (listeners){
            for ( i = 0, len = listeners.length; i < len; i++)
                listeners[i]._setPaused(false);
        }
        this._setDirtyForNode(node);
        if (recursive === true) {
            var locChildren = node.getChildren();
            for ( i = 0, len = locChildren.length; i< len; i++)
                this.resumeTarget(locChildren[i], true);
        }
    },
    _addListener: function (listener) {
        if (this._inDispatch === 0)
            this._forceAddEventListener(listener);
        else
            this._toAddedListeners.push(listener);
    },
    _forceAddEventListener: function (listener) {
        var listenerID = listener._getListenerID();
        var listeners = this._listenersMap[listenerID];
        if (!listeners) {
            listeners = new cc._EventListenerVector();
            this._listenersMap[listenerID] = listeners;
        }
        listeners.push(listener);
        if (listener._getFixedPriority() === 0) {
            this._setDirty(listenerID, this.DIRTY_SCENE_GRAPH_PRIORITY);
            var node = listener._getSceneGraphPriority();
            if (node === null)
                cc.log(cc._LogInfos.eventManager__forceAddEventListener);
            this._associateNodeAndEventListener(node, listener);
            if (node.isRunning())
                this.resumeTarget(node);
        } else
            this._setDirty(listenerID, this.DIRTY_FIXED_PRIORITY);
    },
    _getListeners: function (listenerID) {
        return this._listenersMap[listenerID];
    },
    _updateDirtyFlagForSceneGraph: function () {
        if (this._dirtyNodes.length === 0)
            return;
        var locDirtyNodes = this._dirtyNodes, selListeners, selListener, locNodeListenersMap = this._nodeListenersMap;
        for (var i = 0, len = locDirtyNodes.length; i < len; i++) {
            selListeners = locNodeListenersMap[locDirtyNodes[i].__instanceId];
            if (selListeners) {
                for (var j = 0, listenersLen = selListeners.length; j < listenersLen; j++) {
                    selListener = selListeners[j];
                    if (selListener)
                        this._setDirty(selListener._getListenerID(), this.DIRTY_SCENE_GRAPH_PRIORITY);
                }
            }
        }
        this._dirtyNodes.length = 0;
    },
    _removeAllListenersInVector: function (listenerVector) {
        if (!listenerVector)
            return;
        var selListener;
        for (var i = 0; i < listenerVector.length;) {
            selListener = listenerVector[i];
            selListener._setRegistered(false);
            if (selListener._getSceneGraphPriority() != null){
                this._dissociateNodeAndEventListener(selListener._getSceneGraphPriority(), selListener);
                selListener._setSceneGraphPriority(null);
            }
            if (this._inDispatch === 0)
                cc.arrayRemoveObject(listenerVector, selListener);
            else
                ++i;
        }
    },
    _removeListenersForListenerID: function (listenerID) {
        var listeners = this._listenersMap[listenerID], i;
        if (listeners) {
            var fixedPriorityListeners = listeners.getFixedPriorityListeners();
            var sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();
            this._removeAllListenersInVector(sceneGraphPriorityListeners);
            this._removeAllListenersInVector(fixedPriorityListeners);
            delete this._priorityDirtyFlagMap[listenerID];
            if (!this._inDispatch) {
                listeners.clear();
                delete this._listenersMap[listenerID];
            }
        }
        var locToAddedListeners = this._toAddedListeners, listener;
        for (i = 0; i < locToAddedListeners.length;) {
            listener = locToAddedListeners[i];
            if (listener && listener._getListenerID() === listenerID)
                cc.arrayRemoveObject(locToAddedListeners, listener);
            else
                ++i;
        }
    },
    _sortEventListeners: function (listenerID) {
        var dirtyFlag = this.DIRTY_NONE,  locFlagMap = this._priorityDirtyFlagMap;
        if (locFlagMap[listenerID])
            dirtyFlag = locFlagMap[listenerID];
        if (dirtyFlag !== this.DIRTY_NONE) {
            locFlagMap[listenerID] = this.DIRTY_NONE;
            if (dirtyFlag & this.DIRTY_FIXED_PRIORITY)
                this._sortListenersOfFixedPriority(listenerID);
            if (dirtyFlag & this.DIRTY_SCENE_GRAPH_PRIORITY){
                var rootNode = cc.director.getRunningScene();
                if(rootNode)
                    this._sortListenersOfSceneGraphPriority(listenerID, rootNode);
                else
                    locFlagMap[listenerID] = this.DIRTY_SCENE_GRAPH_PRIORITY;
            }
        }
    },
    _sortListenersOfSceneGraphPriority: function (listenerID, rootNode) {
        var listeners = this._getListeners(listenerID);
        if (!listeners)
            return;
        var sceneGraphListener = listeners.getSceneGraphPriorityListeners();
        if(!sceneGraphListener || sceneGraphListener.length === 0)
            return;
        this._nodePriorityIndex = 0;
        this._nodePriorityMap = {};
        this._visitTarget(rootNode, true);
        listeners.getSceneGraphPriorityListeners().sort(this._sortEventListenersOfSceneGraphPriorityDes);
    },
    _sortEventListenersOfSceneGraphPriorityDes : function(l1, l2){
        var locNodePriorityMap = cc.eventManager._nodePriorityMap, node1 = l1._getSceneGraphPriority(),
            node2 = l2._getSceneGraphPriority();
        if( !l2 || !node2 || !locNodePriorityMap[node2.__instanceId] )
            return -1;
        else if( !l1 || !node1 || !locNodePriorityMap[node1.__instanceId] )
            return 1;
        return locNodePriorityMap[l2._getSceneGraphPriority().__instanceId] - locNodePriorityMap[l1._getSceneGraphPriority().__instanceId];
    },
    _sortListenersOfFixedPriority: function (listenerID) {
        var listeners = this._listenersMap[listenerID];
        if (!listeners)
            return;
        var fixedListeners = listeners.getFixedPriorityListeners();
        if(!fixedListeners || fixedListeners.length === 0)
            return;
        fixedListeners.sort(this._sortListenersOfFixedPriorityAsc);
        var index = 0;
        for (var len = fixedListeners.length; index < len;) {
            if (fixedListeners[index]._getFixedPriority() >= 0)
                break;
            ++index;
        }
        listeners.gt0Index = index;
    },
    _sortListenersOfFixedPriorityAsc: function (l1, l2) {
        return l1._getFixedPriority() - l2._getFixedPriority();
    },
    _onUpdateListeners: function (listenerID) {
        var listeners = this._listenersMap[listenerID];
        if (!listeners)
            return;
        var fixedPriorityListeners = listeners.getFixedPriorityListeners();
        var sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();
        var i, selListener, idx, toRemovedListeners = this._toRemovedListeners;
        if (sceneGraphPriorityListeners) {
            for (i = 0; i < sceneGraphPriorityListeners.length;) {
                selListener = sceneGraphPriorityListeners[i];
                if (!selListener._isRegistered()) {
                    cc.arrayRemoveObject(sceneGraphPriorityListeners, selListener);
                    idx = toRemovedListeners.indexOf(selListener);
                    if(idx !== -1)
                        toRemovedListeners.splice(idx, 1);
                } else
                    ++i;
            }
        }
        if (fixedPriorityListeners) {
            for (i = 0; i < fixedPriorityListeners.length;) {
                selListener = fixedPriorityListeners[i];
                if (!selListener._isRegistered()) {
                    cc.arrayRemoveObject(fixedPriorityListeners, selListener);
                    idx = toRemovedListeners.indexOf(selListener);
                    if(idx !== -1)
                        toRemovedListeners.splice(idx, 1);
                } else
                    ++i;
            }
        }
        if (sceneGraphPriorityListeners && sceneGraphPriorityListeners.length === 0)
            listeners.clearSceneGraphListeners();
        if (fixedPriorityListeners && fixedPriorityListeners.length === 0)
            listeners.clearFixedListeners();
    },
    _updateListeners: function (event) {
        var locInDispatch = this._inDispatch;
        cc.assert(locInDispatch > 0, cc._LogInfos.EventManager__updateListeners);
        if(locInDispatch > 1)
            return;
        if (event.getType() === cc.Event.TOUCH) {
            this._onUpdateListeners(cc._EventListenerTouchOneByOne.LISTENER_ID);
            this._onUpdateListeners(cc._EventListenerTouchAllAtOnce.LISTENER_ID);
        } else
            this._onUpdateListeners(cc.__getListenerID(event));
        cc.assert(locInDispatch === 1, cc._LogInfos.EventManager__updateListeners_2);
        var locListenersMap = this._listenersMap, locPriorityDirtyFlagMap = this._priorityDirtyFlagMap;
        for (var selKey in locListenersMap) {
            if (locListenersMap[selKey].empty()) {
                delete locPriorityDirtyFlagMap[selKey];
                delete locListenersMap[selKey];
            }
        }
        var locToAddedListeners = this._toAddedListeners;
        if (locToAddedListeners.length !== 0) {
            for (var i = 0, len = locToAddedListeners.length; i < len; i++)
                this._forceAddEventListener(locToAddedListeners[i]);
            this._toAddedListeners.length = 0;
        }
        if(this._toRemovedListeners.length !== 0)
            this._cleanToRemovedListeners();
    },
    _cleanToRemovedListeners: function(){
        var toRemovedListeners = this._toRemovedListeners;
        for(var i = 0; i< toRemovedListeners.length; i++){
            var selListener = toRemovedListeners[i];
            var listeners = this._listenersMap[selListener._getListenerID()];
            if(!listeners)
                continue;
            var idx, fixedPriorityListeners = listeners.getFixedPriorityListeners(),
                sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();
            if(sceneGraphPriorityListeners){
                idx = sceneGraphPriorityListeners.indexOf(selListener);
                if (idx !== -1) {
                    sceneGraphPriorityListeners.splice(idx, 1);
                }
            }
            if(fixedPriorityListeners){
                idx = fixedPriorityListeners.indexOf(selListener);
                if (idx !== -1) {
                    fixedPriorityListeners.splice(idx, 1);
                }
            }
        }
        toRemovedListeners.length = 0;
    },
    _onTouchEventCallback: function(listener, argsObj){
        if (!listener._isRegistered)
            return false;
        var event = argsObj.event, selTouch = argsObj.selTouch;
        event._setCurrentTarget(listener._node);
        var isClaimed = false, removedIdx;
        var getCode = event.getEventCode(), eventCode = cc.EventTouch.EventCode;
        if (getCode === eventCode.BEGAN) {
            if (listener.onTouchBegan) {
                isClaimed = listener.onTouchBegan(selTouch, event);
                if (isClaimed && listener._registered)
                    listener._claimedTouches.push(selTouch);
            }
        } else if (listener._claimedTouches.length > 0
            && ((removedIdx = listener._claimedTouches.indexOf(selTouch)) !== -1)) {
            isClaimed = true;
            if(getCode === eventCode.MOVED && listener.onTouchMoved){
                listener.onTouchMoved(selTouch, event);
            } else if(getCode === eventCode.ENDED){
                if (listener.onTouchEnded)
                    listener.onTouchEnded(selTouch, event);
                if (listener._registered)
                    listener._claimedTouches.splice(removedIdx, 1);
            } else if(getCode === eventCode.CANCELLED){
                if (listener.onTouchCancelled)
                    listener.onTouchCancelled(selTouch, event);
                if (listener._registered)
                    listener._claimedTouches.splice(removedIdx, 1);
            }
        }
        if (event.isStopped()) {
            cc.eventManager._updateListeners(event);
            return true;
        }
        if (isClaimed && listener._registered && listener.swallowTouches) {
            if (argsObj.needsMutableSet)
                argsObj.touches.splice(selTouch, 1);
            return true;
        }
        return false;
    },
    _dispatchTouchEvent: function (event) {
        this._sortEventListeners(cc._EventListenerTouchOneByOne.LISTENER_ID);
        this._sortEventListeners(cc._EventListenerTouchAllAtOnce.LISTENER_ID);
        var oneByOneListeners = this._getListeners(cc._EventListenerTouchOneByOne.LISTENER_ID);
        var allAtOnceListeners = this._getListeners(cc._EventListenerTouchAllAtOnce.LISTENER_ID);
        if (null === oneByOneListeners && null === allAtOnceListeners)
            return;
        var originalTouches = event.getTouches(), mutableTouches = cc.copyArray(originalTouches);
        var oneByOneArgsObj = {event: event, needsMutableSet: (oneByOneListeners && allAtOnceListeners), touches: mutableTouches, selTouch: null};
        if (oneByOneListeners) {
            for (var i = 0; i < originalTouches.length; i++) {
                oneByOneArgsObj.selTouch = originalTouches[i];
                this._dispatchEventToListeners(oneByOneListeners, this._onTouchEventCallback, oneByOneArgsObj);
                if (event.isStopped())
                    return;
            }
        }
        if (allAtOnceListeners && mutableTouches.length > 0) {
            this._dispatchEventToListeners(allAtOnceListeners, this._onTouchesEventCallback, {event: event, touches: mutableTouches});
            if (event.isStopped())
                return;
        }
        this._updateListeners(event);
    },
    _onTouchesEventCallback: function (listener, callbackParams) {
        if (!listener._registered)
            return false;
        var eventCode = cc.EventTouch.EventCode, event = callbackParams.event, touches = callbackParams.touches, getCode = event.getEventCode();
        event._setCurrentTarget(listener._node);
        if(getCode === eventCode.BEGAN && listener.onTouchesBegan)
            listener.onTouchesBegan(touches, event);
        else if(getCode === eventCode.MOVED && listener.onTouchesMoved)
            listener.onTouchesMoved(touches, event);
        else if(getCode === eventCode.ENDED && listener.onTouchesEnded)
            listener.onTouchesEnded(touches, event);
        else if(getCode === eventCode.CANCELLED && listener.onTouchesCancelled)
            listener.onTouchesCancelled(touches, event);
        if (event.isStopped()) {
            cc.eventManager._updateListeners(event);
            return true;
        }
        return false;
    },
    _associateNodeAndEventListener: function (node, listener) {
        var listeners = this._nodeListenersMap[node.__instanceId];
        if (!listeners) {
            listeners = [];
            this._nodeListenersMap[node.__instanceId] = listeners;
        }
        listeners.push(listener);
    },
    _dissociateNodeAndEventListener: function (node, listener) {
        var listeners = this._nodeListenersMap[node.__instanceId];
        if (listeners) {
            cc.arrayRemoveObject(listeners, listener);
            if (listeners.length === 0)
                delete this._nodeListenersMap[node.__instanceId];
        }
    },
    _dispatchEventToListeners: function (listeners, onEvent, eventOrArgs) {
        var shouldStopPropagation = false;
        var fixedPriorityListeners = listeners.getFixedPriorityListeners();
        var sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();
        var i = 0, j, selListener;
        if (fixedPriorityListeners) {
            if (fixedPriorityListeners.length !== 0) {
                for (; i < listeners.gt0Index; ++i) {
                    selListener = fixedPriorityListeners[i];
                    if (selListener.isEnabled() && !selListener._isPaused() && selListener._isRegistered() && onEvent(selListener, eventOrArgs)) {
                        shouldStopPropagation = true;
                        break;
                    }
                }
            }
        }
        if (sceneGraphPriorityListeners && !shouldStopPropagation) {
            for (j = 0; j < sceneGraphPriorityListeners.length; j++) {
                selListener = sceneGraphPriorityListeners[j];
                if (selListener.isEnabled() && !selListener._isPaused() && selListener._isRegistered() && onEvent(selListener, eventOrArgs)) {
                    shouldStopPropagation = true;
                    break;
                }
            }
        }
        if (fixedPriorityListeners && !shouldStopPropagation) {
            for (; i < fixedPriorityListeners.length; ++i) {
                selListener = fixedPriorityListeners[i];
                if (selListener.isEnabled() && !selListener._isPaused() && selListener._isRegistered() && onEvent(selListener, eventOrArgs)) {
                    shouldStopPropagation = true;
                    break;
                }
            }
        }
    },
    _setDirty: function (listenerID, flag) {
        var locDirtyFlagMap = this._priorityDirtyFlagMap;
        if (locDirtyFlagMap[listenerID] == null)
            locDirtyFlagMap[listenerID] = flag;
        else
            locDirtyFlagMap[listenerID] = flag | locDirtyFlagMap[listenerID];
    },
    _visitTarget: function (node, isRootNode) {
        var children = node.getChildren(), i = 0;
        var childrenCount = children.length, locGlobalZOrderNodeMap = this._globalZOrderNodeMap, locNodeListenersMap = this._nodeListenersMap;
        if (childrenCount > 0) {
            var child;
            for (; i < childrenCount; i++) {
                child = children[i];
                if (child && child.getLocalZOrder() < 0)
                    this._visitTarget(child, false);
                else
                    break;
            }
            if (locNodeListenersMap[node.__instanceId] != null) {
                if (!locGlobalZOrderNodeMap[node.getGlobalZOrder()])
                    locGlobalZOrderNodeMap[node.getGlobalZOrder()] = [];
                locGlobalZOrderNodeMap[node.getGlobalZOrder()].push(node.__instanceId);
            }
            for (; i < childrenCount; i++) {
                child = children[i];
                if (child)
                    this._visitTarget(child, false);
            }
        } else {
            if (locNodeListenersMap[node.__instanceId] != null) {
                if (!locGlobalZOrderNodeMap[node.getGlobalZOrder()])
                    locGlobalZOrderNodeMap[node.getGlobalZOrder()] = [];
                locGlobalZOrderNodeMap[node.getGlobalZOrder()].push(node.__instanceId);
            }
        }
        if (isRootNode) {
            var globalZOrders = [];
            for (var selKey in locGlobalZOrderNodeMap)
                globalZOrders.push(selKey);
            globalZOrders.sort(this._sortNumberAsc);
            var zOrdersLen = globalZOrders.length, selZOrders, j, locNodePriorityMap = this._nodePriorityMap;
            for (i = 0; i < zOrdersLen; i++) {
                selZOrders = locGlobalZOrderNodeMap[globalZOrders[i]];
                for (j = 0; j < selZOrders.length; j++)
                    locNodePriorityMap[selZOrders[j]] = ++this._nodePriorityIndex;
            }
            this._globalZOrderNodeMap = {};
        }
    },
    _sortNumberAsc : function (a, b) {
        return a - b;
    },
    addListener: function (listener, nodeOrPriority) {
        cc.assert(listener && nodeOrPriority, cc._LogInfos.eventManager_addListener_2);
        if(!(listener instanceof cc.EventListener)){
            cc.assert(!cc.isNumber(nodeOrPriority), cc._LogInfos.eventManager_addListener_3);
            listener = cc.EventListener.create(listener);
        } else {
            if(listener._isRegistered()){
                cc.log(cc._LogInfos.eventManager_addListener_4);
                return;
            }
        }
        if (!listener.checkAvailable())
            return;
        if (cc.isNumber(nodeOrPriority)) {
            if (nodeOrPriority === 0) {
                cc.log(cc._LogInfos.eventManager_addListener);
                return;
            }
            listener._setSceneGraphPriority(null);
            listener._setFixedPriority(nodeOrPriority);
            listener._setRegistered(true);
            listener._setPaused(false);
            this._addListener(listener);
        } else {
            listener._setSceneGraphPriority(nodeOrPriority);
            listener._setFixedPriority(0);
            listener._setRegistered(true);
            this._addListener(listener);
        }
        return listener;
    },
    addCustomListener: function (eventName, callback) {
        var listener = new cc._EventListenerCustom(eventName, callback);
        this.addListener(listener, 1);
        return listener;
    },
    removeListener: function (listener) {
        if (listener == null)
            return;
        var isFound, locListener = this._listenersMap;
        for (var selKey in locListener) {
            var listeners = locListener[selKey];
            var fixedPriorityListeners = listeners.getFixedPriorityListeners(), sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();
            isFound = this._removeListenerInVector(sceneGraphPriorityListeners, listener);
            if (isFound){
               this._setDirty(listener._getListenerID(), this.DIRTY_SCENE_GRAPH_PRIORITY);
            }else{
                isFound = this._removeListenerInVector(fixedPriorityListeners, listener);
                if (isFound)
                    this._setDirty(listener._getListenerID(), this.DIRTY_FIXED_PRIORITY);
            }
            if (listeners.empty()) {
                delete this._priorityDirtyFlagMap[listener._getListenerID()];
                delete locListener[selKey];
            }
            if (isFound)
                break;
        }
        if (!isFound) {
            var locToAddedListeners = this._toAddedListeners;
            for (var i = 0, len = locToAddedListeners.length; i < len; i++) {
                var selListener = locToAddedListeners[i];
                if (selListener === listener) {
                    cc.arrayRemoveObject(locToAddedListeners, selListener);
                    selListener._setRegistered(false);
                    break;
                }
            }
        }
    },
    _removeListenerInCallback: function(listeners, callback){
        if (listeners == null)
            return false;
        for (var i = 0, len = listeners.length; i < len; i++) {
            var selListener = listeners[i];
            if (selListener._onCustomEvent === callback || selListener._onEvent === callback) {
                selListener._setRegistered(false);
                if (selListener._getSceneGraphPriority() != null){
                    this._dissociateNodeAndEventListener(selListener._getSceneGraphPriority(), selListener);
                    selListener._setSceneGraphPriority(null);
                }
                if (this._inDispatch === 0)
                    cc.arrayRemoveObject(listeners, selListener);
                return true;
            }
        }
        return false;
    },
    _removeListenerInVector : function(listeners, listener){
        if (listeners == null)
            return false;
        for (var i = 0, len = listeners.length; i < len; i++) {
            var selListener = listeners[i];
            if (selListener === listener) {
                selListener._setRegistered(false);
                if (selListener._getSceneGraphPriority() != null){
                    this._dissociateNodeAndEventListener(selListener._getSceneGraphPriority(), selListener);
                    selListener._setSceneGraphPriority(null);
                }
                if (this._inDispatch === 0)
                    cc.arrayRemoveObject(listeners, selListener);
                else
                    this._toRemovedListeners.push(selListener);
                return true;
            }
        }
        return false;
    },
    removeListeners: function (listenerType, recursive) {
        var _t = this;
        if (listenerType instanceof cc.Node) {
            delete _t._nodePriorityMap[listenerType.__instanceId];
            cc.arrayRemoveObject(_t._dirtyNodes, listenerType);
            var listeners = _t._nodeListenersMap[listenerType.__instanceId], i;
            if (listeners) {
                var listenersCopy = cc.copyArray(listeners);
                for (i = 0; i < listenersCopy.length; i++)
                    _t.removeListener(listenersCopy[i]);
                listenersCopy.length = 0;
            }
            var locToAddedListeners = _t._toAddedListeners;
            for (i = 0; i < locToAddedListeners.length; ) {
                var listener = locToAddedListeners[i];
                if (listener._getSceneGraphPriority() === listenerType) {
                    listener._setSceneGraphPriority(null);
                    listener._setRegistered(false);
                    locToAddedListeners.splice(i, 1);
                } else
                    ++i;
            }
            if (recursive === true) {
                var locChildren = listenerType.getChildren(), len;
                for (i = 0, len = locChildren.length; i< len; i++)
                    _t.removeListeners(locChildren[i], true);
            }
        } else {
            if (listenerType === cc.EventListener.TOUCH_ONE_BY_ONE)
                _t._removeListenersForListenerID(cc._EventListenerTouchOneByOne.LISTENER_ID);
            else if (listenerType === cc.EventListener.TOUCH_ALL_AT_ONCE)
                _t._removeListenersForListenerID(cc._EventListenerTouchAllAtOnce.LISTENER_ID);
            else if (listenerType === cc.EventListener.MOUSE)
                _t._removeListenersForListenerID(cc._EventListenerMouse.LISTENER_ID);
            else if (listenerType === cc.EventListener.ACCELERATION)
                _t._removeListenersForListenerID(cc._EventListenerAcceleration.LISTENER_ID);
            else if (listenerType === cc.EventListener.KEYBOARD)
                _t._removeListenersForListenerID(cc._EventListenerKeyboard.LISTENER_ID);
            else
                cc.log(cc._LogInfos.eventManager_removeListeners);
        }
    },
    removeCustomListeners: function (customEventName) {
        this._removeListenersForListenerID(customEventName);
    },
    removeAllListeners: function () {
        var locListeners = this._listenersMap, locInternalCustomEventIDs = this._internalCustomListenerIDs;
        for (var selKey in locListeners){
            if(locInternalCustomEventIDs.indexOf(selKey) === -1)
                this._removeListenersForListenerID(selKey);
        }
    },
    setPriority: function (listener, fixedPriority) {
        if (listener == null)
            return;
        var locListeners = this._listenersMap;
        for (var selKey in locListeners) {
            var selListeners = locListeners[selKey];
            var fixedPriorityListeners = selListeners.getFixedPriorityListeners();
            if (fixedPriorityListeners) {
                var found = fixedPriorityListeners.indexOf(listener);
                if (found !== -1) {
                    if(listener._getSceneGraphPriority() != null)
                        cc.log(cc._LogInfos.eventManager_setPriority);
                    if (listener._getFixedPriority() !== fixedPriority) {
                        listener._setFixedPriority(fixedPriority);
                        this._setDirty(listener._getListenerID(), this.DIRTY_FIXED_PRIORITY);
                    }
                    return;
                }
            }
        }
    },
    setEnabled: function (enabled) {
        this._isEnabled = enabled;
    },
    isEnabled: function () {
        return this._isEnabled;
    },
    dispatchEvent: function (event) {
        if (!this._isEnabled)
            return;
        this._updateDirtyFlagForSceneGraph();
        this._inDispatch++;
        if(!event || !event.getType)
            throw new Error("event is undefined");
        if (event.getType() === cc.Event.TOUCH) {
            this._dispatchTouchEvent(event);
            this._inDispatch--;
            return;
        }
        var listenerID = cc.__getListenerID(event);
        this._sortEventListeners(listenerID);
        var selListeners = this._listenersMap[listenerID];
        if (selListeners != null)
            this._dispatchEventToListeners(selListeners, this._onListenerCallback, event);
        this._updateListeners(event);
        this._inDispatch--;
    },
    _onListenerCallback: function(listener, event){
        event._setCurrentTarget(listener._getSceneGraphPriority());
        listener._onEvent(event);
        return event.isStopped();
    },
    dispatchCustomEvent: function (eventName, optionalUserData) {
        var ev = new cc.EventCustom(eventName);
        ev.setUserData(optionalUserData);
        this.dispatchEvent(ev);
    }
};
cc._tmp.PrototypeCCNode = function () {
    var _p = cc.Node.prototype;
    cc.defineGetterSetter(_p, "x", _p.getPositionX, _p.setPositionX);
    cc.defineGetterSetter(_p, "y", _p.getPositionY, _p.setPositionY);
    _p.width;
    cc.defineGetterSetter(_p, "width", _p._getWidth, _p._setWidth);
    _p.height;
    cc.defineGetterSetter(_p, "height", _p._getHeight, _p._setHeight);
    _p.anchorX;
    cc.defineGetterSetter(_p, "anchorX", _p._getAnchorX, _p._setAnchorX);
    _p.anchorY;
    cc.defineGetterSetter(_p, "anchorY", _p._getAnchorY, _p._setAnchorY);
    _p.skewX;
    cc.defineGetterSetter(_p, "skewX", _p.getSkewX, _p.setSkewX);
    _p.skewY;
    cc.defineGetterSetter(_p, "skewY", _p.getSkewY, _p.setSkewY);
    _p.zIndex;
    cc.defineGetterSetter(_p, "zIndex", _p.getLocalZOrder, _p.setLocalZOrder);
    _p.vertexZ;
    cc.defineGetterSetter(_p, "vertexZ", _p.getVertexZ, _p.setVertexZ);
    _p.rotation;
    cc.defineGetterSetter(_p, "rotation", _p.getRotation, _p.setRotation);
    _p.rotationX;
    cc.defineGetterSetter(_p, "rotationX", _p.getRotationX, _p.setRotationX);
    _p.rotationY;
    cc.defineGetterSetter(_p, "rotationY", _p.getRotationY, _p.setRotationY);
    _p.scale;
    cc.defineGetterSetter(_p, "scale", _p.getScale, _p.setScale);
    _p.scaleX;
    cc.defineGetterSetter(_p, "scaleX", _p.getScaleX, _p.setScaleX);
    _p.scaleY;
    cc.defineGetterSetter(_p, "scaleY", _p.getScaleY, _p.setScaleY);
    _p.children;
    cc.defineGetterSetter(_p, "children", _p.getChildren);
    _p.childrenCount;
    cc.defineGetterSetter(_p, "childrenCount", _p.getChildrenCount);
    _p.parent;
    cc.defineGetterSetter(_p, "parent", _p.getParent, _p.setParent);
    _p.visible;
    cc.defineGetterSetter(_p, "visible", _p.isVisible, _p.setVisible);
    _p.running;
    cc.defineGetterSetter(_p, "running", _p.isRunning);
    _p.ignoreAnchor;
    cc.defineGetterSetter(_p, "ignoreAnchor", _p.isIgnoreAnchorPointForPosition, _p.ignoreAnchorPointForPosition);
    _p.tag;
    _p.userData;
    _p.userObject;
    _p.arrivalOrder;
    _p.actionManager;
    cc.defineGetterSetter(_p, "actionManager", _p.getActionManager, _p.setActionManager);
    _p.scheduler;
    cc.defineGetterSetter(_p, "scheduler", _p.getScheduler, _p.setScheduler);
    _p.shaderProgram;
    cc.defineGetterSetter(_p, "shaderProgram", _p.getShaderProgram, _p.setShaderProgram);
    _p.opacity;
    cc.defineGetterSetter(_p, "opacity", _p.getOpacity, _p.setOpacity);
    _p.opacityModifyRGB;
    cc.defineGetterSetter(_p, "opacityModifyRGB", _p.isOpacityModifyRGB);
    _p.cascadeOpacity;
    cc.defineGetterSetter(_p, "cascadeOpacity", _p.isCascadeOpacityEnabled, _p.setCascadeOpacityEnabled);
    _p.color;
    cc.defineGetterSetter(_p, "color", _p.getColor, _p.setColor);
    _p.cascadeColor;
    cc.defineGetterSetter(_p, "cascadeColor", _p.isCascadeColorEnabled, _p.setCascadeColorEnabled);
};
cc.NODE_TAG_INVALID = -1;
cc.s_globalOrderOfArrival = 1;
cc.Node = cc.Class.extend({
    _localZOrder: 0,
    _globalZOrder: 0,
    _vertexZ: 0.0,
    _customZ: NaN,
    _rotationX: 0,
    _rotationY: 0.0,
    _scaleX: 1.0,
    _scaleY: 1.0,
    _position: null,
    _normalizedPosition:null,
    _usingNormalizedPosition: false,
    _normalizedPositionDirty: false,
    _skewX: 0.0,
    _skewY: 0.0,
    _children: null,
    _visible: true,
    _anchorPoint: null,
    _contentSize: null,
    _running: false,
    _parent: null,
    _ignoreAnchorPointForPosition: false,
    tag: cc.NODE_TAG_INVALID,
    userData: null,
    userObject: null,
    _reorderChildDirty: false,
    _shaderProgram: null,
    arrivalOrder: 0,
    _actionManager: null,
    _scheduler: null,
    _eventDispatcher: null,
    _additionalTransformDirty: false,
    _additionalTransform: null,
    _componentContainer: null,
    _isTransitionFinished: false,
    _className: "Node",
    _showNode: false,
    _name: "",
    _realOpacity: 255,
    _realColor: null,
    _cascadeColorEnabled: false,
    _cascadeOpacityEnabled: false,
    _renderCmd:null,
    ctor: function(){
        this._initNode();
        this._initRendererCmd();
    },
    _initNode: function () {
        var _t = this;
        _t._anchorPoint = cc.p(0, 0);
        _t._contentSize = cc.size(0, 0);
        _t._position = cc.p(0, 0);
        _t._normalizedPosition = cc.p(0,0);
        _t._children = [];
        var director = cc.director;
        _t._actionManager = director.getActionManager();
        _t._scheduler = director.getScheduler();
        _t._additionalTransform = cc.affineTransformMakeIdentity();
        if (cc.ComponentContainer) {
            _t._componentContainer = new cc.ComponentContainer(_t);
        }
        this._realOpacity = 255;
        this._realColor = cc.color(255, 255, 255, 255);
        this._cascadeColorEnabled = false;
        this._cascadeOpacityEnabled = false;
    },
    init: function () {
        return true;
    },
    _arrayMakeObjectsPerformSelector: function (array, callbackType) {
        if (!array || array.length === 0)
            return;
        var i, len = array.length, node;
        var nodeCallbackType = cc.Node._stateCallbackType;
        switch (callbackType) {
            case nodeCallbackType.onEnter:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.onEnter();
                }
                break;
            case nodeCallbackType.onExit:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.onExit();
                }
                break;
            case nodeCallbackType.onEnterTransitionDidFinish:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.onEnterTransitionDidFinish();
                }
                break;
            case nodeCallbackType.cleanup:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.cleanup();
                }
                break;
            case nodeCallbackType.updateTransform:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.updateTransform();
                }
                break;
            case nodeCallbackType.onExitTransitionDidStart:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.onExitTransitionDidStart();
                }
                break;
            case nodeCallbackType.sortAllChildren:
                for (i = 0; i < len; i++) {
                    node = array[i];
                    if (node)
                        node.sortAllChildren();
                }
                break;
            default :
                cc.assert(0, cc._LogInfos.Node__arrayMakeObjectsPerformSelector);
                break;
        }
    },
    attr: function (attrs) {
        for (var key in attrs) {
            this[key] = attrs[key];
        }
    },
    getSkewX: function () {
        return this._skewX;
    },
    setSkewX: function (newSkewX) {
        this._skewX = newSkewX;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getSkewY: function () {
        return this._skewY;
    },
    setSkewY: function (newSkewY) {
        this._skewY = newSkewY;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    setLocalZOrder: function (localZOrder) {
        this._localZOrder = localZOrder;
        if (this._parent)
            this._parent.reorderChild(this, localZOrder);
        cc.eventManager._setDirtyForNode(this);
    },
    _setLocalZOrder: function (localZOrder) {
        this._localZOrder = localZOrder;
    },
    getLocalZOrder: function () {
        return this._localZOrder;
    },
    getZOrder: function () {
        cc.log(cc._LogInfos.Node_getZOrder);
        return this.getLocalZOrder();
    },
    setZOrder: function (z) {
        cc.log(cc._LogInfos.Node_setZOrder);
        this.setLocalZOrder(z);
    },
    setGlobalZOrder: function (globalZOrder) {
        if (this._globalZOrder !== globalZOrder) {
            this._globalZOrder = globalZOrder;
            cc.eventManager._setDirtyForNode(this);
        }
    },
    getGlobalZOrder: function () {
        return this._globalZOrder;
    },
    getVertexZ: function () {
        return this._vertexZ;
    },
    setVertexZ: function (Var) {
        this._customZ = this._vertexZ = Var;
    },
    getRotation: function () {
        if (this._rotationX !== this._rotationY)
            cc.log(cc._LogInfos.Node_getRotation);
        return this._rotationX;
    },
    setRotation: function (newRotation) {
        this._rotationX = this._rotationY = newRotation;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getRotationX: function () {
        return this._rotationX;
    },
    setRotationX: function (rotationX) {
        this._rotationX = rotationX;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getRotationY: function () {
        return this._rotationY;
    },
    setRotationY: function (rotationY) {
        this._rotationY = rotationY;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getScale: function () {
        if (this._scaleX !== this._scaleY)
            cc.log(cc._LogInfos.Node_getScale);
        return this._scaleX;
    },
    setScale: function (scale, scaleY) {
        this._scaleX = scale;
        this._scaleY = (scaleY || scaleY === 0) ? scaleY : scale;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getScaleX: function () {
        return this._scaleX;
    },
    setScaleX: function (newScaleX) {
        this._scaleX = newScaleX;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getScaleY: function () {
        return this._scaleY;
    },
    setScaleY: function (newScaleY) {
        this._scaleY = newScaleY;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    setPosition: function (newPosOrxValue, yValue) {
        var locPosition = this._position;
        if (yValue === undefined) {
            if(locPosition.x === newPosOrxValue.x && locPosition.y === newPosOrxValue.y)
                return;
            locPosition.x = newPosOrxValue.x;
            locPosition.y = newPosOrxValue.y;
        } else {
            if(locPosition.x === newPosOrxValue && locPosition.y === yValue)
                return;
            locPosition.x = newPosOrxValue;
            locPosition.y = yValue;
        }
        this._usingNormalizedPosition = false;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    setNormalizedPosition: function(posOrX, y){
        var locPosition = this._normalizedPosition;
        if (y === undefined) {
            locPosition.x = posOrX.x;
            locPosition.y = posOrX.y;
        } else {
            locPosition.x = posOrX;
            locPosition.y = y;
        }
        this._normalizedPositionDirty = this._usingNormalizedPosition = true;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getPosition: function () {
        return cc.p(this._position);
    },
    getNormalizedPosition: function(){
        return cc.p(this._normalizedPosition);
    },
    getPositionX: function () {
        return this._position.x;
    },
    setPositionX: function (x) {
        this._position.x = x;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getPositionY: function () {
        return  this._position.y;
    },
    setPositionY: function (y) {
        this._position.y = y;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getChildrenCount: function () {
        return this._children.length;
    },
    getChildren: function () {
        return this._children;
    },
    isVisible: function () {
        return this._visible;
    },
    setVisible: function (visible) {
        if(this._visible !== visible){
            this._visible = visible;
            this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
            cc.renderer.childrenOrderDirty = true;
        }
    },
    getAnchorPoint: function () {
        return cc.p(this._anchorPoint);
    },
    setAnchorPoint: function (point, y) {
        var locAnchorPoint = this._anchorPoint;
        if (y === undefined) {
            if ((point.x === locAnchorPoint.x) && (point.y === locAnchorPoint.y))
                return;
            locAnchorPoint.x = point.x;
            locAnchorPoint.y = point.y;
        } else {
            if ((point === locAnchorPoint.x) && (y === locAnchorPoint.y))
                return;
            locAnchorPoint.x = point;
            locAnchorPoint.y = y;
        }
        this._renderCmd._updateAnchorPointInPoint();
    },
    _getAnchorX: function () {
        return this._anchorPoint.x;
    },
    _setAnchorX: function (x) {
        if (this._anchorPoint.x === x) return;
        this._anchorPoint.x = x;
        this._renderCmd._updateAnchorPointInPoint();
    },
    _getAnchorY: function () {
        return this._anchorPoint.y;
    },
    _setAnchorY: function (y) {
        if (this._anchorPoint.y === y) return;
        this._anchorPoint.y = y;
        this._renderCmd._updateAnchorPointInPoint();
    },
    getAnchorPointInPoints: function () {
        return this._renderCmd.getAnchorPointInPoints();
    },
    _getWidth: function () {
        return this._contentSize.width;
    },
    _setWidth: function (width) {
        this._contentSize.width = width;
        this._renderCmd._updateAnchorPointInPoint();
    },
    _getHeight: function () {
        return this._contentSize.height;
    },
    _setHeight: function (height) {
        this._contentSize.height = height;
        this._renderCmd._updateAnchorPointInPoint();
    },
    getContentSize: function () {
        return cc.size(this._contentSize);
    },
    setContentSize: function (size, height) {
        var locContentSize = this._contentSize;
        if (height === undefined) {
            if ((size.width === locContentSize.width) && (size.height === locContentSize.height))
                return;
            locContentSize.width = size.width;
            locContentSize.height = size.height;
        } else {
            if ((size === locContentSize.width) && (height === locContentSize.height))
                return;
            locContentSize.width = size;
            locContentSize.height = height;
        }
        this._renderCmd._updateAnchorPointInPoint();
    },
    isRunning: function () {
        return this._running;
    },
    getParent: function () {
        return this._parent;
    },
    setParent: function (parent) {
        this._parent = parent;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    isIgnoreAnchorPointForPosition: function () {
        return this._ignoreAnchorPointForPosition;
    },
    ignoreAnchorPointForPosition: function (newValue) {
        if (newValue !== this._ignoreAnchorPointForPosition) {
            this._ignoreAnchorPointForPosition = newValue;
            this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        }
    },
    getTag: function () {
        return this.tag;
    },
    setTag: function (tag) {
        this.tag = tag;
    },
    setName: function(name){
         this._name = name;
    },
    getName: function(){
        return this._name;
    },
    getUserData: function () {
        return this.userData;
    },
    setUserData: function (Var) {
        this.userData = Var;
    },
    getUserObject: function () {
        return this.userObject;
    },
    setUserObject: function (newValue) {
        if (this.userObject !== newValue)
            this.userObject = newValue;
    },
    getOrderOfArrival: function () {
        return this.arrivalOrder;
    },
    setOrderOfArrival: function (Var) {
        this.arrivalOrder = Var;
    },
    getActionManager: function () {
        if (!this._actionManager)
            this._actionManager = cc.director.getActionManager();
        return this._actionManager;
    },
    setActionManager: function (actionManager) {
        if (this._actionManager !== actionManager) {
            this.stopAllActions();
            this._actionManager = actionManager;
        }
    },
    getScheduler: function () {
        if (!this._scheduler)
            this._scheduler = cc.director.getScheduler();
        return this._scheduler;
    },
    setScheduler: function (scheduler) {
        if (this._scheduler !== scheduler) {
            this.unscheduleAllCallbacks();
            this._scheduler = scheduler;
        }
    },
    boundingBox: function(){
        cc.log(cc._LogInfos.Node_boundingBox);
        return this.getBoundingBox();
    },
    getBoundingBox: function () {
        var rect = cc.rect(0, 0, this._contentSize.width, this._contentSize.height);
        return cc._rectApplyAffineTransformIn(rect, this.getNodeToParentTransform());
    },
    cleanup: function () {
        this.stopAllActions();
        this.unscheduleAllCallbacks();
        cc.eventManager.removeListeners(this);
        this._arrayMakeObjectsPerformSelector(this._children, cc.Node._stateCallbackType.cleanup);
    },
    getChildByTag: function (aTag) {
        var __children = this._children;
        if (__children !== null) {
            for (var i = 0; i < __children.length; i++) {
                var node = __children[i];
                if (node && node.tag === aTag)
                    return node;
            }
        }
        return null;
    },
    getChildByName: function(name){
        if(!name){
            cc.log("Invalid name");
            return null;
        }
        var locChildren = this._children;
        for(var i = 0, len = locChildren.length; i < len; i++){
           if(locChildren[i]._name === name)
            return locChildren[i];
        }
        return null;
    },
    addChild: function (child, localZOrder, tag) {
        localZOrder = localZOrder === undefined ? child._localZOrder : localZOrder;
        var name, setTag = false;
        if(cc.isUndefined(tag)){
            tag = undefined;
            name = child._name;
        } else if(cc.isString(tag)){
            name = tag;
            tag = undefined;
        } else if(cc.isNumber(tag)){
            setTag = true;
            name = "";
        }
        cc.assert(child, cc._LogInfos.Node_addChild_3);
        cc.assert(child._parent === null, "child already added. It can't be added again");
        this._addChildHelper(child, localZOrder, tag, name, setTag);
    },
    _addChildHelper: function(child, localZOrder, tag, name, setTag){
        if(!this._children)
            this._children = [];
        this._insertChild(child, localZOrder);
        if(setTag)
            child.setTag(tag);
        else
            child.setName(name);
        child.setParent(this);
        child.setOrderOfArrival(cc.s_globalOrderOfArrival++);
        if( this._running ){
            child.onEnter();
            if (this._isTransitionFinished)
                child.onEnterTransitionDidFinish();
        }
        child._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        if (this._cascadeColorEnabled)
            child._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.colorDirty);
        if (this._cascadeOpacityEnabled)
            child._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.opacityDirty);
    },
    removeFromParent: function (cleanup) {
        if (this._parent) {
            if (cleanup === undefined)
                cleanup = true;
            this._parent.removeChild(this, cleanup);
        }
    },
    removeFromParentAndCleanup: function (cleanup) {
        cc.log(cc._LogInfos.Node_removeFromParentAndCleanup);
        this.removeFromParent(cleanup);
    },
    removeChild: function (child, cleanup) {
        if (this._children.length === 0)
            return;
        if (cleanup === undefined)
            cleanup = true;
        if (this._children.indexOf(child) > -1)
            this._detachChild(child, cleanup);
        cc.renderer.childrenOrderDirty = true;
    },
    removeChildByTag: function (tag, cleanup) {
        if (tag === cc.NODE_TAG_INVALID)
            cc.log(cc._LogInfos.Node_removeChildByTag);
        var child = this.getChildByTag(tag);
        if (!child)
            cc.log(cc._LogInfos.Node_removeChildByTag_2, tag);
        else
            this.removeChild(child, cleanup);
    },
    removeAllChildrenWithCleanup: function (cleanup) {
        this.removeAllChildren(cleanup);
    },
    removeAllChildren: function (cleanup) {
        var __children = this._children;
        if (__children !== null) {
            if (cleanup === undefined)
                cleanup = true;
            for (var i = 0; i < __children.length; i++) {
                var node = __children[i];
                if (node) {
                    if (this._running) {
                        node.onExitTransitionDidStart();
                        node.onExit();
                    }
                    if (cleanup)
                        node.cleanup();
                    node.parent = null;
                    node._renderCmd.detachFromParent();
                }
            }
            this._children.length = 0;
            cc.renderer.childrenOrderDirty = true;
        }
    },
    _detachChild: function (child, doCleanup) {
        if (this._running) {
            child.onExitTransitionDidStart();
            child.onExit();
        }
        if (doCleanup)
            child.cleanup();
        child.parent = null;
        child._renderCmd.detachFromParent();
        cc.arrayRemoveObject(this._children, child);
    },
    _insertChild: function (child, z) {
        cc.renderer.childrenOrderDirty = this._reorderChildDirty = true;
        this._children.push(child);
        child._setLocalZOrder(z);
    },
    setNodeDirty: function(){
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    reorderChild: function (child, zOrder) {
        cc.assert(child, cc._LogInfos.Node_reorderChild);
        cc.renderer.childrenOrderDirty = this._reorderChildDirty = true;
        child.arrivalOrder = cc.s_globalOrderOfArrival;
        cc.s_globalOrderOfArrival++;
        child._setLocalZOrder(zOrder);
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.orderDirty);
    },
    sortAllChildren: function () {
        if (this._reorderChildDirty) {
            var _children = this._children;
            var len = _children.length, i, j, tmp;
            for(i=1; i<len; i++){
                tmp = _children[i];
                j = i - 1;
                while(j >= 0){
                    if(tmp._localZOrder < _children[j]._localZOrder){
                        _children[j+1] = _children[j];
                    }else if(tmp._localZOrder === _children[j]._localZOrder && tmp.arrivalOrder < _children[j].arrivalOrder){
                        _children[j+1] = _children[j];
                    }else{
                        break;
                    }
                    j--;
                }
                _children[j+1] = tmp;
            }
            this._reorderChildDirty = false;
        }
    },
    draw: function (ctx) {
    },
    transformAncestors: function () {
        if (this._parent !== null) {
            this._parent.transformAncestors();
            this._parent.transform();
        }
    },
    onEnter: function () {
        this._isTransitionFinished = false;
        this._running = true;//should be running before resumeSchedule
        this._arrayMakeObjectsPerformSelector(this._children, cc.Node._stateCallbackType.onEnter);
        this.resume();
    },
    onEnterTransitionDidFinish: function () {
        this._isTransitionFinished = true;
        this._arrayMakeObjectsPerformSelector(this._children, cc.Node._stateCallbackType.onEnterTransitionDidFinish);
    },
    onExitTransitionDidStart: function () {
        this._arrayMakeObjectsPerformSelector(this._children, cc.Node._stateCallbackType.onExitTransitionDidStart);
    },
    onExit: function () {
        this._running = false;
        this.pause();
        this._arrayMakeObjectsPerformSelector(this._children, cc.Node._stateCallbackType.onExit);
        this.removeAllComponents();
    },
    runAction: function (action) {
        cc.assert(action, cc._LogInfos.Node_runAction);
        this.actionManager.addAction(action, this, !this._running);
        return action;
    },
    stopAllActions: function () {
        this.actionManager && this.actionManager.removeAllActionsFromTarget(this);
    },
    stopAction: function (action) {
        this.actionManager.removeAction(action);
    },
    stopActionByTag: function (tag) {
        if (tag === cc.ACTION_TAG_INVALID) {
            cc.log(cc._LogInfos.Node_stopActionByTag);
            return;
        }
        this.actionManager.removeActionByTag(tag, this);
    },
    getActionByTag: function (tag) {
        if (tag === cc.ACTION_TAG_INVALID) {
            cc.log(cc._LogInfos.Node_getActionByTag);
            return null;
        }
        return this.actionManager.getActionByTag(tag, this);
    },
    getNumberOfRunningActions: function () {
        return this.actionManager.numberOfRunningActionsInTarget(this);
    },
    scheduleUpdate: function () {
        this.scheduleUpdateWithPriority(0);
    },
    scheduleUpdateWithPriority: function (priority) {
        this.scheduler.scheduleUpdate(this, priority, !this._running);
    },
    unscheduleUpdate: function () {
        this.scheduler.unscheduleUpdate(this);
    },
    schedule: function (callback, interval, repeat, delay, key) {
        var len = arguments.length;
        if(typeof callback === "function"){
            if(len === 1){
                interval = 0;
                repeat = cc.REPEAT_FOREVER;
                delay = 0;
                key = this.__instanceId;
            }else if(len === 2){
                if(typeof interval === "number"){
                    repeat = cc.REPEAT_FOREVER;
                    delay = 0;
                    key = this.__instanceId;
                }else{
                    key = interval;
                    interval = 0;
                    repeat = cc.REPEAT_FOREVER;
                    delay = 0;
                }
            }else if(len === 3){
                if(typeof repeat === "string"){
                    key = repeat;
                    repeat = cc.REPEAT_FOREVER;
                }else{
                    key = this.__instanceId;
                }
                delay = 0;
            }else if(len === 4){
                key = this.__instanceId;
            }
        }else{
            if(len === 1){
                interval = 0;
                repeat = cc.REPEAT_FOREVER;
                delay = 0;
            }else if(len === 2){
                repeat = cc.REPEAT_FOREVER;
                delay = 0;
            }
        }
        cc.assert(callback, cc._LogInfos.Node_schedule);
        cc.assert(interval >= 0, cc._LogInfos.Node_schedule_2);
        interval = interval || 0;
        repeat = (repeat == null) ? cc.REPEAT_FOREVER : repeat;
        delay = delay || 0;
        this.scheduler.schedule(callback, this, interval, repeat, delay, !this._running, key);
    },
    scheduleOnce: function (callback, delay, key) {
        if(key === undefined)
            key = this.__instanceId;
        this.schedule(callback, 0, 0, delay, key);
    },
    unschedule: function (callback_fn) {
        if (!callback_fn)
            return;
        this.scheduler.unschedule(callback_fn, this);
    },
    unscheduleAllCallbacks: function () {
        this.scheduler.unscheduleAllForTarget(this);
    },
    resumeSchedulerAndActions: function () {
        cc.log(cc._LogInfos.Node_resumeSchedulerAndActions);
        this.resume();
    },
    resume: function () {
        this.scheduler.resumeTarget(this);
        this.actionManager && this.actionManager.resumeTarget(this);
        cc.eventManager.resumeTarget(this);
    },
    pauseSchedulerAndActions: function () {
        cc.log(cc._LogInfos.Node_pauseSchedulerAndActions);
        this.pause();
    },
    pause: function () {
        this.scheduler.pauseTarget(this);
        this.actionManager && this.actionManager.pauseTarget(this);
        cc.eventManager.pauseTarget(this);
    },
    setAdditionalTransform: function (additionalTransform) {
        if(additionalTransform === undefined)
            return this._additionalTransformDirty = false;
        this._additionalTransform = additionalTransform;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        this._additionalTransformDirty = true;
    },
    getParentToNodeTransform: function () {
       return this._renderCmd.getParentToNodeTransform();
    },
    parentToNodeTransform: function () {
        return this.getParentToNodeTransform();
    },
    getNodeToWorldTransform: function () {
        var t = this.getNodeToParentTransform();
        for (var p = this._parent; p !== null; p = p.parent)
            t = cc.affineTransformConcat(t, p.getNodeToParentTransform());
        return t;
    },
    nodeToWorldTransform: function(){
        return this.getNodeToWorldTransform();
    },
    getWorldToNodeTransform: function () {
        return cc.affineTransformInvert(this.getNodeToWorldTransform());
    },
    worldToNodeTransform: function () {
        return this.getWorldToNodeTransform();
    },
    convertToNodeSpace: function (worldPoint) {
        return cc.pointApplyAffineTransform(worldPoint, this.getWorldToNodeTransform());
    },
    convertToWorldSpace: function (nodePoint) {
        nodePoint = nodePoint || cc.p(0,0);
        return cc.pointApplyAffineTransform(nodePoint, this.getNodeToWorldTransform());
    },
    convertToNodeSpaceAR: function (worldPoint) {
        return cc.pSub(this.convertToNodeSpace(worldPoint), this._renderCmd.getAnchorPointInPoints());
    },
    convertToWorldSpaceAR: function (nodePoint) {
        nodePoint = nodePoint || cc.p(0,0);
        var pt = cc.pAdd(nodePoint, this._renderCmd.getAnchorPointInPoints());
        return this.convertToWorldSpace(pt);
    },
    _convertToWindowSpace: function (nodePoint) {
        var worldPoint = this.convertToWorldSpace(nodePoint);
        return cc.director.convertToUI(worldPoint);
    },
    convertTouchToNodeSpace: function (touch) {
        var point = touch.getLocation();
        return this.convertToNodeSpace(point);
    },
    convertTouchToNodeSpaceAR: function (touch) {
        var point = cc.director.convertToGL(touch.getLocation());
        return this.convertToNodeSpaceAR(point);
    },
    update: function (dt) {
        if (this._componentContainer && !this._componentContainer.isEmpty())
            this._componentContainer.visit(dt);
    },
    updateTransform: function () {
        this._arrayMakeObjectsPerformSelector(this._children, cc.Node._stateCallbackType.updateTransform);
    },
    retain: function () {
    },
    release: function () {
    },
    getComponent: function (name) {
        if(this._componentContainer)
            return this._componentContainer.getComponent(name);
        return null;
    },
    addComponent: function (component) {
        if(this._componentContainer)
            this._componentContainer.add(component);
    },
    removeComponent: function (component) {
        if(this._componentContainer)
            return this._componentContainer.remove(component);
        return false;
    },
    removeAllComponents: function () {
        if(this._componentContainer)
            this._componentContainer.removeAll();
    },
    grid: null,
    visit: function(parentCmd){
        this._renderCmd.visit(parentCmd);
    },
    transform: function(parentCmd, recursive){
        this._renderCmd.transform(parentCmd, recursive);
    },
    nodeToParentTransform: function(){
        return this.getNodeToParentTransform();
    },
    getNodeToParentTransform: function(ancestor){
        var t = this._renderCmd.getNodeToParentTransform();
        if(ancestor){
            var T = {a: t.a, b: t.b, c: t.c, d: t.d, tx: t.tx, ty: t.ty};
            for(var p = this._parent;  p != null && p != ancestor ; p = p.getParent()){
                cc.affineTransformConcatIn(T, p.getNodeToParentTransform());
            }
            return T;
        }else{
            return t;
        }
    },
    getNodeToParentAffineTransform: function(ancestor){
        return this.getNodeToParentTransform(ancestor);
    },
    getCamera: function () {
        return null;
    },
    getGrid: function () {
        return this.grid;
    },
    setGrid: function (grid) {
        this.grid = grid;
    },
    getShaderProgram: function () {
        return this._renderCmd.getShaderProgram();
    },
    setShaderProgram: function (newShaderProgram) {
        this._renderCmd.setShaderProgram(newShaderProgram);
    },
    getGLServerState: function () {
        return 0;
    },
    setGLServerState: function (state) {
    },
    getBoundingBoxToWorld: function () {
        var rect = cc.rect(0, 0, this._contentSize.width, this._contentSize.height);
        var trans = this.getNodeToWorldTransform();
        rect = cc.rectApplyAffineTransform(rect, trans);
        if (!this._children)
            return rect;
        var locChildren = this._children;
        for (var i = 0; i < locChildren.length; i++) {
            var child = locChildren[i];
            if (child && child._visible) {
                var childRect = child._getBoundingBoxToCurrentNode(trans);
                if (childRect)
                    rect = cc.rectUnion(rect, childRect);
            }
        }
        return rect;
    },
    _getBoundingBoxToCurrentNode: function (parentTransform) {
        var rect = cc.rect(0, 0, this._contentSize.width, this._contentSize.height);
        var trans = (parentTransform === undefined) ? this.getNodeToParentTransform() : cc.affineTransformConcat(this.getNodeToParentTransform(), parentTransform);
        rect = cc.rectApplyAffineTransform(rect, trans);
        if (!this._children)
            return rect;
        var locChildren = this._children;
        for (var i = 0; i < locChildren.length; i++) {
            var child = locChildren[i];
            if (child && child._visible) {
                var childRect = child._getBoundingBoxToCurrentNode(trans);
                if (childRect)
                    rect = cc.rectUnion(rect, childRect);
            }
        }
        return rect;
    },
    getOpacity: function () {
        return this._realOpacity;
    },
    getDisplayedOpacity: function () {
        return this._renderCmd.getDisplayedOpacity();
    },
    setOpacity: function (opacity) {
        this._realOpacity = opacity;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.opacityDirty);
    },
    updateDisplayedOpacity: function (parentOpacity) {
        this._renderCmd._updateDisplayOpacity(parentOpacity);
    },
    isCascadeOpacityEnabled: function () {
        return this._cascadeOpacityEnabled;
    },
    setCascadeOpacityEnabled: function (cascadeOpacityEnabled) {
        if (this._cascadeOpacityEnabled === cascadeOpacityEnabled)
            return;
        this._cascadeOpacityEnabled = cascadeOpacityEnabled;
        this._renderCmd.setCascadeOpacityEnabledDirty();
    },
    getColor: function () {
        var locRealColor = this._realColor;
        return cc.color(locRealColor.r, locRealColor.g, locRealColor.b, locRealColor.a);
    },
    getDisplayedColor: function () {
        return this._renderCmd.getDisplayedColor();
    },
    setColor: function (color) {
        var locRealColor = this._realColor;
        locRealColor.r = color.r;
        locRealColor.g = color.g;
        locRealColor.b = color.b;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.colorDirty);
    },
    updateDisplayedColor: function (parentColor) {
        this._renderCmd._updateDisplayColor(parentColor);
    },
    isCascadeColorEnabled: function () {
        return this._cascadeColorEnabled;
    },
    setCascadeColorEnabled: function (cascadeColorEnabled) {
        if (this._cascadeColorEnabled === cascadeColorEnabled)
            return;
        this._cascadeColorEnabled = cascadeColorEnabled;
        this._renderCmd.setCascadeColorEnabledDirty();
    },
    setOpacityModifyRGB: function (opacityValue) {
    },
    isOpacityModifyRGB: function () {
        return false;
    },
    _initRendererCmd: function(){
        this._renderCmd = cc.renderer.getRenderCmd(this);
    },
    _createRenderCmd: function(){
        if(cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return new cc.Node.CanvasRenderCmd(this);
        else
            return new cc.Node.WebGLRenderCmd(this);
    },
    enumerateChildren: function(name, callback){
        cc.assert(name && name.length != 0, "Invalid name");
        cc.assert(callback != null, "Invalid callback function");
        var length = name.length;
        var subStrStartPos = 0;
        var subStrlength = length;
        var searchRecursively = false;
        if(length > 2 && name[0] === "/" && name[1] === "/"){
            searchRecursively = true;
            subStrStartPos = 2;
            subStrlength -= 2;
        }
        var searchFromParent = false;
        if(length > 3 && name[length-3] === "/" && name[length-2] === "." && name[length-1] === "."){
            searchFromParent = true;
            subStrlength -= 3;
        }
        var newName = name.substr(subStrStartPos, subStrlength);
        if(searchFromParent)
            newName = "[[:alnum:]]+/" + newName;
        if(searchRecursively)
            this.doEnumerateRecursive(this, newName, callback);
        else
            this.doEnumerate(newName, callback);
    },
    doEnumerateRecursive: function(node, name, callback){
        var ret = false;
        if(node.doEnumerate(name,callback)){
            ret = true;
        }else{
            var child,
                children = node.getChildren(),
                length = children.length;
            for (var i=0; i<length; i++) {
                child = children[i];
                if (this.doEnumerateRecursive(child, name, callback)) {
                    ret = true;
                    break;
                }
            }
        }
    },
    doEnumerate: function(name, callback){
        var pos = name.indexOf('/');
        var searchName = name;
        var needRecursive = false;
        if (pos !== -1){
            searchName = name.substr(0, pos);
            needRecursive = true;
        }
        var ret = false;
        var child,
            children = this._children,
            length = children.length;
        for (var i=0; i<length; i++){
            child = children[i];
            if (child._name.indexOf(searchName) !== -1){
                if (!needRecursive){
                    if (callback(child)){
                        ret = true;
                        break;
                    }
                }else{
                    ret = child.doEnumerate(name, callback);
                    if (ret)
                        break;
                }
            }
        }
        return ret;
    }
});
cc.Node.create = function () {
    return new cc.Node();
};
cc.Node._stateCallbackType = {onEnter: 1, onExit: 2, cleanup: 3, onEnterTransitionDidFinish: 4, updateTransform: 5, onExitTransitionDidStart: 6, sortAllChildren: 7};
cc.assert(cc.isFunction(cc._tmp.PrototypeCCNode), cc._LogInfos.MissingFile, "BaseNodesPropertyDefine.js");
cc._tmp.PrototypeCCNode();
delete cc._tmp.PrototypeCCNode;
cc.CustomRenderCmd = function (target, func) {
    this._needDraw = true;
    this._target = target;
    this._callback = func;
    this.rendering = function (ctx, scaleX, scaleY) {
        if (!this._callback)
            return;
        this._callback.call(this._target, ctx, scaleX, scaleY);
    };
    this.needDraw = function () {
        return this._needDraw;
    };
};
cc.Node._dirtyFlags = {
    transformDirty: 1 << 0, visibleDirty: 1 << 1, colorDirty: 1 << 2, opacityDirty: 1 << 3, cacheDirty: 1 << 4,
    orderDirty: 1 << 5, textDirty: 1 << 6, gradientDirty: 1 << 7, textureDirty: 1 << 8,
    contentDirty: 1 << 9,
    COUNT: 10,
    all: (1 << 10) - 1
};
cc.Node.RenderCmd = function (renderable) {
    this._dirtyFlag = 1;
    this._savedDirtyFlag = true;
    this._node = renderable;
    this._needDraw = false;
    this._anchorPointInPoints = new cc.Point(0, 0);
    this._transform = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};
    this._worldTransform = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};
    this._inverse = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};
    this._displayedOpacity = 255;
    this._displayedColor = cc.color(255, 255, 255, 255);
    this._cascadeColorEnabledDirty = false;
    this._cascadeOpacityEnabledDirty = false;
    this._curLevel = -1;
};
cc.Node.RenderCmd.prototype = {
    constructor: cc.Node.RenderCmd,
    needDraw: function () {
        return this._needDraw;
    },
    getAnchorPointInPoints: function () {
        return cc.p(this._anchorPointInPoints);
    },
    getDisplayedColor: function () {
        var tmpColor = this._displayedColor;
        return cc.color(tmpColor.r, tmpColor.g, tmpColor.b, tmpColor.a);
    },
    getDisplayedOpacity: function () {
        return this._displayedOpacity;
    },
    setCascadeColorEnabledDirty: function () {
        this._cascadeColorEnabledDirty = true;
        this.setDirtyFlag(cc.Node._dirtyFlags.colorDirty);
    },
    setCascadeOpacityEnabledDirty: function () {
        this._cascadeOpacityEnabledDirty = true;
        this.setDirtyFlag(cc.Node._dirtyFlags.opacityDirty);
    },
    getParentToNodeTransform: function () {
        if (this._dirtyFlag & cc.Node._dirtyFlags.transformDirty)
            this._inverse = cc.affineTransformInvert(this.getNodeToParentTransform());
        return this._inverse;
    },
    detachFromParent: function () {
    },
    _updateAnchorPointInPoint: function () {
        var locAPP = this._anchorPointInPoints, locSize = this._node._contentSize, locAnchorPoint = this._node._anchorPoint;
        locAPP.x = locSize.width * locAnchorPoint.x;
        locAPP.y = locSize.height * locAnchorPoint.y;
        this.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    setDirtyFlag: function (dirtyFlag) {
        if (this._dirtyFlag === 0 && dirtyFlag !== 0)
            cc.renderer.pushDirtyNode(this);
        this._dirtyFlag |= dirtyFlag;
    },
    getParentRenderCmd: function () {
        if (this._node && this._node._parent && this._node._parent._renderCmd)
            return this._node._parent._renderCmd;
        return null;
    },
    transform: function (parentCmd, recursive) {
        var node = this._node,
            pt = parentCmd ? parentCmd._worldTransform : null,
            t = this._transform,
            wt = this._worldTransform;
        if (node._usingNormalizedPosition && node._parent) {
            var conSize = node._parent._contentSize;
            node._position.x = node._normalizedPosition.x * conSize.width;
            node._position.y = node._normalizedPosition.y * conSize.height;
            node._normalizedPositionDirty = false;
        }
        var hasRotation = node._rotationX || node._rotationY;
        var hasSkew = node._skewX || node._skewY;
        var sx = node._scaleX, sy = node._scaleY;
        var appX = this._anchorPointInPoints.x, appY = this._anchorPointInPoints.y;
        var a = 1, b = 0, c = 0, d = 1;
        if (hasRotation || hasSkew) {
            t.tx = node._position.x;
            t.ty = node._position.y;
            if (hasRotation) {
                var rotationRadiansX = node._rotationX * 0.017453292519943295;
                c = Math.sin(rotationRadiansX);
                d = Math.cos(rotationRadiansX);
                if (node._rotationY === node._rotationX) {
                    a = d;
                    b = -c;
                }
                else {
                    var rotationRadiansY = node._rotationY * 0.017453292519943295;
                    a = Math.cos(rotationRadiansY);
                    b = -Math.sin(rotationRadiansY);
                }
            }
            t.a = a *= sx;
            t.b = b *= sx;
            t.c = c *= sy;
            t.d = d *= sy;
            if (hasSkew) {
                var skx = Math.tan(node._skewX * Math.PI / 180);
                var sky = Math.tan(node._skewY * Math.PI / 180);
                if (skx === Infinity)
                    skx = 99999999;
                if (sky === Infinity)
                    sky = 99999999;
                t.a = a + c * sky;
                t.b = b + d * sky;
                t.c = c + a * skx;
                t.d = d + b * skx;
            }
            if (appX || appY) {
                t.tx -= t.a * appX + t.c * appY;
                t.ty -= t.b * appX + t.d * appY;
                if (node._ignoreAnchorPointForPosition) {
                    t.tx += appX;
                    t.ty += appY;
                }
            }
            if (pt) {
                wt.a = t.a * pt.a + t.b * pt.c;
                wt.b = t.a * pt.b + t.b * pt.d;
                wt.c = t.c * pt.a + t.d * pt.c;
                wt.d = t.c * pt.b + t.d * pt.d;
                wt.tx = pt.a * t.tx + pt.c * t.ty + pt.tx;
                wt.ty = pt.d * t.ty + pt.ty + pt.b * t.tx;
            } else {
                wt.a = t.a;
                wt.b = t.b;
                wt.c = t.c;
                wt.d = t.d;
                wt.tx = t.tx;
                wt.ty = t.ty;
            }
        }
        else {
            t.a = sx;
            t.b = 0;
            t.c = 0;
            t.d = sy;
            t.tx = node._position.x;
            t.ty = node._position.y;
            if (appX || appY) {
                t.tx -= t.a * appX;
                t.ty -= t.d * appY;
                if (node._ignoreAnchorPointForPosition) {
                    t.tx += appX;
                    t.ty += appY;
                }
            }
            if (pt) {
                wt.a = t.a * pt.a + t.b * pt.c;
                wt.b = t.a * pt.b + t.b * pt.d;
                wt.c = t.c * pt.a + t.d * pt.c;
                wt.d = t.c * pt.b + t.d * pt.d;
                wt.tx = t.tx * pt.a + t.ty * pt.c + pt.tx;
                wt.ty = t.tx * pt.b + t.ty * pt.d + pt.ty;
            } else {
                wt.a = t.a;
                wt.b = t.b;
                wt.c = t.c;
                wt.d = t.d;
                wt.tx = t.tx;
                wt.ty = t.ty;
            }
        }
        if (node._additionalTransformDirty) {
            this._transform = cc.affineTransformConcat(t, node._additionalTransform);
        }
        this._updateCurrentRegions && this._updateCurrentRegions();
        this._notifyRegionStatus && this._notifyRegionStatus(cc.Node.CanvasRenderCmd.RegionStatus.DirtyDouble);
        if (recursive) {
            var locChildren = this._node._children;
            if (!locChildren || locChildren.length === 0)
                return;
            var i, len;
            for (i = 0, len = locChildren.length; i < len; i++) {
                locChildren[i]._renderCmd.transform(this, recursive);
            }
        }
        this._cacheDirty = true;
    },
    getNodeToParentTransform: function () {
        if (this._dirtyFlag & cc.Node._dirtyFlags.transformDirty) {
            this.transform();
        }
        return this._transform;
    },
    visit: function (parentCmd) {
        var node = this._node, renderer = cc.renderer;
        if (!node._visible)
            return;
        parentCmd = parentCmd || this.getParentRenderCmd();
        if (parentCmd)
            this._curLevel = parentCmd._curLevel + 1;
        if (isNaN(node._customZ)) {
            node._vertexZ = renderer.assignedZ;
            renderer.assignedZ += renderer.assignedZStep;
        }
        this._syncStatus(parentCmd);
        this.visitChildren();
    },
    _updateDisplayColor: function (parentColor) {
        var node = this._node;
        var locDispColor = this._displayedColor, locRealColor = node._realColor;
        var i, len, selChildren, item;
        this._notifyRegionStatus && this._notifyRegionStatus(cc.Node.CanvasRenderCmd.RegionStatus.Dirty);
        if (this._cascadeColorEnabledDirty && !node._cascadeColorEnabled) {
            locDispColor.r = locRealColor.r;
            locDispColor.g = locRealColor.g;
            locDispColor.b = locRealColor.b;
            var whiteColor = new cc.Color(255, 255, 255, 255);
            selChildren = node._children;
            for (i = 0, len = selChildren.length; i < len; i++) {
                item = selChildren[i];
                if (item && item._renderCmd)
                    item._renderCmd._updateDisplayColor(whiteColor);
            }
            this._cascadeColorEnabledDirty = false;
        } else {
            if (parentColor === undefined) {
                var locParent = node._parent;
                if (locParent && locParent._cascadeColorEnabled)
                    parentColor = locParent.getDisplayedColor();
                else
                    parentColor = cc.color.WHITE;
            }
            locDispColor.r = 0 | (locRealColor.r * parentColor.r / 255.0);
            locDispColor.g = 0 | (locRealColor.g * parentColor.g / 255.0);
            locDispColor.b = 0 | (locRealColor.b * parentColor.b / 255.0);
            if (node._cascadeColorEnabled) {
                selChildren = node._children;
                for (i = 0, len = selChildren.length; i < len; i++) {
                    item = selChildren[i];
                    if (item && item._renderCmd) {
                        item._renderCmd._updateDisplayColor(locDispColor);
                        item._renderCmd._updateColor();
                    }
                }
            }
        }
        this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.colorDirty ^ this._dirtyFlag;
    },
    _updateDisplayOpacity: function (parentOpacity) {
        var node = this._node;
        var i, len, selChildren, item;
        this._notifyRegionStatus && this._notifyRegionStatus(cc.Node.CanvasRenderCmd.RegionStatus.Dirty);
        if (this._cascadeOpacityEnabledDirty && !node._cascadeOpacityEnabled) {
            this._displayedOpacity = node._realOpacity;
            selChildren = node._children;
            for (i = 0, len = selChildren.length; i < len; i++) {
                item = selChildren[i];
                if (item && item._renderCmd)
                    item._renderCmd._updateDisplayOpacity(255);
            }
            this._cascadeOpacityEnabledDirty = false;
        } else {
            if (parentOpacity === undefined) {
                var locParent = node._parent;
                parentOpacity = 255;
                if (locParent && locParent._cascadeOpacityEnabled)
                    parentOpacity = locParent.getDisplayedOpacity();
            }
            this._displayedOpacity = node._realOpacity * parentOpacity / 255.0;
            if (node._cascadeOpacityEnabled) {
                selChildren = node._children;
                for (i = 0, len = selChildren.length; i < len; i++) {
                    item = selChildren[i];
                    if (item && item._renderCmd) {
                        item._renderCmd._updateDisplayOpacity(this._displayedOpacity);
                        item._renderCmd._updateColor();
                    }
                }
            }
        }
        this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.opacityDirty ^ this._dirtyFlag;
    },
    _syncDisplayColor: function (parentColor) {
        var node = this._node, locDispColor = this._displayedColor, locRealColor = node._realColor;
        if (parentColor === undefined) {
            var locParent = node._parent;
            if (locParent && locParent._cascadeColorEnabled)
                parentColor = locParent.getDisplayedColor();
            else
                parentColor = cc.color.WHITE;
        }
        locDispColor.r = 0 | (locRealColor.r * parentColor.r / 255.0);
        locDispColor.g = 0 | (locRealColor.g * parentColor.g / 255.0);
        locDispColor.b = 0 | (locRealColor.b * parentColor.b / 255.0);
    },
    _syncDisplayOpacity: function (parentOpacity) {
        var node = this._node;
        if (parentOpacity === undefined) {
            var locParent = node._parent;
            parentOpacity = 255;
            if (locParent && locParent._cascadeOpacityEnabled)
                parentOpacity = locParent.getDisplayedOpacity();
        }
        this._displayedOpacity = node._realOpacity * parentOpacity / 255.0;
    },
    _updateColor: function () {
    },
    updateStatus: function () {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        var colorDirty = locFlag & flags.colorDirty,
            opacityDirty = locFlag & flags.opacityDirty;
        this._savedDirtyFlag = this._savedDirtyFlag || locFlag;
        if (colorDirty)
            this._updateDisplayColor();
        if (opacityDirty)
            this._updateDisplayOpacity();
        if (colorDirty || opacityDirty)
            this._updateColor();
        if (locFlag & flags.transformDirty) {
            this.transform(this.getParentRenderCmd(), true);
            this._dirtyFlag = this._dirtyFlag & flags.transformDirty ^ this._dirtyFlag;
        }
        if (locFlag & flags.orderDirty)
            this._dirtyFlag = this._dirtyFlag & flags.orderDirty ^ this._dirtyFlag;
    },
    _syncStatus: function (parentCmd) {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag, parentNode = null;
        if (parentCmd) {
            parentNode = parentCmd._node;
            this._savedDirtyFlag = this._savedDirtyFlag || parentCmd._savedDirtyFlag || locFlag;
        }
        else {
            this._savedDirtyFlag = this._savedDirtyFlag || locFlag;
        }
        if (parentNode && parentNode._cascadeColorEnabled && (parentCmd._dirtyFlag & flags.colorDirty))
            locFlag |= flags.colorDirty;
        if (parentNode && parentNode._cascadeOpacityEnabled && (parentCmd._dirtyFlag & flags.opacityDirty))
            locFlag |= flags.opacityDirty;
        if (parentCmd && (parentCmd._dirtyFlag & flags.transformDirty))
            locFlag |= flags.transformDirty;
        var colorDirty = locFlag & flags.colorDirty,
            opacityDirty = locFlag & flags.opacityDirty;
        this._dirtyFlag = locFlag;
        if (colorDirty)
            this._syncDisplayColor();
        if (opacityDirty)
            this._syncDisplayOpacity();
        if (colorDirty || opacityDirty)
            this._updateColor();
        if (locFlag & flags.transformDirty)
            this.transform(parentCmd);
        if (locFlag & flags.orderDirty)
            this._dirtyFlag = this._dirtyFlag & flags.orderDirty ^ this._dirtyFlag;
    },
    visitChildren: function () {
        var renderer = cc.renderer;
        var node = this._node;
        var i, children = node._children, child;
        var len = children.length;
        if (len > 0) {
            node.sortAllChildren();
            for (i = 0; i < len; i++) {
                child = children[i];
                if (child._localZOrder < 0) {
                    child._renderCmd.visit(this);
                }
                else {
                    break;
                }
            }
            renderer.pushRenderCommand(this);
            for (; i < len; i++) {
                children[i]._renderCmd.visit(this);
            }
        } else {
            renderer.pushRenderCommand(this);
        }
        this._dirtyFlag = 0;
    }
};
cc.Node.RenderCmd.prototype.originVisit = cc.Node.RenderCmd.prototype.visit;
cc.Node.RenderCmd.prototype.originTransform = cc.Node.RenderCmd.prototype.transform;
(function () {
    cc.Node.CanvasRenderCmd = function (renderable) {
        cc.Node.RenderCmd.call(this, renderable);
        this._cachedParent = null;
        this._cacheDirty = false;
        this._currentRegion = new cc.Region();
        this._oldRegion = new cc.Region();
        this._regionFlag = 0;
        this._canUseDirtyRegion = false;
    };
    cc.Node.CanvasRenderCmd.RegionStatus = {
        NotDirty: 0,
        Dirty: 1,
        DirtyDouble: 2
    };
    var proto = cc.Node.CanvasRenderCmd.prototype = Object.create(cc.Node.RenderCmd.prototype);
    proto.constructor = cc.Node.CanvasRenderCmd;
    proto._notifyRegionStatus = function (status) {
        if (this._needDraw && this._regionFlag < status) {
            this._regionFlag = status;
        }
    };
    var localBB = new cc.Rect();
    proto.getLocalBB = function () {
        var node = this._node;
        localBB.x = localBB.y = 0;
        localBB.width = node._contentSize.width;
        localBB.height = node._contentSize.height;
        return localBB;
    };
    proto._updateCurrentRegions = function () {
        var temp = this._currentRegion;
        this._currentRegion = this._oldRegion;
        this._oldRegion = temp;
        if (cc.Node.CanvasRenderCmd.RegionStatus.DirtyDouble === this._regionFlag && (!this._currentRegion.isEmpty())) {
            this._oldRegion.union(this._currentRegion);
        }
        this._currentRegion.updateRegion(this.getLocalBB(), this._worldTransform);
    };
    proto.setDirtyFlag = function (dirtyFlag, child) {
        cc.Node.RenderCmd.prototype.setDirtyFlag.call(this, dirtyFlag, child);
        this._setCacheDirty(child);
        if (this._cachedParent)
            this._cachedParent.setDirtyFlag(dirtyFlag, true);
    };
    proto._setCacheDirty = function () {
        if (this._cacheDirty === false) {
            this._cacheDirty = true;
            var cachedP = this._cachedParent;
            cachedP && cachedP !== this && cachedP._setNodeDirtyForCache && cachedP._setNodeDirtyForCache();
        }
    };
    proto._setCachedParent = function (cachedParent) {
        if (this._cachedParent === cachedParent)
            return;
        this._cachedParent = cachedParent;
        var children = this._node._children;
        for (var i = 0, len = children.length; i < len; i++)
            children[i]._renderCmd._setCachedParent(cachedParent);
    };
    proto.detachFromParent = function () {
        this._cachedParent = null;
        var selChildren = this._node._children, item;
        for (var i = 0, len = selChildren.length; i < len; i++) {
            item = selChildren[i];
            if (item && item._renderCmd)
                item._renderCmd.detachFromParent();
        }
    };
    proto.setShaderProgram = function (shaderProgram) {
    };
    proto.getShaderProgram = function () {
        return null;
    };
    cc.Node.CanvasRenderCmd._getCompositeOperationByBlendFunc = function (blendFunc) {
        if (!blendFunc)
            return "source-over";
        else {
            if (( blendFunc.src === cc.SRC_ALPHA && blendFunc.dst === cc.ONE) || (blendFunc.src === cc.ONE && blendFunc.dst === cc.ONE))
                return "lighter";
            else if (blendFunc.src === cc.ZERO && blendFunc.dst === cc.SRC_ALPHA)
                return "destination-in";
            else if (blendFunc.src === cc.ZERO && blendFunc.dst === cc.ONE_MINUS_SRC_ALPHA)
                return "destination-out";
            else
                return "source-over";
        }
    };
})();
cc._tmp.PrototypeTexture2D = function () {
    var _c = cc.Texture2D;
    _c.PVRImagesHavePremultipliedAlpha = function (haveAlphaPremultiplied) {
        cc.PVRHaveAlphaPremultiplied_ = haveAlphaPremultiplied;
    };
    _c.PIXEL_FORMAT_RGBA8888 = 2;
    _c.PIXEL_FORMAT_RGB888 = 3;
    _c.PIXEL_FORMAT_RGB565 = 4;
    _c.PIXEL_FORMAT_A8 = 5;
    _c.PIXEL_FORMAT_I8 = 6;
    _c.PIXEL_FORMAT_AI88 = 7;
    _c.PIXEL_FORMAT_RGBA4444 = 8;
    _c.PIXEL_FORMAT_RGB5A1 = 7;
    _c.PIXEL_FORMAT_PVRTC4 = 9;
    _c.PIXEL_FORMAT_PVRTC2 = 10;
    _c.PIXEL_FORMAT_DEFAULT = _c.PIXEL_FORMAT_RGBA8888;
    _c.defaultPixelFormat = _c.PIXEL_FORMAT_DEFAULT;
    var _M = cc.Texture2D._M = {};
    _M[_c.PIXEL_FORMAT_RGBA8888] = "RGBA8888";
    _M[_c.PIXEL_FORMAT_RGB888] = "RGB888";
    _M[_c.PIXEL_FORMAT_RGB565] = "RGB565";
    _M[_c.PIXEL_FORMAT_A8] = "A8";
    _M[_c.PIXEL_FORMAT_I8] = "I8";
    _M[_c.PIXEL_FORMAT_AI88] = "AI88";
    _M[_c.PIXEL_FORMAT_RGBA4444] = "RGBA4444";
    _M[_c.PIXEL_FORMAT_RGB5A1] = "RGB5A1";
    _M[_c.PIXEL_FORMAT_PVRTC4] = "PVRTC4";
    _M[_c.PIXEL_FORMAT_PVRTC2] = "PVRTC2";
    var _B = cc.Texture2D._B = {};
    _B[_c.PIXEL_FORMAT_RGBA8888] = 32;
    _B[_c.PIXEL_FORMAT_RGB888] = 24;
    _B[_c.PIXEL_FORMAT_RGB565] = 16;
    _B[_c.PIXEL_FORMAT_A8] = 8;
    _B[_c.PIXEL_FORMAT_I8] = 8;
    _B[_c.PIXEL_FORMAT_AI88] = 16;
    _B[_c.PIXEL_FORMAT_RGBA4444] = 16;
    _B[_c.PIXEL_FORMAT_RGB5A1] = 16;
    _B[_c.PIXEL_FORMAT_PVRTC4] = 4;
    _B[_c.PIXEL_FORMAT_PVRTC2] = 3;
    var _p = cc.Texture2D.prototype;
    _p.name;
    cc.defineGetterSetter(_p, "name", _p.getName);
    _p.pixelFormat;
    cc.defineGetterSetter(_p, "pixelFormat", _p.getPixelFormat);
    _p.pixelsWidth;
    cc.defineGetterSetter(_p, "pixelsWidth", _p.getPixelsWide);
    _p.pixelsHeight;
    cc.defineGetterSetter(_p, "pixelsHeight", _p.getPixelsHigh);
    _p.width;
    cc.defineGetterSetter(_p, "width", _p._getWidth);
    _p.height;
    cc.defineGetterSetter(_p, "height", _p._getHeight);
};
cc._tmp.PrototypeTextureAtlas = function () {
    var _p = cc.TextureAtlas.prototype;
    _p.totalQuads;
    cc.defineGetterSetter(_p, "totalQuads", _p.getTotalQuads);
    _p.capacity;
    cc.defineGetterSetter(_p, "capacity", _p.getCapacity);
    _p.quads;
    cc.defineGetterSetter(_p, "quads", _p.getQuads, _p.setQuads);
};
cc._tmp.WebGLTexture2D = function () {
    cc.Texture2D = cc.Class.extend({
        _pVRHaveAlphaPremultiplied: true,
        _pixelFormat: null,
        _pixelsWide: 0,
        _pixelsHigh: 0,
        _name: "",
        _contentSize: null,
        maxS: 0,
        maxT: 0,
        _hasPremultipliedAlpha: false,
        _hasMipmaps: false,
        shaderProgram: null,
        _textureLoaded: false,
        _htmlElementObj: null,
        _webTextureObj: null,
        url: null,
        ctor: function () {
            this._contentSize = cc.size(0, 0);
            this._pixelFormat = cc.Texture2D.defaultPixelFormat;
        },
        releaseTexture: function () {
            if (this._webTextureObj)
                cc._renderContext.deleteTexture(this._webTextureObj);
            cc.loader.release(this.url);
        },
        getPixelFormat: function () {
            return this._pixelFormat;
        },
        getPixelsWide: function () {
            return this._pixelsWide;
        },
        getPixelsHigh: function () {
            return this._pixelsHigh;
        },
        getName: function () {
            return this._webTextureObj;
        },
        getContentSize: function () {
            return cc.size(this._contentSize.width / cc.contentScaleFactor(), this._contentSize.height / cc.contentScaleFactor());
        },
        _getWidth: function () {
            return this._contentSize.width / cc.contentScaleFactor();
        },
        _getHeight: function () {
            return this._contentSize.height / cc.contentScaleFactor();
        },
        getContentSizeInPixels: function () {
            return this._contentSize;
        },
        getMaxS: function () {
            return this.maxS;
        },
        setMaxS: function (maxS) {
            this.maxS = maxS;
        },
        getMaxT: function () {
            return this.maxT;
        },
        setMaxT: function (maxT) {
            this.maxT = maxT;
        },
        getShaderProgram: function () {
            return this.shaderProgram;
        },
        setShaderProgram: function (shaderProgram) {
            this.shaderProgram = shaderProgram;
        },
        hasPremultipliedAlpha: function () {
            return this._hasPremultipliedAlpha;
        },
        hasMipmaps: function () {
            return this._hasMipmaps;
        },
        description: function () {
            var _t = this;
            return "<cc.Texture2D | Name = " + _t._name + " | Dimensions = " + _t._pixelsWide + " x " + _t._pixelsHigh
                + " | Coordinates = (" + _t.maxS + ", " + _t.maxT + ")>";
        },
        releaseData: function (data) {
            data = null;
        },
        keepData: function (data, length) {
            return data;
        },
        initWithData: function (data, pixelFormat, pixelsWide, pixelsHigh, contentSize) {
            var self = this, tex2d = cc.Texture2D;
            var gl = cc._renderContext;
            var format = gl.RGBA, type = gl.UNSIGNED_BYTE;
            var bitsPerPixel = cc.Texture2D._B[pixelFormat];
            var bytesPerRow = pixelsWide * bitsPerPixel / 8;
            if (bytesPerRow % 8 === 0) {
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 8);
            } else if (bytesPerRow % 4 === 0) {
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
            } else if (bytesPerRow % 2 === 0) {
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
            } else {
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            }
            self._webTextureObj = gl.createTexture();
            cc.glBindTexture2D(self);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            switch (pixelFormat) {
                case tex2d.PIXEL_FORMAT_RGBA8888:
                    format = gl.RGBA;
                    break;
                case tex2d.PIXEL_FORMAT_RGB888:
                    format = gl.RGB;
                    break;
                case tex2d.PIXEL_FORMAT_RGBA4444:
                    type = gl.UNSIGNED_SHORT_4_4_4_4;
                    break;
                case tex2d.PIXEL_FORMAT_RGB5A1:
                    type = gl.UNSIGNED_SHORT_5_5_5_1;
                    break;
                case tex2d.PIXEL_FORMAT_RGB565:
                    type = gl.UNSIGNED_SHORT_5_6_5;
                    break;
                case tex2d.PIXEL_FORMAT_AI88:
                    format = gl.LUMINANCE_ALPHA;
                    break;
                case tex2d.PIXEL_FORMAT_A8:
                    format = gl.ALPHA;
                    break;
                case tex2d.PIXEL_FORMAT_I8:
                    format = gl.LUMINANCE;
                    break;
                default:
                    cc.assert(0, cc._LogInfos.Texture2D_initWithData);
            }
            gl.texImage2D(gl.TEXTURE_2D, 0, format, pixelsWide, pixelsHigh, 0, format, type, data);
            self._contentSize.width = contentSize.width;
            self._contentSize.height = contentSize.height;
            self._pixelsWide = pixelsWide;
            self._pixelsHigh = pixelsHigh;
            self._pixelFormat = pixelFormat;
            self.maxS = contentSize.width / pixelsWide;
            self.maxT = contentSize.height / pixelsHigh;
            self._hasPremultipliedAlpha = false;
            self._hasMipmaps = false;
            self.shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURE);
            self._textureLoaded = true;
            return true;
        },
        drawAtPoint: function (point) {
            var self = this;
            var coordinates = [
                0.0, self.maxT,
                self.maxS, self.maxT,
                0.0, 0.0,
                self.maxS, 0.0 ],
                gl = cc._renderContext;
            var width = self._pixelsWide * self.maxS,
                height = self._pixelsHigh * self.maxT;
            var vertices = [
                point.x, point.y, 0.0,
                width + point.x, point.y, 0.0,
                point.x, height + point.y, 0.0,
                width + point.x, height + point.y, 0.0 ];
            self._shaderProgram.use();
            self._shaderProgram.setUniformsForBuiltins();
            cc.glBindTexture2D(self);
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, gl.FLOAT, false, 0, vertices);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_TEX_COORDS, 2, gl.FLOAT, false, 0, coordinates);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        drawInRect: function (rect) {
            var self = this;
            var coordinates = [
                0.0, self.maxT,
                self.maxS, self.maxT,
                0.0, 0.0,
                self.maxS, 0.0];
            var vertices = [    rect.x, rect.y,
                rect.x + rect.width, rect.y,
                rect.x, rect.y + rect.height,
                rect.x + rect.width, rect.y + rect.height         ];
            self._shaderProgram.use();
            self._shaderProgram.setUniformsForBuiltins();
            cc.glBindTexture2D(self);
            var gl = cc._renderContext;
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, gl.FLOAT, false, 0, vertices);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_TEX_COORDS, 2, gl.FLOAT, false, 0, coordinates);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        initWithImage: function (uiImage) {
            if (uiImage == null) {
                cc.log(cc._LogInfos.Texture2D_initWithImage);
                return false;
            }
            var imageWidth = uiImage.getWidth();
            var imageHeight = uiImage.getHeight();
            var maxTextureSize = cc.configuration.getMaxTextureSize();
            if (imageWidth > maxTextureSize || imageHeight > maxTextureSize) {
                cc.log(cc._LogInfos.Texture2D_initWithImage_2, imageWidth, imageHeight, maxTextureSize, maxTextureSize);
                return false;
            }
            this._textureLoaded = true;
            return this._initPremultipliedATextureWithImage(uiImage, imageWidth, imageHeight);
        },
        initWithElement: function (element) {
            if (!element)
                return;
            this._webTextureObj = cc._renderContext.createTexture();
            this._htmlElementObj = element;
            this._textureLoaded = true;
            this._hasPremultipliedAlpha = true;
        },
        getHtmlElementObj: function () {
            return this._htmlElementObj;
        },
        isLoaded: function () {
            return this._textureLoaded;
        },
        handleLoadedTexture: function (premultiplied) {
            var self = this;
            premultiplied =
              (premultiplied !== undefined)
                ? premultiplied
                : self._hasPremultipliedAlpha;
            if (!cc.game._rendererInitialized)
                return;
            if (!self._htmlElementObj) {
                var img = cc.loader.getRes(self.url);
                if (!img) return;
                self.initWithElement(img);
            }
            if (!self._htmlElementObj.width || !self._htmlElementObj.height)
                return;
            var gl = cc._renderContext;
            cc.glBindTexture2D(self);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
            if(premultiplied)
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, self._htmlElementObj);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            self.shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURE);
            cc.glBindTexture2D(null);
            if(premultiplied)
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
            var pixelsWide = self._htmlElementObj.width;
            var pixelsHigh = self._htmlElementObj.height;
            self._pixelsWide = self._contentSize.width = pixelsWide;
            self._pixelsHigh = self._contentSize.height = pixelsHigh;
            self._pixelFormat = cc.Texture2D.PIXEL_FORMAT_RGBA8888;
            self.maxS = 1;
            self.maxT = 1;
            self._hasPremultipliedAlpha = premultiplied;
            self._hasMipmaps = false;
            self.dispatchEvent("load");
        },
        initWithString: function (text, fontName, fontSize, dimensions, hAlignment, vAlignment) {
            cc.log(cc._LogInfos.Texture2D_initWithString);
            return null;
        },
        initWithETCFile: function (file) {
            cc.log(cc._LogInfos.Texture2D_initWithETCFile_2);
            return false;
        },
        initWithPVRFile: function (file) {
            cc.log(cc._LogInfos.Texture2D_initWithPVRFile_2);
            return false;
        },
        initWithPVRTCData: function (data, level, bpp, hasAlpha, length, pixelFormat) {
            cc.log(cc._LogInfos.Texture2D_initWithPVRTCData_2);
            return false;
        },
        setTexParameters: function (texParams, magFilter, wrapS, wrapT) {
            var _t = this;
            var gl = cc._renderContext;
            if(magFilter !== undefined)
                texParams = {minFilter: texParams, magFilter: magFilter, wrapS: wrapS, wrapT: wrapT};
            cc.assert((_t._pixelsWide === cc.NextPOT(_t._pixelsWide) && _t._pixelsHigh === cc.NextPOT(_t._pixelsHigh)) ||
                (texParams.wrapS === gl.CLAMP_TO_EDGE && texParams.wrapT === gl.CLAMP_TO_EDGE),
                "WebGLRenderingContext.CLAMP_TO_EDGE should be used in NPOT textures");
            cc.glBindTexture2D(_t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texParams.minFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texParams.magFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, texParams.wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, texParams.wrapT);
        },
        setAntiAliasTexParameters: function () {
            var gl = cc._renderContext;
            cc.glBindTexture2D(this);
            if (!this._hasMipmaps)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            else
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        },
        setAliasTexParameters: function () {
            var gl = cc._renderContext;
            cc.glBindTexture2D(this);
            if (!this._hasMipmaps)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            else
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        },
        generateMipmap: function () {
            var _t = this;
            cc.assert(_t._pixelsWide === cc.NextPOT(_t._pixelsWide) && _t._pixelsHigh === cc.NextPOT(_t._pixelsHigh), "Mimpap texture only works in POT textures");
            cc.glBindTexture2D(_t);
            cc._renderContext.generateMipmap(cc._renderContext.TEXTURE_2D);
            _t._hasMipmaps = true;
        },
        stringForFormat: function () {
            return cc.Texture2D._M[this._pixelFormat];
        },
        bitsPerPixelForFormat: function (format) {//TODO I want to delete the format argument, use this._pixelFormat
            format = format || this._pixelFormat;
            var value = cc.Texture2D._B[format];
            if (value != null) return value;
            cc.log(cc._LogInfos.Texture2D_bitsPerPixelForFormat, format);
            return -1;
        },
        _initPremultipliedATextureWithImage: function (uiImage, width, height) {
            var tex2d = cc.Texture2D;
            var tempData = uiImage.getData();
            var inPixel32 = null;
            var inPixel8 = null;
            var outPixel16 = null;
            var hasAlpha = uiImage.hasAlpha();
            var imageSize = cc.size(uiImage.getWidth(), uiImage.getHeight());
            var pixelFormat = tex2d.defaultPixelFormat;
            var bpp = uiImage.getBitsPerComponent();
            var i;
            if (!hasAlpha) {
                if (bpp >= 8) {
                    pixelFormat = tex2d.PIXEL_FORMAT_RGB888;
                } else {
                    cc.log(cc._LogInfos.Texture2D__initPremultipliedATextureWithImage);
                    pixelFormat = tex2d.PIXEL_FORMAT_RGB565;
                }
            }
            var length = width * height;
            if (pixelFormat === tex2d.PIXEL_FORMAT_RGB565) {
                if (hasAlpha) {
                    tempData = new Uint16Array(width * height);
                    inPixel32 = uiImage.getData();
                    for (i = 0; i < length; ++i) {
                        tempData[i] =
                            ((((inPixel32[i] >> 0) & 0xFF) >> 3) << 11) |
                                ((((inPixel32[i] >> 8) & 0xFF) >> 2) << 5) |
                                ((((inPixel32[i] >> 16) & 0xFF) >> 3) << 0);
                    }
                } else {
                    tempData = new Uint16Array(width * height);
                    inPixel8 = uiImage.getData();
                    for (i = 0; i < length; ++i) {
                        tempData[i] =
                            (((inPixel8[i] & 0xFF) >> 3) << 11) |
                                (((inPixel8[i] & 0xFF) >> 2) << 5) |
                                (((inPixel8[i] & 0xFF) >> 3) << 0);
                    }
                }
            } else if (pixelFormat === tex2d.PIXEL_FORMAT_RGBA4444) {
                tempData = new Uint16Array(width * height);
                inPixel32 = uiImage.getData();
                for (i = 0; i < length; ++i) {
                    tempData[i] =
                        ((((inPixel32[i] >> 0) & 0xFF) >> 4) << 12) |
                            ((((inPixel32[i] >> 8) & 0xFF) >> 4) << 8) |
                            ((((inPixel32[i] >> 16) & 0xFF) >> 4) << 4) |
                            ((((inPixel32[i] >> 24) & 0xFF) >> 4) << 0);
                }
            } else if (pixelFormat === tex2d.PIXEL_FORMAT_RGB5A1) {
                tempData = new Uint16Array(width * height);
                inPixel32 = uiImage.getData();
                for (i = 0; i < length; ++i) {
                    tempData[i] =
                        ((((inPixel32[i] >> 0) & 0xFF) >> 3) << 11) |
                            ((((inPixel32[i] >> 8) & 0xFF) >> 3) << 6) |
                            ((((inPixel32[i] >> 16) & 0xFF) >> 3) << 1) |
                            ((((inPixel32[i] >> 24) & 0xFF) >> 7) << 0);
                }
            } else if (pixelFormat === tex2d.PIXEL_FORMAT_A8) {
                tempData = new Uint8Array(width * height);
                inPixel32 = uiImage.getData();
                for (i = 0; i < length; ++i) {
                    tempData[i] = (inPixel32 >> 24) & 0xFF;
                }
            }
            if (hasAlpha && pixelFormat === tex2d.PIXEL_FORMAT_RGB888) {
                inPixel32 = uiImage.getData();
                tempData = new Uint8Array(width * height * 3);
                for (i = 0; i < length; ++i) {
                    tempData[i * 3] = (inPixel32 >> 0) & 0xFF;
                    tempData[i * 3 + 1] = (inPixel32 >> 8) & 0xFF;
                    tempData[i * 3 + 2] = (inPixel32 >> 16) & 0xFF;
                }
            }
            this.initWithData(tempData, pixelFormat, width, height, imageSize);
            if (tempData != uiImage.getData())
                tempData = null;
            this._hasPremultipliedAlpha = uiImage.isPremultipliedAlpha();
            return true;
        },
        addLoadedEventListener: function (callback, target) {
            this.addEventListener("load", callback, target);
        },
        removeLoadedEventListener: function (target) {
            this.removeEventTarget("load", target);
        }
    });
};
cc._tmp.WebGLTextureAtlas = function () {
    var _p = cc.TextureAtlas.prototype;
    _p._setupVBO = function () {
        var _t = this;
        var gl = cc._renderContext;
        _t._buffersVBO[0] = gl.createBuffer();
        _t._buffersVBO[1] = gl.createBuffer();
        _t._quadsWebBuffer = gl.createBuffer();
        _t._mapBuffers();
    };
    _p._mapBuffers = function () {
        var _t = this;
        var gl = cc._renderContext;
        gl.bindBuffer(gl.ARRAY_BUFFER, _t._quadsWebBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, _t._quadsArrayBuffer, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _t._buffersVBO[1]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, _t._indices, gl.STATIC_DRAW);
    };
    _p.drawNumberOfQuads = function (n, start) {
        var _t = this;
        start = start || 0;
        if (0 === n || !_t.texture || !_t.texture.isLoaded())
            return;
        var gl = cc._renderContext;
        cc.glBindTexture2D(_t.texture);
        gl.bindBuffer(gl.ARRAY_BUFFER, _t._quadsWebBuffer);
        if (_t.dirty){
            gl.bufferData(gl.ARRAY_BUFFER, _t._quadsArrayBuffer, gl.DYNAMIC_DRAW);
            _t.dirty = false;
        }
        gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
        gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.UNSIGNED_BYTE, true, 24, 12);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_TEX_COORDS, 2, gl.FLOAT, false, 24, 16);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _t._buffersVBO[1]);
        if (cc.TEXTURE_ATLAS_USE_TRIANGLE_STRIP)
            gl.drawElements(gl.TRIANGLE_STRIP, n * 6, gl.UNSIGNED_SHORT, start * 6 * _t._indices.BYTES_PER_ELEMENT);
        else
            gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, start * 6 * _t._indices.BYTES_PER_ELEMENT);
        cc.g_NumberOfDraws++;
    };
};
cc._tmp.WebGLTextureCache = function () {
    var _p = cc.textureCache;
    _p.handleLoadedTexture = function (url) {
        var locTexs = this._textures, tex, ext;
        if (!cc.game._rendererInitialized) {
            locTexs = this._loadedTexturesBefore;
        }
        tex = locTexs[url];
        if (!tex) {
            tex = locTexs[url] = new cc.Texture2D();
            tex.url = url;
        }
        ext = cc.path.extname(url);
        if (ext === ".png") {
            tex.handleLoadedTexture(true);
        }
        else {
            tex.handleLoadedTexture();
        }
    };
    _p.addImage = function (url, cb, target) {
        cc.assert(url, cc._LogInfos.Texture2D_addImage_2);
        var locTexs = this._textures;
        if (!cc.game._rendererInitialized) {
            locTexs = this._loadedTexturesBefore;
        }
        var tex = locTexs[url] || locTexs[cc.loader._getAliase(url)];
        if (tex) {
            if(tex.isLoaded()) {
                cb && cb.call(target, tex);
                return tex;
            }
            else
            {
                tex.addEventListener("load", function(){
                   cb && cb.call(target, tex);
                }, target);
                return tex;
            }
        }
        tex = locTexs[url] = new cc.Texture2D();
        tex.url = url;
        var basePath = cc.loader.getBasePath ? cc.loader.getBasePath() : cc.loader.resPath;
        cc.loader.loadImg(cc.path.join(basePath || "", url), function (err, img) {
            if (err)
                return cb && cb.call(target, err);
            if (!cc.loader.cache[url]) {
                cc.loader.cache[url] = img;
            }
            cc.textureCache.handleLoadedTexture(url);
            var texResult = locTexs[url];
            cb && cb.call(target, texResult);
        });
        return tex;
    };
    _p.addImageAsync = _p.addImage;
    _p = null;
};
cc.ALIGN_CENTER = 0x33;
cc.ALIGN_TOP = 0x13;
cc.ALIGN_TOP_RIGHT = 0x12;
cc.ALIGN_RIGHT = 0x32;
cc.ALIGN_BOTTOM_RIGHT = 0x22;
cc.ALIGN_BOTTOM = 0x23;
cc.ALIGN_BOTTOM_LEFT = 0x21;
cc.ALIGN_LEFT = 0x31;
cc.ALIGN_TOP_LEFT = 0x11;
cc.PVRHaveAlphaPremultiplied_ = false;
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if(cc._renderType === cc.game.RENDER_TYPE_CANVAS) {
        var proto = {
            _contentSize: null,
            _textureLoaded: false,
            _htmlElementObj: null,
            url: null,
            _pattern: null,
            ctor: function () {
                this._contentSize = cc.size(0, 0);
                this._textureLoaded = false;
                this._htmlElementObj = null;
                this._pattern = "";
            },
            getPixelsWide: function () {
                return this._contentSize.width;
            },
            getPixelsHigh: function () {
                return this._contentSize.height;
            },
            getContentSize: function () {
                var locScaleFactor = cc.contentScaleFactor();
                return cc.size(this._contentSize.width / locScaleFactor, this._contentSize.height / locScaleFactor);
            },
            _getWidth: function () {
                return this._contentSize.width / cc.contentScaleFactor();
            },
            _getHeight: function () {
                return this._contentSize.height / cc.contentScaleFactor();
            },
            getContentSizeInPixels: function () {
                return this._contentSize;
            },
            initWithElement: function (element) {
                if (!element)
                    return;
                this._htmlElementObj = element;
                this._contentSize.width = element.width;
                this._contentSize.height = element.height;
                this._textureLoaded = true;
            },
            getHtmlElementObj: function () {
                return this._htmlElementObj;
            },
            isLoaded: function () {
                return this._textureLoaded;
            },
            handleLoadedTexture: function () {
                var self = this;
                if (self._textureLoaded) return;
                if (!self._htmlElementObj) {
                    var img = cc.loader.getRes(self.url);
                    if (!img) return;
                    self.initWithElement(img);
                }
                var locElement = self._htmlElementObj;
                self._contentSize.width = locElement.width;
                self._contentSize.height = locElement.height;
                self.dispatchEvent("load");
            },
            description: function () {
                return "<cc.Texture2D | width = " + this._contentSize.width + " height " + this._contentSize.height + ">";
            },
            initWithData: function (data, pixelFormat, pixelsWide, pixelsHigh, contentSize) {
                return false;
            },
            initWithImage: function (uiImage) {
                return false;
            },
            initWithString: function (text, fontName, fontSize, dimensions, hAlignment, vAlignment) {
                return false;
            },
            releaseTexture: function () {
                cc.loader.release(this.url);
            },
            getName: function () {
                return null;
            },
            getMaxS: function () {
                return 1;
            },
            setMaxS: function (maxS) {
            },
            getMaxT: function () {
                return 1;
            },
            setMaxT: function (maxT) {
            },
            getPixelFormat: function () {
                return null;
            },
            getShaderProgram: function () {
                return null;
            },
            setShaderProgram: function (shaderProgram) {
            },
            hasPremultipliedAlpha: function () {
                return false;
            },
            hasMipmaps: function () {
                return false;
            },
            releaseData: function (data) {
                data = null;
            },
            keepData: function (data, length) {
                return data;
            },
            drawAtPoint: function (point) {
            },
            drawInRect: function (rect) {
            },
            initWithETCFile: function (file) {
                cc.log(cc._LogInfos.Texture2D_initWithETCFile);
                return false;
            },
            initWithPVRFile: function (file) {
                cc.log(cc._LogInfos.Texture2D_initWithPVRFile);
                return false;
            },
            initWithPVRTCData: function (data, level, bpp, hasAlpha, length, pixelFormat) {
                cc.log(cc._LogInfos.Texture2D_initWithPVRTCData);
                return false;
            },
            setTexParameters: function (texParams, magFilter, wrapS, wrapT) {
                if(magFilter !== undefined)
                    texParams = {minFilter: texParams, magFilter: magFilter, wrapS: wrapS, wrapT: wrapT};
                if(texParams.wrapS === cc.REPEAT && texParams.wrapT === cc.REPEAT){
                    this._pattern = "repeat";
                    return;
                }
                if(texParams.wrapS === cc.REPEAT ){
                    this._pattern = "repeat-x";
                    return;
                }
                if(texParams.wrapT === cc.REPEAT){
                    this._pattern = "repeat-y";
                    return;
                }
                this._pattern = "";
            },
            setAntiAliasTexParameters: function () {
            },
            setAliasTexParameters: function () {
            },
            generateMipmap: function () {
            },
            stringForFormat: function () {
                return "";
            },
            bitsPerPixelForFormat: function (format) {
                return -1;
            },
            addLoadedEventListener: function (callback, target) {
                this.addEventListener("load", callback, target);
            },
            removeLoadedEventListener: function (target) {
                this.removeEventTarget("load", target);
            },
            _generateColorTexture: function(){},
            _generateTextureCacheForColor: function(){
                if (this.channelCache)
                    return this.channelCache;
                var textureCache = [
                    document.createElement("canvas"),
                    document.createElement("canvas"),
                    document.createElement("canvas"),
                    document.createElement("canvas")
                ];
                renderToCache(this._htmlElementObj, textureCache);
                return this.channelCache = textureCache;
            },
            _grayElementObj: null,
            _backupElement: null,
            _isGray: false,
            _switchToGray: function(toGray){
                if(!this._textureLoaded || this._isGray === toGray)
                    return;
                this._isGray = toGray;
                if(this._isGray){
                    this._backupElement = this._htmlElementObj;
                    if(!this._grayElementObj)
                        this._grayElementObj = cc.Texture2D._generateGrayTexture(this._htmlElementObj);
                    this._htmlElementObj = this._grayElementObj;
                } else {
                    if(this._backupElement !== null)
                        this._htmlElementObj = this._backupElement;
                }
            }
        };
        var renderToCache = function(image, cache){
            var w = image.width;
            var h = image.height;
            cache[0].width = w;
            cache[0].height = h;
            cache[1].width = w;
            cache[1].height = h;
            cache[2].width = w;
            cache[2].height = h;
            cache[3].width = w;
            cache[3].height = h;
            var cacheCtx = cache[3].getContext("2d");
            cacheCtx.drawImage(image, 0, 0);
            var pixels = cacheCtx.getImageData(0, 0, w, h).data;
            var ctx;
            for (var rgbI = 0; rgbI < 4; rgbI++) {
                ctx = cache[rgbI].getContext("2d");
                var to = ctx.getImageData(0, 0, w, h);
                var data = to.data;
                for (var i = 0; i < pixels.length; i += 4) {
                    data[i  ] = (rgbI === 0) ? pixels[i  ] : 0;
                    data[i + 1] = (rgbI === 1) ? pixels[i + 1] : 0;
                    data[i + 2] = (rgbI === 2) ? pixels[i + 2] : 0;
                    data[i + 3] = pixels[i + 3];
                }
                ctx.putImageData(to, 0, 0);
            }
            image.onload = null;
        };
        if(cc.sys._supportCanvasNewBlendModes){
            proto._generateColorTexture = function(r, g, b, rect, canvas){
                var onlyCanvas = false;
                if(canvas)
                    onlyCanvas = true;
                else
                    canvas = document.createElement("canvas");
                var textureImage = this._htmlElementObj;
                if(!rect)
                    rect = cc.rect(0, 0, textureImage.width, textureImage.height);
                canvas.width = rect.width;
                canvas.height = rect.height;
                var context = canvas.getContext("2d");
                context.globalCompositeOperation = "source-over";
                context.fillStyle = "rgb(" + (r|0) + "," + (g|0) + "," + (b|0) + ")";
                context.fillRect(0, 0, rect.width, rect.height);
                context.globalCompositeOperation = "multiply";
                context.drawImage(
                    textureImage,
                    rect.x, rect.y, rect.width, rect.height,
                    0, 0, rect.width, rect.height
                );
                context.globalCompositeOperation = "destination-atop";
                context.drawImage(
                    textureImage,
                    rect.x, rect.y, rect.width, rect.height,
                    0, 0, rect.width, rect.height
                );
                if(onlyCanvas)
                    return canvas;
                var newTexture = new cc.Texture2D();
                newTexture.initWithElement(canvas);
                newTexture.handleLoadedTexture();
                return newTexture;
            };
        }else{
            proto._generateColorTexture = function(r, g, b, rect, canvas){
                var onlyCanvas = false;
                if(canvas)
                    onlyCanvas = true;
                else
                    canvas = document.createElement("canvas");
                var textureImage = this._htmlElementObj;
                if(!rect)
                    rect = cc.rect(0, 0, textureImage.width, textureImage.height);
                var x, y, w, h;
                x = rect.x; y = rect.y; w = rect.width; h = rect.height;
                if(!w || !h)
                    return;
                canvas.width = w;
                canvas.height = h;
                var context = canvas.getContext("2d");
                var tintedImgCache = cc.textureCache.getTextureColors(this);
                context.globalCompositeOperation = 'lighter';
                context.drawImage(
                    tintedImgCache[3],
                    x, y, w, h,
                    0, 0, w, h
                );
                if (r > 0) {
                    context.globalAlpha = r / 255;
                    context.drawImage(
                        tintedImgCache[0],
                        x, y, w, h,
                        0, 0, w, h
                    );
                }
                if (g > 0) {
                    context.globalAlpha = g / 255;
                    context.drawImage(
                        tintedImgCache[1],
                        x, y, w, h,
                        0, 0, w, h
                    );
                }
                if (b > 0) {
                    context.globalAlpha = b / 255;
                    context.drawImage(
                        tintedImgCache[2],
                        x, y, w, h,
                        0, 0, w, h
                    );
                }
                if(onlyCanvas)
                    return canvas;
                var newTexture = new cc.Texture2D();
                newTexture.initWithElement(canvas);
                newTexture.handleLoadedTexture();
                return newTexture;
            };
        }
        cc.Texture2D = cc.Class.extend(proto);
        cc.Texture2D._generateGrayTexture = function(texture, rect, renderCanvas){
            if (texture === null)
                return null;
            renderCanvas = renderCanvas || document.createElement("canvas");
            rect = rect || cc.rect(0, 0, texture.width, texture.height);
            renderCanvas.width = rect.width;
            renderCanvas.height = rect.height;
            var context = renderCanvas.getContext("2d");
            context.drawImage(texture, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
            var imgData = context.getImageData(0, 0, rect.width, rect.height);
            var data = imgData.data;
            for (var i = 0, len = data.length; i < len; i += 4) {
                data[i] = data[i + 1] = data[i + 2] = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            }
            context.putImageData(imgData, 0, 0);
            return renderCanvas;
        };
    } else if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
        cc.assert(cc.isFunction(cc._tmp.WebGLTexture2D), cc._LogInfos.MissingFile, "TexturesWebGL.js");
        cc._tmp.WebGLTexture2D();
        delete cc._tmp.WebGLTexture2D;
    }
    cc.EventHelper.prototype.apply(cc.Texture2D.prototype);
    cc.assert(cc.isFunction(cc._tmp.PrototypeTexture2D), cc._LogInfos.MissingFile, "TexturesPropertyDefine.js");
    cc._tmp.PrototypeTexture2D();
    delete cc._tmp.PrototypeTexture2D;
});
cc.textureCache = {
    _textures: {},
    _textureColorsCache: {},
    _textureKeySeq: (0 | Math.random() * 1000),
    _loadedTexturesBefore: {},
    _initializingRenderer: function () {
        var selPath;
        var locLoadedTexturesBefore = this._loadedTexturesBefore, locTextures = this._textures;
        for (selPath in locLoadedTexturesBefore) {
            var tex2d = locLoadedTexturesBefore[selPath];
            tex2d.handleLoadedTexture();
            locTextures[selPath] = tex2d;
        }
        this._loadedTexturesBefore = {};
    },
    addPVRTCImage: function (filename) {
        cc.log(cc._LogInfos.textureCache_addPVRTCImage);
    },
    addETCImage: function (filename) {
        cc.log(cc._LogInfos.textureCache_addETCImage);
    },
    description: function () {
        return "<TextureCache | Number of textures = " + this._textures.length + ">";
    },
    textureForKey: function (textureKeyName) {
        cc.log(cc._LogInfos.textureCache_textureForKey);
        return this.getTextureForKey(textureKeyName);
    },
    getTextureForKey: function(textureKeyName){
        return this._textures[textureKeyName] || this._textures[cc.loader._getAliase(textureKeyName)];
    },
    getKeyByTexture: function (texture) {
        for (var key in this._textures) {
            if (this._textures[key] === texture) {
                return key;
            }
        }
        return null;
    },
    _generalTextureKey: function (id) {
        return "_textureKey_" + id;
    },
    getTextureColors: function (texture) {
        var image = texture._htmlElementObj;
        var key = this.getKeyByTexture(image);
        if (!key) {
            if (image instanceof HTMLImageElement)
                key = image.src;
            else
                key = this._generalTextureKey(texture.__instanceId);
        }
        if (!this._textureColorsCache[key])
            this._textureColorsCache[key] = texture._generateTextureCacheForColor();
        return this._textureColorsCache[key];
    },
    addPVRImage: function (path) {
        cc.log(cc._LogInfos.textureCache_addPVRImage);
    },
    removeAllTextures: function () {
        var locTextures = this._textures;
        for (var selKey in locTextures) {
            if (locTextures[selKey])
                locTextures[selKey].releaseTexture();
        }
        this._textures = {};
    },
    removeTexture: function (texture) {
        if (!texture)
            return;
        var locTextures = this._textures;
        for (var selKey in locTextures) {
            if (locTextures[selKey] === texture) {
                locTextures[selKey].releaseTexture();
                delete(locTextures[selKey]);
            }
        }
    },
    removeTextureForKey: function (textureKeyName) {
        if (textureKeyName == null)
            return;
        if (this._textures[textureKeyName])
            delete(this._textures[textureKeyName]);
    },
    cacheImage: function (path, texture) {
        if (texture instanceof  cc.Texture2D) {
            this._textures[path] = texture;
            return;
        }
        var texture2d = new cc.Texture2D();
        texture2d.initWithElement(texture);
        texture2d.handleLoadedTexture();
        this._textures[path] = texture2d;
    },
    addUIImage: function (image, key) {
        cc.assert(image, cc._LogInfos.textureCache_addUIImage_2);
        if (key) {
            if (this._textures[key])
                return this._textures[key];
        }
        var texture = new cc.Texture2D();
        texture.initWithImage(image);
        if (key != null)
            this._textures[key] = texture;
        else
            cc.log(cc._LogInfos.textureCache_addUIImage);
        return texture;
    },
    dumpCachedTextureInfo: function () {
        var count = 0;
        var totalBytes = 0, locTextures = this._textures;
        for (var key in locTextures) {
            var selTexture = locTextures[key];
            count++;
            if (selTexture.getHtmlElementObj() instanceof  HTMLImageElement)
                cc.log(cc._LogInfos.textureCache_dumpCachedTextureInfo, key, selTexture.getHtmlElementObj().src, selTexture.pixelsWidth, selTexture.pixelsHeight);
            else {
                cc.log(cc._LogInfos.textureCache_dumpCachedTextureInfo_2, key, selTexture.pixelsWidth, selTexture.pixelsHeight);
            }
            totalBytes += selTexture.pixelsWidth * selTexture.pixelsHeight * 4;
        }
        var locTextureColorsCache = this._textureColorsCache;
        for (key in locTextureColorsCache) {
            var selCanvasColorsArr = locTextureColorsCache[key];
            for (var selCanvasKey in selCanvasColorsArr) {
                var selCanvas = selCanvasColorsArr[selCanvasKey];
                count++;
                cc.log(cc._LogInfos.textureCache_dumpCachedTextureInfo_2, key, selCanvas.width, selCanvas.height);
                totalBytes += selCanvas.width * selCanvas.height * 4;
            }
        }
        cc.log(cc._LogInfos.textureCache_dumpCachedTextureInfo_3, count, totalBytes / 1024, (totalBytes / (1024.0 * 1024.0)).toFixed(2));
    },
    _clear: function () {
        this._textures = {};
        this._textureColorsCache = {};
        this._textureKeySeq = (0 | Math.random() * 1000);
        this._loadedTexturesBefore = {};
    }
};
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType === cc.game.RENDER_TYPE_CANVAS) {
        var _p = cc.textureCache;
        _p.handleLoadedTexture = function (url) {
            var locTexs = this._textures;
            var tex = locTexs[url];
            if (!tex) {
                tex = locTexs[url] = new cc.Texture2D();
                tex.url = url;
            }
            tex.handleLoadedTexture();
        };
        _p.addImage = function (url, cb, target) {
            cc.assert(url, cc._LogInfos.Texture2D_addImage);
            var locTexs = this._textures;
            var tex = locTexs[url] || locTexs[cc.loader._getAliase(url)];
            if (tex) {
                if(tex.isLoaded()) {
                    cb && cb.call(target, tex);
                    return tex;
                }
                else
                {
                    tex.addEventListener("load", function(){
                        cb && cb.call(target, tex);
                    }, target);
                    return tex;
                }
            }
            tex = locTexs[url] = new cc.Texture2D();
            tex.url = url;
            var basePath = cc.loader.getBasePath ? cc.loader.getBasePath() : cc.loader.resPath;
            cc.loader.loadImg(cc.path.join(basePath || "", url), function (err, img) {
                if (err)
                    return cb && cb.call(target, err);
                if (!cc.loader.cache[url]) {
                    cc.loader.cache[url] = img;
                }
                cc.textureCache.handleLoadedTexture(url);
                var texResult = locTexs[url];
                cb && cb.call(target, texResult);
            });
            return tex;
        };
        _p.addImageAsync = _p.addImage;
        _p = null;
    } else if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
        cc.assert(cc.isFunction(cc._tmp.WebGLTextureCache), cc._LogInfos.MissingFile, "TexturesWebGL.js");
        cc._tmp.WebGLTextureCache();
        delete cc._tmp.WebGLTextureCache;
    }
});
cc.Scene = cc.Node.extend({
    _className:"Scene",
    ctor:function () {
        cc.Node.prototype.ctor.call(this);
        this._ignoreAnchorPointForPosition = true;
        this.setAnchorPoint(0.5, 0.5);
        this.setContentSize(cc.director.getWinSize());
    }
});
cc.Scene.create = function () {
    return new cc.Scene();
};
cc.LoaderScene = cc.Scene.extend({
    _interval : null,
    _label : null,
    _className:"LoaderScene",
    cb: null,
    target: null,
    init : function(){
        var self = this;
        var logoWidth = 160;
        var logoHeight = 200;
        var bgLayer = self._bgLayer = new cc.LayerColor(cc.color(32, 32, 32, 255));
        self.addChild(bgLayer, 0);
        var fontSize = 24, lblHeight =  -logoHeight / 2 + 100;
        if(cc._loaderImage){
            cc.loader.loadImg(cc._loaderImage, {isCrossOrigin : false }, function(err, img){
                logoWidth = img.width;
                logoHeight = img.height;
                self._initStage(img, cc.visibleRect.center);
            });
            fontSize = 14;
            lblHeight = -logoHeight / 2 - 10;
        }
        var label = self._label = new cc.LabelTTF("Loading... 0%", "Arial", fontSize);
        label.setPosition(cc.pAdd(cc.visibleRect.center, cc.p(0, lblHeight)));
        label.setColor(cc.color(180, 180, 180));
        bgLayer.addChild(this._label, 10);
        return true;
    },
    _initStage: function (img, centerPos) {
        var self = this;
        var texture2d = self._texture2d = new cc.Texture2D();
        texture2d.initWithElement(img);
        texture2d.handleLoadedTexture();
        var logo = self._logo = new cc.Sprite(texture2d);
        logo.setScale(cc.contentScaleFactor());
        logo.x = centerPos.x;
        logo.y = centerPos.y;
        self._bgLayer.addChild(logo, 10);
    },
    onEnter: function () {
        var self = this;
        cc.Node.prototype.onEnter.call(self);
        self.schedule(self._startLoading, 0.3);
    },
    onExit: function () {
        cc.Node.prototype.onExit.call(this);
        var tmpStr = "Loading... 0%";
        this._label.setString(tmpStr);
    },
    initWithResources: function (resources, cb, target) {
        if(cc.isString(resources))
            resources = [resources];
        this.resources = resources || [];
        this.cb = cb;
        this.target = target;
    },
    _startLoading: function () {
        var self = this;
        self.unschedule(self._startLoading);
        var res = self.resources;
        cc.loader.load(res,
            function (result, count, loadedCount) {
                var percent = (loadedCount / count * 100) | 0;
                percent = Math.min(percent, 100);
                self._label.setString("Loading... " + percent + "%");
            }, function () {
                if (self.cb)
                    self.cb.call(self.target);
            });
    },
    _updateTransform: function(){
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        this._bgLayer._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        this._label._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        this._logo._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    }
});
cc.LoaderScene.preload = function(resources, cb, target){
    var _cc = cc;
    if(!_cc.loaderScene) {
        _cc.loaderScene = new cc.LoaderScene();
        _cc.loaderScene.init();
        cc.eventManager.addCustomListener(cc.Director.EVENT_PROJECTION_CHANGED, function(){
            _cc.loaderScene._updateTransform();
        });
    }
    _cc.loaderScene.initWithResources(resources, cb, target);
    cc.director.runScene(_cc.loaderScene);
    return _cc.loaderScene;
};
cc.Layer = cc.Node.extend({
    _className: "Layer",
    ctor: function () {
        cc.Node.prototype.ctor.call(this);
        this._ignoreAnchorPointForPosition = true;
        this.setAnchorPoint(0.5, 0.5);
        this.setContentSize(cc.winSize);
    },
    init: function(){
        var _t = this;
        _t._ignoreAnchorPointForPosition = true;
        _t.setAnchorPoint(0.5, 0.5);
        _t.setContentSize(cc.winSize);
        _t._cascadeColorEnabled = false;
        _t._cascadeOpacityEnabled = false;
        return true;
    },
    bake: function(){
        this._renderCmd.bake();
    },
    unbake: function(){
        this._renderCmd.unbake();
    },
    isBaked: function(){
        return this._renderCmd._isBaked;
    },
    addChild: function(child, localZOrder, tag){
        cc.Node.prototype.addChild.call(this, child, localZOrder, tag);
        this._renderCmd._bakeForAddChild(child);
    },
    _createRenderCmd: function(){
        if (cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return new cc.Layer.CanvasRenderCmd(this);
        else
            return new cc.Layer.WebGLRenderCmd(this);
    }
});
cc.Layer.create = function () {
    return new cc.Layer();
};
cc.LayerColor = cc.Layer.extend({
    _blendFunc: null,
    _className: "LayerColor",
    getBlendFunc: function () {
        return this._blendFunc;
    },
    changeWidthAndHeight: function (w, h) {
        this.width = w;
        this.height = h;
    },
    changeWidth: function (w) {
        this.width = w;
    },
    changeHeight: function (h) {
        this.height = h;
    },
    setOpacityModifyRGB: function (value) {
    },
    isOpacityModifyRGB: function () {
        return false;
    },
    ctor: function(color, width, height){
        cc.Layer.prototype.ctor.call(this);
        this._blendFunc = cc.BlendFunc._alphaNonPremultiplied();
        cc.LayerColor.prototype.init.call(this, color, width, height);
    },
    init: function (color, width, height) {
        var winSize = cc.director.getWinSize();
        color = color || cc.color(0, 0, 0, 255);
        width = width === undefined ? winSize.width : width;
        height = height === undefined ? winSize.height : height;
        var locRealColor = this._realColor;
        locRealColor.r = color.r;
        locRealColor.g = color.g;
        locRealColor.b = color.b;
        this._realOpacity = color.a;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.colorDirty|cc.Node._dirtyFlags.opacityDirty);
        cc.LayerColor.prototype.setContentSize.call(this, width, height);
        return true;
    },
    setBlendFunc: function (src, dst) {
        var locBlendFunc = this._blendFunc;
        if (dst === undefined) {
            locBlendFunc.src = src.src;
            locBlendFunc.dst = src.dst;
        } else {
            locBlendFunc.src = src;
            locBlendFunc.dst = dst;
        }
        this._renderCmd.updateBlendFunc(locBlendFunc);
    },
    _createRenderCmd: function(){
        if (cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return new cc.LayerColor.CanvasRenderCmd(this);
        else
            return new cc.LayerColor.WebGLRenderCmd(this);
    }
});
cc.LayerColor.create = function (color, width, height) {
    return new cc.LayerColor(color, width, height);
};
(function(){
    var proto = cc.LayerColor.prototype;
    cc.defineGetterSetter(proto, "width", proto._getWidth, proto._setWidth);
    cc.defineGetterSetter(proto, "height", proto._getHeight, proto._setHeight);
})();
cc.LayerGradient = cc.LayerColor.extend({
    _endColor: null,
    _startOpacity: 255,
    _endOpacity: 255,
    _alongVector: null,
    _compressedInterpolation: false,
    _className: "LayerGradient",
    _colorStops: [],
    ctor: function (start, end, v, stops) {
        cc.LayerColor.prototype.ctor.call(this);
        this._endColor = cc.color(0, 0, 0, 255);
        this._alongVector = cc.p(0, -1);
        this._startOpacity = 255;
        this._endOpacity = 255;
        if(stops && stops instanceof Array){
            this._colorStops = stops;
            stops.splice(0, 0, {p:0, color: start || cc.color.BLACK});
            stops.push({p:1, color: end || cc.color.BLACK});
        } else
            this._colorStops = [{p:0, color: start || cc.color.BLACK}, {p:1, color: end || cc.color.BLACK}];
        cc.LayerGradient.prototype.init.call(this, start, end, v, stops);
    },
    init: function (start, end, v, stops) {
        start = start || cc.color(0, 0, 0, 255);
        end = end || cc.color(0, 0, 0, 255);
        v = v || cc.p(0, -1);
        var _t = this;
        var locEndColor = _t._endColor;
        _t._startOpacity = start.a;
        locEndColor.r = end.r;
        locEndColor.g = end.g;
        locEndColor.b = end.b;
        _t._endOpacity = end.a;
        _t._alongVector = v;
        _t._compressedInterpolation = true;
        cc.LayerColor.prototype.init.call(_t, cc.color(start.r, start.g, start.b, 255));
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.colorDirty|cc.Node._dirtyFlags.opacityDirty|cc.Node._dirtyFlags.gradientDirty);
        return true;
    },
    setContentSize: function (size, height) {
        cc.LayerColor.prototype.setContentSize.call(this, size, height);
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.gradientDirty);
    },
    _setWidth: function (width) {
        cc.LayerColor.prototype._setWidth.call(this, width);
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.gradientDirty);
    },
    _setHeight: function (height) {
        cc.LayerColor.prototype._setHeight.call(this, height);
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.gradientDirty);
    },
    getStartColor: function () {
        return cc.color(this._realColor);
    },
    setStartColor: function (color) {
        this.color = color;
        var stops = this._colorStops;
        if(stops && stops.length > 0){
            var selColor = stops[0].color;
            selColor.r = color.r;
            selColor.g = color.g;
            selColor.b = color.b;
        }
    },
    setEndColor: function (color) {
        var locColor = this._endColor;
        locColor.r = color.r;
        locColor.g = color.g;
        locColor.b = color.b;
        var stops = this._colorStops;
        if(stops && stops.length > 0){
            var selColor = stops[stops.length -1].color;
            selColor.r = color.r;
            selColor.g = color.g;
            selColor.b = color.b;
        }
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.colorDirty);
    },
    getEndColor: function () {
        return cc.color(this._endColor);
    },
    setStartOpacity: function (o) {
        this._startOpacity = o;
        var stops = this._colorStops;
        if(stops && stops.length > 0)
            stops[0].color.a = o;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.opacityDirty);
    },
    getStartOpacity: function () {
        return this._startOpacity;
    },
    setEndOpacity: function (o) {
        this._endOpacity = o;
        var stops = this._colorStops;
        if(stops && stops.length > 0)
            stops[stops.length -1].color.a = o;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.opacityDirty);
    },
    getEndOpacity: function () {
        return this._endOpacity;
    },
    setVector: function (Var) {
        this._alongVector.x = Var.x;
        this._alongVector.y = Var.y;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.gradientDirty);
    },
    getVector: function () {
        return cc.p(this._alongVector.x, this._alongVector.y);
    },
    isCompressedInterpolation: function () {
        return this._compressedInterpolation;
    },
    setCompressedInterpolation: function (compress) {
        this._compressedInterpolation = compress;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.gradientDirty);
    },
    getColorStops: function(){
        return this._colorStops;
    },
    setColorStops: function(colorStops){
        this._colorStops = colorStops;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.colorDirty|cc.Node._dirtyFlags.opacityDirty|cc.Node._dirtyFlags.gradientDirty);
    },
    _createRenderCmd: function(){
        if (cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return new cc.LayerGradient.CanvasRenderCmd(this);
        else
            return new cc.LayerGradient.WebGLRenderCmd(this);
    }
});
cc.LayerGradient.create = function (start, end, v, stops) {
    return new cc.LayerGradient(start, end, v, stops);
};
(function(){
    var proto = cc.LayerGradient.prototype;
    proto.startColor;
    cc.defineGetterSetter(proto, "startColor", proto.getStartColor, proto.setStartColor);
    proto.endColor;
    cc.defineGetterSetter(proto, "endColor", proto.getEndColor, proto.setEndColor);
    proto.startOpacity;
    cc.defineGetterSetter(proto, "startOpacity", proto.getStartOpacity, proto.setStartOpacity);
    proto.endOpacity;
    cc.defineGetterSetter(proto, "endOpacity", proto.getEndOpacity, proto.setEndOpacity);
    proto.vector;
    cc.defineGetterSetter(proto, "vector", proto.getVector, proto.setVector);
    proto.colorStops;
    cc.defineGetterSetter(proto, "colorStops", proto.getColorStops, proto.setColorStops);
})();
cc.LayerMultiplex = cc.Layer.extend({
    _enabledLayer: 0,
    _layers: null,
    _className: "LayerMultiplex",
    ctor: function (layers) {
        cc.Layer.prototype.ctor.call(this);
        if (layers instanceof Array)
            cc.LayerMultiplex.prototype.initWithLayers.call(this, layers);
        else
            cc.LayerMultiplex.prototype.initWithLayers.call(this, Array.prototype.slice.call(arguments));
    },
    initWithLayers: function (layers) {
        if ((layers.length > 0) && (layers[layers.length - 1] == null))
            cc.log(cc._LogInfos.LayerMultiplex_initWithLayers);
        this._layers = layers;
        this._enabledLayer = 0;
        this.addChild(this._layers[this._enabledLayer]);
        return true;
    },
    switchTo: function (n) {
        if (n >= this._layers.length) {
            cc.log(cc._LogInfos.LayerMultiplex_switchTo);
            return;
        }
        this.removeChild(this._layers[this._enabledLayer], true);
        this._enabledLayer = n;
        this.addChild(this._layers[n]);
    },
    switchToAndReleaseMe: function (n) {
        if (n >= this._layers.length) {
            cc.log(cc._LogInfos.LayerMultiplex_switchToAndReleaseMe);
            return;
        }
        this.removeChild(this._layers[this._enabledLayer], true);
        this._layers[this._enabledLayer] = null;
        this._enabledLayer = n;
        this.addChild(this._layers[n]);
    },
    addLayer: function (layer) {
        if (!layer) {
            cc.log(cc._LogInfos.LayerMultiplex_addLayer);
            return;
        }
        this._layers.push(layer);
    }
});
cc.LayerMultiplex.create = function () {
    return new cc.LayerMultiplex(Array.prototype.slice.call(arguments));
};
(function(){
    cc.Layer.CanvasRenderCmd = function(renderable){
        cc.Node.CanvasRenderCmd.call(this, renderable);
        this._isBaked = false;
        this._bakeSprite = null;
        this._canUseDirtyRegion = true;
        this._updateCache = 2;
    };
    var proto = cc.Layer.CanvasRenderCmd.prototype = Object.create(cc.Node.CanvasRenderCmd.prototype);
    proto.constructor = cc.Layer.CanvasRenderCmd;
    proto._setCacheDirty = function(child){
        if(child && this._updateCache === 0)
            this._updateCache = 2;
        if (this._cacheDirty === false) {
            this._cacheDirty = true;
            var cachedP = this._cachedParent;
            cachedP && cachedP !== this && cachedP._setNodeDirtyForCache && cachedP._setNodeDirtyForCache();
        }
    };
    proto.updateStatus = function () {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.orderDirty) {
            this._cacheDirty = true;
            if(this._updateCache === 0)
                this._updateCache = 2;
            this._dirtyFlag = locFlag & flags.orderDirty ^ locFlag;
        }
        cc.Node.RenderCmd.prototype.updateStatus.call(this);
    };
    proto._syncStatus = function (parentCmd) {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.orderDirty) {
            this._cacheDirty = true;
            if(this._updateCache === 0)
                this._updateCache = 2;
            this._dirtyFlag = locFlag & flags.orderDirty ^ locFlag;
        }
        cc.Node.RenderCmd.prototype._syncStatus.call(this, parentCmd);
    };
    proto.transform = function (parentCmd, recursive) {
        var wt = this._worldTransform;
        var a = wt.a, b = wt.b, c = wt.c, d = wt.d, tx = wt.tx, ty = wt.ty;
        cc.Node.CanvasRenderCmd.prototype.transform.call(this, parentCmd, recursive);
        if(( wt.a !== a || wt.b !== b || wt.c !== c || wt.d !== d ) && this._updateCache === 0)
            this._updateCache = 2;
    };
    proto.bake = function(){
        if (!this._isBaked) {
            this._needDraw = true;
            cc.renderer.childrenOrderDirty = true;
            this._isBaked = this._cacheDirty = true;
            if(this._updateCache === 0)
                this._updateCache = 2;
            var children = this._node._children;
            for(var i = 0, len = children.length; i < len; i++)
                children[i]._renderCmd._setCachedParent(this);
            if (!this._bakeSprite) {
                this._bakeSprite = new cc.BakeSprite();
                this._bakeSprite.setAnchorPoint(0,0);
            }
        }
    };
    proto.unbake = function(){
        if (this._isBaked) {
            cc.renderer.childrenOrderDirty = true;
            this._needDraw = false;
            this._isBaked = false;
            this._cacheDirty = true;
            if(this._updateCache === 0)
                this._updateCache = 2;
            var children = this._node._children;
            for(var i = 0, len = children.length; i < len; i++)
                children[i]._renderCmd._setCachedParent(null);
        }
    };
    proto.isBaked = function(){
        return this._isBaked;
    };
    proto.rendering = function(){
        if(this._cacheDirty){
            var node = this._node;
            var children = node._children, locBakeSprite = this._bakeSprite;
            this.transform(this.getParentRenderCmd(), true);
            var boundingBox = this._getBoundingBoxForBake();
            boundingBox.width = 0|(boundingBox.width+0.5);
            boundingBox.height = 0|(boundingBox.height+0.5);
            var bakeContext = locBakeSprite.getCacheContext();
            var ctx = bakeContext.getContext();
            locBakeSprite.setPosition(boundingBox.x, boundingBox.y);
            if(this._updateCache > 0){
                locBakeSprite.resetCanvasSize(boundingBox.width, boundingBox.height);
                bakeContext.setOffset(0 - boundingBox.x, ctx.canvas.height - boundingBox.height + boundingBox.y );
                node.sortAllChildren();
                cc.renderer._turnToCacheMode(this.__instanceId);
                for (var i = 0, len = children.length; i < len; i++) {
                    children[i].visit(this);
                }
                cc.renderer._renderingToCacheCanvas(bakeContext, this.__instanceId);
                locBakeSprite.transform();
                this._updateCache--;
            }
            this._cacheDirty = false;
        }
    };
    proto.visit = function(parentCmd){
        if(!this._isBaked){
            this.originVisit(parentCmd);
            return;
        }
        var node = this._node, children = node._children;
        var len = children.length;
        if (!node._visible || len === 0)
            return;
        this._syncStatus(parentCmd);
        cc.renderer.pushRenderCommand(this);
        this._bakeSprite.visit(this);
        this._dirtyFlag = 0;
    };
    proto._bakeForAddChild = function(child){
        if(child._parent === this._node && this._isBaked)
            child._renderCmd._setCachedParent(this);
    };
    proto._getBoundingBoxForBake = function(){
        var rect = null, node = this._node;
        if (!node._children || node._children.length === 0)
            return cc.rect(0, 0, 10, 10);
        var trans = node.getNodeToWorldTransform();
        var locChildren = node._children;
        for (var i = 0, len = locChildren.length; i < len; i++) {
            var child = locChildren[i];
            if (child && child._visible) {
                if(rect){
                    var childRect = child._getBoundingBoxToCurrentNode(trans);
                    if (childRect)
                        rect = cc.rectUnion(rect, childRect);
                }else{
                    rect = child._getBoundingBoxToCurrentNode(trans);
                }
            }
        }
        return rect;
    };
})();
(function(){
    cc.LayerColor.CanvasRenderCmd = function(renderable){
        cc.Layer.CanvasRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._blendFuncStr = "source-over";
        this._bakeRenderCmd = new cc.CustomRenderCmd(this, this._bakeRendering);
    };
    var proto = cc.LayerColor.CanvasRenderCmd.prototype = Object.create(cc.Layer.CanvasRenderCmd.prototype);
    proto.constructor = cc.LayerColor.CanvasRenderCmd;
    proto.unbake = function(){
        cc.Layer.CanvasRenderCmd.prototype.unbake.call(this);
        this._needDraw = true;
    };
    proto.rendering = function (ctx, scaleX, scaleY) {
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext(),
            node = this._node,
            curColor = this._displayedColor,
            opacity = this._displayedOpacity / 255,
            locWidth = node._contentSize.width,
            locHeight = node._contentSize.height;
        if (opacity === 0)
            return;
        wrapper.setCompositeOperation(this._blendFuncStr);
        wrapper.setGlobalAlpha(opacity);
        wrapper.setFillStyle("rgba(" + (0 | curColor.r) + "," + (0 | curColor.g) + ","
            + (0 | curColor.b) + ", 1)");
        wrapper.setTransform(this._worldTransform, scaleX, scaleY);
        context.fillRect(0, 0, locWidth , -locHeight );
        cc.g_NumberOfDraws++;
    };
    proto.updateBlendFunc = function(blendFunc){
        this._blendFuncStr = cc.Node.CanvasRenderCmd._getCompositeOperationByBlendFunc(blendFunc);
    };
    proto._updateSquareVertices =
    proto._updateSquareVerticesWidth =
    proto._updateSquareVerticesHeight = function(){};
    proto._bakeRendering = function(){
        if(this._cacheDirty){
            var node = this._node;
            var locBakeSprite = this._bakeSprite, children = node._children;
            var len = children.length, i;
            this.transform(this.getParentRenderCmd(), true);
            var boundingBox = this._getBoundingBoxForBake();
            boundingBox.width = 0|(boundingBox.width+0.5);
            boundingBox.height = 0|(boundingBox.height+0.5);
            var bakeContext = locBakeSprite.getCacheContext();
            var ctx = bakeContext.getContext();
            locBakeSprite.setPosition(boundingBox.x, boundingBox.y);
            if(this._updateCache > 0) {
                ctx.fillStyle = bakeContext._currentFillStyle;
                locBakeSprite.resetCanvasSize(boundingBox.width, boundingBox.height);
                bakeContext.setOffset(0 - boundingBox.x, ctx.canvas.height - boundingBox.height + boundingBox.y );
                var child;
                cc.renderer._turnToCacheMode(this.__instanceId);
                if (len > 0) {
                    node.sortAllChildren();
                    for (i = 0; i < len; i++) {
                        child = children[i];
                        if (child._localZOrder < 0)
                            child._renderCmd.visit(this);
                        else
                            break;
                    }
                    cc.renderer.pushRenderCommand(this);
                    for (; i < len; i++) {
                        children[i]._renderCmd.visit(this);
                    }
                } else
                    cc.renderer.pushRenderCommand(this);
                cc.renderer._renderingToCacheCanvas(bakeContext, this.__instanceId);
                locBakeSprite.transform();
                this._updateCache--;
            }
            this._cacheDirty = false;
        }
    };
    proto.visit = function(parentCmd){
        if(!this._isBaked){
            this.originVisit();
            return;
        }
        var node = this._node;
        if (!node._visible)
            return;
        this._syncStatus(parentCmd);
        cc.renderer.pushRenderCommand(this._bakeRenderCmd);
        this._bakeSprite._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        this._bakeSprite.visit(this);
        this._dirtyFlag = 0;
    };
    proto._getBoundingBoxForBake = function(){
        var node = this._node;
        var rect = cc.rect(0, 0, node._contentSize.width, node._contentSize.height);
        var trans = node.getNodeToWorldTransform();
        rect = cc.rectApplyAffineTransform(rect, node.getNodeToWorldTransform());
        if (!node._children || node._children.length === 0)
            return rect;
        var locChildren = node._children;
        for (var i = 0; i < locChildren.length; i++) {
            var child = locChildren[i];
            if (child && child._visible) {
                var childRect = child._getBoundingBoxToCurrentNode(trans);
                rect = cc.rectUnion(rect, childRect);
            }
        }
        return rect;
    };
})();
(function(){
    cc.LayerGradient.CanvasRenderCmd = function(renderable){
        cc.LayerColor.CanvasRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._startPoint = cc.p(0, 0);
        this._endPoint = cc.p(0, 0);
        this._startStopStr = null;
        this._endStopStr = null;
    };
    var proto = cc.LayerGradient.CanvasRenderCmd.prototype = Object.create(cc.LayerColor.CanvasRenderCmd.prototype);
    proto.constructor = cc.LayerGradient.CanvasRenderCmd;
    proto.rendering = function (ctx, scaleX, scaleY) {
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext(),
            node = this._node,
            opacity = this._displayedOpacity / 255;
        if (opacity === 0)
            return;
        var locWidth = node._contentSize.width, locHeight = node._contentSize.height;
        wrapper.setCompositeOperation(this._blendFuncStr);
        wrapper.setGlobalAlpha(opacity);
        var gradient = context.createLinearGradient(this._startPoint.x, this._startPoint.y, this._endPoint.x, this._endPoint.y);
        if(node._colorStops){
             for(var i=0; i < node._colorStops.length; i++) {
                 var stop = node._colorStops[i];
                 gradient.addColorStop(stop.p, this._colorStopsStr[i]);
             }
        }else{
            gradient.addColorStop(0, this._startStopStr);
            gradient.addColorStop(1, this._endStopStr);
        }
        wrapper.setFillStyle(gradient);
        wrapper.setTransform(this._worldTransform, scaleX, scaleY);
        context.fillRect(0, 0, locWidth , -locHeight );
        cc.g_NumberOfDraws++;
    };
    proto.updateStatus = function () {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.gradientDirty) {
            this._dirtyFlag |= flags.colorDirty;
            this._dirtyFlag = locFlag & flags.gradientDirty ^ locFlag;
        }
        cc.Node.RenderCmd.prototype.updateStatus.call(this);
    };
    proto._syncStatus = function (parentCmd) {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.gradientDirty) {
            this._dirtyFlag |= flags.colorDirty;
            this._dirtyFlag = locFlag & flags.gradientDirty ^ locFlag;
        }
        cc.Node.RenderCmd.prototype._syncStatus.call(this, parentCmd);
    };
    proto._updateColor = function() {
        var node = this._node;
        var contentSize = node._contentSize;
        var tWidth = contentSize.width * 0.5, tHeight = contentSize.height * 0.5;
        var angle = cc.pAngleSigned(cc.p(0, -1), node._alongVector);
        var p1 = cc.pRotateByAngle(cc.p(0, -1), cc.p(0,0), angle);
        var factor = Math.min(Math.abs(1 / p1.x), Math.abs(1/ p1.y));
        this._startPoint.x = tWidth * (-p1.x * factor) + tWidth;
        this._startPoint.y = tHeight * (p1.y * factor) - tHeight;
        this._endPoint.x = tWidth * (p1.x * factor) + tWidth;
        this._endPoint.y = tHeight * (-p1.y * factor) - tHeight;
        var locStartColor = this._displayedColor, locEndColor = node._endColor;
        var startOpacity = node._startOpacity/255, endOpacity = node._endOpacity/255;
        this._startStopStr = "rgba(" + Math.round(locStartColor.r) + "," + Math.round(locStartColor.g) + ","
            + Math.round(locStartColor.b) + "," + startOpacity.toFixed(4) + ")";
        this._endStopStr = "rgba(" + Math.round(locEndColor.r) + "," + Math.round(locEndColor.g) + ","
            + Math.round(locEndColor.b) + "," + endOpacity.toFixed(4) + ")";
        if( node._colorStops){
            this._startOpacity = 0;
            this._endOpacity = 0;
            this._colorStopsStr = [];
            for(var i =0; i < node._colorStops.length; i++){
                var stopColor = node._colorStops[i].color;
                var stopOpacity = stopColor.a == null ? 1 : stopColor.a / 255;
                this._colorStopsStr.push("rgba(" + Math.round(stopColor.r) + "," + Math.round(stopColor.g) + ","
                    + Math.round(stopColor.b) + "," + stopOpacity.toFixed(4) + ")");
            }
        }
    };
})();
cc._tmp.PrototypeSprite = function () {
    var _p = cc.Sprite.prototype;
    cc.defineGetterSetter(_p, "opacityModifyRGB", _p.isOpacityModifyRGB, _p.setOpacityModifyRGB);
    cc.defineGetterSetter(_p, "opacity", _p.getOpacity, _p.setOpacity);
    cc.defineGetterSetter(_p, "color", _p.getColor, _p.setColor);
    _p.dirty;
    _p.flippedX;
    cc.defineGetterSetter(_p, "flippedX", _p.isFlippedX, _p.setFlippedX);
    _p.flippedY;
    cc.defineGetterSetter(_p, "flippedY", _p.isFlippedY, _p.setFlippedY);
    _p.offsetX;
    cc.defineGetterSetter(_p, "offsetX", _p._getOffsetX);
    _p.offsetY;
    cc.defineGetterSetter(_p, "offsetY", _p._getOffsetY);
    _p.atlasIndex;
    _p.texture;
    cc.defineGetterSetter(_p, "texture", _p.getTexture, _p.setTexture);
    _p.textureRectRotated;
    cc.defineGetterSetter(_p, "textureRectRotated", _p.isTextureRectRotated);
    _p.textureAtlas;
    _p.batchNode;
    cc.defineGetterSetter(_p, "batchNode", _p.getBatchNode, _p.setBatchNode);
    _p.quad;
    cc.defineGetterSetter(_p, "quad", _p.getQuad);
};
cc.Sprite = cc.Node.extend({
    dirty:false,
    atlasIndex:0,
    textureAtlas:null,
    _batchNode:null,
    _recursiveDirty:null,
    _hasChildren:null,
    _shouldBeHidden:false,
    _transformToBatch:null,
    _blendFunc:null,
    _texture:null,
    _rect:null,
    _rectRotated:false,
    _offsetPosition:null,
    _unflippedOffsetPositionFromCenter:null,
    _opacityModifyRGB:false,
    _flippedX:false,
    _flippedY:false,
    _textureLoaded:false,
    _className:"Sprite",
    ctor: function (fileName, rect, rotated) {
        var self = this;
        cc.Node.prototype.ctor.call(self);
        this.setAnchorPoint(0.5, 0.5);
        self._loader = new cc.Sprite.LoadManager();
        self._shouldBeHidden = false;
        self._offsetPosition = cc.p(0, 0);
        self._unflippedOffsetPositionFromCenter = cc.p(0, 0);
        self._blendFunc = {src: cc.BLEND_SRC, dst: cc.BLEND_DST};
        self._rect = cc.rect(0, 0, 0, 0);
        self._softInit(fileName, rect, rotated);
    },
    textureLoaded:function(){
        return this._textureLoaded;
    },
    addLoadedEventListener:function(callback, target){
        this.addEventListener("load", callback, target);
    },
    isDirty:function () {
        return this.dirty;
    },
    setDirty:function (bDirty) {
        this.dirty = bDirty;
    },
    isTextureRectRotated:function () {
        return this._rectRotated;
    },
    getAtlasIndex:function () {
        return this.atlasIndex;
    },
    setAtlasIndex:function (atlasIndex) {
        this.atlasIndex = atlasIndex;
    },
    getTextureRect:function () {
        return cc.rect(this._rect);
    },
    getTextureAtlas:function () {
        return this.textureAtlas;
    },
    setTextureAtlas:function (textureAtlas) {
        this.textureAtlas = textureAtlas;
    },
    getOffsetPosition:function () {
        return cc.p(this._offsetPosition);
    },
    _getOffsetX: function () {
        return this._offsetPosition.x;
    },
    _getOffsetY: function () {
        return this._offsetPosition.y;
    },
    getBlendFunc:function () {
        return this._blendFunc;
    },
    initWithSpriteFrame:function (spriteFrame) {
        cc.assert(spriteFrame, cc._LogInfos.Sprite_initWithSpriteFrame);
        return this.setSpriteFrame(spriteFrame);
    },
    initWithSpriteFrameName:function (spriteFrameName) {
        cc.assert(spriteFrameName, cc._LogInfos.Sprite_initWithSpriteFrameName);
        var frame = cc.spriteFrameCache.getSpriteFrame(spriteFrameName);
        cc.assert(frame, spriteFrameName + cc._LogInfos.Sprite_initWithSpriteFrameName1);
        return this.initWithSpriteFrame(frame);
    },
    useBatchNode:function (batchNode) {
        this.textureAtlas = batchNode.getTextureAtlas();
        this._batchNode = batchNode;
    },
    setVertexRect:function (rect) {
        var locRect = this._rect;
        locRect.x = rect.x;
        locRect.y = rect.y;
        locRect.width = rect.width;
        locRect.height = rect.height;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    sortAllChildren:function () {
        if (this._reorderChildDirty) {
            var _children = this._children;
            cc.Node.prototype.sortAllChildren.call(this);
            if (this._batchNode) {
                this._arrayMakeObjectsPerformSelector(_children, cc.Node._stateCallbackType.sortAllChildren);
            }
            this._reorderChildDirty = false;
        }
    },
    reorderChild:function (child, zOrder) {
        cc.assert(child, cc._LogInfos.Sprite_reorderChild_2);
        if(this._children.indexOf(child) === -1){
            cc.log(cc._LogInfos.Sprite_reorderChild);
            return;
        }
        if (zOrder === child.zIndex)
            return;
        if (this._batchNode && !this._reorderChildDirty) {
            this._setReorderChildDirtyRecursively();
            this._batchNode.reorderBatch(true);
        }
        cc.Node.prototype.reorderChild.call(this, child, zOrder);
    },
    removeChild:function (child, cleanup) {
        if (this._batchNode)
            this._batchNode.removeSpriteFromAtlas(child);
        cc.Node.prototype.removeChild.call(this, child, cleanup);
    },
    setVisible:function (visible) {
        cc.Node.prototype.setVisible.call(this, visible);
        this._renderCmd.setDirtyRecursively(true);
    },
    removeAllChildren:function (cleanup) {
        var locChildren = this._children, locBatchNode = this._batchNode;
        if (locBatchNode && locChildren != null) {
            for (var i = 0, len = locChildren.length; i < len; i++)
                locBatchNode.removeSpriteFromAtlas(locChildren[i]);
        }
        cc.Node.prototype.removeAllChildren.call(this, cleanup);
        this._hasChildren = false;
    },
    ignoreAnchorPointForPosition:function (relative) {
        if(this._batchNode){
            cc.log(cc._LogInfos.Sprite_ignoreAnchorPointForPosition);
            return;
        }
        cc.Node.prototype.ignoreAnchorPointForPosition.call(this, relative);
    },
    setFlippedX:function (flippedX) {
        if (this._flippedX !== flippedX) {
            this._flippedX = flippedX;
            this.setTextureRect(this._rect, this._rectRotated, this._contentSize);
            this.setNodeDirty(true);
        }
    },
    setFlippedY:function (flippedY) {
        if (this._flippedY !== flippedY) {
            this._flippedY = flippedY;
            this.setTextureRect(this._rect, this._rectRotated, this._contentSize);
            this.setNodeDirty(true);
        }
    },
    isFlippedX:function () {
        return this._flippedX;
    },
    isFlippedY:function () {
        return this._flippedY;
    },
    setOpacityModifyRGB: function (modify) {
        if (this._opacityModifyRGB !== modify) {
            this._opacityModifyRGB = modify;
            this._renderCmd._setColorDirty();
        }
    },
    isOpacityModifyRGB:function () {
        return this._opacityModifyRGB;
    },
    setDisplayFrameWithAnimationName:function (animationName, frameIndex) {
        cc.assert(animationName, cc._LogInfos.Sprite_setDisplayFrameWithAnimationName_3);
        var cache = cc.animationCache.getAnimation(animationName);
        if(!cache){
            cc.log(cc._LogInfos.Sprite_setDisplayFrameWithAnimationName);
            return;
        }
        var animFrame = cache.getFrames()[frameIndex];
        if(!animFrame){
            cc.log(cc._LogInfos.Sprite_setDisplayFrameWithAnimationName_2);
            return;
        }
        this.setSpriteFrame(animFrame.getSpriteFrame());
    },
    getBatchNode:function () {
        return this._batchNode;
    },
    _setReorderChildDirtyRecursively:function () {
        if (!this._reorderChildDirty) {
            this._reorderChildDirty = true;
            var pNode = this._parent;
            while (pNode && pNode !== this._batchNode) {
                pNode._setReorderChildDirtyRecursively();
                pNode = pNode.parent;
            }
        }
    },
    getTexture:function () {
        return this._texture;
    },
    _softInit: function (fileName, rect, rotated) {
        if (fileName === undefined)
            cc.Sprite.prototype.init.call(this);
        else if (cc.isString(fileName)) {
            if (fileName[0] === "#") {
                var frameName = fileName.substr(1, fileName.length - 1);
                var spriteFrame = cc.spriteFrameCache.getSpriteFrame(frameName);
                if (spriteFrame)
                    this.initWithSpriteFrame(spriteFrame);
                else
                    cc.log("%s does not exist", fileName);
            } else {
                cc.Sprite.prototype.init.call(this, fileName, rect);
            }
        } else if (typeof fileName === "object") {
            if (fileName instanceof cc.Texture2D) {
                this.initWithTexture(fileName, rect, rotated);
            } else if (fileName instanceof cc.SpriteFrame) {
                this.initWithSpriteFrame(fileName);
            } else if ((fileName instanceof HTMLImageElement) || (fileName instanceof HTMLCanvasElement)) {
                var texture2d = new cc.Texture2D();
                texture2d.initWithElement(fileName);
                texture2d.handleLoadedTexture();
                this.initWithTexture(texture2d);
            }
        }
    },
    getQuad:function () {
        return null;
    },
    setBlendFunc: function (src, dst) {
        var locBlendFunc = this._blendFunc;
        if (dst === undefined) {
            locBlendFunc.src = src.src;
            locBlendFunc.dst = src.dst;
        } else {
            locBlendFunc.src = src;
            locBlendFunc.dst = dst;
        }
        this._renderCmd.updateBlendFunc(locBlendFunc);
    },
    init: function () {
        var _t = this;
        if (arguments.length > 0)
            return _t.initWithFile(arguments[0], arguments[1]);
        cc.Node.prototype.init.call(_t);
        _t.dirty = _t._recursiveDirty = false;
        _t._blendFunc.src = cc.BLEND_SRC;
        _t._blendFunc.dst = cc.BLEND_DST;
        _t.texture = null;
        _t._flippedX = _t._flippedY = false;
        _t.anchorX = 0.5;
        _t.anchorY = 0.5;
        _t._offsetPosition.x = 0;
        _t._offsetPosition.y = 0;
        _t._hasChildren = false;
        _t.setTextureRect(cc.rect(0, 0, 0, 0), false, cc.size(0, 0));
        return true;
    },
    initWithFile:function (filename, rect) {
        cc.assert(filename, cc._LogInfos.Sprite_initWithFile);
        var tex = cc.textureCache.getTextureForKey(filename);
        if (!tex) {
            tex = cc.textureCache.addImage(filename);
        }
        if (!tex.isLoaded()) {
            this._loader.clear();
            this._loader.once(tex, function () {
                this.initWithFile(filename, rect);
                this.dispatchEvent("load");
            }, this);
            return false;
        }
        if (!rect) {
            var size = tex.getContentSize();
            rect = cc.rect(0, 0, size.width, size.height);
        }
        return this.initWithTexture(tex, rect);
    },
    initWithTexture: function (texture, rect, rotated, counterclockwise) {
        var _t = this;
        cc.assert(arguments.length !== 0, cc._LogInfos.CCSpriteBatchNode_initWithTexture);
        this._loader.clear();
        _t._textureLoaded = texture.isLoaded();
        if (!_t._textureLoaded) {
            this._loader.once(texture, function () {
                this.initWithTexture(texture, rect, rotated, counterclockwise);
                this.dispatchEvent("load");
            }, this);
            return false;
        }
        rotated = rotated || false;
        texture = this._renderCmd._handleTextureForRotatedTexture(texture, rect, rotated, counterclockwise);
        if (!cc.Node.prototype.init.call(_t))
            return false;
        _t._batchNode = null;
        _t._recursiveDirty = false;
        _t.dirty = false;
        _t._opacityModifyRGB = true;
        _t._blendFunc.src = cc.BLEND_SRC;
        _t._blendFunc.dst = cc.BLEND_DST;
        _t._flippedX = _t._flippedY = false;
        _t._offsetPosition.x = 0;
        _t._offsetPosition.y = 0;
        _t._hasChildren = false;
        _t._rectRotated = rotated;
        if (rect) {
            _t._rect.x = rect.x;
            _t._rect.y = rect.y;
            _t._rect.width = rect.width;
            _t._rect.height = rect.height;
        }
        if (!rect)
            rect = cc.rect(0, 0, texture.width, texture.height);
        this._renderCmd._checkTextureBoundary(texture, rect, rotated);
        _t.setTexture(texture);
        _t.setTextureRect(rect, rotated);
        _t.setBatchNode(null);
        return true;
    },
    setTextureRect: function (rect, rotated, untrimmedSize, needConvert) {
        var _t = this;
        _t._rectRotated = rotated || false;
        _t.setContentSize(untrimmedSize || rect);
        _t.setVertexRect(rect);
        _t._renderCmd._setTextureCoords(rect, needConvert);
        var relativeOffsetX = _t._unflippedOffsetPositionFromCenter.x, relativeOffsetY = _t._unflippedOffsetPositionFromCenter.y;
        if (_t._flippedX)
            relativeOffsetX = -relativeOffsetX;
        if (_t._flippedY)
            relativeOffsetY = -relativeOffsetY;
        var locRect = _t._rect;
        _t._offsetPosition.x = relativeOffsetX + (_t._contentSize.width - locRect.width) / 2;
        _t._offsetPosition.y = relativeOffsetY + (_t._contentSize.height - locRect.height) / 2;
    },
    addChild: function (child, localZOrder, tag) {
        cc.assert(child, cc._LogInfos.CCSpriteBatchNode_addChild_2);
        if (localZOrder == null)
            localZOrder = child._localZOrder;
        if (tag == null)
            tag = child.tag;
        if(this._renderCmd._setBatchNodeForAddChild(child)){
            cc.Node.prototype.addChild.call(this, child, localZOrder, tag);
            this._hasChildren = true;
        }
    },
    setSpriteFrame: function (newFrame) {
        var _t = this;
        if(cc.isString(newFrame)){
            newFrame = cc.spriteFrameCache.getSpriteFrame(newFrame);
            cc.assert(newFrame, cc._LogInfos.Sprite_setSpriteFrame)
        }
        this._loader.clear();
        this.setNodeDirty(true);
        var pNewTexture = newFrame.getTexture();
        _t._textureLoaded = newFrame.textureLoaded();
        this._loader.clear();
        if (!_t._textureLoaded) {
            this._loader.once(pNewTexture, function () {
                this.setSpriteFrame(newFrame);
                this.dispatchEvent("load");
            }, this);
            return false;
        }
        var frameOffset = newFrame.getOffset();
        _t._unflippedOffsetPositionFromCenter.x = frameOffset.x;
        _t._unflippedOffsetPositionFromCenter.y = frameOffset.y;
        if (pNewTexture !== _t._texture) {
            this._renderCmd._setTexture(pNewTexture);
            _t.setColor(_t._realColor);
        }
        _t.setTextureRect(newFrame.getRect(), newFrame.isRotated(), newFrame.getOriginalSize());
    },
    setDisplayFrame: function(newFrame){
        cc.log(cc._LogInfos.Sprite_setDisplayFrame);
        this.setSpriteFrame(newFrame);
    },
    isFrameDisplayed: function(frame){
        return this._renderCmd.isFrameDisplayed(frame);
    },
    displayFrame: function () {
        return this.getSpriteFrame();
    },
    getSpriteFrame: function () {
        return new cc.SpriteFrame(this._texture,
            cc.rectPointsToPixels(this._rect),
            this._rectRotated,
            cc.pointPointsToPixels(this._unflippedOffsetPositionFromCenter),
            cc.sizePointsToPixels(this._contentSize));
    },
    setBatchNode:function (spriteBatchNode) {
        var _t = this;
        _t._batchNode = spriteBatchNode;
        if (!_t._batchNode) {
            _t.atlasIndex = cc.Sprite.INDEX_NOT_INITIALIZED;
            _t.textureAtlas = null;
            _t._recursiveDirty = false;
            _t.dirty = false;
        } else {
            _t._transformToBatch = cc.affineTransformIdentity();
            _t.textureAtlas = _t._batchNode.getTextureAtlas();
        }
    },
    setTexture: function (texture) {
        if(!texture)
            return this._renderCmd._setTexture(null);
        var isFileName = cc.isString(texture);
        if(isFileName)
            texture = cc.textureCache.addImage(texture);
        this._loader.clear();
        if (!texture._textureLoaded) {
            this._loader.once(texture, function () {
                this.setTexture(texture);
                this.dispatchEvent("load");
            }, this);
            return false;
        }
        this._renderCmd._setTexture(texture);
        if (isFileName)
            this._changeRectWithTexture(texture);
        this.setColor(this._realColor);
        this._textureLoaded = true;
    },
    _changeRectWithTexture: function(texture){
        var contentSize = texture._contentSize;
        var rect = cc.rect(
            0, 0,
            contentSize.width, contentSize.height
        );
        this.setTextureRect(rect);
    },
    _createRenderCmd: function(){
        if(cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return new cc.Sprite.CanvasRenderCmd(this);
        else
            return new cc.Sprite.WebGLRenderCmd(this);
    }
});
cc.Sprite.create = function (fileName, rect, rotated) {
    return new cc.Sprite(fileName, rect, rotated);
};
cc.Sprite.createWithTexture = cc.Sprite.create;
cc.Sprite.createWithSpriteFrameName = cc.Sprite.create;
cc.Sprite.createWithSpriteFrame = cc.Sprite.create;
cc.Sprite.INDEX_NOT_INITIALIZED = -1;
cc.EventHelper.prototype.apply(cc.Sprite.prototype);
cc.assert(cc.isFunction(cc._tmp.PrototypeSprite), cc._LogInfos.MissingFile, "SpritesPropertyDefine.js");
cc._tmp.PrototypeSprite();
delete cc._tmp.PrototypeSprite;
(function () {
    var manager = cc.Sprite.LoadManager = function () {
        this.list = [];
    };
    manager.prototype.add = function (source, callback, target) {
        if (!source || !source.addEventListener) return;
        source.addEventListener('load', callback, target);
        this.list.push({
            source: source,
            listener: callback,
            target: target
        });
    };
    manager.prototype.once = function (source, callback, target) {
        if (!source || !source.addEventListener) return;
        var tmpCallback = function (event) {
            source.removeEventListener('load', tmpCallback, target);
            callback.call(target, event);
        };
        source.addEventListener('load', tmpCallback, target);
        this.list.push({
            source: source,
            listener: tmpCallback,
            target: target
        });
    };
    manager.prototype.clear = function () {
        while (this.list.length > 0) {
            var item = this.list.pop();
            item.source.removeEventListener('load', item.listener, item.target);
        }
    };
})();
(function() {
    cc.Sprite.CanvasRenderCmd = function (renderable) {
        cc.Node.CanvasRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._textureCoord = {
            renderX: 0,
            renderY: 0,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            validRect: false
        };
        this._blendFuncStr = "source-over";
        this._colorized = false;
        this._canUseDirtyRegion = true;
        this._textureToRender = null;
    };
    var proto = cc.Sprite.CanvasRenderCmd.prototype = Object.create(cc.Node.CanvasRenderCmd.prototype);
    proto.constructor = cc.Sprite.CanvasRenderCmd;
    proto.setDirtyRecursively = function (value) {};
    proto._setTexture = function (texture) {
        var node = this._node;
        if (node._texture !== texture) {
            if (texture) {
                node._textureLoaded = texture._textureLoaded;
            }else{
                node._textureLoaded = false;
            }
            node._texture = texture;
            this._updateColor();
        }
    };
    proto._setColorDirty = function () {
        this.setDirtyFlag(cc.Node._dirtyFlags.colorDirty | cc.Node._dirtyFlags.opacityDirty);
    };
    proto.isFrameDisplayed = function (frame) {
        var node = this._node;
        if (frame.getTexture() !== node._texture)
            return false;
        return cc.rectEqualToRect(frame.getRect(), node._rect);
    };
    proto.updateBlendFunc = function (blendFunc) {
        this._blendFuncStr = cc.Node.CanvasRenderCmd._getCompositeOperationByBlendFunc(blendFunc);
    };
    proto._setBatchNodeForAddChild = function (child) {
        return true;
    };
    proto._handleTextureForRotatedTexture = function (texture, rect, rotated, counterclockwise) {
        if (rotated && texture.isLoaded()) {
            var tempElement = texture.getHtmlElementObj();
            tempElement = cc.Sprite.CanvasRenderCmd._cutRotateImageToCanvas(tempElement, rect, counterclockwise);
            var tempTexture = new cc.Texture2D();
            tempTexture.initWithElement(tempElement);
            tempTexture.handleLoadedTexture();
            texture = tempTexture;
            rect.x = rect.y = 0;
            this._node._rect = cc.rect(0, 0, rect.width, rect.height);
        }
        return texture;
    };
    proto._checkTextureBoundary = function (texture, rect, rotated) {
        if (texture && texture.url) {
            var _x = rect.x + rect.width, _y = rect.y + rect.height;
            if (_x > texture.width)
                cc.error(cc._LogInfos.RectWidth, texture.url);
            if (_y > texture.height)
                cc.error(cc._LogInfos.RectHeight, texture.url);
        }
    };
    proto.rendering = function (ctx, scaleX, scaleY) {
        var node = this._node;
        var locTextureCoord = this._textureCoord, alpha = (this._displayedOpacity / 255);
        var texture = this._textureToRender || node._texture;
        if ((texture && (locTextureCoord.width === 0 || locTextureCoord.height === 0|| !texture._textureLoaded)) || alpha === 0)
            return;
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext();
        var locX = node._offsetPosition.x, locHeight = node._rect.height, locWidth = node._rect.width,
            locY = -node._offsetPosition.y - locHeight, image;
        wrapper.setTransform(this._worldTransform, scaleX, scaleY);
        wrapper.setCompositeOperation(this._blendFuncStr);
        wrapper.setGlobalAlpha(alpha);
        if(node._flippedX || node._flippedY)
            wrapper.save();
        if (node._flippedX) {
            locX = -locX - locWidth;
            context.scale(-1, 1);
        }
        if (node._flippedY) {
            locY = node._offsetPosition.y;
            context.scale(1, -1);
        }
        var sx, sy, sw, sh, x, y, w, h;
        if (this._colorized) {
            sx = 0;
            sy = 0;
        }else{
            sx = locTextureCoord.renderX;
            sy = locTextureCoord.renderY;
        }
        sw = locTextureCoord.width;
        sh = locTextureCoord.height;
        x = locX;
        y = locY;
        w = locWidth;
        h = locHeight;
        if (texture && texture._htmlElementObj) {
            image = texture._htmlElementObj;
            if (texture._pattern !== "") {
                wrapper.setFillStyle(context.createPattern(image, texture._pattern));
                context.fillRect(x, y, w, h);
            } else {
                context.drawImage(image,
                    sx, sy, sw, sh,
                    x, y, w, h);
            }
        } else {
            var contentSize = node._contentSize;
            if (locTextureCoord.validRect) {
                var curColor = this._displayedColor;
                wrapper.setFillStyle("rgba(" + curColor.r + "," + curColor.g + "," + curColor.b + ",1)");
                context.fillRect(x, y, contentSize.width * scaleX, contentSize.height * scaleY);
            }
        }
        if(node._flippedX || node._flippedY)
            wrapper.restore();
        cc.g_NumberOfDraws++;
    };
    proto._updateColor = function(){
        var node = this._node;
        var texture = node._texture, rect = this._textureCoord;
        var dColor = this._displayedColor;
        if(texture){
            if(dColor.r !== 255 || dColor.g !== 255 || dColor.b !== 255){
                this._textureToRender = texture._generateColorTexture(dColor.r, dColor.g, dColor.b, rect);
                this._colorized = true;
            }else if(texture){
                this._textureToRender = texture;
                this._colorized = false;
            }
        }
    };
    proto._textureLoadedCallback = function (sender) {
        var node = this;
        if (node._textureLoaded)
            return;
        node._textureLoaded = true;
        var locRect = node._rect, locRenderCmd = this._renderCmd;
        if (!locRect) {
            locRect = cc.rect(0, 0, sender.width, sender.height);
        } else if (cc._rectEqualToZero(locRect)) {
            locRect.width = sender.width;
            locRect.height = sender.height;
        }
        node.texture = sender;
        node.setTextureRect(locRect, node._rectRotated);
        var locColor = locRenderCmd._displayedColor;
        if (locColor.r !== 255 || locColor.g !== 255 || locColor.b !== 255)
            locRenderCmd._updateColor();
        node.setBatchNode(node._batchNode);
        node.dispatchEvent("load");
    };
    proto._setTextureCoords = function (rect, needConvert) {
        if (needConvert === undefined)
            needConvert = true;
        var locTextureRect = this._textureCoord,
            scaleFactor = needConvert ? cc.contentScaleFactor() : 1;
        locTextureRect.renderX = locTextureRect.x = 0 | (rect.x * scaleFactor);
        locTextureRect.renderY = locTextureRect.y = 0 | (rect.y * scaleFactor);
        locTextureRect.width = 0 | (rect.width * scaleFactor);
        locTextureRect.height = 0 | (rect.height * scaleFactor);
        locTextureRect.validRect = !(locTextureRect.width === 0 || locTextureRect.height === 0 || locTextureRect.x < 0 || locTextureRect.y < 0);
    };
    cc.Sprite.CanvasRenderCmd._cutRotateImageToCanvas = function (texture, rect, counterclockwise) {
        if (!texture)
            return null;
        if (!rect)
            return texture;
        counterclockwise = counterclockwise == null? true: counterclockwise;
        var nCanvas = document.createElement("canvas");
        nCanvas.width = rect.width;
        nCanvas.height = rect.height;
        var ctx = nCanvas.getContext("2d");
        ctx.translate(nCanvas.width / 2, nCanvas.height / 2);
        if(counterclockwise)
            ctx.rotate(-1.5707963267948966);
        else
            ctx.rotate(1.5707963267948966);
        ctx.drawImage(texture, rect.x, rect.y, rect.height, rect.width, -rect.height / 2, -rect.width / 2, rect.height, rect.width);
        return nCanvas;
    };
})();
cc.BakeSprite = cc.Sprite.extend({
    _cacheCanvas: null,
    _cacheContext: null,
    ctor: function(){
        cc.Sprite.prototype.ctor.call(this);
        var canvasElement = document.createElement("canvas");
        canvasElement.width = canvasElement.height = 10;
        this._cacheCanvas = canvasElement;
        this._cacheContext = new cc.CanvasContextWrapper(canvasElement.getContext("2d"));
        var texture = new cc.Texture2D();
        texture.initWithElement(canvasElement);
        texture.handleLoadedTexture();
        this.setTexture(texture);
    },
    getCacheContext: function(){
        return this._cacheContext;
    },
    getCacheCanvas: function(){
        return this._cacheCanvas;
    },
    resetCanvasSize: function(sizeOrWidth, height){
        var locCanvas = this._cacheCanvas,
            locContext = this._cacheContext,
            strokeStyle = locContext._context.strokeStyle,
            fillStyle = locContext._context.fillStyle;
        if(height === undefined){
            height = sizeOrWidth.height;
            sizeOrWidth = sizeOrWidth.width;
        }
        locCanvas.width = sizeOrWidth;
        locCanvas.height = height;
        if(strokeStyle !== locContext._context.strokeStyle)
            locContext._context.strokeStyle = strokeStyle;
        if(fillStyle !== locContext._context.fillStyle)
            locContext._context.fillStyle = fillStyle;
        this.getTexture().handleLoadedTexture();
        this.setTextureRect(cc.rect(0,0, sizeOrWidth, height), false, null, false);
    }
});
cc.AnimationFrame = cc.Class.extend({
    _spriteFrame:null,
    _delayPerUnit:0,
    _userInfo:null,
    ctor:function (spriteFrame, delayUnits, userInfo) {
        this._spriteFrame = spriteFrame || null;
        this._delayPerUnit = delayUnits || 0;
        this._userInfo = userInfo || null;
    },
    clone: function(){
        var frame = new cc.AnimationFrame();
        frame.initWithSpriteFrame(this._spriteFrame.clone(), this._delayPerUnit, this._userInfo);
        return frame;
    },
    copyWithZone:function (pZone) {
        return cc.clone(this);
    },
    copy:function (pZone) {
        var newFrame = new cc.AnimationFrame();
        newFrame.initWithSpriteFrame(this._spriteFrame.clone(), this._delayPerUnit, this._userInfo);
        return newFrame;
    },
    initWithSpriteFrame:function (spriteFrame, delayUnits, userInfo) {
        this._spriteFrame = spriteFrame;
        this._delayPerUnit = delayUnits;
        this._userInfo = userInfo;
        return true;
    },
    getSpriteFrame:function () {
        return this._spriteFrame;
    },
    setSpriteFrame:function (spriteFrame) {
        this._spriteFrame = spriteFrame;
    },
    getDelayUnits:function () {
        return this._delayPerUnit;
    },
    setDelayUnits:function (delayUnits) {
        this._delayPerUnit = delayUnits;
    },
    getUserInfo:function () {
        return this._userInfo;
    },
    setUserInfo:function (userInfo) {
        this._userInfo = userInfo;
    }
});
cc.AnimationFrame.create = function(spriteFrame,delayUnits,userInfo){
    return new cc.AnimationFrame(spriteFrame,delayUnits,userInfo);
};
cc.Animation = cc.Class.extend({
    _frames:null,
    _loops:0,
    _restoreOriginalFrame:false,
    _duration:0,
    _delayPerUnit:0,
    _totalDelayUnits:0,
    ctor:function (frames, delay, loops) {
        this._frames = [];
		if (frames === undefined) {
			this.initWithSpriteFrames(null, 0);
		} else {
			var frame0 = frames[0];
			if(frame0){
				if (frame0 instanceof cc.SpriteFrame) {
					this.initWithSpriteFrames(frames, delay, loops);
				}else if(frame0 instanceof cc.AnimationFrame) {
					this.initWithAnimationFrames(frames, delay, loops);
				}
			}
		}
    },
    getFrames:function () {
        return this._frames;
    },
    setFrames:function (frames) {
        this._frames = frames;
    },
    addSpriteFrame:function (frame) {
        var animFrame = new cc.AnimationFrame();
        animFrame.initWithSpriteFrame(frame, 1, null);
        this._frames.push(animFrame);
        this._totalDelayUnits++;
    },
    addSpriteFrameWithFile:function (fileName) {
        var texture = cc.textureCache.addImage(fileName);
        var rect = cc.rect(0, 0, 0, 0);
        rect.width = texture.width;
        rect.height = texture.height;
        var frame = new cc.SpriteFrame(texture, rect);
        this.addSpriteFrame(frame);
    },
    addSpriteFrameWithTexture:function (texture, rect) {
        var pFrame = new cc.SpriteFrame(texture, rect);
        this.addSpriteFrame(pFrame);
    },
    initWithAnimationFrames:function (arrayOfAnimationFrames, delayPerUnit, loops) {
        cc.arrayVerifyType(arrayOfAnimationFrames, cc.AnimationFrame);
        this._delayPerUnit = delayPerUnit;
        this._loops = loops === undefined ? 1 : loops;
        this._totalDelayUnits = 0;
        var locFrames = this._frames;
        locFrames.length = 0;
        for (var i = 0; i < arrayOfAnimationFrames.length; i++) {
            var animFrame = arrayOfAnimationFrames[i];
            locFrames.push(animFrame);
            this._totalDelayUnits += animFrame.getDelayUnits();
        }
        return true;
    },
    clone: function(){
        var animation = new cc.Animation();
        animation.initWithAnimationFrames(this._copyFrames(), this._delayPerUnit, this._loops);
        animation.setRestoreOriginalFrame(this._restoreOriginalFrame);
        return animation;
    },
    copyWithZone:function (pZone) {
        var pCopy = new cc.Animation();
        pCopy.initWithAnimationFrames(this._copyFrames(), this._delayPerUnit, this._loops);
        pCopy.setRestoreOriginalFrame(this._restoreOriginalFrame);
        return pCopy;
    },
    _copyFrames:function(){
       var copyFrames = [];
        for(var i = 0; i< this._frames.length;i++)
            copyFrames.push(this._frames[i].clone());
        return copyFrames;
    },
    copy:function (pZone) {
        return this.copyWithZone(null);
    },
    getLoops:function () {
        return this._loops;
    },
    setLoops:function (value) {
        this._loops = value;
    },
    setRestoreOriginalFrame:function (restOrigFrame) {
        this._restoreOriginalFrame = restOrigFrame;
    },
    getRestoreOriginalFrame:function () {
        return this._restoreOriginalFrame;
    },
    getDuration:function () {
        return this._totalDelayUnits * this._delayPerUnit;
    },
    getDelayPerUnit:function () {
        return this._delayPerUnit;
    },
    setDelayPerUnit:function (delayPerUnit) {
        this._delayPerUnit = delayPerUnit;
    },
    getTotalDelayUnits:function () {
        return this._totalDelayUnits;
    },
    initWithSpriteFrames:function (frames, delay, loops) {
        cc.arrayVerifyType(frames, cc.SpriteFrame);
        this._loops = loops === undefined ? 1 : loops;
        this._delayPerUnit = delay || 0;
        this._totalDelayUnits = 0;
        var locFrames = this._frames;
        locFrames.length = 0;
        if (frames) {
            for (var i = 0; i < frames.length; i++) {
                var frame = frames[i];
                var animFrame = new cc.AnimationFrame();
                animFrame.initWithSpriteFrame(frame, 1, null);
                locFrames.push(animFrame);
            }
            this._totalDelayUnits += frames.length;
        }
        return true;
    },
    retain:function () {
    },
    release:function () {
    }
});
cc.Animation.create = function (frames, delay, loops) {
    return new cc.Animation(frames, delay, loops);
};
cc.Animation.createWithAnimationFrames = cc.Animation.create;
cc.animationCache = {
	_animations: {},
    addAnimation:function (animation, name) {
        this._animations[name] = animation;
    },
    removeAnimation:function (name) {
        if (!name) {
            return;
        }
        if (this._animations[name]) {
            delete this._animations[name];
        }
    },
    getAnimation:function (name) {
        if (this._animations[name])
            return this._animations[name];
        return null;
    },
    _addAnimationsWithDictionary:function (dictionary,plist) {
        var animations = dictionary["animations"];
        if (!animations) {
            cc.log(cc._LogInfos.animationCache__addAnimationsWithDictionary);
            return;
        }
        var version = 1;
        var properties = dictionary["properties"];
        if (properties) {
            version = (properties["format"] != null) ? parseInt(properties["format"]) : version;
            var spritesheets = properties["spritesheets"];
            var spriteFrameCache = cc.spriteFrameCache;
            var path = cc.path;
            for (var i = 0; i < spritesheets.length; i++) {
                spriteFrameCache.addSpriteFrames(path.changeBasename(plist, spritesheets[i]));
            }
        }
        switch (version) {
            case 1:
                this._parseVersion1(animations);
                break;
            case 2:
                this._parseVersion2(animations);
                break;
            default :
                cc.log(cc._LogInfos.animationCache__addAnimationsWithDictionary_2);
                break;
        }
    },
    addAnimations:function (plist) {
        cc.assert(plist, cc._LogInfos.animationCache_addAnimations_2);
        var dict = cc.loader.getRes(plist);
        if(!dict){
            cc.log(cc._LogInfos.animationCache_addAnimations);
            return;
        }
        this._addAnimationsWithDictionary(dict,plist);
    },
    _parseVersion1:function (animations) {
        var frameCache = cc.spriteFrameCache;
        for (var key in animations) {
            var animationDict = animations[key];
            var frameNames = animationDict["frames"];
            var delay = parseFloat(animationDict["delay"]) || 0;
            var animation = null;
            if (!frameNames) {
                cc.log(cc._LogInfos.animationCache__parseVersion1, key);
                continue;
            }
            var frames = [];
            for (var i = 0; i < frameNames.length; i++) {
                var spriteFrame = frameCache.getSpriteFrame(frameNames[i]);
                if (!spriteFrame) {
                    cc.log(cc._LogInfos.animationCache__parseVersion1_2, key, frameNames[i]);
                    continue;
                }
                var animFrame = new cc.AnimationFrame();
                animFrame.initWithSpriteFrame(spriteFrame, 1, null);
                frames.push(animFrame);
            }
            if (frames.length === 0) {
                cc.log(cc._LogInfos.animationCache__parseVersion1_3, key);
                continue;
            } else if (frames.length !== frameNames.length) {
                cc.log(cc._LogInfos.animationCache__parseVersion1_4, key);
            }
            animation = new cc.Animation(frames, delay, 1);
            cc.animationCache.addAnimation(animation, key);
        }
    },
    _parseVersion2:function (animations) {
        var frameCache = cc.spriteFrameCache;
        for (var key in animations) {
            var animationDict = animations[key];
            var isLoop = animationDict["loop"];
            var loopsTemp = parseInt(animationDict["loops"]);
            var loops = isLoop ? cc.REPEAT_FOREVER : ((isNaN(loopsTemp)) ? 1 : loopsTemp);
            var restoreOriginalFrame = (animationDict["restoreOriginalFrame"] && animationDict["restoreOriginalFrame"] == true) ? true : false;
            var frameArray = animationDict["frames"];
            if (!frameArray) {
                cc.log(cc._LogInfos.animationCache__parseVersion2, key);
                continue;
            }
            var arr = [];
            for (var i = 0; i < frameArray.length; i++) {
                var entry = frameArray[i];
                var spriteFrameName = entry["spriteframe"];
                var spriteFrame = frameCache.getSpriteFrame(spriteFrameName);
                if (!spriteFrame) {
                    cc.log(cc._LogInfos.animationCache__parseVersion2_2, key, spriteFrameName);
                    continue;
                }
                var delayUnits = parseFloat(entry["delayUnits"]) || 0;
                var userInfo = entry["notification"];
                var animFrame = new cc.AnimationFrame();
                animFrame.initWithSpriteFrame(spriteFrame, delayUnits, userInfo);
                arr.push(animFrame);
            }
            var delayPerUnit = parseFloat(animationDict["delayPerUnit"]) || 0;
            var animation = new cc.Animation();
            animation.initWithAnimationFrames(arr, delayPerUnit, loops);
            animation.setRestoreOriginalFrame(restoreOriginalFrame);
            cc.animationCache.addAnimation(animation, key);
        }
    },
	_clear: function () {
		this._animations = {};
	}
};
cc.SpriteFrame = cc.Class.extend({
    _offset:null,
    _originalSize:null,
    _rectInPixels:null,
    _rotated:false,
    _rect:null,
    _offsetInPixels:null,
    _originalSizeInPixels:null,
    _texture:null,
    _textureFilename:"",
    _textureLoaded:false,
    ctor:function (filename, rect, rotated, offset, originalSize) {
        this._offset = cc.p(0, 0);
        this._offsetInPixels = cc.p(0, 0);
        this._originalSize = cc.size(0, 0);
        this._rotated = false;
        this._originalSizeInPixels = cc.size(0, 0);
        this._textureFilename = "";
        this._texture = null;
        this._textureLoaded = false;
        if(filename !== undefined && rect !== undefined ){
            if(rotated === undefined || offset === undefined || originalSize === undefined)
                this.initWithTexture(filename, rect);
            else
                this.initWithTexture(filename, rect, rotated, offset, originalSize)
        }
    },
    textureLoaded:function(){
        return this._textureLoaded;
    },
    addLoadedEventListener:function(callback, target){
        this.addEventListener("load", callback, target);
    },
    getRectInPixels:function () {
        var locRectInPixels = this._rectInPixels;
        return cc.rect(locRectInPixels.x, locRectInPixels.y, locRectInPixels.width, locRectInPixels.height);
    },
    setRectInPixels:function (rectInPixels) {
        if (!this._rectInPixels){
            this._rectInPixels = cc.rect(0,0,0,0);
        }
        this._rectInPixels.x = rectInPixels.x;
        this._rectInPixels.y = rectInPixels.y;
        this._rectInPixels.width = rectInPixels.width;
        this._rectInPixels.height = rectInPixels.height;
        this._rect = cc.rectPixelsToPoints(rectInPixels);
    },
    isRotated:function () {
        return this._rotated;
    },
    setRotated:function (bRotated) {
        this._rotated = bRotated;
    },
    getRect:function () {
        var locRect = this._rect;
        return cc.rect(locRect.x, locRect.y, locRect.width, locRect.height);
    },
    setRect:function (rect) {
        if (!this._rect){
            this._rect = cc.rect(0,0,0,0);
        }
        this._rect.x = rect.x;
        this._rect.y = rect.y;
        this._rect.width = rect.width;
        this._rect.height = rect.height;
        this._rectInPixels = cc.rectPointsToPixels(this._rect);
    },
    getOffsetInPixels:function () {
        return cc.p(this._offsetInPixels);
    },
    setOffsetInPixels:function (offsetInPixels) {
        this._offsetInPixels.x = offsetInPixels.x;
        this._offsetInPixels.y = offsetInPixels.y;
        cc._pointPixelsToPointsOut(this._offsetInPixels, this._offset);
    },
    getOriginalSizeInPixels:function () {
        return cc.size(this._originalSizeInPixels);
    },
    setOriginalSizeInPixels:function (sizeInPixels) {
        this._originalSizeInPixels.width = sizeInPixels.width;
        this._originalSizeInPixels.height = sizeInPixels.height;
    },
    getOriginalSize:function () {
        return cc.size(this._originalSize);
    },
    setOriginalSize:function (sizeInPixels) {
        this._originalSize.width = sizeInPixels.width;
        this._originalSize.height = sizeInPixels.height;
    },
    getTexture:function () {
        if (this._texture)
            return this._texture;
        if (this._textureFilename !== "") {
            var locTexture = cc.textureCache.addImage(this._textureFilename);
            if (locTexture)
                this._textureLoaded = locTexture.isLoaded();
            return locTexture;
        }
        return null;
    },
    setTexture:function (texture) {
        if (this._texture !== texture) {
            var locLoaded = texture.isLoaded();
            this._textureLoaded = locLoaded;
            this._texture = texture;
            if(!locLoaded){
                texture.addEventListener("load", function(sender){
                    this._textureLoaded = true;
                    if(this._rotated && cc._renderType === cc.game.RENDER_TYPE_CANVAS){
                        var tempElement = sender.getHtmlElementObj();
                        tempElement = cc.Sprite.CanvasRenderCmd._cutRotateImageToCanvas(tempElement, this.getRect());
                        var tempTexture = new cc.Texture2D();
                        tempTexture.initWithElement(tempElement);
                        tempTexture.handleLoadedTexture();
                        this.setTexture(tempTexture);
                        var rect = this.getRect();
                        this.setRect(cc.rect(0, 0, rect.width, rect.height));
                    }
                    var locRect = this._rect;
                    if(locRect.width === 0 && locRect.height === 0){
                        var w = sender.width, h = sender.height;
                        this._rect.width = w;
                        this._rect.height = h;
                        this._rectInPixels = cc.rectPointsToPixels(this._rect);
                        this._originalSizeInPixels.width = this._rectInPixels.width;
                        this._originalSizeInPixels.height = this._rectInPixels.height;
                        this._originalSize.width =  w;
                        this._originalSize.height =  h;
                    }
                    this.dispatchEvent("load");
                }, this);
            }
        }
    },
    getOffset:function () {
        return cc.p(this._offset);
    },
    setOffset:function (offsets) {
        this._offset.x = offsets.x;
        this._offset.y = offsets.y;
    },
    clone: function(){
        var frame = new cc.SpriteFrame();
        frame.initWithTexture(this._textureFilename, this._rectInPixels, this._rotated, this._offsetInPixels, this._originalSizeInPixels);
        frame.setTexture(this._texture);
        return frame;
    },
    copyWithZone:function () {
        var copy = new cc.SpriteFrame();
        copy.initWithTexture(this._textureFilename, this._rectInPixels, this._rotated, this._offsetInPixels, this._originalSizeInPixels);
        copy.setTexture(this._texture);
        return copy;
    },
    copy:function () {
        return this.copyWithZone();
    },
    initWithTexture:function (texture, rect, rotated, offset, originalSize) {
        if(arguments.length === 2)
            rect = cc.rectPointsToPixels(rect);
        offset = offset || cc.p(0, 0);
        originalSize = originalSize || rect;
        rotated = rotated || false;
        if (cc.isString(texture)){
            this._texture = null;
            this._textureFilename = texture;
        } else if (texture instanceof cc.Texture2D){
            this.setTexture(texture);
        }
        texture = this.getTexture();
        this._rectInPixels = rect;
        this._rect = cc.rectPixelsToPoints(rect);
        if(texture && texture.url && texture.isLoaded()) {
            var _x, _y;
            if(rotated){
                _x = rect.x + rect.height;
                _y = rect.y + rect.width;
            }else{
                _x = rect.x + rect.width;
                _y = rect.y + rect.height;
            }
            if(_x > texture.getPixelsWide()){
                cc.error(cc._LogInfos.RectWidth, texture.url);
            }
            if(_y > texture.getPixelsHigh()){
                cc.error(cc._LogInfos.RectHeight, texture.url);
            }
        }
        this._offsetInPixels.x = offset.x;
        this._offsetInPixels.y = offset.y;
        cc._pointPixelsToPointsOut(offset, this._offset);
        this._originalSizeInPixels.width = originalSize.width;
        this._originalSizeInPixels.height = originalSize.height;
        cc._sizePixelsToPointsOut(originalSize, this._originalSize);
        this._rotated = rotated;
        return true;
    }
});
cc.EventHelper.prototype.apply(cc.SpriteFrame.prototype);
cc.SpriteFrame.create = function (filename, rect, rotated, offset, originalSize) {
    return new cc.SpriteFrame(filename,rect,rotated,offset,originalSize);
};
cc.SpriteFrame.createWithTexture = cc.SpriteFrame.create;
cc.SpriteFrame._frameWithTextureForCanvas = function (texture, rect, rotated, offset, originalSize) {
    var spriteFrame = new cc.SpriteFrame();
    spriteFrame._texture = texture;
    spriteFrame._rectInPixels = rect;
    spriteFrame._rect = cc.rectPixelsToPoints(rect);
    spriteFrame._offsetInPixels.x = offset.x;
    spriteFrame._offsetInPixels.y = offset.y;
    cc._pointPixelsToPointsOut(spriteFrame._offsetInPixels, spriteFrame._offset);
    spriteFrame._originalSizeInPixels.width = originalSize.width;
    spriteFrame._originalSizeInPixels.height = originalSize.height;
    cc._sizePixelsToPointsOut(spriteFrame._originalSizeInPixels, spriteFrame._originalSize);
    spriteFrame._rotated = rotated;
    return spriteFrame;
};
cc.spriteFrameCache = {
    _CCNS_REG1 : /^\s*\{\s*([\-]?\d+[.]?\d*)\s*,\s*([\-]?\d+[.]?\d*)\s*\}\s*$/,
    _CCNS_REG2 : /^\s*\{\s*\{\s*([\-]?\d+[.]?\d*)\s*,\s*([\-]?\d+[.]?\d*)\s*\}\s*,\s*\{\s*([\-]?\d+[.]?\d*)\s*,\s*([\-]?\d+[.]?\d*)\s*\}\s*\}\s*$/,
    _spriteFrames: {},
    _spriteFramesAliases: {},
    _frameConfigCache : {},
    _rectFromString :  function (content) {
        var result = this._CCNS_REG2.exec(content);
        if(!result) return cc.rect(0, 0, 0, 0);
        return cc.rect(parseFloat(result[1]), parseFloat(result[2]), parseFloat(result[3]), parseFloat(result[4]));
    },
    _pointFromString : function (content) {
        var result = this._CCNS_REG1.exec(content);
        if(!result) return cc.p(0,0);
        return cc.p(parseFloat(result[1]), parseFloat(result[2]));
    },
    _sizeFromString : function (content) {
        var result = this._CCNS_REG1.exec(content);
        if(!result) return cc.size(0, 0);
        return cc.size(parseFloat(result[1]), parseFloat(result[2]));
    },
    _getFrameConfig : function(url){
        var dict = cc.loader.getRes(url);
        cc.assert(dict, cc._LogInfos.spriteFrameCache__getFrameConfig_2, url);
        cc.loader.release(url);//release it in loader
        if(dict._inited){
            this._frameConfigCache[url] = dict;
            return dict;
        }
        this._frameConfigCache[url] = this._parseFrameConfig(dict);
        return this._frameConfigCache[url];
    },
    _getFrameConfigByJsonObject: function(url, jsonObject) {
        cc.assert(jsonObject, cc._LogInfos.spriteFrameCache__getFrameConfig_2, url);
        this._frameConfigCache[url] = this._parseFrameConfig(jsonObject);
        return this._frameConfigCache[url];
    },
    _parseFrameConfig: function(dict) {
        var tempFrames = dict["frames"], tempMeta = dict["metadata"] || dict["meta"];
        var frames = {}, meta = {};
        var format = 0;
        if(tempMeta){//init meta
            var tmpFormat = tempMeta["format"];
            format = (tmpFormat.length <= 1) ? parseInt(tmpFormat) : tmpFormat;
            meta.image = tempMeta["textureFileName"] || tempMeta["textureFileName"] || tempMeta["image"];
        }
        for (var key in tempFrames) {
            var frameDict = tempFrames[key];
            if(!frameDict) continue;
            var tempFrame = {};
            if (format == 0) {
                tempFrame.rect = cc.rect(frameDict["x"], frameDict["y"], frameDict["width"], frameDict["height"]);
                tempFrame.rotated = false;
                tempFrame.offset = cc.p(frameDict["offsetX"], frameDict["offsetY"]);
                var ow = frameDict["originalWidth"];
                var oh = frameDict["originalHeight"];
                if (!ow || !oh) {
                    cc.log(cc._LogInfos.spriteFrameCache__getFrameConfig);
                }
                ow = Math.abs(ow);
                oh = Math.abs(oh);
                tempFrame.size = cc.size(ow, oh);
            } else if (format == 1 || format == 2) {
                tempFrame.rect = this._rectFromString(frameDict["frame"]);
                tempFrame.rotated = frameDict["rotated"] || false;
                tempFrame.offset = this._pointFromString(frameDict["offset"]);
                tempFrame.size = this._sizeFromString(frameDict["sourceSize"]);
            } else if (format == 3) {
                var spriteSize = this._sizeFromString(frameDict["spriteSize"]);
                var textureRect = this._rectFromString(frameDict["textureRect"]);
                if (spriteSize) {
                    textureRect = cc.rect(textureRect.x, textureRect.y, spriteSize.width, spriteSize.height);
                }
                tempFrame.rect = textureRect;
                tempFrame.rotated = frameDict["textureRotated"] || false;
                tempFrame.offset = this._pointFromString(frameDict["spriteOffset"]);
                tempFrame.size = this._sizeFromString(frameDict["spriteSourceSize"]);
                tempFrame.aliases = frameDict["aliases"];
            } else {
                var tmpFrame = frameDict["frame"], tmpSourceSize = frameDict["sourceSize"];
                key = frameDict["filename"] || key;
                tempFrame.rect = cc.rect(tmpFrame["x"], tmpFrame["y"], tmpFrame["w"], tmpFrame["h"]);
                tempFrame.rotated = frameDict["rotated"] || false;
                tempFrame.offset = cc.p(0, 0);
                tempFrame.size = cc.size(tmpSourceSize["w"], tmpSourceSize["h"]);
            }
            frames[key] = tempFrame;
        }
        return {_inited: true, frames: frames, meta: meta};
    },
    _addSpriteFramesByObject: function(url, jsonObject, texture) {
        cc.assert(url, cc._LogInfos.spriteFrameCache_addSpriteFrames_2);
        if(!jsonObject || !jsonObject["frames"])
            return;
        var frameConfig = this._frameConfigCache[url] || this._getFrameConfigByJsonObject(url, jsonObject);
        this._createSpriteFrames(url, frameConfig, texture);
    },
    _createSpriteFrames: function(url, frameConfig, texture) {
        var frames = frameConfig.frames, meta = frameConfig.meta;
        if(!texture){
            var texturePath = cc.path.changeBasename(url, meta.image || ".png");
            texture = cc.textureCache.addImage(texturePath);
        }else if(texture instanceof cc.Texture2D){
        }else if(cc.isString(texture)){//string
            texture = cc.textureCache.addImage(texture);
        }else{
            cc.assert(0, cc._LogInfos.spriteFrameCache_addSpriteFrames_3);
        }
        var spAliases = this._spriteFramesAliases, spriteFrames = this._spriteFrames;
        for (var key in frames) {
            var frame = frames[key];
            var spriteFrame = spriteFrames[key];
            if (!spriteFrame) {
                spriteFrame = new cc.SpriteFrame(texture, frame.rect, frame.rotated, frame.offset, frame.size);
                var aliases = frame.aliases;
                if(aliases){//set aliases
                    for(var i = 0, li = aliases.length; i < li; i++){
                        var alias = aliases[i];
                        if (spAliases[alias])
                            cc.log(cc._LogInfos.spriteFrameCache_addSpriteFrames, alias);
                        spAliases[alias] = key;
                    }
                }
                if (cc._renderType === cc.game.RENDER_TYPE_CANVAS && spriteFrame.isRotated()) {
                    var locTexture = spriteFrame.getTexture();
                    if (locTexture.isLoaded()) {
                        var tempElement = spriteFrame.getTexture().getHtmlElementObj();
                        tempElement = cc.Sprite.CanvasRenderCmd._cutRotateImageToCanvas(tempElement, spriteFrame.getRectInPixels());
                        var tempTexture = new cc.Texture2D();
                        tempTexture.initWithElement(tempElement);
                        tempTexture.handleLoadedTexture();
                        spriteFrame.setTexture(tempTexture);
                        var rect = spriteFrame._rect;
                        spriteFrame.setRect(cc.rect(0, 0, rect.width, rect.height));
                    }
                }
                spriteFrames[key] = spriteFrame;
            }
        }
    },
    addSpriteFrames: function (url, texture) {
        cc.assert(url, cc._LogInfos.spriteFrameCache_addSpriteFrames_2);
        var dict = this._frameConfigCache[url] || cc.loader.getRes(url);
        if(!dict || !dict["frames"])
            return;
        var frameConfig = this._frameConfigCache[url] || this._getFrameConfig(url);
        this._createSpriteFrames(url, frameConfig, texture);
    },
    _checkConflict: function (dictionary) {
        var framesDict = dictionary["frames"];
        for (var key in framesDict) {
            if (this._spriteFrames[key]) {
                cc.log(cc._LogInfos.spriteFrameCache__checkConflict, key);
            }
        }
    },
    addSpriteFrame: function (frame, frameName) {
        this._spriteFrames[frameName] = frame;
    },
    removeSpriteFrames: function () {
        this._spriteFrames = {};
        this._spriteFramesAliases = {};
    },
    removeSpriteFrameByName: function (name) {
        if (!name) {
            return;
        }
        if (this._spriteFramesAliases[name]) {
            delete(this._spriteFramesAliases[name]);
        }
        if (this._spriteFrames[name]) {
            delete(this._spriteFrames[name]);
        }
    },
    removeSpriteFramesFromFile: function (url) {
        var self = this, spriteFrames = self._spriteFrames,
            aliases = self._spriteFramesAliases, cfg = self._frameConfigCache[url];
        if(!cfg) return;
        var frames = cfg.frames;
        for (var key in frames) {
            if (spriteFrames[key]) {
                delete(spriteFrames[key]);
                for (var alias in aliases) {//remove alias
                    if(aliases[alias] === key) delete aliases[alias];
                }
            }
        }
    },
    removeSpriteFramesFromTexture: function (texture) {
        var self = this, spriteFrames = self._spriteFrames, aliases = self._spriteFramesAliases;
        for (var key in spriteFrames) {
            var frame = spriteFrames[key];
            if (frame && (frame.getTexture() === texture)) {
                delete(spriteFrames[key]);
                for (var alias in aliases) {//remove alias
                    if(aliases[alias] === key) delete aliases[alias];
                }
            }
        }
    },
    getSpriteFrame: function (name) {
        var self = this, frame = self._spriteFrames[name];
        if (!frame) {
            var key = self._spriteFramesAliases[name];
            if (key) {
                frame = self._spriteFrames[key.toString()];
                if(!frame) delete self._spriteFramesAliases[name];
            }
        }
        return frame;
    },
	_clear: function () {
		this._spriteFrames = {};
		this._spriteFramesAliases = {};
		this._frameConfigCache = {};
	}
};
cc.g_NumberOfDraws = 0;
cc.Director = cc.Class.extend({
    _landscape: false,
    _nextDeltaTimeZero: false,
    _paused: false,
    _purgeDirectorInNextLoop: false,
    _sendCleanupToScene: false,
    _animationInterval: 0.0,
    _oldAnimationInterval: 0.0,
    _projection: 0,
    _contentScaleFactor: 1.0,
    _deltaTime: 0.0,
    _winSizeInPoints: null,
    _lastUpdate: null,
    _nextScene: null,
    _notificationNode: null,
    _openGLView: null,
    _scenesStack: null,
    _projectionDelegate: null,
    _runningScene: null,
    _totalFrames: 0,
    _secondsPerFrame: 0,
    _dirtyRegion: null,
    _scheduler: null,
    _actionManager: null,
    _eventProjectionChanged: null,
    _eventAfterUpdate: null,
    _eventAfterVisit: null,
    _eventAfterDraw: null,
    ctor: function () {
        var self = this;
        self._lastUpdate = Date.now();
        cc.eventManager.addCustomListener(cc.game.EVENT_SHOW, function () {
            self._lastUpdate = Date.now();
        });
    },
    init: function () {
        this._oldAnimationInterval = this._animationInterval = 1.0 / cc.defaultFPS;
        this._scenesStack = [];
        this._projection = cc.Director.PROJECTION_DEFAULT;
        this._projectionDelegate = null;
        this._totalFrames = 0;
        this._lastUpdate = Date.now();
        this._paused = false;
        this._purgeDirectorInNextLoop = false;
        this._winSizeInPoints = cc.size(0, 0);
        this._openGLView = null;
        this._contentScaleFactor = 1.0;
        this._scheduler = new cc.Scheduler();
        if(cc.ActionManager){
            this._actionManager = new cc.ActionManager();
            this._scheduler.scheduleUpdate(this._actionManager, cc.Scheduler.PRIORITY_SYSTEM, false);
        }else{
            this._actionManager = null;
        }
        this._eventAfterUpdate = new cc.EventCustom(cc.Director.EVENT_AFTER_UPDATE);
        this._eventAfterUpdate.setUserData(this);
        this._eventAfterVisit = new cc.EventCustom(cc.Director.EVENT_AFTER_VISIT);
        this._eventAfterVisit.setUserData(this);
        this._eventAfterDraw = new cc.EventCustom(cc.Director.EVENT_AFTER_DRAW);
        this._eventAfterDraw.setUserData(this);
        this._eventProjectionChanged = new cc.EventCustom(cc.Director.EVENT_PROJECTION_CHANGED);
        this._eventProjectionChanged.setUserData(this);
        return true;
    },
    calculateDeltaTime: function () {
        var now = Date.now();
        if (this._nextDeltaTimeZero) {
            this._deltaTime = 0;
            this._nextDeltaTimeZero = false;
        } else {
            this._deltaTime = (now - this._lastUpdate) / 1000;
        }
        if ((cc.game.config[cc.game.CONFIG_KEY.debugMode] > 0) && (this._deltaTime > 0.2))
            this._deltaTime = 1 / 60.0;
        this._lastUpdate = now;
    },
    convertToGL: function (uiPoint) {
        var docElem = document.documentElement;
        var view = cc.view;
        var box = element.getBoundingClientRect();
        box.left += window.pageXOffset - docElem.clientLeft;
        box.top += window.pageYOffset - docElem.clientTop;
        var x = view._devicePixelRatio * (uiPoint.x - box.left);
        var y = view._devicePixelRatio * (box.top + box.height - uiPoint.y);
        return view._isRotated ? {x: view._viewPortRect.width - y, y: x} : {x: x, y: y};
    },
    convertToUI: function (glPoint) {
        var docElem = document.documentElement;
        var view = cc.view;
        var box = element.getBoundingClientRect();
        box.left += window.pageXOffset - docElem.clientLeft;
        box.top += window.pageYOffset - docElem.clientTop;
        var uiPoint = {x: 0, y: 0};
        if (view._isRotated) {
            uiPoint.x = box.left + glPoint.y / view._devicePixelRatio;
            uiPoint.y = box.top + box.height - (view._viewPortRect.width - glPoint.x) / view._devicePixelRatio;
        }
        else {
            uiPoint.x = box.left + glPoint.x / view._devicePixelRatio;
            uiPoint.y = box.top + box.height - glPoint.y / view._devicePixelRatio;
        }
        return uiPoint;
    },
    drawScene: function () {
        var renderer = cc.renderer;
        this.calculateDeltaTime();
        if (!this._paused) {
            this._scheduler.update(this._deltaTime);
            cc.eventManager.dispatchEvent(this._eventAfterUpdate);
        }
        if (this._nextScene) {
            this.setNextScene();
        }
        if (this._beforeVisitScene)
            this._beforeVisitScene();
        if (this._runningScene) {
            if (renderer.childrenOrderDirty) {
                cc.renderer.clearRenderCommands();
                cc.renderer.assignedZ = 0;
                this._runningScene._renderCmd._curLevel = 0;
                this._runningScene.visit();
                renderer.resetFlag();
            }
            else if (renderer.transformDirty()) {
                renderer.transform();
            }
        }
        renderer.clear();
        if (this._notificationNode)
            this._notificationNode.visit();
        cc.eventManager.dispatchEvent(this._eventAfterVisit);
        cc.g_NumberOfDraws = 0;
        if (this._afterVisitScene)
            this._afterVisitScene();
        renderer.rendering(cc._renderContext);
        this._totalFrames++;
        cc.eventManager.dispatchEvent(this._eventAfterDraw);
        this._calculateMPF();
    },
    _beforeVisitScene: null,
    _afterVisitScene: null,
    end: function () {
        this._purgeDirectorInNextLoop = true;
    },
    getContentScaleFactor: function () {
        return this._contentScaleFactor;
    },
    getNotificationNode: function () {
        return this._notificationNode;
    },
    getWinSize: function () {
        return cc.size(this._winSizeInPoints);
    },
    getWinSizeInPixels: function () {
        return cc.size(this._winSizeInPoints.width * this._contentScaleFactor, this._winSizeInPoints.height * this._contentScaleFactor);
    },
    getVisibleSize: null,
    getVisibleOrigin: null,
    getZEye: null,
    pause: function () {
        if (this._paused)
            return;
        this._oldAnimationInterval = this._animationInterval;
        this.setAnimationInterval(1 / 4.0);
        this._paused = true;
    },
    popScene: function () {
        cc.assert(this._runningScene, cc._LogInfos.Director_popScene);
        this._scenesStack.pop();
        var c = this._scenesStack.length;
        if (c === 0)
            this.end();
        else {
            this._sendCleanupToScene = true;
            this._nextScene = this._scenesStack[c - 1];
        }
    },
    purgeCachedData: function () {
        cc.animationCache._clear();
        cc.spriteFrameCache._clear();
        cc.textureCache._clear();
    },
    purgeDirector: function () {
        this.getScheduler().unscheduleAll();
        if (cc.eventManager)
            cc.eventManager.setEnabled(false);
        if (this._runningScene) {
            this._runningScene.onExitTransitionDidStart();
            this._runningScene.onExit();
            this._runningScene.cleanup();
        }
        this._runningScene = null;
        this._nextScene = null;
        this._scenesStack.length = 0;
        this.stopAnimation();
        this.purgeCachedData();
        cc.checkGLErrorDebug();
    },
    pushScene: function (scene) {
        cc.assert(scene, cc._LogInfos.Director_pushScene);
        this._sendCleanupToScene = false;
        this._scenesStack.push(scene);
        this._nextScene = scene;
    },
    runScene: function (scene) {
        cc.assert(scene, cc._LogInfos.Director_pushScene);
        if (!this._runningScene) {
            this.pushScene(scene);
            this.startAnimation();
        } else {
            var i = this._scenesStack.length;
            if (i === 0) {
                this._sendCleanupToScene = true;
                this._scenesStack[i] = scene;
                this._nextScene = scene;
            } else {
                this._sendCleanupToScene = true;
                this._scenesStack[i - 1] = scene;
                this._nextScene = scene;
            }
        }
    },
    resume: function () {
        if (!this._paused) {
            return;
        }
        this.setAnimationInterval(this._oldAnimationInterval);
        this._lastUpdate = Date.now();
        if (!this._lastUpdate) {
            cc.log(cc._LogInfos.Director_resume);
        }
        this._paused = false;
        this._deltaTime = 0;
    },
    setContentScaleFactor: function (scaleFactor) {
        if (scaleFactor !== this._contentScaleFactor) {
            this._contentScaleFactor = scaleFactor;
        }
    },
    setDepthTest: null,
    setClearColor: null,
    setDefaultValues: function () {
    },
    setNextDeltaTimeZero: function (nextDeltaTimeZero) {
        this._nextDeltaTimeZero = nextDeltaTimeZero;
    },
    setNextScene: function () {
        var runningIsTransition = false, newIsTransition = false;
        if (cc.TransitionScene) {
            runningIsTransition = this._runningScene ? this._runningScene instanceof cc.TransitionScene : false;
            newIsTransition = this._nextScene ? this._nextScene instanceof cc.TransitionScene : false;
        }
        if (!newIsTransition) {
            var locRunningScene = this._runningScene;
            if (locRunningScene) {
                locRunningScene.onExitTransitionDidStart();
                locRunningScene.onExit();
            }
            if (this._sendCleanupToScene && locRunningScene)
                locRunningScene.cleanup();
        }
        this._runningScene = this._nextScene;
        cc.renderer.childrenOrderDirty = true;
        this._nextScene = null;
        if ((!runningIsTransition) && (this._runningScene !== null)) {
            this._runningScene.onEnter();
            this._runningScene.onEnterTransitionDidFinish();
        }
    },
    setNotificationNode: function (node) {
        cc.renderer.childrenOrderDirty = true;
        if(this._notificationNode){
            this._notificationNode.onExitTransitionDidStart();
            this._notificationNode.onExit();
            this._notificationNode.cleanup();
        }
        this._notificationNode = node;
        if(!node)
            return;
        this._notificationNode.onEnter();
        this._notificationNode.onEnterTransitionDidFinish();
    },
    getDelegate: function () {
        return this._projectionDelegate;
    },
    setDelegate: function (delegate) {
        this._projectionDelegate = delegate;
    },
    setOpenGLView: null,
    setProjection: null,
    setViewport: null,
    getOpenGLView: null,
    getProjection: null,
    setAlphaBlending: null,
    isSendCleanupToScene: function () {
        return this._sendCleanupToScene;
    },
    getRunningScene: function () {
        return this._runningScene;
    },
    getAnimationInterval: function () {
        return this._animationInterval;
    },
    isDisplayStats: function () {
        return cc.profiler ? cc.profiler.isShowingStats() : false;
    },
    setDisplayStats: function (displayStats) {
        if (cc.profiler) {
            displayStats ? cc.profiler.showStats() : cc.profiler.hideStats();
        }
    },
    getSecondsPerFrame: function () {
        return this._secondsPerFrame;
    },
    isNextDeltaTimeZero: function () {
        return this._nextDeltaTimeZero;
    },
    isPaused: function () {
        return this._paused;
    },
    getTotalFrames: function () {
        return this._totalFrames;
    },
    popToRootScene: function () {
        this.popToSceneStackLevel(1);
    },
    popToSceneStackLevel: function (level) {
        cc.assert(this._runningScene, cc._LogInfos.Director_popToSceneStackLevel_2);
        var locScenesStack = this._scenesStack;
        var c = locScenesStack.length;
        if (level === 0) {
            this.end();
            return;
        }
        if (level >= c)
            return;
        while (c > level) {
            var current = locScenesStack.pop();
            if (current.running) {
                current.onExitTransitionDidStart();
                current.onExit();
            }
            current.cleanup();
            c--;
        }
        this._nextScene = locScenesStack[locScenesStack.length - 1];
        this._sendCleanupToScene = true;
    },
    getScheduler: function () {
        return this._scheduler;
    },
    setScheduler: function (scheduler) {
        if (this._scheduler !== scheduler) {
            this._scheduler = scheduler;
        }
    },
    getActionManager: function () {
        return this._actionManager;
    },
    setActionManager: function (actionManager) {
        if (this._actionManager !== actionManager) {
            this._actionManager = actionManager;
        }
    },
    getDeltaTime: function () {
        return this._deltaTime;
    },
    _calculateMPF: function () {
        var now = Date.now();
        this._secondsPerFrame = (now - this._lastUpdate) / 1000;
    }
});
cc.Director.EVENT_PROJECTION_CHANGED = "director_projection_changed";
cc.Director.EVENT_AFTER_UPDATE = "director_after_update";
cc.Director.EVENT_AFTER_VISIT = "director_after_visit";
cc.Director.EVENT_AFTER_DRAW = "director_after_draw";
cc.DisplayLinkDirector = cc.Director.extend({
    invalid: false,
    startAnimation: function () {
        this._nextDeltaTimeZero = true;
        this.invalid = false;
    },
    mainLoop: function () {
        if (this._purgeDirectorInNextLoop) {
            this._purgeDirectorInNextLoop = false;
            this.purgeDirector();
        }
        else if (!this.invalid) {
            this.drawScene();
        }
    },
    stopAnimation: function () {
        this.invalid = true;
    },
    setAnimationInterval: function (value) {
        this._animationInterval = value;
        if (!this.invalid) {
            this.stopAnimation();
            this.startAnimation();
        }
    }
});
cc.Director.sharedDirector = null;
cc.Director.firstUseDirector = true;
cc.Director._getInstance = function () {
    if (cc.Director.firstUseDirector) {
        cc.Director.firstUseDirector = false;
        cc.Director.sharedDirector = new cc.DisplayLinkDirector();
        cc.Director.sharedDirector.init();
    }
    return cc.Director.sharedDirector;
};
cc.defaultFPS = 60;
cc.Director.PROJECTION_2D = 0;
cc.Director.PROJECTION_3D = 1;
cc.Director.PROJECTION_CUSTOM = 3;
cc.Director.PROJECTION_DEFAULT = cc.Director.PROJECTION_2D;
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType === cc.game.RENDER_TYPE_CANVAS) {
        var _p = cc.Director.prototype;
        _p.getProjection = function (projection) {
            return this._projection;
        };
        _p.setProjection = function (projection) {
            this._projection = projection;
            cc.eventManager.dispatchEvent(this._eventProjectionChanged);
        };
        _p.setDepthTest = function () {
        };
        _p.setClearColor = function (clearColor) {
            cc.renderer._clearColor = clearColor;
            cc.renderer._clearFillStyle = 'rgb(' + clearColor.r + ',' + clearColor.g + ',' + clearColor.b +')' ;
        };
        _p.setOpenGLView = function (openGLView) {
            this._winSizeInPoints.width = cc._canvas.width;
            this._winSizeInPoints.height = cc._canvas.height;
            this._openGLView = openGLView || cc.view;
            if (cc.eventManager)
                cc.eventManager.setEnabled(true);
        };
        _p.getVisibleSize = function () {
            return this.getWinSize();
        };
        _p.getVisibleOrigin = function () {
            return cc.p(0, 0);
        };
    } else {
        cc.Director._fpsImage = new Image();
        cc.Director._fpsImage.addEventListener("load", function () {
            cc.Director._fpsImageLoaded = true;
        });
        if (cc._fpsImage) {
            cc.Director._fpsImage.src = cc._fpsImage;
        }
    }
});
cc.PRIORITY_NON_SYSTEM = cc.PRIORITY_SYSTEM + 1;
cc.ListEntry = function (prev, next, callback, target, priority, paused, markedForDeletion) {
    this.prev = prev;
    this.next = next;
    this.callback = callback;
    this.target = target;
    this.priority = priority;
    this.paused = paused;
    this.markedForDeletion = markedForDeletion;
};
cc.HashUpdateEntry = function (list, entry, target, callback, hh) {
    this.list = list;
    this.entry = entry;
    this.target = target;
    this.callback = callback;
    this.hh = hh;
};
cc.HashTimerEntry = cc.hashSelectorEntry = function (timers, target, timerIndex, currentTimer, currentTimerSalvaged, paused, hh) {
    var _t = this;
    _t.timers = timers;
    _t.target = target;
    _t.timerIndex = timerIndex;
    _t.currentTimer = currentTimer;
    _t.currentTimerSalvaged = currentTimerSalvaged;
    _t.paused = paused;
    _t.hh = hh;
};
cc.Timer = cc.Class.extend({
    _scheduler: null,
    _elapsed:0.0,
    _runForever:false,
    _useDelay:false,
    _timesExecuted:0,
    _repeat:0,
    _delay:0,
    _interval:0.0,
    getInterval : function(){return this._interval;},
    setInterval : function(interval){this._interval = interval;},
    setupTimerWithInterval: function(seconds, repeat, delay){
        this._elapsed = -1;
        this._interval = seconds;
        this._delay = delay;
        this._useDelay = (this._delay > 0);
        this._repeat = repeat;
        this._runForever = (this._repeat === cc.REPEAT_FOREVER);
    },
    trigger: function(){
        return 0;
    },
    cancel: function(){
        return 0;
    },
    ctor:function () {
        this._scheduler = null;
        this._elapsed = -1;
        this._runForever = false;
        this._useDelay = false;
        this._timesExecuted = 0;
        this._repeat = 0;
        this._delay = 0;
        this._interval = 0;
    },
    update:function (dt) {
        if (this._elapsed === -1) {
            this._elapsed = 0;
            this._timesExecuted = 0;
        } else {
            this._elapsed += dt;
            if (this._runForever && !this._useDelay) {//standard timer usage
                if (this._elapsed >= this._interval) {
                    this.trigger();
                    this._elapsed = 0;
                }
            } else {//advanced usage
                if (this._useDelay) {
                    if (this._elapsed >= this._delay) {
                        this.trigger();
                        this._elapsed -= this._delay;
                        this._timesExecuted += 1;
                        this._useDelay = false;
                    }
                } else {
                    if (this._elapsed >= this._interval) {
                        this.trigger();
                        this._elapsed = 0;
                        this._timesExecuted += 1;
                    }
                }
                if (!this._runForever && this._timesExecuted > this._repeat)
                    this.cancel();
            }
        }
    }
});
cc.TimerTargetSelector = cc.Timer.extend({
    _target: null,
    _selector: null,
    ctor: function(){
        this._target = null;
        this._selector = null;
    },
    initWithSelector: function(scheduler, selector, target, seconds, repeat, delay){
        this._scheduler = scheduler;
        this._target = target;
        this._selector = selector;
        this.setupTimerWithInterval(seconds, repeat, delay);
        return true;
    },
    getSelector: function(){
        return this._selector;
    },
    trigger: function(){
        if (this._target && this._selector){
            this._target.call(this._selector, this._elapsed);
        }
    },
    cancel: function(){
        this._scheduler.unschedule(this._selector, this._target);
    }
});
cc.TimerTargetCallback = cc.Timer.extend({
    _target: null,
    _callback: null,
    _key: null,
    ctor: function(){
        this._target = null;
        this._callback = null;
    },
    initWithCallback: function(scheduler, callback, target, key, seconds, repeat, delay){
        this._scheduler = scheduler;
        this._target = target;
        this._callback = callback;
        this._key = key;
        this.setupTimerWithInterval(seconds, repeat, delay);
        return true;
    },
    getCallback: function(){
        return this._callback;
    },
    getKey: function(){
        return this._key;
    },
    trigger: function(){
        if(this._callback)
            this._callback.call(this._target, this._elapsed);
    },
    cancel: function(){
        this._scheduler.unschedule(this._callback, this._target);
    }
});
cc.Scheduler = cc.Class.extend({
    _timeScale:1.0,
    _updatesNegList: null,
    _updates0List: null,
    _updatesPosList: null,
    _hashForTimers:null,
    _arrayForTimers:null,
    _hashForUpdates:null,
    _currentTarget:null,
    _currentTargetSalvaged:false,
    _updateHashLocked:false,
    ctor:function () {
        this._timeScale = 1.0;
        this._updatesNegList = [];
        this._updates0List = [];
        this._updatesPosList = [];
        this._hashForUpdates = {};
        this._hashForTimers = {};
        this._currentTarget = null;
        this._currentTargetSalvaged = false;
        this._updateHashLocked = false;
        this._arrayForTimers = [];
    },
    _schedulePerFrame: function(callback, target, priority, paused){
        var hashElement = this._hashForUpdates[target.__instanceId];
        if (hashElement && hashElement.entry){
            if (hashElement.entry.priority !== priority){
                if (this._updateHashLocked){
                    cc.log("warning: you CANNOT change update priority in scheduled function");
                    hashElement.entry.markedForDeletion = false;
                    hashElement.entry.paused = paused;
                    return;
                }else{
                    this.unscheduleUpdate(target);
                }
            }else{
                hashElement.entry.markedForDeletion = false;
                hashElement.entry.paused = paused;
                return;
            }
        }
        if (priority === 0){
            this._appendIn(this._updates0List, callback, target, paused);
        }else if (priority < 0){
            this._priorityIn(this._updatesNegList, callback, target, priority, paused);
        }else{
            this._priorityIn(this._updatesPosList, callback, target, priority, paused);
        }
    },
    _removeHashElement:function (element) {
        delete this._hashForTimers[element.target.__instanceId];
        cc.arrayRemoveObject(this._arrayForTimers, element);
        element.Timer = null;
        element.target = null;
        element = null;
    },
    _removeUpdateFromHash:function (entry) {
        var self = this, element = self._hashForUpdates[entry.target.__instanceId];
        if (element) {
            cc.arrayRemoveObject(element.list, element.entry);
            delete self._hashForUpdates[element.target.__instanceId];
            element.entry = null;
            element.target = null;
        }
    },
    _priorityIn:function (ppList, callback,  target, priority, paused) {
        var self = this,
            listElement = new cc.ListEntry(null, null, callback, target, priority, paused, false);
        if (!ppList) {
            ppList = [];
            ppList.push(listElement);
        } else {
            var index2Insert = ppList.length - 1;
            for(var i = 0; i <= index2Insert; i++){
                if (priority < ppList[i].priority) {
                    index2Insert = i;
                    break;
                }
            }
            ppList.splice(i, 0, listElement);
        }
        self._hashForUpdates[target.__instanceId] = new cc.HashUpdateEntry(ppList, listElement, target, null);
        return ppList;
    },
    _appendIn:function (ppList, callback, target, paused) {
        var self = this, listElement = new cc.ListEntry(null, null, callback, target, 0, paused, false);
        ppList.push(listElement);
        self._hashForUpdates[target.__instanceId] = new cc.HashUpdateEntry(ppList, listElement, target, null, null);
    },
    setTimeScale:function (timeScale) {
        this._timeScale = timeScale;
    },
    getTimeScale:function () {
        return this._timeScale;
    },
    update:function (dt) {
        this._updateHashLocked = true;
        if(this._timeScale !== 1)
            dt *= this._timeScale;
        var i, list, len, entry;
        for(i=0,list=this._updatesNegList, len = list.length; i<len; i++){
            entry = list[i];
            if(!entry.paused && !entry.markedForDeletion)
                entry.callback(dt);
        }
        for(i=0, list=this._updates0List, len=list.length; i<len; i++){
            entry = list[i];
            if (!entry.paused && !entry.markedForDeletion)
                entry.callback(dt);
        }
        for(i=0, list=this._updatesPosList, len=list.length; i<len; i++){
            entry = list[i];
            if (!entry.paused && !entry.markedForDeletion)
                entry.callback(dt);
        }
        var elt, arr = this._arrayForTimers;
        for(i=0; i<arr.length; i++){
            elt = arr[i];
            this._currentTarget = elt;
            this._currentTargetSalvaged = false;
            if (!elt.paused){
                for (elt.timerIndex = 0; elt.timerIndex < elt.timers.length; ++(elt.timerIndex)){
                    elt.currentTimer = elt.timers[elt.timerIndex];
                    elt.currentTimerSalvaged = false;
                    elt.currentTimer.update(dt);
                    elt.currentTimer = null;
                }
            }
            if (this._currentTargetSalvaged && this._currentTarget.timers.length === 0)
                this._removeHashElement(this._currentTarget);
        }
        for(i=0,list=this._updatesNegList; i<list.length; ){
            entry = list[i];
            if(entry.markedForDeletion)
                this._removeUpdateFromHash(entry);
            else
                i++;
        }
        for(i=0, list=this._updates0List; i<list.length; ){
            entry = list[i];
            if (entry.markedForDeletion)
                this._removeUpdateFromHash(entry);
            else
                i++;
        }
        for(i=0, list=this._updatesPosList; i<list.length; ){
            entry = list[i];
            if (entry.markedForDeletion)
                this._removeUpdateFromHash(entry);
            else
                i++;
        }
        this._updateHashLocked = false;
        this._currentTarget = null;
    },
    scheduleCallbackForTarget: function(target, callback_fn, interval, repeat, delay, paused){
        this.schedule(callback_fn, target, interval, repeat, delay, paused, target.__instanceId + "");
    },
    schedule: function(callback, target, interval, repeat, delay, paused, key){
        var isSelector = false;
        if(typeof callback !== "function"){
            var selector = callback;
            isSelector = true;
        }
        if(isSelector === false){
            if(arguments.length === 4 || arguments.length === 5){
                key = delay;
                paused = repeat;
                delay = 0;
                repeat = cc.REPEAT_FOREVER;
            }
        }else{
            if(arguments.length === 4){
                paused = repeat;
                repeat = cc.REPEAT_FOREVER;
                delay = 0;
            }
        }
        if (key === undefined) {
            key = target.__instanceId + "";
        }
        cc.assert(target, cc._LogInfos.Scheduler_scheduleCallbackForTarget_3);
        var element = this._hashForTimers[target.__instanceId];
        if(!element){
            element = new cc.HashTimerEntry(null, target, 0, null, null, paused, null);
            this._arrayForTimers.push(element);
            this._hashForTimers[target.__instanceId] = element;
        }else{
            cc.assert(element.paused === paused, "");
        }
        var timer, i;
        if (element.timers == null) {
            element.timers = [];
        } else if(isSelector === false) {
            for (i = 0; i < element.timers.length; i++) {
                timer = element.timers[i];
                if (callback === timer._callback) {
                    cc.log(cc._LogInfos.Scheduler_scheduleCallbackForTarget, timer.getInterval().toFixed(4), interval.toFixed(4));
                    timer._interval = interval;
                    return;
                }
            }
        }else{
            for (i = 0; i < element.timers.length; ++i){
                timer =element.timers[i];
                if (timer && selector === timer.getSelector()){
                    cc.log("CCScheduler#scheduleSelector. Selector already scheduled. Updating interval from: %.4f to %.4f", timer.getInterval(), interval);
                    timer.setInterval(interval);
                    return;
                }
            }
        }
        if(isSelector === false){
            timer = new cc.TimerTargetCallback();
            timer.initWithCallback(this, callback, target, key, interval, repeat, delay);
            element.timers.push(timer);
        }else{
            timer = new cc.TimerTargetSelector();
            timer.initWithSelector(this, selector, target, interval, repeat, delay);
            element.timers.push(timer);
        }
    },
    scheduleUpdate: function(target, priority, paused){
        this._schedulePerFrame(function(dt){
            target.update(dt);
        }, target, priority, paused);
    },
    _getUnscheduleMark: function(key, timer){
        switch (typeof key){
            case "number":
            case "string":
                return key === timer.getKey();
            case "function":
                return key === timer._callback;
            default:
                return key === timer.getSelector();
        }
    },
    unschedule: function(key, target){
        if (!target || !key)
            return;
        var self = this, element = self._hashForTimers[target.__instanceId];
        if (element) {
            var timers = element.timers;
            for(var i = 0, li = timers.length; i < li; i++){
                var timer = timers[i];
                if (this._getUnscheduleMark(key, timer)) {
                    if ((timer === element.currentTimer) && (!element.currentTimerSalvaged)) {
                        element.currentTimerSalvaged = true;
                    }
                    timers.splice(i, 1);
                    if (element.timerIndex >= i) {
                        element.timerIndex--;
                    }
                    if (timers.length === 0) {
                        if (self._currentTarget === element) {
                            self._currentTargetSalvaged = true;
                        } else {
                            self._removeHashElement(element);
                        }
                    }
                    return;
                }
            }
        }
    },
    unscheduleUpdate: function(target){
        if (target == null)
            return;
        var element = this._hashForUpdates[target.__instanceId];
        if (element){
            if (this._updateHashLocked){
                element.entry.markedForDeletion = true;
            }else{
                this._removeUpdateFromHash(element.entry);
            }
        }
    },
    unscheduleAllForTarget: function(target){
        if (target == null){
            return;
        }
        var element = this._hashForTimers[target.__instanceId];
        if (element){
            if (element.timers.indexOf(element.currentTimer) > -1
                && (! element.currentTimerSalvaged)){
                element.currentTimerSalvaged = true;
            }
            element.timers.length = 0;
            if (this._currentTarget === element){
                this._currentTargetSalvaged = true;
            }else{
                this._removeHashElement(element);
            }
        }
        this.unscheduleUpdate(target);
    },
    unscheduleAll: function(){
        this.unscheduleAllWithMinPriority(cc.Scheduler.PRIORITY_SYSTEM);
    },
    unscheduleAllWithMinPriority: function(minPriority){
        var i, element, arr = this._arrayForTimers;
        for(i=arr.length-1; i>=0; i--){
            element = arr[i];
            this.unscheduleAllForTarget(element.target);
        }
        var entry;
        var temp_length = 0;
        if(minPriority < 0){
            for(i=0; i<this._updatesNegList.length; ){
                temp_length = this._updatesNegList.length;
                entry = this._updatesNegList[i];
                if(entry && entry.priority >= minPriority)
                    this.unscheduleUpdate(entry.target);
                if (temp_length == this._updatesNegList.length)
                    i++;
            }
        }
        if(minPriority <= 0){
            for(i=0; i<this._updates0List.length; ){
                temp_length = this._updates0List.length;
                entry = this._updates0List[i];
                if (entry)
                    this.unscheduleUpdate(entry.target);
                if (temp_length == this._updates0List.length)
                    i++;
            }
        }
        for(i=0; i<this._updatesPosList.length; ){
            temp_length = this._updatesPosList.length;
            entry = this._updatesPosList[i];
            if(entry && entry.priority >= minPriority)
                this.unscheduleUpdate(entry.target);
            if (temp_length == this._updatesPosList.length)
                i++;
        }
    },
    isScheduled: function(key, target){
        cc.assert(key, "Argument key must not be empty");
        cc.assert(target, "Argument target must be non-nullptr");
        var element = this._hashForUpdates[target.__instanceId];
        if (!element){
            return false;
        }
        if (element.timers == null){
            return false;
        }else{
            var timers = element.timers;
            for (var i = 0; i < timers.length; ++i){
                var timer =  timers[i];
                if (key === timer.getKey()){
                    return true;
                }
            }
            return false;
        }
    },
    pauseAllTargets:function () {
        return this.pauseAllTargetsWithMinPriority(cc.Scheduler.PRIORITY_SYSTEM);
    },
    pauseAllTargetsWithMinPriority:function (minPriority) {
        var idsWithSelectors = [];
        var self = this, element, locArrayForTimers = self._arrayForTimers;
        var i, li;
        for(i = 0, li = locArrayForTimers.length; i < li; i++){
            element = locArrayForTimers[i];
            if (element) {
                element.paused = true;
                idsWithSelectors.push(element.target);
            }
        }
        var entry;
        if(minPriority < 0){
            for(i=0; i<this._updatesNegList.length; i++){
                entry = this._updatesNegList[i];
                if (entry) {
                    if(entry.priority >= minPriority){
						entry.paused = true;
                        idsWithSelectors.push(entry.target);
                    }
                }
            }
        }
        if(minPriority <= 0){
            for(i=0; i<this._updates0List.length; i++){
                entry = this._updates0List[i];
                if (entry) {
					entry.paused = true;
                    idsWithSelectors.push(entry.target);
                }
            }
        }
        for(i=0; i<this._updatesPosList.length; i++){
            entry = this._updatesPosList[i];
            if (entry) {
                if(entry.priority >= minPriority){
					entry.paused = true;
                    idsWithSelectors.push(entry.target);
                }
            }
        }
        return idsWithSelectors;
    },
    resumeTargets:function (targetsToResume) {
        if (!targetsToResume)
            return;
        for (var i = 0; i < targetsToResume.length; i++) {
            this.resumeTarget(targetsToResume[i]);
        }
    },
    pauseTarget:function (target) {
        cc.assert(target, cc._LogInfos.Scheduler_pauseTarget);
        var self = this, element = self._hashForTimers[target.__instanceId];
        if (element) {
            element.paused = true;
        }
        var elementUpdate = self._hashForUpdates[target.__instanceId];
        if (elementUpdate) {
            elementUpdate.entry.paused = true;
        }
    },
    resumeTarget:function (target) {
        cc.assert(target, cc._LogInfos.Scheduler_resumeTarget);
        var self = this, element = self._hashForTimers[target.__instanceId];
        if (element) {
            element.paused = false;
        }
        var elementUpdate = self._hashForUpdates[target.__instanceId];
        if (elementUpdate) {
            elementUpdate.entry.paused = false;
        }
    },
    isTargetPaused:function (target) {
        cc.assert(target, cc._LogInfos.Scheduler_isTargetPaused);
        var element = this._hashForTimers[target.__instanceId];
        if (element) {
            return element.paused;
        }
        var elementUpdate = this._hashForUpdates[target.__instanceId];
        if (elementUpdate) {
            return elementUpdate.entry.paused;
        }
        return false;
    },
    scheduleUpdateForTarget: function(target, priority, paused){
        this.scheduleUpdate(target, priority, paused);
    },
    unscheduleCallbackForTarget:function (target, callback) {
        this.unschedule(callback, target);
    },
    unscheduleUpdateForTarget:function (target) {
        this.unscheduleUpdate(target);
    },
    unscheduleAllCallbacksForTarget: function(target){
        this.unschedule(target.__instanceId + "", target);
    },
    unscheduleAllCallbacks: function(){
        this.unscheduleAllWithMinPriority(cc.Scheduler.PRIORITY_SYSTEM);
    },
    unscheduleAllCallbacksWithMinPriority:function (minPriority) {
        this.unscheduleAllWithMinPriority(minPriority);
    }
});
cc.Scheduler.PRIORITY_SYSTEM = (-2147483647 - 1);
cc._tmp.PrototypeLabelTTF = function () {
    var _p = cc.LabelTTF.prototype;
    cc.defineGetterSetter(_p, "color", _p.getColor, _p.setColor);
    cc.defineGetterSetter(_p, "opacity", _p.getOpacity, _p.setOpacity);
    _p.string;
    cc.defineGetterSetter(_p, "string", _p.getString, _p.setString);
    _p.textAlign;
    cc.defineGetterSetter(_p, "textAlign", _p.getHorizontalAlignment, _p.setHorizontalAlignment);
    _p.verticalAlign;
    cc.defineGetterSetter(_p, "verticalAlign", _p.getVerticalAlignment, _p.setVerticalAlignment);
    _p.fontSize;
    cc.defineGetterSetter(_p, "fontSize", _p.getFontSize, _p.setFontSize);
    _p.fontName;
    cc.defineGetterSetter(_p, "fontName", _p.getFontName, _p.setFontName);
    _p.font;
    cc.defineGetterSetter(_p, "font", _p._getFont, _p._setFont);
    _p.boundingSize;
    _p.boundingWidth;
    cc.defineGetterSetter(_p, "boundingWidth", _p._getBoundingWidth, _p._setBoundingWidth);
    _p.boundingHeight;
    cc.defineGetterSetter(_p, "boundingHeight", _p._getBoundingHeight, _p._setBoundingHeight);
    _p.fillStyle;
    cc.defineGetterSetter(_p, "fillStyle", _p._getFillStyle, _p.setFontFillColor);
    _p.strokeStyle;
    cc.defineGetterSetter(_p, "strokeStyle", _p._getStrokeStyle, _p._setStrokeStyle);
    _p.lineWidth;
    cc.defineGetterSetter(_p, "lineWidth", _p._getLineWidth, _p._setLineWidth);
    _p.shadowOffset;
    _p.shadowOffsetX;
    cc.defineGetterSetter(_p, "shadowOffsetX", _p._getShadowOffsetX, _p._setShadowOffsetX);
    _p.shadowOffsetY;
    cc.defineGetterSetter(_p, "shadowOffsetY", _p._getShadowOffsetY, _p._setShadowOffsetY);
    _p.shadowOpacity;
    cc.defineGetterSetter(_p, "shadowOpacity", _p._getShadowOpacity, _p._setShadowOpacity);
    _p.shadowBlur;
    cc.defineGetterSetter(_p, "shadowBlur", _p._getShadowBlur, _p._setShadowBlur);
};
cc.LabelTTF = cc.Sprite.extend({
    _dimensions: null,
    _hAlignment: cc.TEXT_ALIGNMENT_CENTER,
    _vAlignment: cc.VERTICAL_TEXT_ALIGNMENT_TOP,
    _fontName: null,
    _fontSize: 0.0,
    _string: "",
    _originalText: null,
    _onCacheCanvasMode: true,
    _shadowEnabled: false,
    _shadowOffset: null,
    _shadowOpacity: 0,
    _shadowBlur: 0,
    _shadowColor: null,
    _strokeEnabled: false,
    _strokeColor: null,
    _strokeSize: 0,
    _textFillColor: null,
    _strokeShadowOffsetX: 0,
    _strokeShadowOffsetY: 0,
    _needUpdateTexture: false,
    _lineWidths: null,
    _className: "LabelTTF",
    _fontStyle: "normal",
    _fontWeight: "normal",
    _lineHeight: "normal",
    initWithString: function (label, fontName, fontSize, dimensions, hAlignment, vAlignment) {
        var strInfo;
        if (label)
            strInfo = label + "";
        else
            strInfo = "";
        fontSize = fontSize || 16;
        dimensions = dimensions || cc.size(0, 0);
        hAlignment = hAlignment || cc.TEXT_ALIGNMENT_LEFT;
        vAlignment = vAlignment || cc.VERTICAL_TEXT_ALIGNMENT_TOP;
        this._opacityModifyRGB = false;
        this._dimensions = cc.size(dimensions.width, dimensions.height);
        this._fontName = fontName || "Arial";
        this._hAlignment = hAlignment;
        this._vAlignment = vAlignment;
        this._fontSize = fontSize;
        this._renderCmd._setFontStyle(this._fontName, fontSize, this._fontStyle, this._fontWeight);
        this.string = strInfo;
        this._renderCmd._setColorsString();
        this._renderCmd._updateTexture();
        this._setUpdateTextureDirty();
        this._scaleX = this._scaleY = 1 / cc.view.getDevicePixelRatio();
        return true;
    },
    _setUpdateTextureDirty: function () {
        this._needUpdateTexture = true;
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.textDirty);
    },
    ctor: function (text, fontName, fontSize, dimensions, hAlignment, vAlignment) {
        cc.Sprite.prototype.ctor.call(this);
        this._dimensions = cc.size(0, 0);
        this._hAlignment = cc.TEXT_ALIGNMENT_LEFT;
        this._vAlignment = cc.VERTICAL_TEXT_ALIGNMENT_TOP;
        this._opacityModifyRGB = false;
        this._fontName = "Arial";
        this._shadowEnabled = false;
        this._shadowOffset = cc.p(0, 0);
        this._shadowOpacity = 0;
        this._shadowBlur = 0;
        this._strokeEnabled = false;
        this._strokeColor = cc.color(255, 255, 255, 255);
        this._strokeSize = 0;
        this._textFillColor = cc.color(255, 255, 255, 255);
        this._strokeShadowOffsetX = 0;
        this._strokeShadowOffsetY = 0;
        this._needUpdateTexture = false;
        this._lineWidths = [];
        this._renderCmd._setColorsString();
        this._textureLoaded = true;
        if (fontName && fontName instanceof cc.FontDefinition) {
            this.initWithStringAndTextDefinition(text, fontName);
        } else {
            cc.LabelTTF.prototype.initWithString.call(this, text, fontName, fontSize, dimensions, hAlignment, vAlignment);
        }
    },
    init: function () {
        return this.initWithString(" ", this._fontName, this._fontSize);
    },
    description: function () {
        return "<cc.LabelTTF | FontName =" + this._fontName + " FontSize = " + this._fontSize.toFixed(1) + ">";
    },
    getLineHeight: function () {
        return !this._lineHeight || this._lineHeight.charAt ?
            this._renderCmd._getFontClientHeight() :
            this._lineHeight || this._renderCmd._getFontClientHeight();
    },
    setLineHeight: function (lineHeight) {
        this._lineHeight = lineHeight;
    },
    getString: function () {
        return this._string;
    },
    getHorizontalAlignment: function () {
        return this._hAlignment;
    },
    getVerticalAlignment: function () {
        return this._vAlignment;
    },
    getDimensions: function () {
        return cc.size(this._dimensions);
    },
    getFontSize: function () {
        return this._fontSize;
    },
    getFontName: function () {
        return this._fontName;
    },
    initWithStringAndTextDefinition: function (text, textDefinition) {
        this._updateWithTextDefinition(textDefinition, false);
        this.string = text;
        return true;
    },
    setTextDefinition: function (theDefinition) {
        if (theDefinition)
            this._updateWithTextDefinition(theDefinition, true);
    },
    getTextDefinition: function () {
        return this._prepareTextDefinition(false);
    },
    enableShadow: function (a, b, c, d) {
        if (a.r != null && a.g != null && a.b != null && a.a != null) {
            this._enableShadow(a, b, c);
        } else {
            this._enableShadowNoneColor(a, b, c, d);
        }
    },
    _enableShadowNoneColor: function (shadowOffsetX, shadowOffsetY, shadowOpacity, shadowBlur) {
        shadowOpacity = shadowOpacity || 0.5;
        if (false === this._shadowEnabled)
            this._shadowEnabled = true;
        var locShadowOffset = this._shadowOffset;
        if (locShadowOffset && (locShadowOffset.x !== shadowOffsetX) || (locShadowOffset._y !== shadowOffsetY)) {
            locShadowOffset.x = shadowOffsetX;
            locShadowOffset.y = shadowOffsetY;
        }
        if (this._shadowOpacity !== shadowOpacity) {
            this._shadowOpacity = shadowOpacity;
        }
        this._renderCmd._setColorsString();
        if (this._shadowBlur !== shadowBlur)
            this._shadowBlur = shadowBlur;
        this._setUpdateTextureDirty();
    },
    _enableShadow: function (shadowColor, offset, blurRadius) {
        if (!this._shadowColor) {
            this._shadowColor = cc.color(255, 255, 255, 128);
        }
        this._shadowColor.r = shadowColor.r;
        this._shadowColor.g = shadowColor.g;
        this._shadowColor.b = shadowColor.b;
        var x, y, a, b;
        x = offset.width || offset.x || 0;
        y = offset.height || offset.y || 0;
        a = (shadowColor.a != null) ? (shadowColor.a / 255) : 0.5;
        b = blurRadius;
        this._enableShadowNoneColor(x, y, a, b);
    },
    _getShadowOffsetX: function () {
        return this._shadowOffset.x;
    },
    _setShadowOffsetX: function (x) {
        if (false === this._shadowEnabled)
            this._shadowEnabled = true;
        if (this._shadowOffset.x !== x) {
            this._shadowOffset.x = x;
            this._setUpdateTextureDirty();
        }
    },
    _getShadowOffsetY: function () {
        return this._shadowOffset._y;
    },
    _setShadowOffsetY: function (y) {
        if (false === this._shadowEnabled)
            this._shadowEnabled = true;
        if (this._shadowOffset._y !== y) {
            this._shadowOffset._y = y;
            this._setUpdateTextureDirty();
        }
    },
    _getShadowOffset: function () {
        return cc.p(this._shadowOffset.x, this._shadowOffset.y);
    },
    _setShadowOffset: function (offset) {
        if (false === this._shadowEnabled)
            this._shadowEnabled = true;
        if (this._shadowOffset.x !== offset.x || this._shadowOffset.y !== offset.y) {
            this._shadowOffset.x = offset.x;
            this._shadowOffset.y = offset.y;
            this._setUpdateTextureDirty();
        }
    },
    _getShadowOpacity: function () {
        return this._shadowOpacity;
    },
    _setShadowOpacity: function (shadowOpacity) {
        if (false === this._shadowEnabled)
            this._shadowEnabled = true;
        if (this._shadowOpacity !== shadowOpacity) {
            this._shadowOpacity = shadowOpacity;
            this._renderCmd._setColorsString();
            this._setUpdateTextureDirty();
        }
    },
    _getShadowBlur: function () {
        return this._shadowBlur;
    },
    _setShadowBlur: function (shadowBlur) {
        if (false === this._shadowEnabled)
            this._shadowEnabled = true;
        if (this._shadowBlur !== shadowBlur) {
            this._shadowBlur = shadowBlur;
            this._setUpdateTextureDirty();
        }
    },
    disableShadow: function () {
        if (this._shadowEnabled) {
            this._shadowEnabled = false;
            this._setUpdateTextureDirty();
        }
    },
    enableStroke: function (strokeColor, strokeSize) {
        if (this._strokeEnabled === false)
            this._strokeEnabled = true;
        var locStrokeColor = this._strokeColor;
        if ((locStrokeColor.r !== strokeColor.r) || (locStrokeColor.g !== strokeColor.g) || (locStrokeColor.b !== strokeColor.b)) {
            locStrokeColor.r = strokeColor.r;
            locStrokeColor.g = strokeColor.g;
            locStrokeColor.b = strokeColor.b;
            this._renderCmd._setColorsString();
        }
        if (this._strokeSize !== strokeSize)
            this._strokeSize = strokeSize || 0;
        this._setUpdateTextureDirty();
    },
    _getStrokeStyle: function () {
        return this._strokeColor;
    },
    _setStrokeStyle: function (strokeStyle) {
        if (this._strokeEnabled === false)
            this._strokeEnabled = true;
        var locStrokeColor = this._strokeColor;
        if ((locStrokeColor.r !== strokeStyle.r) || (locStrokeColor.g !== strokeStyle.g) || (locStrokeColor.b !== strokeStyle.b)) {
            locStrokeColor.r = strokeStyle.r;
            locStrokeColor.g = strokeStyle.g;
            locStrokeColor.b = strokeStyle.b;
            this._renderCmd._setColorsString();
            this._setUpdateTextureDirty();
        }
    },
    _getLineWidth: function () {
        return this._strokeSize;
    },
    _setLineWidth: function (lineWidth) {
        if (this._strokeEnabled === false)
            this._strokeEnabled = true;
        if (this._strokeSize !== lineWidth) {
            this._strokeSize = lineWidth || 0;
            this._setUpdateTextureDirty();
        }
    },
    disableStroke: function () {
        if (this._strokeEnabled) {
            this._strokeEnabled = false;
            this._setUpdateTextureDirty();
        }
    },
    setFontFillColor: function (fillColor) {
        var locTextFillColor = this._textFillColor;
        if (locTextFillColor.r !== fillColor.r || locTextFillColor.g !== fillColor.g || locTextFillColor.b !== fillColor.b) {
            locTextFillColor.r = fillColor.r;
            locTextFillColor.g = fillColor.g;
            locTextFillColor.b = fillColor.b;
            this._renderCmd._setColorsString();
            this._needUpdateTexture = true;
        }
    },
    _getFillStyle: function () {
        return this._textFillColor;
    },
    _updateWithTextDefinition: function (textDefinition, mustUpdateTexture) {
        if (textDefinition.fontDimensions) {
            this._dimensions.width = textDefinition.boundingWidth;
            this._dimensions.height = textDefinition.boundingHeight;
        } else {
            this._dimensions.width = 0;
            this._dimensions.height = 0;
        }
        this._hAlignment = textDefinition.textAlign;
        this._vAlignment = textDefinition.verticalAlign;
        this._fontName = textDefinition.fontName;
        this._fontSize = textDefinition.fontSize || 12;
        if(textDefinition.lineHeight)
            this._lineHeight = textDefinition.lineHeight
        else
            this._lineHeight = this._fontSize;
        this._renderCmd._setFontStyle(textDefinition);
        if (textDefinition.shadowEnabled)
            this.enableShadow(textDefinition.shadowOffsetX,
                textDefinition.shadowOffsetY,
                textDefinition.shadowOpacity,
                textDefinition.shadowBlur);
        if (textDefinition.strokeEnabled)
            this.enableStroke(textDefinition.strokeStyle, textDefinition.lineWidth);
        this.setFontFillColor(textDefinition.fillStyle);
        if (mustUpdateTexture)
            this._renderCmd._updateTexture();
        var flags = cc.Node._dirtyFlags;
        this._renderCmd.setDirtyFlag(flags.colorDirty|flags.opacityDirty|flags.textDirty);
    },
    _prepareTextDefinition: function (adjustForResolution) {
        var texDef = new cc.FontDefinition();
        if (adjustForResolution) {
            texDef.fontSize = this._fontSize;
            texDef.boundingWidth = cc.contentScaleFactor() * this._dimensions.width;
            texDef.boundingHeight = cc.contentScaleFactor() * this._dimensions.height;
        } else {
            texDef.fontSize = this._fontSize;
            texDef.boundingWidth = this._dimensions.width;
            texDef.boundingHeight = this._dimensions.height;
        }
        texDef.fontName = this._fontName;
        texDef.textAlign = this._hAlignment;
        texDef.verticalAlign = this._vAlignment;
        if (this._strokeEnabled) {
            texDef.strokeEnabled = true;
            var locStrokeColor = this._strokeColor;
            texDef.strokeStyle = cc.color(locStrokeColor.r, locStrokeColor.g, locStrokeColor.b);
            texDef.lineWidth = this._strokeSize;
        } else
            texDef.strokeEnabled = false;
        if (this._shadowEnabled) {
            texDef.shadowEnabled = true;
            texDef.shadowBlur = this._shadowBlur;
            texDef.shadowOpacity = this._shadowOpacity;
            texDef.shadowOffsetX = (adjustForResolution ? cc.contentScaleFactor() : 1) * this._shadowOffset.x;
            texDef.shadowOffsetY = (adjustForResolution ? cc.contentScaleFactor() : 1) * this._shadowOffset.y;
        } else
            texDef._shadowEnabled = false;
        var locTextFillColor = this._textFillColor;
        texDef.fillStyle = cc.color(locTextFillColor.r, locTextFillColor.g, locTextFillColor.b);
        return texDef;
    },
    getScale: function () {
        if (this._scaleX !== this._scaleY)
            cc.log(cc._LogInfos.Node_getScale);
        return this._scaleX * cc.view.getDevicePixelRatio();
    },
    setScale: function (scale, scaleY) {
        this._scaleX = scale / cc.view.getDevicePixelRatio();
        this._scaleY = ((scaleY || scaleY === 0) ? scaleY : scale) /
            cc.view.getDevicePixelRatio();
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getScaleX: function () {
        return this._scaleX * cc.view.getDevicePixelRatio();
    },
    setScaleX: function (newScaleX) {
        this._scaleX = newScaleX / cc.view.getDevicePixelRatio();
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    getScaleY: function () {
        return this._scaleY * cc.view.getDevicePixelRatio();
    },
    setScaleY: function (newScaleY) {
        this._scaleY = newScaleY / cc.view.getDevicePixelRatio();
        this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
    },
    setString: function (text) {
        text = String(text);
        if (this._originalText !== text) {
            this._originalText = text + "";
            this._updateString();
            this._setUpdateTextureDirty();
            this._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
        }
    },
    _updateString: function () {
        if ((!this._string || this._string === "") && this._string !== this._originalText)
            cc.renderer.childrenOrderDirty = true;
        this._string = this._originalText;
    },
    setHorizontalAlignment: function (alignment) {
        if (alignment !== this._hAlignment) {
            this._hAlignment = alignment;
            this._setUpdateTextureDirty();
        }
    },
    setVerticalAlignment: function (verticalAlignment) {
        if (verticalAlignment !== this._vAlignment) {
            this._vAlignment = verticalAlignment;
            this._setUpdateTextureDirty();
        }
    },
    setDimensions: function (dim, height) {
        var width;
        if (height === undefined) {
            width = dim.width;
            height = dim.height;
        } else
            width = dim;
        if (width !== this._dimensions.width || height !== this._dimensions.height) {
            this._dimensions.width = width;
            this._dimensions.height = height;
            this._updateString();
            this._setUpdateTextureDirty();
        }
    },
    _getBoundingWidth: function () {
        return this._dimensions.width;
    },
    _setBoundingWidth: function (width) {
        if (width !== this._dimensions.width) {
            this._dimensions.width = width;
            this._updateString();
            this._setUpdateTextureDirty();
        }
    },
    _getBoundingHeight: function () {
        return this._dimensions.height;
    },
    _setBoundingHeight: function (height) {
        if (height !== this._dimensions.height) {
            this._dimensions.height = height;
            this._updateString();
            this._setUpdateTextureDirty();
        }
    },
    setFontSize: function (fontSize) {
        if (this._fontSize !== fontSize) {
            this._fontSize = fontSize;
            this._renderCmd._setFontStyle(this._fontName, this._fontSize, this._fontStyle, this._fontWeight);
            this._setUpdateTextureDirty();
        }
    },
    setFontName: function (fontName) {
        if (this._fontName && this._fontName !== fontName) {
            this._fontName = fontName;
            this._renderCmd._setFontStyle(this._fontName, this._fontSize, this._fontStyle, this._fontWeight);
            this._setUpdateTextureDirty();
        }
    },
    _getFont: function () {
        return this._renderCmd._getFontStyle();
    },
    _setFont: function (fontStyle) {
        var res = cc.LabelTTF._fontStyleRE.exec(fontStyle);
        if (res) {
            this._fontSize = parseInt(res[1]);
            this._fontName = res[2];
            this._renderCmd._setFontStyle(this._fontName, this._fontSize, this._fontStyle, this._fontWeight);
            this._setUpdateTextureDirty();
        }
    },
    getContentSize: function () {
        if (this._needUpdateTexture)
            this._renderCmd._updateTTF();
        return cc.size(this._contentSize);
    },
    _getWidth: function () {
        if (this._needUpdateTexture)
            this._renderCmd._updateTTF();
        return this._contentSize.width;
    },
    _getHeight: function () {
        if (this._needUpdateTexture)
            this._renderCmd._updateTTF();
        return this._contentSize.height;
    },
    setTextureRect: function (rect, rotated, untrimmedSize) {
        cc.Sprite.prototype.setTextureRect.call(this, rect, rotated, untrimmedSize, false);
    },
    setDrawMode: function (onCacheMode) {
        this._onCacheCanvasMode = onCacheMode;
    },
    _createRenderCmd: function () {
        if (cc._renderType === cc.game.RENDER_TYPE_WEBGL)
            return new cc.LabelTTF.WebGLRenderCmd(this);
        else if (this._onCacheCanvasMode)
            return new cc.LabelTTF.CacheCanvasRenderCmd(this);
        else
            return new cc.LabelTTF.CanvasRenderCmd(this);
    },
    _setFontStyle: function(fontStyle){
        if (this._fontStyle !== fontStyle) {
            this._fontStyle = fontStyle;
            this._renderCmd._setFontStyle(this._fontName, this._fontSize, this._fontStyle, this._fontWeight);
            this._setUpdateTextureDirty();
        }
    },
    _getFontStyle: function(){
        return this._fontStyle;
    },
    _setFontWeight: function(fontWeight){
        if (this._fontWeight !== fontWeight) {
            this._fontWeight = fontWeight;
            this._renderCmd._setFontStyle(this._fontName, this._fontSize, this._fontStyle, this._fontWeight);
            this._setUpdateTextureDirty();
        }
    },
    _getFontWeight: function(){
        return this._fontWeight;
    }
});
cc.assert(cc.isFunction(cc._tmp.PrototypeLabelTTF), cc._LogInfos.MissingFile, "LabelTTFPropertyDefine.js");
cc._tmp.PrototypeLabelTTF();
delete cc._tmp.PrototypeLabelTTF;
cc.LabelTTF._fontStyleRE = /^(\d+)px\s+['"]?([\w\s\d]+)['"]?$/;
cc.LabelTTF.create = function (text, fontName, fontSize, dimensions, hAlignment, vAlignment) {
    return new cc.LabelTTF(text, fontName, fontSize, dimensions, hAlignment, vAlignment);
};
cc.LabelTTF.createWithFontDefinition = cc.LabelTTF.create;
cc.LabelTTF.__labelHeightDiv = document.createElement("div");
cc.LabelTTF.__labelHeightDiv.style.fontFamily = "Arial";
cc.LabelTTF.__labelHeightDiv.style.position = "absolute";
cc.LabelTTF.__labelHeightDiv.style.left = "-100px";
cc.LabelTTF.__labelHeightDiv.style.top = "-100px";
cc.LabelTTF.__labelHeightDiv.style.lineHeight = "normal";
document.body ?
    document.body.appendChild(cc.LabelTTF.__labelHeightDiv) :
    window.addEventListener('load', function () {
        this.removeEventListener('load', arguments.callee, false);
        document.body.appendChild(cc.LabelTTF.__labelHeightDiv);
    }, false);
cc.LabelTTF.__getFontHeightByDiv = function (fontName, fontSize) {
    var clientHeight, labelDiv = cc.LabelTTF.__labelHeightDiv;
    if(fontName instanceof cc.FontDefinition){
        var fontDef = fontName;
        clientHeight = cc.LabelTTF.__fontHeightCache[fontDef._getCanvasFontStr()];
        if (clientHeight > 0) return clientHeight;
        labelDiv.innerHTML = "ajghl~!";
        labelDiv.style.fontFamily = fontDef.fontName;
        labelDiv.style.fontSize = fontDef.fontSize + "px";
        labelDiv.style.fontStyle = fontDef.fontStyle;
        labelDiv.style.fontWeight = fontDef.fontWeight;
        clientHeight = labelDiv.clientHeight;
        cc.LabelTTF.__fontHeightCache[fontDef._getCanvasFontStr()] = clientHeight;
        labelDiv.innerHTML = "";
    }
    else {
        clientHeight = cc.LabelTTF.__fontHeightCache[fontName + "." + fontSize];
        if (clientHeight > 0) return clientHeight;
        labelDiv.innerHTML = "ajghl~!";
        labelDiv.style.fontFamily = fontName;
        labelDiv.style.fontSize = fontSize + "px";
        clientHeight = labelDiv.clientHeight;
        cc.LabelTTF.__fontHeightCache[fontName + "." + fontSize] = clientHeight;
        labelDiv.innerHTML = "";
    }
    return clientHeight;
};
cc.LabelTTF.__fontHeightCache = {};
cc.LabelTTF._textAlign = ["left", "center", "right"];
cc.LabelTTF._textBaseline = ["top", "middle", "bottom"];
cc.LabelTTF.wrapInspection = true;
cc.LabelTTF._wordRex = /([a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôû]+|\S)/;
cc.LabelTTF._symbolRex = /^[!,.:;}\]%\?>、‘“》？。，！]/;
cc.LabelTTF._lastWordRex = /([a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôû]+|\S)$/;
cc.LabelTTF._lastEnglish = /[a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôû]+$/;
cc.LabelTTF._firsrEnglish = /^[a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôû]/;
(function() {
    cc.LabelTTF.RenderCmd = function () {
        this._fontClientHeight = 18;
        this._fontStyleStr = "";
        this._shadowColorStr = "rgba(128, 128, 128, 0.5)";
        this._strokeColorStr = "";
        this._fillColorStr = "rgba(255,255,255,1)";
        this._labelCanvas = null;
        this._labelContext = null;
        this._lineWidths = [];
        this._strings = [];
        this._isMultiLine = false;
        this._status = [];
        this._renderingIndex = 0;
        this._texRect = cc.rect();
        this._canUseDirtyRegion = true;
    };
    var proto = cc.LabelTTF.RenderCmd.prototype;
    proto.constructor = cc.LabelTTF.RenderCmd;
    proto._setFontStyle = function (fontNameOrFontDef, fontSize, fontStyle, fontWeight) {
        if(fontNameOrFontDef instanceof cc.FontDefinition){
            this._fontStyleStr = fontNameOrFontDef._getCanvasFontStr();
            this._fontClientHeight = cc.LabelTTF.__getFontHeightByDiv(fontNameOrFontDef);
        }else {
            var deviceFontSize = fontSize * cc.view.getDevicePixelRatio();
            this._fontStyleStr = fontStyle + " " + fontWeight + " " + deviceFontSize + "px '" + fontNameOrFontDef + "'";
            this._fontClientHeight = cc.LabelTTF.__getFontHeightByDiv(fontNameOrFontDef, fontSize);
        }
    };
    proto._getFontStyle = function () {
        return this._fontStyleStr;
    };
    proto._getFontClientHeight = function () {
        return this._fontClientHeight;
    };
    proto._updateColor = function(){
        this._setColorsString();
        this._updateTexture();
    };
    proto._setColorsString = function () {
        var locDisplayColor = this._displayedColor, node = this._node,
            locShadowColor = node._shadowColor || this._displayedColor;
        var locStrokeColor = node._strokeColor, locFontFillColor = node._textFillColor;
        var dr = locDisplayColor.r / 255, dg = locDisplayColor.g / 255, db = locDisplayColor.b / 255;
        this._shadowColorStr = "rgba(" + (0 | (dr * locShadowColor.r)) + "," + (0 | ( dg * locShadowColor.g)) + ","
            + (0 | (db * locShadowColor.b)) + "," + node._shadowOpacity + ")";
        this._fillColorStr = "rgba(" + (0 | (dr * locFontFillColor.r)) + "," + (0 | (dg * locFontFillColor.g)) + ","
            + (0 | (db * locFontFillColor.b)) + ", 1)";
        this._strokeColorStr = "rgba(" + (0 | (dr * locStrokeColor.r)) + "," + (0 | (dg * locStrokeColor.g)) + ","
            + (0 | (db * locStrokeColor.b)) + ", 1)";
    };
    var localBB = new cc.Rect();
    proto.getLocalBB = function () {
        var node = this._node;
        localBB.x = localBB.y = 0;
        var pixelRatio = cc.view.getDevicePixelRatio();
        localBB.width = node._getWidth() * pixelRatio;
        localBB.height = node._getHeight() * pixelRatio;
        return localBB;
    };
    proto._updateTTF = function () {
        var node = this._node;
        var pixelRatio = cc.view.getDevicePixelRatio();
        var locDimensionsWidth = node._dimensions.width * pixelRatio, i, strLength;
        var locLineWidth = this._lineWidths;
        locLineWidth.length = 0;
        this._isMultiLine = false;
        this._measureConfig();
        if (locDimensionsWidth !== 0) {
            this._strings = node._string.split('\n');
            for (i = 0; i < this._strings.length; i++) {
                this._checkWarp(this._strings, i, locDimensionsWidth);
            }
        } else {
            this._strings = node._string.split('\n');
            for (i = 0, strLength = this._strings.length; i < strLength; i++) {
                locLineWidth.push(this._measure(this._strings[i]));
            }
        }
        if (this._strings.length > 1)
            this._isMultiLine = true;
        var locSize, locStrokeShadowOffsetX = 0, locStrokeShadowOffsetY = 0;
        if (node._strokeEnabled)
            locStrokeShadowOffsetX = locStrokeShadowOffsetY = node._strokeSize * 2;
        if (node._shadowEnabled) {
            var locOffsetSize = node._shadowOffset;
            locStrokeShadowOffsetX += Math.abs(locOffsetSize.x) * 2;
            locStrokeShadowOffsetY += Math.abs(locOffsetSize.y) * 2;
        }
        if (locDimensionsWidth === 0) {
            if (this._isMultiLine)
                locSize = cc.size(
                    Math.ceil(Math.max.apply(Math, locLineWidth) + locStrokeShadowOffsetX),
                    Math.ceil((this._fontClientHeight * pixelRatio * this._strings.length) + locStrokeShadowOffsetY));
            else
                locSize = cc.size(
                    Math.ceil(this._measure(node._string) + locStrokeShadowOffsetX),
                    Math.ceil(this._fontClientHeight * pixelRatio + locStrokeShadowOffsetY));
        } else {
            if (node._dimensions.height === 0) {
                if (this._isMultiLine)
                    locSize = cc.size(
                        Math.ceil(locDimensionsWidth + locStrokeShadowOffsetX),
                        Math.ceil((node.getLineHeight() * pixelRatio * this._strings.length) + locStrokeShadowOffsetY));
                else
                    locSize = cc.size(
                        Math.ceil(locDimensionsWidth + locStrokeShadowOffsetX),
                        Math.ceil(node.getLineHeight() * pixelRatio + locStrokeShadowOffsetY));
            } else {
                locSize = cc.size(
                    Math.ceil(locDimensionsWidth + locStrokeShadowOffsetX),
                    Math.ceil(node._dimensions.height * pixelRatio + locStrokeShadowOffsetY));
            }
        }
        if (node._getFontStyle() !== "normal") {
            locSize.width = Math.ceil(locSize.width + node._fontSize * 0.3);
        }
        if (this._strings.length === 0) {
            this._texRect.width = 1;
            this._texRect.height = locSize.height || 1;
        }
        else {
            this._texRect.width = locSize.width;
            this._texRect.height = locSize.height;
        }
        var nodeW = locSize.width / pixelRatio, nodeH = locSize.height / pixelRatio;
        node.setContentSize(nodeW, nodeH);
        node._strokeShadowOffsetX = locStrokeShadowOffsetX;
        node._strokeShadowOffsetY = locStrokeShadowOffsetY;
        var locAP = node._anchorPoint;
        this._anchorPointInPoints.x = (locStrokeShadowOffsetX * 0.5) + ((locSize.width - locStrokeShadowOffsetX) * locAP.x);
        this._anchorPointInPoints.y = (locStrokeShadowOffsetY * 0.5) + ((locSize.height - locStrokeShadowOffsetY) * locAP.y);
    };
    proto._saveStatus = function () {
        var node = this._node;
        var scale = cc.view.getDevicePixelRatio();
        var locStrokeShadowOffsetX = node._strokeShadowOffsetX, locStrokeShadowOffsetY = node._strokeShadowOffsetY;
        var locContentSizeHeight = node._contentSize.height * scale - locStrokeShadowOffsetY, locVAlignment = node._vAlignment,
            locHAlignment = node._hAlignment;
        var dx = locStrokeShadowOffsetX * 0.5,
            dy = locContentSizeHeight + locStrokeShadowOffsetY * 0.5;
        var xOffset = 0, yOffset = 0, OffsetYArray = [];
        var locContentWidth = node._contentSize.width * scale - locStrokeShadowOffsetX;
        var lineHeight = node.getLineHeight() * scale;
        var transformTop = (lineHeight - this._fontClientHeight * scale) / 2;
        if (locHAlignment === cc.TEXT_ALIGNMENT_RIGHT)
            xOffset += locContentWidth;
        else if (locHAlignment === cc.TEXT_ALIGNMENT_CENTER)
            xOffset += locContentWidth / 2;
        else
            xOffset += 0;
        if (this._isMultiLine) {
            var locStrLen = this._strings.length;
            if (locVAlignment === cc.VERTICAL_TEXT_ALIGNMENT_BOTTOM)
                yOffset = lineHeight - transformTop * 2 + locContentSizeHeight - lineHeight * locStrLen;
            else if (locVAlignment === cc.VERTICAL_TEXT_ALIGNMENT_CENTER)
                yOffset = (lineHeight - transformTop * 2) / 2 + (locContentSizeHeight - lineHeight * locStrLen) / 2;
            for (var i = 0; i < locStrLen; i++) {
                var tmpOffsetY = -locContentSizeHeight + (lineHeight * i + transformTop) + yOffset;
                OffsetYArray.push(tmpOffsetY);
            }
        } else {
            if (locVAlignment === cc.VERTICAL_TEXT_ALIGNMENT_BOTTOM) {
            } else if (locVAlignment === cc.VERTICAL_TEXT_ALIGNMENT_TOP) {
                yOffset -= locContentSizeHeight;
            } else {
                yOffset -= locContentSizeHeight * 0.5;
            }
            OffsetYArray.push(yOffset);
        }
        var tmpStatus = {
            contextTransform:cc.p(dx,dy),
            xOffset:xOffset,
            OffsetYArray:OffsetYArray
        };
        this._status.push(tmpStatus);
    };
    proto._drawTTFInCanvas = function (context) {
        if (!context)
            return;
        var locStatus = this._status.pop();
        context.setTransform(1, 0, 0, 1, locStatus.contextTransform.x, locStatus.contextTransform.y);
        var xOffset = locStatus.xOffset;
        var yOffsetArray = locStatus.OffsetYArray;
        this.drawLabels(context, xOffset, yOffsetArray);
    };
    proto._checkWarp = function (strArr, i, maxWidth) {
        var text = strArr[i];
        var allWidth = this._measure(text);
        if (allWidth > maxWidth && text.length > 1) {
            var fuzzyLen = text.length * ( maxWidth / allWidth ) | 0;
            var tmpText = text.substr(fuzzyLen);
            var width = allWidth - this._measure(tmpText);
            var sLine;
            var pushNum = 0;
            var checkWhile = 0;
            while (width > maxWidth && checkWhile++ < 100) {
                fuzzyLen *= maxWidth / width;
                fuzzyLen = fuzzyLen | 0;
                tmpText = text.substr(fuzzyLen);
                width = allWidth - this._measure(tmpText);
            }
            checkWhile = 0;
            while (width < maxWidth && checkWhile++ < 100) {
                if (tmpText) {
                    var exec = cc.LabelTTF._wordRex.exec(tmpText);
                    pushNum = exec ? exec[0].length : 1;
                    sLine = tmpText;
                }
                fuzzyLen = fuzzyLen + pushNum;
                tmpText = text.substr(fuzzyLen);
                width = allWidth - this._measure(tmpText);
            }
            fuzzyLen -= pushNum;
            if (fuzzyLen === 0) {
                fuzzyLen = 1;
                sLine = sLine.substr(1);
            }
            var sText = text.substr(0, fuzzyLen), result;
            if (cc.LabelTTF.wrapInspection) {
                if (cc.LabelTTF._symbolRex.test(sLine || tmpText)) {
                    result = cc.LabelTTF._lastWordRex.exec(sText);
                    fuzzyLen -= result ? result[0].length : 0;
                    if (fuzzyLen === 0) fuzzyLen = 1;
                    sLine = text.substr(fuzzyLen);
                    sText = text.substr(0, fuzzyLen);
                }
            }
            if (cc.LabelTTF._firsrEnglish.test(sLine)) {
                result = cc.LabelTTF._lastEnglish.exec(sText);
                if (result && sText !== result[0]) {
                    fuzzyLen -= result[0].length;
                    sLine = text.substr(fuzzyLen);
                    sText = text.substr(0, fuzzyLen);
                }
            }
            strArr[i] = sLine || tmpText;
            strArr.splice(i, 0, sText);
        }
    };
    proto.updateStatus = function () {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.textDirty)
            this._updateTexture();
        cc.Node.RenderCmd.prototype.updateStatus.call(this);
        if (this._dirtyFlag & flags.transformDirty){
            this.transform(this.getParentRenderCmd(), true);
            this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.transformDirty ^ this._dirtyFlag;
        }
    };
    proto._syncStatus = function (parentCmd) {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.textDirty)
            this._updateTexture();
        cc.Node.RenderCmd.prototype._syncStatus.call(this, parentCmd);
        if (cc._renderType === cc.game.RENDER_TYPE_WEBGL || locFlag & flags.transformDirty)
            this.transform(parentCmd);
    };
    proto.drawLabels = function (context, xOffset, yOffsetArray) {
        var node = this._node;
        if (node._shadowEnabled) {
            var locShadowOffset = node._shadowOffset;
            context.shadowColor = this._shadowColorStr;
            context.shadowOffsetX = locShadowOffset.x;
            context.shadowOffsetY = -locShadowOffset.y;
            context.shadowBlur = node._shadowBlur;
        }
        var locHAlignment = node._hAlignment,
            locVAlignment = node._vAlignment,
            locStrokeSize = node._strokeSize;
        if (context.font !== this._fontStyleStr)
            context.font = this._fontStyleStr;
        context.fillStyle = this._fillColorStr;
        var locStrokeEnabled = node._strokeEnabled;
        if (locStrokeEnabled) {
            context.lineWidth = locStrokeSize * 2;
            context.strokeStyle = this._strokeColorStr;
        }
        context.textBaseline = cc.LabelTTF._textBaseline[locVAlignment];
        context.textAlign = cc.LabelTTF._textAlign[locHAlignment];
        var locStrLen = this._strings.length;
        for (var i = 0; i < locStrLen; i++) {
            var line = this._strings[i];
            if (locStrokeEnabled)
                context.strokeText(line, xOffset, yOffsetArray[i]);
            context.fillText(line, xOffset, yOffsetArray[i]);
        }
        cc.g_NumberOfDraws++;
    };
})();
(function(){
    cc.LabelTTF.CacheRenderCmd = function (renderable) {
        cc.LabelTTF.RenderCmd.call(this,renderable);
        var locCanvas = this._labelCanvas = document.createElement("canvas");
        locCanvas.width = 1;
        locCanvas.height = 1;
        this._labelContext = locCanvas.getContext("2d");
        this._texRect = cc.rect();
    };
    cc.LabelTTF.CacheRenderCmd.prototype = Object.create( cc.LabelTTF.RenderCmd.prototype);
    cc.inject(cc.LabelTTF.RenderCmd.prototype, cc.LabelTTF.CacheRenderCmd.prototype);
    var proto = cc.LabelTTF.CacheRenderCmd.prototype;
    proto.constructor = cc.LabelTTF.CacheRenderCmd;
    proto._updateTexture = function () {
        this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.textDirty ^ this._dirtyFlag;
        var node = this._node;
        this._updateTTF();
        var width = this._texRect.width, height = this._texRect.height;
        var locContext = this._labelContext, locLabelCanvas = this._labelCanvas;
        if(!node._texture){
            var labelTexture = new cc.Texture2D();
            labelTexture.initWithElement(this._labelCanvas);
            node.setTexture(labelTexture);
        }
        if (node._string.length === 0) {
            locLabelCanvas.width = width;
            locLabelCanvas.height = height;
            node._texture && node._texture.handleLoadedTexture();
            node.setTextureRect(this._texRect);
            return true;
        }
        locContext.font = this._fontStyleStr;
        var flag = locLabelCanvas.width === width && locLabelCanvas.height === height;
        locLabelCanvas.width = this._texRect.width;
        locLabelCanvas.height = this._texRect.height;
        if (flag) locContext.clearRect(0, 0, width, height);
        this._saveStatus();
        this._drawTTFInCanvas(locContext);
        node._texture && node._texture.handleLoadedTexture();
        node.setTextureRect(this._texRect);
        return true;
    };
    proto._measureConfig = function () {
        this._labelContext.font = this._fontStyleStr;
    };
    proto._measure = function (text) {
        return this._labelContext.measureText(text).width;
    };
})();
(function(){
    cc.LabelTTF.CacheCanvasRenderCmd = function (renderable) {
        cc.Sprite.CanvasRenderCmd.call(this, renderable);
        cc.LabelTTF.CacheRenderCmd.call(this);
    };
    var proto = cc.LabelTTF.CacheCanvasRenderCmd.prototype = Object.create(cc.Sprite.CanvasRenderCmd.prototype);
    cc.inject(cc.LabelTTF.CacheRenderCmd.prototype, proto);
    proto.constructor = cc.LabelTTF.CacheCanvasRenderCmd;
})();
(function(){
    cc.LabelTTF.CanvasRenderCmd = function (renderable) {
        cc.Sprite.CanvasRenderCmd.call(this, renderable);
        cc.LabelTTF.RenderCmd.call(this);
    };
    cc.LabelTTF.CanvasRenderCmd.prototype = Object.create(cc.Sprite.CanvasRenderCmd.prototype);
    cc.inject(cc.LabelTTF.RenderCmd.prototype, cc.LabelTTF.CanvasRenderCmd.prototype);
    var proto = cc.LabelTTF.CanvasRenderCmd.prototype;
    proto.constructor = cc.LabelTTF.CanvasRenderCmd;
    proto._measureConfig = function () {};
    proto._measure = function (text) {
        var context = cc._renderContext.getContext();
        context.font = this._fontStyleStr;
        return context.measureText(text).width;
    };
    proto._updateTexture = function () {
        this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.textDirty ^ this._dirtyFlag;
        var node = this._node;
        var scale = cc.view.getDevicePixelRatio();
        this._updateTTF();
        if (node._string.length === 0) {
            node.setTextureRect(this._texRect);
            return true;
        }
        this._saveStatus();
        node.setTextureRect(this._texRect);
        return true;
    };
    proto.rendering = function(ctx) {
        var scaleX = cc.view.getScaleX(),
            scaleY = cc.view.getScaleY();
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext();
        if (!context)
            return;
        var node = this._node;
        wrapper.computeRealOffsetY();
        if(this._status.length <= 0)
            return;
        var locIndex = (this._renderingIndex >= this._status.length)? this._renderingIndex-this._status.length:this._renderingIndex;
        var status = this._status[locIndex];
        this._renderingIndex = locIndex+1;
        var locHeight = node._rect.height,
            locX = node._offsetPosition.x,
            locY = -node._offsetPosition.y - locHeight;
        var alpha = (this._displayedOpacity / 255);
        wrapper.setTransform(this._worldTransform, scaleX, scaleY);
        wrapper.setCompositeOperation(this._blendFuncStr);
        wrapper.setGlobalAlpha(alpha);
        wrapper.save();
        if (node._flippedX) {
            locX = -locX - node._rect.width;
            context.scale(-1, 1);
        }
        if (node._flippedY) {
            locY = node._offsetPosition.y;
            context.scale(1, -1);
        }
        var xOffset = status.xOffset + status.contextTransform.x + locX * scaleX;
        var yOffsetArray = [];
        var locStrLen = this._strings.length;
        for (var i = 0; i < locStrLen; i++)
            yOffsetArray.push(status.OffsetYArray[i] + status.contextTransform.y + locY * scaleY);
        this.drawLabels(context, xOffset, yOffsetArray);
        wrapper.restore();
    };
})();
var cc = cc || {};
cc._tmp = cc._tmp || {};
cc.associateWithNative = function (jsObj, superclass) {
};
cc.KEY = {
    none:0,
    back:6,
    menu:18,
    backspace:8,
    tab:9,
    enter:13,
    shift:16,
    ctrl:17,
    alt:18,
    pause:19,
    capslock:20,
    escape:27,
    space:32,
    pageup:33,
    pagedown:34,
    end:35,
    home:36,
    left:37,
    up:38,
    right:39,
    down:40,
    select:41,
    insert:45,
    Delete:46,
    0:48,
    1:49,
    2:50,
    3:51,
    4:52,
    5:53,
    6:54,
    7:55,
    8:56,
    9:57,
    a:65,
    b:66,
    c:67,
    d:68,
    e:69,
    f:70,
    g:71,
    h:72,
    i:73,
    j:74,
    k:75,
    l:76,
    m:77,
    n:78,
    o:79,
    p:80,
    q:81,
    r:82,
    s:83,
    t:84,
    u:85,
    v:86,
    w:87,
    x:88,
    y:89,
    z:90,
    num0:96,
    num1:97,
    num2:98,
    num3:99,
    num4:100,
    num5:101,
    num6:102,
    num7:103,
    num8:104,
    num9:105,
    '*':106,
    '+':107,
    '-':109,
    'numdel':110,
    '/':111,
    f1:112,
    f2:113,
    f3:114,
    f4:115,
    f5:116,
    f6:117,
    f7:118,
    f8:119,
    f9:120,
    f10:121,
    f11:122,
    f12:123,
    numlock:144,
    scrolllock:145,
    ';':186,
    semicolon:186,
    equal:187,
    '=':187,
    ',':188,
    comma:188,
    dash:189,
    '.':190,
    period:190,
    forwardslash:191,
    grave:192,
    '[':219,
    openbracket:219,
    backslash:220,
    ']':221,
    closebracket:221,
    quote:222,
    dpadLeft:1000,
    dpadRight:1001,
    dpadUp:1003,
    dpadDown:1004,
    dpadCenter:1005
};
cc.FMT_JPG = 0;
cc.FMT_PNG = 1;
cc.FMT_TIFF = 2;
cc.FMT_RAWDATA = 3;
cc.FMT_WEBP = 4;
cc.FMT_UNKNOWN = 5;
cc.getImageFormatByData = function (imgData) {
    if (imgData.length > 8 && imgData[0] === 0x89
        && imgData[1] === 0x50
        && imgData[2] === 0x4E
        && imgData[3] === 0x47
        && imgData[4] === 0x0D
        && imgData[5] === 0x0A
        && imgData[6] === 0x1A
        && imgData[7] === 0x0A) {
        return cc.FMT_PNG;
    }
    if (imgData.length > 2 && ((imgData[0] === 0x49 && imgData[1] === 0x49)
        || (imgData[0] === 0x4d && imgData[1] === 0x4d)
        || (imgData[0] === 0xff && imgData[1] === 0xd8))) {
        return cc.FMT_TIFF;
    }
	return cc.FMT_UNKNOWN;
};
cc.inherits = function (childCtor, parentCtor) {
    function tempCtor() {}
    tempCtor.prototype = parentCtor.prototype;
    childCtor.superClass_ = parentCtor.prototype;
    childCtor.prototype = new tempCtor();
    childCtor.prototype.constructor = childCtor;
};
cc.base = function(me, opt_methodName, var_args) {
    var caller = arguments.callee.caller;
    if (caller.superClass_) {
        ret = caller.superClass_.constructor.apply( me, Array.prototype.slice.call(arguments, 1));
        return ret;
    }
    var args = Array.prototype.slice.call(arguments, 2);
    var foundCaller = false;
    for (var ctor = me.constructor; ctor; ctor = ctor.superClass_ && ctor.superClass_.constructor) {
        if (ctor.prototype[opt_methodName] === caller) {
            foundCaller = true;
        } else if (foundCaller) {
            return ctor.prototype[opt_methodName].apply(me, args);
        }
    }
    if (me[opt_methodName] === caller) {
        return me.constructor.prototype[opt_methodName].apply(me, args);
    } else {
        throw Error(
            'cc.base called from a method of one name ' +
                'to a method of a different name');
    }
};
var GlobalVertexBuffer = (function () {
var VERTICES_SIZE = 888;
var GlobalVertexBuffer = function (gl) {
    this.gl = gl;
    this.vertexBuffer = gl.createBuffer();
    this.size = VERTICES_SIZE;
    this.byteLength = VERTICES_SIZE * 4 * cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
    this.data = new ArrayBuffer(this.byteLength);
    this.dataArray = new Float32Array(this.data);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.dataArray, gl.DYNAMIC_DRAW);
    this._dirty = false;
    this._spaces = {
        0: this.byteLength
    };
};
GlobalVertexBuffer.prototype = {
    constructor: GlobalVertexBuffer,
    allocBuffer: function (offset, size) {
        var space = this._spaces[offset];
        if (space && space >= size) {
            delete this._spaces[offset];
            if (space > size) {
                var newOffset = offset + size;
                this._spaces[newOffset] = space - size;
            }
            return true;
        }
        else {
            return false;
        }
    },
    requestBuffer: function (size) {
        var key, offset, available;
        for (key in this._spaces) {
            offset = parseInt(key);
            available = this._spaces[key];
            if (available >= size && this.allocBuffer(offset, size)) {
                return {
                    buffer: this,
                    offset: offset,
                    size: size
                };
            }
        }
        return null;
    },
    freeBuffer: function (offset, size) {
        var spaces = this._spaces;
        var i, key, end;
        for (key in spaces) {
            i = parseInt(key);
            if (i > offset) {
                break;
            }
            if (i + spaces[key] >= offset) {
                size = size + offset - i;
                offset = i;
                break;
            }
        }
        end = offset + size;
        if (this._spaces[end]) {
            size += this._spaces[end];
            delete this._spaces[end];
        }
        this._spaces[offset] = size;
    },
    setDirty: function () {
        this._dirty = true;
    },
    update: function () {
        if (this._dirty) {
            this.gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            this.gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dataArray);
            this._dirty = false;
        }
    },
    destroy: function () {
        this.gl.deleteBuffer(this.vertexBuffer);
        this.data = null;
        this.positions = null;
        this.colors = null;
        this.texCoords = null;
        this.vertexBuffer = null;
    }
};
return GlobalVertexBuffer;
})();
cc.rendererCanvas = {
    childrenOrderDirty: true,
    assignedZ: 0,
    assignedZStep: 1 / 10000,
    _transformNodePool: [],
    _renderCmds: [],
    _isCacheToCanvasOn: false,
    _cacheToCanvasCmds: {},
    _cacheInstanceIds: [],
    _currentID: 0,
    _clearColor: cc.color(),
    _clearFillStyle: "rgb(0, 0, 0)",
    _dirtyRegion: null,
    _allNeedDraw: true,
    _enableDirtyRegion: false,
    _debugDirtyRegion: false,
    _canUseDirtyRegion: false,
    _dirtyRegionCountThreshold: 10,
    getRenderCmd: function (renderableObject) {
        return renderableObject._createRenderCmd();
    },
    enableDirtyRegion: function (enabled) {
        this._enableDirtyRegion = enabled;
    },
    isDirtyRegionEnabled: function () {
        return this._enableDirtyRegion;
    },
    setDirtyRegionCountThreshold: function(threshold) {
        this._dirtyRegionCountThreshold = threshold;
    },
    _collectDirtyRegion: function () {
        var locCmds = this._renderCmds, i, len;
        var dirtyRegion = this._dirtyRegion;
        var dirtryRegionCount = 0;
        var result = true;
        var localStatus = cc.Node.CanvasRenderCmd.RegionStatus;
        for (i = 0, len = locCmds.length; i < len; i++) {
            var cmd = locCmds[i];
            var regionFlag = cmd._regionFlag;
            var oldRegion = cmd._oldRegion;
            var currentRegion = cmd._currentRegion;
            if (regionFlag > localStatus.NotDirty) {
                ++dirtryRegionCount;
                if(dirtryRegionCount > this._dirtyRegionCountThreshold)
                    result = false;
                if(result) {
                    (!currentRegion.isEmpty()) && dirtyRegion.addRegion(currentRegion);
                    if (cmd._regionFlag > localStatus.Dirty) {
                        (!oldRegion.isEmpty()) && dirtyRegion.addRegion(oldRegion);
                    }
                }
                cmd._regionFlag = localStatus.NotDirty;
            }
        }
        return result;
    },
    _beginDrawDirtyRegion: function (ctxWrapper) {
        var ctx = ctxWrapper.getContext();
        var dirtyList = this._dirtyRegion.getDirtyRegions();
        ctx.save();
        var scaleX = ctxWrapper._scaleX;
        var scaleY = ctxWrapper._scaleY;
        ctxWrapper.setTransform({a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0}, scaleX, scaleY);
        ctx.beginPath();
        for (var index = 0, count = dirtyList.length; index < count; ++index) {
            var region = dirtyList[index];
            ctx.rect(region._minX , -region._maxY , region._width , region._height );
        }
        ctx.clip();
    },
    _endDrawDirtyRegion: function (ctx) {
        ctx.restore();
    },
    _debugDrawDirtyRegion: function (ctxWrapper) {
        if (!this._debugDirtyRegion) return;
        var ctx = ctxWrapper.getContext();
        var dirtyList = this._dirtyRegion.getDirtyRegions();
        var scaleX = ctxWrapper._scaleX;
        var scaleY = ctxWrapper._scaleY;
        ctxWrapper.setTransform({a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0}, scaleX, scaleY);
        ctx.beginPath();
        for (var index = 0, count = dirtyList.length; index < count; ++index) {
            var region = dirtyList[index];
            ctx.rect(region._minX, -region._maxY , region._width , region._height );
        }
        var oldstyle = ctx.fillStyle;
        ctx.fillStyle = 'green';
        ctx.fill();
        ctx.fillStyle = oldstyle;
    },
    rendering: function (ctxWrapper) {
        var dirtyRegion = this._dirtyRegion = this._dirtyRegion || new cc.DirtyRegion();
        var viewport = cc._canvas;
        var wrapper = ctxWrapper || cc._renderContext;
        var ctx = wrapper.getContext();
        var scaleX = cc.view.getScaleX(),
            scaleY = cc.view.getScaleY();
        wrapper.setViewScale(scaleX, scaleY);
        wrapper.computeRealOffsetY();
        var dirtyList = this._dirtyRegion.getDirtyRegions();
        var locCmds = this._renderCmds, i, len;
        var allNeedDraw = this._allNeedDraw || !this._enableDirtyRegion || !this._canUseDirtyRegion;
        var collectResult = true;
        if (!allNeedDraw) {
            collectResult = this._collectDirtyRegion();
        }
        allNeedDraw = allNeedDraw || (!collectResult);
        if(!allNeedDraw) {
            this._beginDrawDirtyRegion(wrapper);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);
        if (this._clearColor.r !== 0 ||
            this._clearColor.g !== 0 ||
            this._clearColor.b !== 0) {
            wrapper.setFillStyle(this._clearFillStyle);
            wrapper.setGlobalAlpha(this._clearColor.a);
            ctx.fillRect(0, 0, viewport.width, viewport.height);
        }
        for (i = 0, len = locCmds.length; i < len; i++) {
            var cmd = locCmds[i];
            var needRendering = false;
            var cmdRegion = cmd._currentRegion;
            if (!cmdRegion || allNeedDraw) {
                needRendering = true;
            } else {
                for (var index = 0, count = dirtyList.length; index < count; ++index) {
                    if (dirtyList[index].intersects(cmdRegion)) {
                        needRendering = true;
                        break;
                    }
                }
            }
            if (needRendering) {
                cmd.rendering(wrapper, scaleX, scaleY);
            }
        }
        if (!allNeedDraw) {
            this._debugDrawDirtyRegion(wrapper);
            this._endDrawDirtyRegion(ctx);
        }
        dirtyRegion.clear();
        this._allNeedDraw = false;
    },
    _renderingToCacheCanvas: function (ctx, instanceID, scaleX, scaleY) {
        if (!ctx)
            cc.log("The context of RenderTexture is invalid.");
        scaleX = cc.isUndefined(scaleX) ? 1 : scaleX;
        scaleY = cc.isUndefined(scaleY) ? 1 : scaleY;
        instanceID = instanceID || this._currentID;
        var locCmds = this._cacheToCanvasCmds[instanceID], i, len;
        ctx.computeRealOffsetY();
        for (i = 0, len = locCmds.length; i < len; i++) {
            locCmds[i].rendering(ctx, scaleX, scaleY);
        }
        this._removeCache(instanceID);
        var locIDs = this._cacheInstanceIds;
        if (locIDs.length === 0)
            this._isCacheToCanvasOn = false;
        else
            this._currentID = locIDs[locIDs.length - 1];
    },
    _turnToCacheMode: function (renderTextureID) {
        this._isCacheToCanvasOn = true;
        renderTextureID = renderTextureID || 0;
        this._cacheToCanvasCmds[renderTextureID] = [];
        if (this._cacheInstanceIds.indexOf(renderTextureID) === -1)
            this._cacheInstanceIds.push(renderTextureID);
        this._currentID = renderTextureID;
    },
    _turnToNormalMode: function () {
        this._isCacheToCanvasOn = false;
    },
    _removeCache: function (instanceID) {
        instanceID = instanceID || this._currentID;
        var cmds = this._cacheToCanvasCmds[instanceID];
        if (cmds) {
            cmds.length = 0;
            delete this._cacheToCanvasCmds[instanceID];
        }
        var locIDs = this._cacheInstanceIds;
        cc.arrayRemoveObject(locIDs, instanceID);
    },
    resetFlag: function () {
        this.childrenOrderDirty = false;
        this._transformNodePool.length = 0;
    },
    transform: function () {
        var locPool = this._transformNodePool;
        locPool.sort(this._sortNodeByLevelAsc);
        for (var i = 0, len = locPool.length; i < len; i++) {
            if (locPool[i]._dirtyFlag !== 0)
                locPool[i].updateStatus();
        }
        locPool.length = 0;
    },
    transformDirty: function () {
        return this._transformNodePool.length > 0;
    },
    _sortNodeByLevelAsc: function (n1, n2) {
        return n1._curLevel - n2._curLevel;
    },
    pushDirtyNode: function (node) {
        this._transformNodePool.push(node);
    },
    clear: function () {
    },
    clearRenderCommands: function () {
        this._renderCmds.length = 0;
        this._cacheInstanceIds.length = 0;
        this._isCacheToCanvasOn = false;
        this._allNeedDraw = true;
        this._canUseDirtyRegion = true;
    },
    pushRenderCommand: function (cmd) {
        if (!cmd.needDraw())
            return;
        if (!cmd._canUseDirtyRegion) {
            this._canUseDirtyRegion = false;
        }
        if (this._isCacheToCanvasOn) {
            var currentId = this._currentID, locCmdBuffer = this._cacheToCanvasCmds;
            var cmdList = locCmdBuffer[currentId];
            if (cmdList.indexOf(cmd) === -1)
                cmdList.push(cmd);
        } else {
            if (this._renderCmds.indexOf(cmd) === -1)
                this._renderCmds.push(cmd);
        }
    }
};
(function () {
    cc.CanvasContextWrapper = function (context) {
        this._context = context;
        this._saveCount = 0;
        this._currentAlpha = context.globalAlpha;
        this._currentCompositeOperation = context.globalCompositeOperation;
        this._currentFillStyle = context.fillStyle;
        this._currentStrokeStyle = context.strokeStyle;
        this._offsetX = 0;
        this._offsetY = 0;
        this._realOffsetY = this.height;
        this._armatureMode = 0;
    };
    var proto = cc.CanvasContextWrapper.prototype;
    proto.resetCache = function () {
        var context = this._context;
        this._currentAlpha = context.globalAlpha;
        this._currentCompositeOperation = context.globalCompositeOperation;
        this._currentFillStyle = context.fillStyle;
        this._currentStrokeStyle = context.strokeStyle;
        this._realOffsetY = this._context.canvas.height + this._offsetY;
    };
    proto.setOffset = function (x, y) {
        this._offsetX = x;
        this._offsetY = y;
        this._realOffsetY = this._context.canvas.height + this._offsetY;
    };
    proto.computeRealOffsetY = function () {
        this._realOffsetY = this._context.canvas.height + this._offsetY;
    };
    proto.setViewScale = function (scaleX, scaleY) {
        this._scaleX = scaleX;
        this._scaleY = scaleY;
    };
    proto.getContext = function () {
        return this._context;
    };
    proto.save = function () {
        this._context.save();
        this._saveCount++;
    };
    proto.restore = function () {
        this._context.restore();
        this._saveCount--;
    };
    proto.setGlobalAlpha = function (alpha) {
        if (this._saveCount > 0) {
            this._context.globalAlpha = alpha;
        } else {
            if (this._currentAlpha !== alpha) {
                this._currentAlpha = alpha;
                this._context.globalAlpha = alpha;
            }
        }
    };
    proto.setCompositeOperation = function (compositionOperation) {
        if (this._saveCount > 0) {
            this._context.globalCompositeOperation = compositionOperation;
        } else {
            if (this._currentCompositeOperation !== compositionOperation) {
                this._currentCompositeOperation = compositionOperation;
                this._context.globalCompositeOperation = compositionOperation;
            }
        }
    };
    proto.setFillStyle = function (fillStyle) {
        if (this._saveCount > 0) {
            this._context.fillStyle = fillStyle;
        } else {
            if (this._currentFillStyle !== fillStyle) {
                this._currentFillStyle = fillStyle;
                this._context.fillStyle = fillStyle;
            }
        }
    };
    proto.setStrokeStyle = function (strokeStyle) {
        if (this._saveCount > 0) {
            this._context.strokeStyle = strokeStyle;
        } else {
            if (this._currentStrokeStyle !== strokeStyle) {
                this._currentStrokeStyle = strokeStyle;
                this._context.strokeStyle = strokeStyle;
            }
        }
    };
    proto.setTransform = function (t, scaleX, scaleY) {
        if (this._armatureMode > 0) {
            this.restore();
            this.save();
            this._context.transform(t.a * scaleX, -t.b * scaleY, -t.c * scaleX, t.d * scaleY, t.tx * scaleX, -(t.ty * scaleY));
        } else {
            this._context.setTransform(t.a * scaleX, -t.b * scaleY, -t.c * scaleX, t.d * scaleY, this._offsetX + t.tx * scaleX, this._realOffsetY - (t.ty * scaleY));
        }
    };
    proto._switchToArmatureMode = function (enable, t, scaleX, scaleY) {
        if (enable) {
            this._armatureMode++;
            this._context.setTransform(t.a, t.c, t.b, t.d, this._offsetX + t.tx * scaleX, this._realOffsetY - (t.ty * scaleY));
            this.save();
        } else {
            this._armatureMode--;
            this.restore();
        }
    };
})();
var Region = function () {
    this._minX = 0;
    this._minY = 0;
    this._maxX = 0;
    this._maxY = 0;
    this._width = 0;
    this._height = 0;
    this._area = 0;
};
var regionProto = Region.prototype;
var regionPool = [];
function regionCreate() {
    var region = regionPool.pop();
    if (!region) {
        region = new Region();
    }
    return region;
}
function regionRelease(region) {
    regionPool.push(region);
}
regionProto.setTo = function (minX, minY, maxX, maxY) {
    this._minX = minX;
    this._minY = minY;
    this._maxX = maxX;
    this._maxY = maxY;
    this.updateArea();
    return this;
};
regionProto.intValues = function () {
    this._minX = Math.floor(this._minX);
    this._minY = Math.floor(this._minY);
    this._maxX = Math.ceil(this._maxX);
    this._maxY = Math.ceil(this._maxY);
    this.updateArea();
};
regionProto.updateArea = function () {
    this._width = this._maxX - this._minX;
    this._height = this._maxY - this._minY;
    this._area = this._width * this._height;
};
regionProto.union = function (target) {
    if(this._width <= 0 || this._height <= 0) {
        this.setTo(target._minX, target._minY, target._maxX, target._maxY);
        return;
    }
    if (this._minX > target._minX) {
        this._minX = target._minX;
    }
    if (this._minY > target._minY) {
        this._minY = target._minY;
    }
    if (this._maxX < target._maxX) {
        this._maxX = target._maxX;
    }
    if (this._maxY < target._maxY) {
        this._maxY = target._maxY;
    }
    this.updateArea();
};
regionProto.setEmpty = function () {
    this._minX = 0;
    this._minY = 0;
    this._maxX = 0;
    this._maxY = 0;
    this._width = 0;
    this._height = 0;
    this._area = 0;
};
regionProto.isEmpty = function () {
    return this._width <= 0 || this._height <= 0;
};
regionProto.intersects = function (target) {
    if (this._width <= 0 || this._height <= 0 || target._width <= 0 || target._height <= 0) {
        return false;
    }
    var max = this._minX > target._minX ? this._minX : target._minX;
    var min = this._maxX < target._maxX ? this._maxX : target._maxX;
    if (max > min) {
        return false;
    }
    max = this._minY > target._minY ? this._minY : target._minY;
    min = this._maxY < target._maxY ? this._maxY : target._maxY;
    return max <= min;
};
regionProto.updateRegion = function (bounds, matrix) {
    if (bounds.width == 0 || bounds.height == 0) {
        this.setEmpty();
        return;
    }
    var m = matrix;
    var a = m.a;
    var b = m.b;
    var c = m.c;
    var d = m.d;
    var tx = m.tx;
    var ty = m.ty;
    var x = bounds.x;
    var y = bounds.y;
    var xMax = x + bounds.width;
    var yMax = y + bounds.height;
    var minX, minY, maxX, maxY;
    if (a == 1.0 && b == 0.0 && c == 0.0 && d == 1.0) {
        minX = x + tx - 1;
        minY = y + ty - 1;
        maxX = xMax + tx + 1;
        maxY = yMax + ty + 1;
    }
    else {
        var x0 = a * x + c * y + tx;
        var y0 = b * x + d * y + ty;
        var x1 = a * xMax + c * y + tx;
        var y1 = b * xMax + d * y + ty;
        var x2 = a * xMax + c * yMax + tx;
        var y2 = b * xMax + d * yMax + ty;
        var x3 = a * x + c * yMax + tx;
        var y3 = b * x + d * yMax + ty;
        var tmp = 0;
        if (x0 > x1) {
            tmp = x0;
            x0 = x1;
            x1 = tmp;
        }
        if (x2 > x3) {
            tmp = x2;
            x2 = x3;
            x3 = tmp;
        }
        minX = (x0 < x2 ? x0 : x2) - 1;
        maxX = (x1 > x3 ? x1 : x3) + 1;
        if (y0 > y1) {
            tmp = y0;
            y0 = y1;
            y1 = tmp;
        }
        if (y2 > y3) {
            tmp = y2;
            y2 = y3;
            y3 = tmp;
        }
        minY = (y0 < y2 ? y0 : y2) - 1;
        maxY = (y1 > y3 ? y1 : y3) + 1;
    }
    this._minX = minX;
    this._minY = minY;
    this._maxX = maxX;
    this._maxY = maxY;
    this._width = maxX - minX;
    this._height = maxY - minY;
    this._area = this._width * this._height;
};
function unionArea(r1, r2) {
    var minX = r1._minX < r2._minX ? r1._minX : r2._minX;
    var minY = r1._minY < r2._minY ? r1._minY : r2._minY;
    var maxX = r1._maxX > r2._maxX ? r1._maxX : r2._maxX;
    var maxY = r1._maxY > r2._maxY ? r1._maxY : r2._maxY;
    return (maxX - minX) * (maxY - minY);
}
var DirtyRegion = function() {
    this.dirtyList = [];
    this.hasClipRect = false;
    this.clipWidth = 0;
    this.clipHeight = 0;
    this.clipArea = 0;
    this.clipRectChanged = false;
};
var dirtyRegionProto = DirtyRegion.prototype;
dirtyRegionProto.setClipRect = function(width, height) {
    this.hasClipRect = true;
    this.clipRectChanged = true;
    this.clipWidth = Math.ceil(width);
    this.clipHeight = Math.ceil(height);
    this.clipArea = this.clipWidth * this.clipHeight;
};
dirtyRegionProto.addRegion = function(target) {
    var minX = target._minX, minY = target._minY, maxX = target._maxX, maxY = target._maxY;
    if (this.hasClipRect) {
        if (minX < 0) {
            minX = 0;
        }
        if (minY < 0) {
            minY = 0;
        }
        if (maxX > this.clipWidth) {
            maxX = this.clipWidth;
        }
        if (maxY > this.clipHeight) {
            maxY = this.clipHeight;
        }
    }
    if (minX >= maxX || minY >= maxY) {
        return false;
    }
    if (this.clipRectChanged) {
        return true;
    }
    var dirtyList = this.dirtyList;
    var region = regionCreate();
    dirtyList.push(region.setTo(minX, minY, maxX, maxY));
    this.mergeDirtyList(dirtyList);
    return true;
};
dirtyRegionProto.clear = function() {
    var dirtyList = this.dirtyList;
    var length = dirtyList.length;
    for (var i = 0; i < length; i++) {
        regionRelease(dirtyList[i]);
    }
    dirtyList.length = 0;
};
dirtyRegionProto.getDirtyRegions = function() {
    var dirtyList = this.dirtyList;
    if (this.clipRectChanged) {
        this.clipRectChanged = false;
        this.clear();
        var region = regionCreate();
        dirtyList.push(region.setTo(0, 0, this.clipWidth, this.clipHeight));
    }
    else {
        while (this.mergeDirtyList(dirtyList)) {
        }
    }
    var numDirty = this.dirtyList.length;
    if (numDirty > 0) {
        for (var i = 0; i < numDirty; i++) {
            this.dirtyList[i].intValues();
        }
    }
    return this.dirtyList;
};
dirtyRegionProto.mergeDirtyList = function(dirtyList) {
    var length = dirtyList.length;
    if (length < 2) {
        return false;
    }
    var hasClipRect = this.hasClipRect;
    var bestDelta = length > 3 ? Number.POSITIVE_INFINITY : 0;
    var mergeA = 0;
    var mergeB = 0;
    var totalArea = 0;
    for (var i = 0; i < length - 1; i++) {
        var regionA = dirtyList[i];
        hasClipRect && (totalArea += regionA.area);
        for (var j = i + 1; j < length; j++) {
            var regionB = dirtyList[j];
            var delta = unionArea(regionA, regionB) - regionA.area - regionB.area;
            if (bestDelta > delta) {
                mergeA = i;
                mergeB = j;
                bestDelta = delta;
            }
        }
    }
    if (hasClipRect && (totalArea / this.clipArea) > 0.95) {
        this.clipRectChanged = true;
    }
    if (mergeA != mergeB) {
        var region = dirtyList[mergeB];
        dirtyList[mergeA].union(region);
        regionRelease(region);
        dirtyList.splice(mergeB, 1);
        return true;
    }
    return false;
};
cc.Region = Region;
cc.DirtyRegion = DirtyRegion;
cc.profiler = (function () {
    var _showFPS = false;
    var _inited = false;
    var _frames = 0, _frameRate = 0, _lastSPF = 0, _accumDt = 0;
    var _afterVisitListener = null,
        _FPSLabel = document.createElement('div'),
        _SPFLabel = document.createElement('div'),
        _drawsLabel = document.createElement('div'),
        _fps = document.createElement('div');
    var LEVEL_DET_FACTOR = 0.6, _levelDetCycle = 10;
    var LEVELS = [0, 10, 20, 30];
    var _fpsCount = [0, 0, 0, 0];
    var _currLevel = 3, _analyseCount = 0, _totalFPS = 0;
    _fps.id = 'fps';
    _fps.style.position = 'absolute';
    _fps.style.padding = '3px';
    _fps.style.textAlign = 'left';
    _fps.style.backgroundColor = 'rgb(0, 0, 34)';
    _fps.style.bottom = cc.DIRECTOR_STATS_POSITION.y + '0px';
    _fps.style.left = cc.DIRECTOR_STATS_POSITION.x + 'px';
    _fps.style.width = '45px';
    _fps.style.height = '60px';
    var labels = [_drawsLabel, _SPFLabel, _FPSLabel];
    for (var i = 0; i < 3; ++i) {
        var style = labels[i].style;
        style.color = 'rgb(0, 255, 255)';
        style.font = 'bold 12px Helvetica, Arial';
        style.lineHeight = '20px';
        style.width = '100%';
        _fps.appendChild(labels[i]);
    }
    var analyseFPS = function (fps) {
        var lastId = LEVELS.length - 1, i = lastId, ratio, average = 0;
        _analyseCount++;
        _totalFPS += fps;
        for (; i >= 0; i--) {
            if (fps >= LEVELS[i]) {
                _fpsCount[i]++;
                break;
            }
        }
        if (_analyseCount >= _levelDetCycle) {
            average = _totalFPS / _levelDetCycle;
            for (i = lastId; i >0; i--) {
                ratio = _fpsCount[i] / _levelDetCycle;
                if (ratio >= LEVEL_DET_FACTOR && average >= LEVELS[i]) {
                    if (i != _currLevel) {
                        _currLevel = i;
                        profiler.onFrameRateChange && profiler.onFrameRateChange(average.toFixed(2));
                    }
                    break;
                }
            }
            _changeCount = 0;
            _analyseCount = 0;
            _totalFPS = 0;
            for (i = lastId; i > 0; i--) {
                _fpsCount[i] = 0;
            }
        }
    };
    var afterVisit = function () {
        _lastSPF = cc.director.getSecondsPerFrame();
        _frames++;
        _accumDt += cc.director.getDeltaTime();
        if (_accumDt > cc.DIRECTOR_FPS_INTERVAL) {
            _frameRate = _frames / _accumDt;
            _frames = 0;
            _accumDt = 0;
            if (profiler.onFrameRateChange) {
                analyseFPS(_frameRate);
            }
            if (_showFPS) {
                _SPFLabel.innerText = _lastSPF.toFixed(3);
                _FPSLabel.innerText = _frameRate.toFixed(1);
                _drawsLabel.innerText = (0 | cc.g_NumberOfDraws).toString();
            }
        }
    };
    var profiler = {
        onFrameRateChange: null,
        getSecondsPerFrame: function () {
            return _lastSPF;
        },
        getFrameRate: function () {
            return _frameRate;
        },
        setProfileDuration: function (duration) {
            if (!isNaN(duration) && duration > 0) {
                _levelDetCycle = duration / cc.DIRECTOR_FPS_INTERVAL;
            }
        },
        resumeProfiling: function () {
            cc.eventManager.addListener(_afterVisitListener, 1);
        },
        stopProfiling: function () {
            cc.eventManager.removeListener(_afterVisitListener);
        },
        isShowingStats: function () {
            return _showFPS;
        },
        showStats: function () {
            if (!_inited) {
                this.init();
            }
            if (_fps.parentElement === null) {
                cc.container.appendChild(_fps);
            }
            _showFPS = true;
        },
        hideStats: function () {
            _showFPS = false;
            if (_fps.parentElement === cc.container) {
                cc.container.removeChild(_fps);
            }
        },
        init: function () {
            if (!_inited) {
                _afterVisitListener = cc.eventManager.addCustomListener(cc.Director.EVENT_AFTER_VISIT, afterVisit);
                _inited = true;
            }
        }
    };
    return profiler;
})();
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType !== cc.game.RENDER_TYPE_WEBGL) {
        return;
    }
    cc.DirectorDelegate = cc.Class.extend({
        updateProjection: function () {
        }
    });
    var _p = cc.Director.prototype;
    var recursiveChild = function(node){
        if(node && node._renderCmd){
            node._renderCmd.setDirtyFlag(cc.Node._dirtyFlags.transformDirty);
            var i, children = node._children;
            for(i=0; i<children.length; i++){
                recursiveChild(children[i]);
            }
        }
    };
    cc.eventManager.addCustomListener(cc.Director.EVENT_PROJECTION_CHANGED, function(){
        var director = cc.director;
        var stack = cc.director._scenesStack;
        for(var  i=0; i<stack.length; i++)
            recursiveChild(stack[i]);
    });
    _p.setProjection = function (projection) {
        var _t = this;
        var size = _t._winSizeInPoints;
        _t.setViewport();
        var view = _t._openGLView,
            ox = view._viewPortRect.x / view._scaleX,
            oy = view._viewPortRect.y / view._scaleY;
        switch (projection) {
            case cc.Director.PROJECTION_2D:
                cc.kmGLMatrixMode(cc.KM_GL_PROJECTION);
                cc.kmGLLoadIdentity();
                var orthoMatrix = cc.math.Matrix4.createOrthographicProjection(
                    0,
                    size.width,
                    0,
                    size.height,
                    -1024, 1024);
                cc.kmGLMultMatrix(orthoMatrix);
                cc.kmGLMatrixMode(cc.KM_GL_MODELVIEW);
                cc.kmGLLoadIdentity();
                break;
            case cc.Director.PROJECTION_3D:
                var zeye = _t.getZEye();
                var matrixPerspective = new cc.math.Matrix4(), matrixLookup = new cc.math.Matrix4();
                cc.kmGLMatrixMode(cc.KM_GL_PROJECTION);
                cc.kmGLLoadIdentity();
                matrixPerspective = cc.math.Matrix4.createPerspectiveProjection(60, size.width / size.height, 0.1, zeye * 2);
                cc.kmGLMultMatrix(matrixPerspective);
                cc.kmGLMatrixMode(cc.KM_GL_MODELVIEW);
                cc.kmGLLoadIdentity();
                var eye = new cc.math.Vec3(-ox + size.width / 2, -oy + size.height / 2, zeye);
                var center = new cc.math.Vec3( -ox + size.width / 2, -oy + size.height / 2, 0.0);
                var up = new cc.math.Vec3( 0.0, 1.0, 0.0);
                matrixLookup.lookAt(eye, center, up);
                cc.kmGLMultMatrix(matrixLookup);
                break;
            case cc.Director.PROJECTION_CUSTOM:
                if (_t._projectionDelegate)
                    _t._projectionDelegate.updateProjection();
                break;
            default:
                cc.log(cc._LogInfos.Director_setProjection);
                break;
        }
        _t._projection = projection;
        cc.eventManager.dispatchEvent(_t._eventProjectionChanged);
        cc.setProjectionMatrixDirty();
        cc.renderer.childrenOrderDirty = true;
    };
    _p.setDepthTest = function (on) {
        cc.renderer.setDepthTest(on);
    };
    _p.setClearColor = function (clearColor) {
        cc.renderer._clearColor = clearColor;
    };
    _p.setOpenGLView = function (openGLView) {
        var _t = this;
        _t._winSizeInPoints.width = cc._canvas.width;
        _t._winSizeInPoints.height = cc._canvas.height;
        _t._openGLView = openGLView || cc.view;
        var conf = cc.configuration;
        conf.gatherGPUInfo();
        conf.dumpInfo();
        _t.setGLDefaultValues();
        if (cc.eventManager)
            cc.eventManager.setEnabled(true);
    };
    _p._clear = function () {
        var gl = cc._renderContext;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    };
    _p.getVisibleSize = function () {
        return this._openGLView.getVisibleSize();
    };
    _p.getVisibleOrigin = function () {
        return this._openGLView.getVisibleOrigin();
    };
    _p.getZEye = function () {
        return (this._winSizeInPoints.height / 1.1566 );
    };
    _p.setViewport = function () {
        var view = this._openGLView;
        if (view) {
            var locWinSizeInPoints = this._winSizeInPoints;
            view.setViewPortInPoints(-view._viewPortRect.x/view._scaleX, -view._viewPortRect.y/view._scaleY, locWinSizeInPoints.width, locWinSizeInPoints.height);
        }
    };
    _p.getOpenGLView = function () {
        return this._openGLView;
    };
    _p.getProjection = function () {
        return this._projection;
    };
    _p.setAlphaBlending = function (on) {
        if (on)
            cc.glBlendFunc(cc.BLEND_SRC, cc.BLEND_DST);
        else
            cc.glBlendFunc(cc._renderContext.ONE, cc._renderContext.ZERO);
    };
    _p.setGLDefaultValues = function () {
        var _t = this;
        _t.setAlphaBlending(true);
        _t.setProjection(_t._projection);
        cc._renderContext.clearColor(0.0, 0.0, 0.0, 0.0);
    };
});
cc.configuration = {
	ERROR:0,
	STRING:1,
	INT:2,
	DOUBLE:3,
	BOOLEAN:4,
    _maxTextureSize:0,
    _maxModelviewStackDepth:0,
    _supportsPVRTC:false,
    _supportsNPOT:false,
    _supportsBGRA8888:false,
    _supportsDiscardFramebuffer:false,
    _supportsShareableVAO:false,
    _maxSamplesAllowed:0,
    _maxTextureUnits:0,
    _GlExtensions:"",
    _valueDict:{},
	_inited: false,
	_init:function () {
		var locValueDict = this._valueDict;
		locValueDict["cocos2d.x.version"] = cc.ENGINE_VERSION;
		locValueDict["cocos2d.x.compiled_with_profiler"] = false;
		locValueDict["cocos2d.x.compiled_with_gl_state_cache"] = cc.ENABLE_GL_STATE_CACHE;
		this._inited = true;
	},
    getMaxTextureSize:function () {
        return this._maxTextureSize;
    },
    getMaxModelviewStackDepth:function () {
        return this._maxModelviewStackDepth;
    },
    getMaxTextureUnits:function () {
        return this._maxTextureUnits;
    },
    supportsNPOT:function () {
        return this._supportsNPOT;
    },
    supportsPVRTC: function () {
        return this._supportsPVRTC;
    },
	supportsETC: function() {
		return false;
	},
	supportsS3TC: function() {
		return false;
	},
	supportsATITC: function() {
		return false;
	},
    supportsBGRA8888:function () {
        return this._supportsBGRA8888;
    },
    supportsDiscardFramebuffer:function () {
        return this._supportsDiscardFramebuffer;
    },
    supportsShareableVAO:function () {
        return this._supportsShareableVAO;
    },
    checkForGLExtension:function (searchName) {
        return this._GlExtensions.indexOf(searchName) > -1;
    },
    getValue: function(key, default_value){
	    if(!this._inited)
		    this._init();
        var locValueDict = this._valueDict;
        if(locValueDict[key])
            return locValueDict[key];
        return default_value;
    },
    setValue: function(key, value){
        this._valueDict[key] = value;
    },
    dumpInfo: function(){
         if(cc.ENABLE_GL_STATE_CACHE === 0){
             cc.log("");
             cc.log(cc._LogInfos.configuration_dumpInfo);
             cc.log("")
         }
    },
    gatherGPUInfo: function(){
        if(cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return;
	    if(!this._inited)
		    this._init();
        var gl = cc._renderContext;
        var locValueDict = this._valueDict;
        locValueDict["gl.vendor"] = gl.getParameter(gl.VENDOR);
        locValueDict["gl.renderer"] = gl.getParameter(gl.RENDERER);
        locValueDict["gl.version"] = gl.getParameter(gl.VERSION);
        this._GlExtensions = "";
        var extArr = gl.getSupportedExtensions();
        for (var i = 0; i < extArr.length; i++)
            this._GlExtensions += extArr[i] + " ";
        this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        locValueDict["gl.max_texture_size"] = this._maxTextureSize;
        this._maxTextureUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        locValueDict["gl.max_texture_units"] = this._maxTextureUnits;
        this._supportsPVRTC = this.checkForGLExtension("GL_IMG_texture_compression_pvrtc");
        locValueDict["gl.supports_PVRTC"] = this._supportsPVRTC;
        this._supportsNPOT = false;
        locValueDict["gl.supports_NPOT"] = this._supportsNPOT;
        this._supportsBGRA8888 = this.checkForGLExtension("GL_IMG_texture_format_BGRA888");
        locValueDict["gl.supports_BGRA8888"] = this._supportsBGRA8888;
        this._supportsDiscardFramebuffer = this.checkForGLExtension("GL_EXT_discard_framebuffer");
        locValueDict["gl.supports_discard_framebuffer"] = this._supportsDiscardFramebuffer;
        this._supportsShareableVAO = this.checkForGLExtension("vertex_array_object");
        locValueDict["gl.supports_vertex_array_object"] = this._supportsShareableVAO;
        cc.checkGLErrorDebug();
    },
    loadConfigFile: function( url){
	    if(!this._inited)
		    this._init();
        var dict = cc.loader.getRes(url);
        if(!dict) throw new Error("Please load the resource first : " + url);
        cc.assert(dict, cc._LogInfos.configuration_loadConfigFile_2, url);
        var getDatas = dict["data"];
        if(!getDatas){
            cc.log(cc._LogInfos.configuration_loadConfigFile, url);
            return;
        }
        for(var selKey in getDatas)
            this._valueDict[selKey] = getDatas[selKey];
    }
};
cc.rendererWebGL = (function () {
var _batchedInfo = {
        texture: null,
        blendSrc: null,
        blendDst: null,
        shader: null
    },
    _quadIndexBuffer = null,
    _quadVertexBuffer = null,
    _vertexSize = 0,
    _batchingSize = 0,
    _sizePerVertex = 6,
    _vertexData = null,
    _vertexDataSize = 0,
    _vertexDataF32 = null,
    _vertexDataUI32 = null,
    _IS_IOS = false;
function updateQuadBuffer (numQuads) {
    var gl = cc._renderContext;
    if (_quadIndexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _quadIndexBuffer);
        var indices = new Uint16Array(numQuads * 6);
        var currentQuad = 0;
        for (var i = 0, len = numQuads * 6; i < len; i += 6) {
            indices[i] = currentQuad + 0;
            indices[i + 1] = currentQuad + 1;
            indices[i + 2] = currentQuad + 2;
            indices[i + 3] = currentQuad + 1;
            indices[i + 4] = currentQuad + 2;
            indices[i + 5] = currentQuad + 3;
            currentQuad += 4;
        }
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
    if (_quadVertexBuffer) {
        _vertexDataSize = numQuads * 4 * _sizePerVertex;
        var byteLength = _vertexDataSize * 4;
        _vertexData = new ArrayBuffer(byteLength);
        _vertexDataF32 = new Float32Array(_vertexData);
        _vertexDataUI32 = new Uint32Array(_vertexData);
        gl.bindBuffer(gl.ARRAY_BUFFER, _quadVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, _vertexDataF32, gl.DYNAMIC_DRAW);
    }
    _vertexSize = numQuads * 4;
}
function initQuadBuffer (numQuads) {
    var gl = cc._renderContext;
    if (_quadIndexBuffer === null) {
        _quadVertexBuffer = gl.createBuffer();
        _quadIndexBuffer = gl.createBuffer();
        updateQuadBuffer(numQuads);
    }
    else {
        updateQuadBuffer(numQuads);
    }
}
return {
    mat4Identity: null,
    childrenOrderDirty: true,
    assignedZ: 0,
    assignedZStep: 1/100,
    _transformNodePool: [],
    _renderCmds: [],
    _isCacheToBufferOn: false,
    _cacheToBufferCmds: {},
    _cacheInstanceIds: [],
    _currentID: 0,
    _clearColor: cc.color(),
    init: function () {
        var gl = cc._renderContext;
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        this.mat4Identity = new cc.math.Matrix4();
        this.mat4Identity.identity();
        initQuadBuffer(2000);
        if (cc.sys.os === cc.sys.OS_IOS) {
            _IS_IOS = true;
        }
    },
    getVertexSize: function () {
        return _vertexSize;
    },
    getRenderCmd: function (renderableObject) {
        return renderableObject._createRenderCmd();
    },
    _turnToCacheMode: function (renderTextureID) {
        this._isCacheToBufferOn = true;
        renderTextureID = renderTextureID || 0;
        if (!this._cacheToBufferCmds[renderTextureID]) {
            this._cacheToBufferCmds[renderTextureID] = [];
        }
        else {
            this._cacheToBufferCmds[renderTextureID].length = 0;
        }
        if (this._cacheInstanceIds.indexOf(renderTextureID) === -1) {
            this._cacheInstanceIds.push(renderTextureID);
        }
        this._currentID = renderTextureID;
    },
    _turnToNormalMode: function () {
        this._isCacheToBufferOn = false;
    },
    _removeCache: function (instanceID) {
        instanceID = instanceID || this._currentID;
        var cmds = this._cacheToBufferCmds[instanceID];
        if (cmds) {
            cmds.length = 0;
            delete this._cacheToBufferCmds[instanceID];
        }
        var locIDs = this._cacheInstanceIds;
        cc.arrayRemoveObject(locIDs, instanceID);
    },
    _renderingToBuffer: function (renderTextureId) {
        renderTextureId = renderTextureId || this._currentID;
        var locCmds = this._cacheToBufferCmds[renderTextureId];
        var ctx = cc._renderContext;
        this.rendering(ctx, locCmds);
        this._removeCache(renderTextureId);
        var locIDs = this._cacheInstanceIds;
        if (locIDs.length === 0)
            this._isCacheToBufferOn = false;
        else
            this._currentID = locIDs[locIDs.length - 1];
    },
    resetFlag: function () {
        if (this.childrenOrderDirty) {
            this.childrenOrderDirty = false;
        }
        this._transformNodePool.length = 0;
    },
    transform: function () {
        var locPool = this._transformNodePool;
        locPool.sort(this._sortNodeByLevelAsc);
        var i, len, cmd;
        for (i = 0, len = locPool.length; i < len; i++) {
            cmd = locPool[i];
            cmd.updateStatus();
        }
        locPool.length = 0;
    },
    transformDirty: function () {
        return this._transformNodePool.length > 0;
    },
    _sortNodeByLevelAsc: function (n1, n2) {
        return n1._curLevel - n2._curLevel;
    },
    pushDirtyNode: function (node) {
        this._transformNodePool.push(node);
    },
    clearRenderCommands: function () {
        this._renderCmds.length = 0;
    },
    clear: function () {
        var gl = cc._renderContext;
        gl.clearColor(this._clearColor.r, this._clearColor.g, this._clearColor.b, this._clearColor.a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    setDepthTest: function (enable){
        var gl = cc._renderContext;
        if(enable){
            gl.clearDepth(1.0);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
        }
        else{
            gl.disable(gl.DEPTH_TEST);
        }
    },
    pushRenderCommand: function (cmd) {
        if(!cmd.needDraw())
            return;
        if (this._isCacheToBufferOn) {
            var currentId = this._currentID, locCmdBuffer = this._cacheToBufferCmds;
            var cmdList = locCmdBuffer[currentId];
            if (cmdList.indexOf(cmd) === -1)
                cmdList.push(cmd);
        } else {
            if (this._renderCmds.indexOf(cmd) === -1) {
                this._renderCmds.push(cmd);
            }
        }
    },
    _increaseBatchingSize: function (increment) {
        _batchingSize += increment;
    },
    _uploadBufferData: function (cmd) {
        if (_batchingSize >= _vertexSize) {
            this._batchRendering();
        }
        var texture = cmd._node._texture;
        var blendSrc = cmd._node._blendFunc.src;
        var blendDst = cmd._node._blendFunc.dst;
        var shader = cmd._shaderProgram;
        if (_batchedInfo.texture !== texture ||
            _batchedInfo.blendSrc !== blendSrc ||
            _batchedInfo.blendDst !== blendDst ||
            _batchedInfo.shader !== shader) {
            this._batchRendering();
            _batchedInfo.texture = texture;
            _batchedInfo.blendSrc = blendSrc;
            _batchedInfo.blendDst = blendDst;
            _batchedInfo.shader = shader;
        }
        var len = cmd.uploadData(_vertexDataF32, _vertexDataUI32, _batchingSize * _sizePerVertex);
        if (len > 0) {
            _batchingSize += len;
        }
    },
    _batchRendering: function () {
        if (_batchingSize === 0 || !_batchedInfo.texture) {
            return;
        }
        var gl = cc._renderContext;
        var texture = _batchedInfo.texture;
        var shader = _batchedInfo.shader;
        var count = _batchingSize / 4;
        if (shader) {
            shader.use();
            shader._updateProjectionUniform();
        }
        cc.glBlendFunc(_batchedInfo.blendSrc, _batchedInfo.blendDst);
        cc.glBindTexture2DN(0, texture);
        var _bufferchanged = !gl.bindBuffer(gl.ARRAY_BUFFER, _quadVertexBuffer);
        if (_batchingSize > _vertexSize * 0.5) {
            gl.bufferData(gl.ARRAY_BUFFER, _vertexDataF32, gl.DYNAMIC_DRAW);
        }
        else {
            var view = _vertexDataF32.subarray(0, _batchingSize * _sizePerVertex);
            gl.bufferData(gl.ARRAY_BUFFER, view, gl.DYNAMIC_DRAW);
        }
        if (_bufferchanged) {
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 3, gl.FLOAT, false, 24, 0);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.UNSIGNED_BYTE, true, 24, 12);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_TEX_COORDS, 2, gl.FLOAT, false, 24, 16);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _quadIndexBuffer);
        gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);
        cc.g_NumberOfDraws++;
        _batchingSize = 0;
    },
    rendering: function (ctx, cmds) {
        var locCmds = cmds || this._renderCmds,
            i, len, cmd, next, batchCount,
            context = ctx || cc._renderContext;
        context.bindBuffer(gl.ARRAY_BUFFER, null);
        for (i = 0, len = locCmds.length; i < len; ++i) {
            cmd = locCmds[i];
            if (cmd.uploadData) {
                this._uploadBufferData(cmd);
            }
            else {
                if (_batchingSize > 0) {
                    this._batchRendering();
                }
                cmd.rendering(context);
            }
        }
        this._batchRendering();
        _batchedInfo.texture = null;
    }
};
})();
(function() {
    cc.Node.WebGLRenderCmd = function (renderable) {
        cc.Node.RenderCmd.call(this, renderable);
        this._shaderProgram = null;
    };
    var proto = cc.Node.WebGLRenderCmd.prototype = Object.create(cc.Node.RenderCmd.prototype);
    proto.constructor = cc.Node.WebGLRenderCmd;
    proto._updateColor = function(){};
    proto.setShaderProgram = function (shaderProgram) {
        this._shaderProgram = shaderProgram;
    };
    proto.getShaderProgram = function () {
        return this._shaderProgram;
    };
})();
(function(){
    cc.Layer.WebGLRenderCmd = function(renderable){
        cc.Node.WebGLRenderCmd.call(this, renderable);
    };
    var proto = cc.Layer.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.Layer.WebGLRenderCmd;
    proto.bake = function(){};
    proto.unbake = function(){};
    proto._bakeForAddChild = function(){};
})();
(function(){
    cc.LayerColor.WebGLRenderCmd = function(renderable){
        cc.Layer.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._matrix = new cc.math.Matrix4();
        this._matrix.identity();
        var _t = this;
        _t._squareVerticesAB = new ArrayBuffer(48);
        _t._squareColorsAB = new ArrayBuffer(16);
        var locSquareVerticesAB = _t._squareVerticesAB, locSquareColorsAB = _t._squareColorsAB;
        var locVertex3FLen = cc.Vertex3F.BYTES_PER_ELEMENT, locColorLen = cc.Color.BYTES_PER_ELEMENT;
        _t._squareVertices = [new cc.Vertex3F(0, 0, 0, locSquareVerticesAB, 0),
            new cc.Vertex3F(0, 0, 0, locSquareVerticesAB, locVertex3FLen),
            new cc.Vertex3F(0, 0, 0, locSquareVerticesAB, locVertex3FLen * 2),
            new cc.Vertex3F(0, 0, 0, locSquareVerticesAB, locVertex3FLen * 3)];
        _t._squareColors = [cc.color(0, 0, 0, 255, locSquareColorsAB, 0),
            cc.color(0, 0, 0, 255, locSquareColorsAB, locColorLen),
            cc.color(0, 0, 0, 255, locSquareColorsAB, locColorLen * 2),
            cc.color(0, 0, 0, 255, locSquareColorsAB, locColorLen * 3)];
        _t._verticesFloat32Buffer = cc._renderContext.createBuffer();
        _t._colorsUint8Buffer = cc._renderContext.createBuffer();
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_COLOR);
    };
    var proto = cc.LayerColor.WebGLRenderCmd.prototype = Object.create(cc.Layer.WebGLRenderCmd.prototype);
    proto.constructor = cc.LayerColor.WebGLRenderCmd;
    proto.rendering = function (ctx) {
        var context = ctx || cc._renderContext;
        var node = this._node;
        var wt = this._worldTransform;
        this._matrix.mat[0] = wt.a;
        this._matrix.mat[4] = wt.c;
        this._matrix.mat[12] = wt.tx;
        this._matrix.mat[1] = wt.b;
        this._matrix.mat[5] = wt.d;
        this._matrix.mat[13] = wt.ty;
        this._shaderProgram.use();
        this._shaderProgram._setUniformForMVPMatrixWithMat4(this._matrix);
        context.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        context.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        context.bindBuffer(context.ARRAY_BUFFER, this._verticesFloat32Buffer);
        context.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 3, context.FLOAT, false, 0, 0);
        context.bindBuffer(context.ARRAY_BUFFER, this._colorsUint8Buffer);
        context.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, context.UNSIGNED_BYTE, true, 0, 0);
        context.drawArrays(context.TRIANGLE_STRIP, 0, this._squareVertices.length);
    };
    proto.transform = function (parentCmd, recursive) {
        this.originTransform(parentCmd, recursive);
        var node = this._node,
            width = node._contentSize.width,
            height = node._contentSize.height;
        var locSquareVertices = this._squareVertices;
        locSquareVertices[1].x = width;
        locSquareVertices[2].y = height;
        locSquareVertices[3].x = width;
        locSquareVertices[3].y = height;
        locSquareVertices[0].z =
        locSquareVertices[1].z =
        locSquareVertices[2].z =
        locSquareVertices[3].z = node._vertexZ;
        this._bindLayerVerticesBufferData();
    };
    proto._updateColor = function(){
        var locDisplayedColor = this._displayedColor, locDisplayedOpacity = this._displayedOpacity,
            locSquareColors = this._squareColors;
        for (var i = 0; i < 4; i++) {
            locSquareColors[i].r = locDisplayedColor.r;
            locSquareColors[i].g = locDisplayedColor.g;
            locSquareColors[i].b = locDisplayedColor.b;
            locSquareColors[i].a = locDisplayedOpacity;
        }
        this._bindLayerColorsBufferData();
    };
    proto._bindLayerVerticesBufferData = function(){
        var glContext = cc._renderContext;
        glContext.bindBuffer(glContext.ARRAY_BUFFER, this._verticesFloat32Buffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, this._squareVerticesAB, glContext.DYNAMIC_DRAW);
    };
    proto._bindLayerColorsBufferData = function(){
        var glContext = cc._renderContext;
        glContext.bindBuffer(glContext.ARRAY_BUFFER, this._colorsUint8Buffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, this._squareColorsAB, glContext.STATIC_DRAW);
    };
    proto.updateBlendFunc = function(blendFunc){};
})();
(function(){
    cc.LayerGradient.WebGLRenderCmd = function(renderable){
        cc.LayerColor.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._clipRect = new cc.Rect();
        this._clippingRectDirty = false;
    };
    var proto = cc.LayerGradient.WebGLRenderCmd.prototype = Object.create(cc.LayerColor.WebGLRenderCmd.prototype);
    proto.constructor = cc.LayerGradient.WebGLRenderCmd;
    proto.updateStatus = function () {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.gradientDirty) {
            this._dirtyFlag |= flags.colorDirty;
            this._updateVertex();
            this._dirtyFlag = locFlag & flags.gradientDirty ^ locFlag;
        }
        cc.Node.RenderCmd.prototype.updateStatus.call(this);
    };
    proto._syncStatus = function (parentCmd) {
        var flags = cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        if (locFlag & flags.gradientDirty) {
            this._dirtyFlag |= flags.colorDirty;
            this._updateVertex();
            this._dirtyFlag = locFlag & flags.gradientDirty ^ locFlag;
        }
        cc.Node.RenderCmd.prototype._syncStatus.call(this, parentCmd);
    };
    proto.transform = function (parentCmd, recursive) {
        this.originTransform(parentCmd, recursive);
        this._updateVertex();
    };
    proto._updateVertex = function () {
        var node = this._node, stops = node._colorStops;
        if(!stops || stops.length < 2)
            return;
        this._clippingRectDirty = true;
        var stopsLen = stops.length, verticesLen = stopsLen * 2, i, contentSize = node._contentSize;
        var locVertices = this._squareVertices;
        if (locVertices.length < verticesLen) {
            this._squareVerticesAB = new ArrayBuffer(verticesLen * 12);
            locVertices.length = 0;
            var locSquareVerticesAB = this._squareVerticesAB;
            var locVertex3FLen = cc.Vertex3F.BYTES_PER_ELEMENT;
            for(i = 0; i < verticesLen; i++){
                locVertices.push(new cc.Vertex3F(0, 0, 0, locSquareVerticesAB, locVertex3FLen * i));
            }
        }
        var angle = Math.PI + cc.pAngleSigned(cc.p(0, -1), node._alongVector), locAnchor = cc.p(contentSize.width/2, contentSize.height /2);
        var degrees = Math.round(cc.radiansToDegrees(angle));
        var transMat = cc.affineTransformMake(1, 0, 0, 1, locAnchor.x, locAnchor.y);
        transMat = cc.affineTransformRotate(transMat, angle);
        var a, b;
        if(degrees < 90) {
            a = cc.p(-locAnchor.x, locAnchor.y);
            b = cc.p(locAnchor.x, locAnchor.y);
        } else if(degrees < 180) {
            a = cc.p(locAnchor.x, locAnchor.y);
            b = cc.p(locAnchor.x, -locAnchor.y);
        } else if(degrees < 270) {
            a = cc.p(locAnchor.x, -locAnchor.y);
            b = cc.p(-locAnchor.x, -locAnchor.y);
        } else {
            a = cc.p(-locAnchor.x, -locAnchor.y);
            b = cc.p(-locAnchor.x, locAnchor.y);
        }
        var sin = Math.sin(angle), cos = Math.cos(angle);
        var tx = Math.abs((a.x * cos - a.y * sin)/locAnchor.x), ty = Math.abs((b.x * sin + b.y * cos)/locAnchor.y);
        transMat = cc.affineTransformScale(transMat, tx, ty);
        for (i = 0; i < stopsLen; i++) {
            var stop = stops[i], y = stop.p * contentSize.height ;
            var p0 = cc.pointApplyAffineTransform(- locAnchor.x , y - locAnchor.y, transMat);
            locVertices[i * 2].x = p0.x;
            locVertices[i * 2].y = p0.y;
            locVertices[i * 2].z = node._vertexZ;
            var p1 = cc.pointApplyAffineTransform(contentSize.width - locAnchor.x, y - locAnchor.y, transMat);
            locVertices[i * 2 + 1].x = p1.x;
            locVertices[i * 2 + 1].y = p1.y;
            locVertices[i * 2 + 1].z = node._vertexZ;
        }
        this._bindLayerVerticesBufferData();
    };
    proto._updateColor = function() {
        var node = this._node, stops = node._colorStops;
        if(!stops || stops.length < 2)
            return;
        var stopsLen = stops.length;
        var locColors = this._squareColors, verticesLen = stopsLen * 2;
        if (locColors.length < verticesLen) {
            this._squareColorsAB = new ArrayBuffer(verticesLen * 4);
            locColors.length = 0;
            var locSquareColorsAB = this._squareColorsAB;
            var locColorLen = cc.Color.BYTES_PER_ELEMENT;
            for(i = 0; i < verticesLen; i++){
                locColors.push(cc.color(0, 0, 0, 255, locSquareColorsAB, locColorLen * i));
            }
        }
        var opacityf = this._displayedOpacity / 255.0;
        for(i = 0; i < stopsLen; i++){
            var stopColor = stops[i].color, locSquareColor0 = locColors[i * 2], locSquareColor1 = locColors[i * 2 + 1];
            locSquareColor0.r = stopColor.r;
            locSquareColor0.g = stopColor.g;
            locSquareColor0.b = stopColor.b;
            locSquareColor0.a = stopColor.a * opacityf;
            locSquareColor1.r = stopColor.r;
            locSquareColor1.g = stopColor.g;
            locSquareColor1.b = stopColor.b;
            locSquareColor1.a = stopColor.a * opacityf;
        }
        this._bindLayerColorsBufferData();
    };
    proto.rendering = function (ctx) {
        var context = ctx || cc._renderContext, node = this._node;
        var clippingRect = this._getClippingRect();
        context.enable(context.SCISSOR_TEST);
        cc.view.setScissorInPoints(clippingRect.x, clippingRect.y, clippingRect.width, clippingRect.height);
        var wt = this._worldTransform;
        this._matrix.mat[0] = wt.a;
        this._matrix.mat[4] = wt.c;
        this._matrix.mat[12] = wt.tx;
        this._matrix.mat[1] = wt.b;
        this._matrix.mat[5] = wt.d;
        this._matrix.mat[13] = wt.ty;
        this._shaderProgram.use();
        this._shaderProgram._setUniformForMVPMatrixWithMat4(this._matrix);
        context.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        context.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        context.bindBuffer(context.ARRAY_BUFFER, this._verticesFloat32Buffer);
        context.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 3, context.FLOAT, false, 0, 0);
        context.bindBuffer(context.ARRAY_BUFFER, this._colorsUint8Buffer);
        context.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, context.UNSIGNED_BYTE, true, 0, 0);
        context.drawArrays(context.TRIANGLE_STRIP, 0, this._squareVertices.length);
        context.disable(context.SCISSOR_TEST);
    };
    proto._getClippingRect = function(){
        if(this._clippingRectDirty){
            var node = this._node;
            var rect = cc.rect(0, 0, node._contentSize.width, node._contentSize.height);
            var trans = node.getNodeToWorldTransform();
            this._clipRect = cc._rectApplyAffineTransformIn(rect, trans);
        }
        return this._clipRect;
    };
})();
(function() {
    cc.Sprite.WebGLRenderCmd = function (renderable) {
        cc.Node.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._vertices = [
            {x: 0, y: 0, u: 0, v: 0},
            {x: 0, y: 0, u: 0, v: 0},
            {x: 0, y: 0, u: 0, v: 0},
            {x: 0, y: 0, u: 0, v: 0}
        ];
        this._color = new Uint32Array(1);
        this._dirty = false;
        this._recursiveDirty = false;
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST);
    };
    var proto = cc.Sprite.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.Sprite.WebGLRenderCmd;
    proto.updateBlendFunc = function (blendFunc) {};
    proto.setDirtyFlag = function(dirtyFlag){
        cc.Node.WebGLRenderCmd.prototype.setDirtyFlag.call(this, dirtyFlag);
        this._dirty = true;
    };
    proto.setDirtyRecursively = function (value) {
        this._recursiveDirty = value;
        this._dirty = value;
        var locChildren = this._node._children, child, l = locChildren ? locChildren.length : 0;
        for (var i = 0; i < l; i++) {
            child = locChildren[i];
            (child instanceof cc.Sprite) && child._renderCmd.setDirtyRecursively(value);
        }
    };
    proto._setBatchNodeForAddChild = function (child) {
        var node = this._node;
        if (node._batchNode) {
            if (!(child instanceof cc.Sprite)) {
                cc.log(cc._LogInfos.Sprite_addChild);
                return false;
            }
            if (child.texture._webTextureObj !== node.textureAtlas.texture._webTextureObj)
                cc.log(cc._LogInfos.Sprite_addChild_2);
            node._batchNode.appendChild(child);
            if (!node._reorderChildDirty)
                node._setReorderChildDirtyRecursively();
        }
        return true;
    };
    proto._handleTextureForRotatedTexture = function (texture) {
        return texture;
    };
    proto.isFrameDisplayed = function (frame) {
        var node = this._node;
        return (cc.rectEqualToRect(frame.getRect(), node._rect) && frame.getTexture().getName() === node._texture.getName()
        && cc.pointEqualToPoint(frame.getOffset(), node._unflippedOffsetPositionFromCenter));
    };
    proto._textureLoadedCallback = function (sender) {
        if (this._textureLoaded)
            return;
        this._textureLoaded = true;
        var locRect = this._rect;
        if (!locRect) {
            locRect = cc.rect(0, 0, sender.width, sender.height);
        } else if (cc._rectEqualToZero(locRect)) {
            locRect.width = sender.width;
            locRect.height = sender.height;
        }
        this.texture = sender;
        this.setTextureRect(locRect, this._rectRotated);
        this.setBatchNode(this._batchNode);
        this.dispatchEvent("load");
        cc.renderer.childrenOrderDirty = true;
    };
    proto._setTextureCoords = function (rect, needConvert) {
        if (needConvert === undefined)
            needConvert = true;
        if (needConvert)
            rect = cc.rectPointsToPixels(rect);
        var node = this._node;
        var tex = node._batchNode ? node.textureAtlas.texture : node._texture;
        var uvs = this._vertices;
        if (!tex)
            return;
        var atlasWidth = tex.pixelsWidth;
        var atlasHeight = tex.pixelsHeight;
        var left, right, top, bottom, tempSwap;
        if (node._rectRotated) {
            if (cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL) {
                left = (2 * rect.x + 1) / (2 * atlasWidth);
                right = left + (rect.height * 2 - 2) / (2 * atlasWidth);
                top = (2 * rect.y + 1) / (2 * atlasHeight);
                bottom = top + (rect.width * 2 - 2) / (2 * atlasHeight);
            } else {
                left = rect.x / atlasWidth;
                right = (rect.x + rect.height) / atlasWidth;
                top = rect.y / atlasHeight;
                bottom = (rect.y + rect.width) / atlasHeight;
            }
            if (node._flippedX) {
                tempSwap = top;
                top = bottom;
                bottom = tempSwap;
            }
            if (node._flippedY) {
                tempSwap = left;
                left = right;
                right = tempSwap;
            }
            uvs[0].u = right;
            uvs[0].v = top;
            uvs[1].u = left;
            uvs[1].v = top;
            uvs[2].u = right;
            uvs[2].v = bottom;
            uvs[3].u = left;
            uvs[3].v = bottom;
        } else {
            if (cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL) {
                left = (2 * rect.x + 1) / (2 * atlasWidth);
                right = left + (rect.width * 2 - 2) / (2 * atlasWidth);
                top = (2 * rect.y + 1) / (2 * atlasHeight);
                bottom = top + (rect.height * 2 - 2) / (2 * atlasHeight);
            } else {
                left = rect.x / atlasWidth;
                right = (rect.x + rect.width) / atlasWidth;
                top = rect.y / atlasHeight;
                bottom = (rect.y + rect.height) / atlasHeight;
            }
            if (node._flippedX) {
                tempSwap = left;
                left = right;
                right = tempSwap;
            }
            if (node._flippedY) {
                tempSwap = top;
                top = bottom;
                bottom = tempSwap;
            }
            uvs[0].u = left;
            uvs[0].v = top;
            uvs[1].u = left;
            uvs[1].v = bottom;
            uvs[2].u = right;
            uvs[2].v = top;
            uvs[3].u = right;
            uvs[3].v = bottom;
        }
    };
    proto._setColorDirty = function () {};
    proto._updateBlendFunc = function () {
        if (this._batchNode) {
            cc.log(cc._LogInfos.Sprite__updateBlendFunc);
            return;
        }
        var node = this._node,
            blendFunc = node._blendFunc;
        if (!node._texture || !node._texture.hasPremultipliedAlpha()) {
            if (blendFunc.src === cc.ONE && blendFunc.dst === cc.BLEND_DST) {
                blendFunc.src = cc.SRC_ALPHA;
            }
            node.opacityModifyRGB = false;
        } else {
            if (blendFunc.src === cc.SRC_ALPHA && blendFunc.dst === cc.BLEND_DST) {
                blendFunc.src = cc.ONE;
            }
            node.opacityModifyRGB = true;
        }
    };
    proto._setTexture = function (texture) {
        var node = this._node;
        if (node._batchNode) {
            if(node._batchNode.texture !== texture){
                cc.log(cc._LogInfos.Sprite_setTexture);
                return;
            }
        } else {
            if(node._texture !== texture){
                node._textureLoaded = texture ? texture._textureLoaded : false;
                node._texture = texture;
                this._updateBlendFunc();
                if (node._textureLoaded) {
                    cc.renderer.childrenOrderDirty = true;
                }
            }
        }
    };
    proto._checkTextureBoundary = function (texture, rect, rotated) {
        if (texture && texture.url) {
            var _x, _y;
            if (rotated) {
                _x = rect.x + rect.height;
                _y = rect.y + rect.width;
            } else {
                _x = rect.x + rect.width;
                _y = rect.y + rect.height;
            }
            if (_x > texture.width) {
                cc.error(cc._LogInfos.RectWidth, texture.url);
            }
            if (_y > texture.height) {
                cc.error(cc._LogInfos.RectHeight, texture.url);
            }
        }
    };
    proto.transform = function (parentCmd, recursive) {
        this.originTransform(parentCmd, recursive);
        var node = this._node,
            lx = node._offsetPosition.x, rx = lx + node._rect.width,
            by = node._offsetPosition.y, ty = by + node._rect.height,
            wt = this._worldTransform;
        var vertices = this._vertices;
        vertices[0].x = lx * wt.a + ty * wt.c + wt.tx;
        vertices[0].y = lx * wt.b + ty * wt.d + wt.ty;
        vertices[1].x = lx * wt.a + by * wt.c + wt.tx;
        vertices[1].y = lx * wt.b + by * wt.d + wt.ty;
        vertices[2].x = rx * wt.a + ty * wt.c + wt.tx;
        vertices[2].y = rx * wt.b + ty * wt.d + wt.ty;
        vertices[3].x = rx * wt.a + by * wt.c + wt.tx;
        vertices[3].y = rx * wt.b + by * wt.d + wt.ty;
    };
    proto.needDraw = function () {
        var node = this._node, locTexture = node._texture;
        return (this._needDraw && locTexture);
    };
    proto.uploadData = function (f32buffer, ui32buffer, vertexDataOffset) {
        var node = this._node, locTexture = node._texture;
        if (!(locTexture && locTexture._textureLoaded && node._rect.width && node._rect.height) || !this._displayedOpacity)
            return false;
        var opacity = this._displayedOpacity;
        var r = this._displayedColor.r,
            g = this._displayedColor.g,
            b = this._displayedColor.b;
        if (node._opacityModifyRGB) {
            var a = opacity / 255;
            r *= a;
            g *= a;
            b *= a;
        }
        this._color[0] = ((opacity<<24) | (b<<16) | (g<<8) | r);
        var z = node._vertexZ;
        var vertices = this._vertices;
        var i, len = vertices.length, vertex, offset = vertexDataOffset;
        for (i = 0; i < len; ++i) {
            vertex = vertices[i];
            f32buffer[offset] = vertex.x;
            f32buffer[offset + 1] = vertex.y;
            f32buffer[offset + 2] = z;
            ui32buffer[offset + 3] = this._color[0];
            f32buffer[offset + 4] = vertex.u;
            f32buffer[offset + 5] = vertex.v;
            offset += 6;
        }
        return len;
    };
})();
(function() {
    cc.LabelTTF.WebGLRenderCmd = function (renderable) {
        cc.Sprite.WebGLRenderCmd.call(this, renderable);
        cc.LabelTTF.CacheRenderCmd.call(this);
    };
    var proto = cc.LabelTTF.WebGLRenderCmd.prototype = Object.create(cc.Sprite.WebGLRenderCmd.prototype);
    cc.inject(cc.LabelTTF.CacheRenderCmd.prototype, proto);
    proto.constructor = cc.LabelTTF.WebGLRenderCmd;
    proto._updateColor = function () {};
})();
cc.DrawingPrimitiveWebGL = cc.Class.extend({
    _renderContext:null,
    _initialized:false,
    _shader: null,
    _colorLocation: "u_color",
    _colorArray: null,
    _pointSizeLocation: "u_pointSize",
    _pointSize:-1,
    ctor:function (ctx) {
        if (ctx == null)
            ctx = cc._renderContext;
        if (!ctx instanceof  WebGLRenderingContext)
            throw new Error("Can't initialise DrawingPrimitiveWebGL. context need is WebGLRenderingContext");
        this._renderContext = ctx;
        this._colorArray = new Float32Array([1.0, 1.0, 1.0, 1.0]);
    },
    lazy_init:function () {
        var _t = this;
        if (!_t._initialized) {
            _t._shader = cc.shaderCache.programForKey(cc.SHADER_POSITION_UCOLOR);
            _t._shader._addUniformLocation(this._colorLocation);
            _t._shader._addUniformLocation(this._pointSizeLocation);
            _t._initialized = true;
        }
    },
    drawInit:function () {
        this._initialized = false;
    },
    drawPoint:function (point) {
        this.lazy_init();
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        this._shader.setUniformLocationWith1f(this._pointSizeLocation, this._pointSize);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array([point.x, point.y]), glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.POINTS, 0, 1);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawPoints:function (points, numberOfPoints) {
        if (!points || points.length === 0)
            return;
        this.lazy_init();
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        this._shader.setUniformLocationWith1f(this._pointSizeLocation, this._pointSize);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, this._pointsToTypeArray(points), glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.POINTS, 0, points.length);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    _pointsToTypeArray:function (points) {
        var typeArr = new Float32Array(points.length * 2);
        for (var i = 0; i < points.length; i++) {
            typeArr[i * 2] = points[i].x;
            typeArr[i * 2 + 1] = points[i].y;
        }
        return typeArr;
    },
    drawLine:function (origin, destination) {
        this.lazy_init();
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, this._pointsToTypeArray([origin, destination]), glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.LINES, 0, 2);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawRect:function (origin, destination) {
        this.drawLine(cc.p(origin.x, origin.y), cc.p(destination.x, origin.y));
        this.drawLine(cc.p(destination.x, origin.y), cc.p(destination.x, destination.y));
        this.drawLine(cc.p(destination.x, destination.y), cc.p(origin.x, destination.y));
        this.drawLine(cc.p(origin.x, destination.y), cc.p(origin.x, origin.y));
    },
    drawSolidRect:function (origin, destination, color) {
        var vertices = [
            origin,
            cc.p(destination.x, origin.y),
            destination,
            cc.p(origin.x, destination.y)
        ];
        this.drawSolidPoly(vertices, 4, color);
    },
    drawPoly:function (vertices, numOfVertices, closePolygon) {
        this.lazy_init();
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, this._pointsToTypeArray(vertices), glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        if (closePolygon)
            glContext.drawArrays(glContext.LINE_LOOP, 0, vertices.length);
        else
            glContext.drawArrays(glContext.LINE_STRIP, 0, vertices.length);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawSolidPoly:function (poli, numberOfPoints, color) {
        this.lazy_init();
        if (color)
            this.setDrawColor(color.r, color.g, color.b, color.a);
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, this._pointsToTypeArray(poli), glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.TRIANGLE_FAN, 0, poli.length);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawCircle:function (center, radius, angle, segments, drawLineToCenter) {
        this.lazy_init();
        var additionalSegment = 1;
        if (drawLineToCenter)
            additionalSegment++;
        var coef = 2.0 * Math.PI / segments;
        var vertices = new Float32Array((segments + 2) * 2);
        if (!vertices)
            return;
        for (var i = 0; i <= segments; i++) {
            var rads = i * coef;
            var j = radius * Math.cos(rads + angle) + center.x;
            var k = radius * Math.sin(rads + angle) + center.y;
            vertices[i * 2] = j;
            vertices[i * 2 + 1] = k;
        }
        vertices[(segments + 1) * 2] = center.x;
        vertices[(segments + 1) * 2 + 1] = center.y;
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, vertices, glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.LINE_STRIP, 0, segments + additionalSegment);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawQuadBezier:function (origin, control, destination, segments) {
        this.lazy_init();
        var vertices = new Float32Array((segments + 1) * 2);
        var t = 0.0;
        for (var i = 0; i < segments; i++) {
            vertices[i * 2] = Math.pow(1 - t, 2) * origin.x + 2.0 * (1 - t) * t * control.x + t * t * destination.x;
            vertices[i * 2 + 1] = Math.pow(1 - t, 2) * origin.y + 2.0 * (1 - t) * t * control.y + t * t * destination.y;
            t += 1.0 / segments;
        }
        vertices[segments * 2] = destination.x;
        vertices[segments * 2 + 1] = destination.y;
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, vertices, glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.LINE_STRIP, 0, segments + 1);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawCubicBezier:function (origin, control1, control2, destination, segments) {
        this.lazy_init();
        var vertices = new Float32Array((segments + 1) * 2);
        var t = 0;
        for (var i = 0; i < segments; i++) {
            vertices[i * 2] = Math.pow(1 - t, 3) * origin.x + 3.0 * Math.pow(1 - t, 2) * t * control1.x + 3.0 * (1 - t) * t * t * control2.x + t * t * t * destination.x;
            vertices[i * 2 + 1] = Math.pow(1 - t, 3) * origin.y + 3.0 * Math.pow(1 - t, 2) * t * control1.y + 3.0 * (1 - t) * t * t * control2.y + t * t * t * destination.y;
            t += 1.0 / segments;
        }
        vertices[segments * 2] = destination.x;
        vertices[segments * 2 + 1] = destination.y;
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, vertices, glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.LINE_STRIP, 0, segments + 1);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    drawCatmullRom:function (points, segments) {
        this.drawCardinalSpline(points, 0.5, segments);
    },
    drawCardinalSpline:function (config, tension, segments) {
        this.lazy_init();
        var vertices = new Float32Array((segments + 1) * 2);
        var p, lt, deltaT = 1.0 / config.length;
        for (var i = 0; i < segments + 1; i++) {
            var dt = i / segments;
            if (dt === 1) {
                p = config.length - 1;
                lt = 1;
            } else {
                p = 0 | (dt / deltaT);
                lt = (dt - deltaT * p) / deltaT;
            }
            var newPos = cc.cardinalSplineAt(
                cc.getControlPointAt(config, p - 1),
                cc.getControlPointAt(config, p),
                cc.getControlPointAt(config, p + 1),
                cc.getControlPointAt(config, p + 2),
                tension, lt);
            vertices[i * 2] = newPos.x;
            vertices[i * 2 + 1] = newPos.y;
        }
        var glContext = this._renderContext;
        this._shader.use();
        this._shader.setUniformForModelViewAndProjectionMatrixWithMat4();
        glContext.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        this._shader.setUniformLocationWith4fv(this._colorLocation, this._colorArray);
        var pointBuffer = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, pointBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, vertices, glContext.STATIC_DRAW);
        glContext.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.LINE_STRIP, 0, segments + 1);
        glContext.deleteBuffer(pointBuffer);
        cc.incrementGLDraws(1);
    },
    setDrawColor:function (r, g, b, a) {
        this._colorArray[0] = r / 255.0;
        this._colorArray[1] = g / 255.0;
        this._colorArray[2] = b / 255.0;
        this._colorArray[3] = a / 255.0;
    },
    setPointSize:function (pointSize) {
        this._pointSize = pointSize * cc.contentScaleFactor();
    },
    setLineWidth:function (width) {
        if(this._renderContext.lineWidth)
            this._renderContext.lineWidth(width);
    }
});
var _p = cc.inputManager;
_p.setAccelerometerEnabled = function(isEnable){
    var _t = this;
    if(_t._accelEnabled === isEnable)
        return;
    _t._accelEnabled = isEnable;
    var scheduler = cc.director.getScheduler();
    if(_t._accelEnabled){
        _t._accelCurTime = 0;
        scheduler.scheduleUpdate(_t);
    } else {
        _t._accelCurTime = 0;
        scheduler.scheduleUpdate(_t);
    }
};
_p.setAccelerometerInterval = function(interval){
    if (this._accelInterval !== interval) {
        this._accelInterval = interval;
    }
};
_p._registerKeyboardEvent = function(){
    cc._canvas.addEventListener("keydown", function (e) {
        cc.eventManager.dispatchEvent(new cc.EventKeyboard(e.keyCode, true));
        e.stopPropagation();
        e.preventDefault();
    }, false);
    cc._canvas.addEventListener("keyup", function (e) {
        cc.eventManager.dispatchEvent(new cc.EventKeyboard(e.keyCode, false));
        e.stopPropagation();
        e.preventDefault();
    }, false);
};
_p._registerAccelerometerEvent = function(){
    var w = window, _t = this;
    _t._acceleration = new cc.Acceleration();
    _t._accelDeviceEvent = w.DeviceMotionEvent || w.DeviceOrientationEvent;
    if (cc.sys.browserType === cc.sys.BROWSER_TYPE_MOBILE_QQ)
        _t._accelDeviceEvent = window.DeviceOrientationEvent;
    var _deviceEventType = (_t._accelDeviceEvent === w.DeviceMotionEvent) ? "devicemotion" : "deviceorientation";
    var ua = navigator.userAgent;
    if (/Android/.test(ua) || (/Adr/.test(ua) && cc.sys.browserType === cc.BROWSER_TYPE_UC)) {
        _t._minus = -1;
    }
    w.addEventListener(_deviceEventType, _t.didAccelerate.bind(_t), false);
};
_p.didAccelerate = function (eventData) {
    var _t = this, w = window;
    if (!_t._accelEnabled)
        return;
    var mAcceleration = _t._acceleration;
    var x, y, z;
    if (_t._accelDeviceEvent === window.DeviceMotionEvent) {
        var eventAcceleration = eventData["accelerationIncludingGravity"];
        x = _t._accelMinus * eventAcceleration.x * 0.1;
        y = _t._accelMinus * eventAcceleration.y * 0.1;
        z = eventAcceleration.z * 0.1;
    } else {
        x = (eventData["gamma"] / 90) * 0.981;
        y = -(eventData["beta"] / 90) * 0.981;
        z = (eventData["alpha"] / 90) * 0.981;
    }
    mAcceleration.x = x;
    mAcceleration.y = y;
    mAcceleration.z = z;
    mAcceleration.timestamp = eventData.timeStamp || Date.now();
    var tmpX = mAcceleration.x;
    if(w.orientation === cc.UIInterfaceOrientationLandscapeRight){
        mAcceleration.x = -mAcceleration.y;
        mAcceleration.y = tmpX;
    }else if(w.orientation === cc.UIInterfaceOrientationLandscapeLeft){
        mAcceleration.x = mAcceleration.y;
        mAcceleration.y = -tmpX;
    }else if(w.orientation === cc.UIInterfaceOrientationPortraitUpsideDown){
        mAcceleration.x = -mAcceleration.x;
        mAcceleration.y = -mAcceleration.y;
    }
};
delete _p;
cc.vertexLineToPolygon = function (points, stroke, vertices, offset, nuPoints) {
    nuPoints += offset;
    if (nuPoints <= 1)
        return;
    stroke *= 0.5;
    var idx;
    var nuPointsMinus = nuPoints - 1;
    for (var i = offset; i < nuPoints; i++) {
        idx = i * 2;
        var p1 = cc.p(points[i * 2], points[i * 2 + 1]);
        var perpVector;
        if (i === 0)
            perpVector = cc.pPerp(cc.pNormalize(cc.pSub(p1, cc.p(points[(i + 1) * 2], points[(i + 1) * 2 + 1]))));
        else if (i === nuPointsMinus)
            perpVector = cc.pPerp(cc.pNormalize(cc.pSub(cc.p(points[(i - 1) * 2], points[(i - 1) * 2 + 1]), p1)));
        else {
            var p0 = cc.p(points[(i - 1) * 2], points[(i - 1) * 2 + 1]);
            var p2 = cc.p(points[(i + 1) * 2], points[(i + 1) * 2 + 1]);
            var p2p1 = cc.pNormalize(cc.pSub(p2, p1));
            var p0p1 = cc.pNormalize(cc.pSub(p0, p1));
            var angle = Math.acos(cc.pDot(p2p1, p0p1));
            if (angle < cc.degreesToRadians(70))
                perpVector = cc.pPerp(cc.pNormalize(cc.pMidpoint(p2p1, p0p1)));
            else if (angle < cc.degreesToRadians(170))
                perpVector = cc.pNormalize(cc.pMidpoint(p2p1, p0p1));
            else
                perpVector = cc.pPerp(cc.pNormalize(cc.pSub(p2, p0)));
        }
        perpVector = cc.pMult(perpVector, stroke);
        vertices[idx * 2] = p1.x + perpVector.x;
        vertices[idx * 2 + 1] = p1.y + perpVector.y;
        vertices[(idx + 1) * 2] = p1.x - perpVector.x;
        vertices[(idx + 1) * 2 + 1] = p1.y - perpVector.y;
    }
    offset = (offset === 0) ? 0 : offset - 1;
    for (i = offset; i < nuPointsMinus; i++) {
        idx = i * 2;
        var idx1 = idx + 2;
        var v1 = cc.vertex2(vertices[idx * 2], vertices[idx * 2 + 1]);
        var v2 = cc.vertex2(vertices[(idx + 1) * 2], vertices[(idx + 1) * 2 + 1]);
        var v3 = cc.vertex2(vertices[idx1 * 2], vertices[idx1 * 2]);
        var v4 = cc.vertex2(vertices[(idx1 + 1) * 2], vertices[(idx1 + 1) * 2 + 1]);
        var fixVertexResult = !cc.vertexLineIntersect(v1.x, v1.y, v4.x, v4.y, v2.x, v2.y, v3.x, v3.y);
        if (!fixVertexResult.isSuccess)
            if (fixVertexResult.value < 0.0 || fixVertexResult.value > 1.0)
                fixVertexResult.isSuccess = true;
        if (fixVertexResult.isSuccess) {
            vertices[idx1 * 2] = v4.x;
            vertices[idx1 * 2 + 1] = v4.y;
            vertices[(idx1 + 1) * 2] = v3.x;
            vertices[(idx1 + 1) * 2 + 1] = v3.y;
        }
    }
};
cc.vertexLineIntersect = function (Ax, Ay, Bx, By, Cx, Cy, Dx, Dy) {
    var distAB, theCos, theSin, newX;
    if ((Ax === Bx && Ay === By) || (Cx === Dx && Cy === Dy))
        return {isSuccess:false, value:0};
    Bx -= Ax;
    By -= Ay;
    Cx -= Ax;
    Cy -= Ay;
    Dx -= Ax;
    Dy -= Ay;
    distAB = Math.sqrt(Bx * Bx + By * By);
    theCos = Bx / distAB;
    theSin = By / distAB;
    newX = Cx * theCos + Cy * theSin;
    Cy = Cy * theCos - Cx * theSin;
    Cx = newX;
    newX = Dx * theCos + Dy * theSin;
    Dy = Dy * theCos - Dx * theSin;
    Dx = newX;
    if (Cy === Dy) return {isSuccess:false, value:0};
    var t = (Dx + (Cx - Dx) * Dy / (Dy - Cy)) / distAB;
    return {isSuccess:true, value:t};
};
cc.vertexListIsClockwise = function(verts) {
    for (var i = 0, len = verts.length; i < len; i++) {
        var a = verts[i];
        var b = verts[(i + 1) % len];
        var c = verts[(i + 2) % len];
        if (cc.pCross(cc.pSub(b, a), cc.pSub(c, b)) > 0)
            return false;
    }
    return true;
};
cc.CGAffineToGL = function (trans, mat) {
    mat[2] = mat[3] = mat[6] = mat[7] = mat[8] = mat[9] = mat[11] = mat[14] = 0.0;
    mat[10] = mat[15] = 1.0;
    mat[0] = trans.a;
    mat[4] = trans.c;
    mat[12] = trans.tx;
    mat[1] = trans.b;
    mat[5] = trans.d;
    mat[13] = trans.ty;
};
cc.GLToCGAffine = function (mat, trans) {
    trans.a = mat[0];
    trans.c = mat[4];
    trans.tx = mat[12];
    trans.b = mat[1];
    trans.d = mat[5];
    trans.ty = mat[13];
};
cc.EventAcceleration = cc.Event.extend({
    _acc: null,
    ctor: function (acc) {
        cc.Event.prototype.ctor.call(this, cc.Event.ACCELERATION);
        this._acc = acc;
    }
});
cc.EventKeyboard = cc.Event.extend({
    _keyCode: 0,
    _isPressed: false,
    ctor: function (keyCode, isPressed) {
        cc.Event.prototype.ctor.call(this, cc.Event.KEYBOARD);
        this._keyCode = keyCode;
        this._isPressed = isPressed;
    }
});
cc._EventListenerAcceleration = cc.EventListener.extend({
    _onAccelerationEvent: null,
    ctor: function (callback) {
        this._onAccelerationEvent = callback;
        var selfPointer = this;
        var listener = function (event) {
            selfPointer._onAccelerationEvent(event._acc, event);
        };
        cc.EventListener.prototype.ctor.call(this, cc.EventListener.ACCELERATION, cc._EventListenerAcceleration.LISTENER_ID, listener);
    },
    checkAvailable: function () {
        cc.assert(this._onAccelerationEvent, cc._LogInfos._EventListenerAcceleration_checkAvailable);
        return true;
    },
    clone: function () {
        return new cc._EventListenerAcceleration(this._onAccelerationEvent);
    }
});
cc._EventListenerAcceleration.LISTENER_ID = "__cc_acceleration";
cc._EventListenerAcceleration.create = function (callback) {
    return new cc._EventListenerAcceleration(callback);
};
cc._EventListenerKeyboard = cc.EventListener.extend({
    onKeyPressed: null,
    onKeyReleased: null,
    ctor: function () {
        var selfPointer = this;
        var listener = function (event) {
            if (event._isPressed) {
                if (selfPointer.onKeyPressed)
                    selfPointer.onKeyPressed(event._keyCode, event);
            } else {
                if (selfPointer.onKeyReleased)
                    selfPointer.onKeyReleased(event._keyCode, event);
            }
        };
        cc.EventListener.prototype.ctor.call(this, cc.EventListener.KEYBOARD, cc._EventListenerKeyboard.LISTENER_ID, listener);
    },
    clone: function () {
        var eventListener = new cc._EventListenerKeyboard();
        eventListener.onKeyPressed = this.onKeyPressed;
        eventListener.onKeyReleased = this.onKeyReleased;
        return eventListener;
    },
    checkAvailable: function () {
        if (this.onKeyPressed === null && this.onKeyReleased === null) {
            cc.log(cc._LogInfos._EventListenerKeyboard_checkAvailable);
            return false;
        }
        return true;
    }
});
cc._EventListenerKeyboard.LISTENER_ID = "__cc_keyboard";
cc._EventListenerKeyboard.create = function () {
    return new cc._EventListenerKeyboard();
};
cc.AtlasNode = cc.Node.extend({
    textureAtlas: null,
    quadsToDraw: 0,
    _itemsPerRow: 0,
    _itemsPerColumn: 0,
    _itemWidth: 0,
    _itemHeight: 0,
    _opacityModifyRGB: false,
    _blendFunc: null,
    _ignoreContentScaleFactor: false,
    _className: "AtlasNode",
    _texture: null,
    _textureForCanvas: null,
    ctor: function (tile, tileWidth, tileHeight, itemsToRender) {
        cc.Node.prototype.ctor.call(this);
        this._blendFunc = {src: cc.BLEND_SRC, dst: cc.BLEND_DST};
        this._ignoreContentScaleFactor = false;
        itemsToRender !== undefined && this.initWithTileFile(tile, tileWidth, tileHeight, itemsToRender);
    },
    _createRenderCmd: function(){
        if(cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            this._renderCmd = new cc.AtlasNode.CanvasRenderCmd(this);
        else
            this._renderCmd = new cc.AtlasNode.WebGLRenderCmd(this);
    },
    updateAtlasValues: function () {
        cc.log(cc._LogInfos.AtlasNode_updateAtlasValues);
    },
    getColor: function () {
        if (this._opacityModifyRGB)
            return this._renderCmd._colorUnmodified;
        return cc.Node.prototype.getColor.call(this);
    },
    setOpacityModifyRGB: function (value) {
        var oldColor = this.color;
        this._opacityModifyRGB = value;
        this.setColor(oldColor);
    },
    isOpacityModifyRGB: function () {
        return this._opacityModifyRGB;
    },
    getBlendFunc: function () {
        return this._blendFunc;
    },
    setBlendFunc: function (src, dst) {
        if (dst === undefined)
            this._blendFunc = src;
        else
            this._blendFunc = {src: src, dst: dst};
    },
    setTextureAtlas: function (value) {
        this.textureAtlas = value;
    },
    getTextureAtlas: function () {
        return this.textureAtlas;
    },
    getQuadsToDraw: function () {
        return this.quadsToDraw;
    },
    setQuadsToDraw: function (quadsToDraw) {
        this.quadsToDraw = quadsToDraw;
    },
    initWithTileFile: function (tile, tileWidth, tileHeight, itemsToRender) {
        if (!tile)
            throw new Error("cc.AtlasNode.initWithTileFile(): title should not be null");
        var texture = cc.textureCache.addImage(tile);
        return this.initWithTexture(texture, tileWidth, tileHeight, itemsToRender);
    },
    initWithTexture: function(texture, tileWidth, tileHeight, itemsToRender){
        return this._renderCmd.initWithTexture(texture, tileWidth, tileHeight, itemsToRender);
    },
    setColor: function(color){
        this._renderCmd.setColor(color);
    },
    setOpacity: function (opacity) {
        this._renderCmd.setOpacity(opacity);
    },
    getTexture: function(){
        return this._texture;
    },
    setTexture: function(texture){
        this._texture = texture;
    },
    _setIgnoreContentScaleFactor: function (ignoreContentScaleFactor) {
        this._ignoreContentScaleFactor = ignoreContentScaleFactor;
    }
});
var _p = cc.AtlasNode.prototype;
cc.defineGetterSetter(_p, "opacity", _p.getOpacity, _p.setOpacity);
cc.defineGetterSetter(_p, "color", _p.getColor, _p.setColor);
_p.texture;
cc.defineGetterSetter(_p, "texture", _p.getTexture, _p.setTexture);
_p.textureAtlas;
_p.quadsToDraw;
cc.EventHelper.prototype.apply(_p);
cc.AtlasNode.create = function (tile, tileWidth, tileHeight, itemsToRender) {
    return new cc.AtlasNode(tile, tileWidth, tileHeight, itemsToRender);
};
(function(){
    cc.AtlasNode.CanvasRenderCmd = function(renderableObject){
        cc.Node.CanvasRenderCmd.call(this, renderableObject);
        this._needDraw = false;
        this._colorUnmodified = cc.color.WHITE;
        this._textureToRender = null;
    };
    var proto = cc.AtlasNode.CanvasRenderCmd.prototype = Object.create(cc.Node.CanvasRenderCmd.prototype);
    proto.constructor = cc.AtlasNode.CanvasRenderCmd;
    proto.initWithTexture = function(texture, tileWidth, tileHeight, itemsToRender){
        var node = this._node;
        node._itemWidth = tileWidth;
        node._itemHeight = tileHeight;
        node._opacityModifyRGB = true;
        node._texture = texture;
        if (!node._texture) {
            cc.log(cc._LogInfos.AtlasNode__initWithTexture);
            return false;
        }
        this._textureToRender = texture;
        this._calculateMaxItems();
        node.quadsToDraw = itemsToRender;
        return true;
    };
    proto.setColor = function(color3){
        var node = this._node;
        var locRealColor = node._realColor;
        if ((locRealColor.r === color3.r) && (locRealColor.g === color3.g) && (locRealColor.b === color3.b))
            return;
        this._colorUnmodified = color3;
        this._changeTextureColor();
    };
    proto._changeTextureColor = function(){
        var node = this._node;
        var texture = node._texture,
            color = this._colorUnmodified,
            element = texture.getHtmlElementObj();
        var textureRect = cc.rect(0, 0, element.width, element.height);
        if(texture === this._textureToRender)
            this._textureToRender = texture._generateColorTexture(color.r, color.g, color.b, textureRect);
        else
            texture._generateColorTexture(color.r, color.g, color.b, textureRect, this._textureToRender.getHtmlElementObj());
    };
    proto.setOpacity = function(opacity){
        var node = this._node;
        cc.Node.prototype.setOpacity.call(node, opacity);
    };
    proto._calculateMaxItems = function(){
        var node = this._node;
        var selTexture = node._texture;
        var size = selTexture.getContentSize();
        node._itemsPerColumn = 0 | (size.height / node._itemHeight);
        node._itemsPerRow = 0 | (size.width / node._itemWidth);
    };
})();
cc.TextureAtlas = cc.Class.extend({
    dirty: false,
    texture: null,
    _indices: null,
    _buffersVBO: null,
    _capacity: 0,
    _quads: null,
    _quadsArrayBuffer: null,
    _quadsWebBuffer: null,
    _quadsReader: null,
    ctor: function (fileName, capacity) {
        this._buffersVBO = [];
        if (cc.isString(fileName)) {
            this.initWithFile(fileName, capacity);
        } else if (fileName instanceof cc.Texture2D) {
            this.initWithTexture(fileName, capacity);
        }
    },
    getTotalQuads: function () {
        return this._totalQuads;
    },
    getCapacity: function () {
        return this._capacity;
    },
    getTexture: function () {
        return this.texture;
    },
    setTexture: function (texture) {
        this.texture = texture;
    },
    setDirty: function (dirty) {
        this.dirty = dirty;
    },
    isDirty: function () {
        return this.dirty;
    },
    getQuads: function () {
        return this._quads;
    },
    setQuads: function (quads) {
        this._quads = quads;
    },
    _copyQuadsToTextureAtlas: function (quads, index) {
        if (!quads)
            return;
        for (var i = 0; i < quads.length; i++)
            this._setQuadToArray(quads[i], index + i);
    },
    _setQuadToArray: function (quad, index) {
        var locQuads = this._quads;
        if (!locQuads[index]) {
            locQuads[index] = new cc.V3F_C4B_T2F_Quad(quad.tl, quad.bl, quad.tr, quad.br, this._quadsArrayBuffer, index * cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT);
            return;
        }
        locQuads[index].bl = quad.bl;
        locQuads[index].br = quad.br;
        locQuads[index].tl = quad.tl;
        locQuads[index].tr = quad.tr;
    },
    description: function () {
        return '<cc.TextureAtlas | totalQuads =' + this._totalQuads + '>';
    },
    _setupIndices: function () {
        if (this._capacity === 0)
            return;
        var locIndices = this._indices, locCapacity = this._capacity;
        for (var i = 0; i < locCapacity; i++) {
            if (cc.TEXTURE_ATLAS_USE_TRIANGLE_STRIP) {
                locIndices[i * 6 + 0] = i * 4 + 0;
                locIndices[i * 6 + 1] = i * 4 + 0;
                locIndices[i * 6 + 2] = i * 4 + 2;
                locIndices[i * 6 + 3] = i * 4 + 1;
                locIndices[i * 6 + 4] = i * 4 + 3;
                locIndices[i * 6 + 5] = i * 4 + 3;
            } else {
                locIndices[i * 6 + 0] = i * 4 + 0;
                locIndices[i * 6 + 1] = i * 4 + 1;
                locIndices[i * 6 + 2] = i * 4 + 2;
                locIndices[i * 6 + 3] = i * 4 + 3;
                locIndices[i * 6 + 4] = i * 4 + 2;
                locIndices[i * 6 + 5] = i * 4 + 1;
            }
        }
    },
    _setupVBO: function () {
        var gl = cc._renderContext;
        this._buffersVBO[0] = gl.createBuffer();
        this._buffersVBO[1] = gl.createBuffer();
        this._quadsWebBuffer = gl.createBuffer();
        this._mapBuffers();
    },
    _mapBuffers: function () {
        var gl = cc._renderContext;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadsWebBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._quadsArrayBuffer, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buffersVBO[1]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._indices, gl.STATIC_DRAW);
    },
    initWithFile: function (file, capacity) {
        var texture = cc.textureCache.addImage(file);
        if (texture)
            return this.initWithTexture(texture, capacity);
        else {
            cc.log(cc._LogInfos.TextureAtlas_initWithFile, file);
            return false;
        }
    },
    initWithTexture: function (texture, capacity) {
        cc.assert(texture, cc._LogInfos.TextureAtlas_initWithTexture);
        capacity = 0 | (capacity);
        this._capacity = capacity;
        this._totalQuads = 0;
        this.texture = texture;
        this._quads = [];
        this._indices = new Uint16Array(capacity * 6);
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        this._quadsArrayBuffer = new ArrayBuffer(quadSize * capacity);
        this._quadsReader = new Uint8Array(this._quadsArrayBuffer);
        if (!( this._quads && this._indices) && capacity > 0)
            return false;
        var locQuads = this._quads;
        for (var i = 0; i < capacity; i++)
            locQuads[i] = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._quadsArrayBuffer, i * quadSize);
        this._setupIndices();
        this._setupVBO();
        this.dirty = true;
        return true;
    },
    updateQuad: function (quad, index) {
        cc.assert(quad, cc._LogInfos.TextureAtlas_updateQuad);
        cc.assert(index >= 0 && index < this._capacity, cc._LogInfos.TextureAtlas_updateQuad_2);
        this._totalQuads = Math.max(index + 1, this._totalQuads);
        this._setQuadToArray(quad, index);
        this.dirty = true;
    },
    insertQuad: function (quad, index) {
        cc.assert(index < this._capacity, cc._LogInfos.TextureAtlas_insertQuad_2);
        this._totalQuads++;
        if (this._totalQuads > this._capacity) {
            cc.log(cc._LogInfos.TextureAtlas_insertQuad);
            return;
        }
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        var remaining = (this._totalQuads - 1) - index;
        var startOffset = index * quadSize;
        var moveLength = remaining * quadSize;
        this._quads[this._totalQuads - 1] = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._quadsArrayBuffer, (this._totalQuads - 1) * quadSize);
        this._quadsReader.set(this._quadsReader.subarray(startOffset, startOffset + moveLength), startOffset + quadSize);
        this._setQuadToArray(quad, index);
        this.dirty = true;
    },
    insertQuads: function (quads, index, amount) {
        amount = amount || quads.length;
        cc.assert((index + amount) <= this._capacity, cc._LogInfos.TextureAtlas_insertQuads);
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        this._totalQuads += amount;
        if (this._totalQuads > this._capacity) {
            cc.log(cc._LogInfos.TextureAtlas_insertQuad);
            return;
        }
        var remaining = (this._totalQuads - 1) - index - amount;
        var startOffset = index * quadSize;
        var moveLength = remaining * quadSize;
        var lastIndex = (this._totalQuads - 1) - amount;
        var i;
        for (i = 0; i < amount; i++)
            this._quads[lastIndex + i] = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._quadsArrayBuffer, (this._totalQuads - 1) * quadSize);
        this._quadsReader.set(this._quadsReader.subarray(startOffset, startOffset + moveLength), startOffset + quadSize * amount);
        for (i = 0; i < amount; i++)
            this._setQuadToArray(quads[i], index + i);
        this.dirty = true;
    },
    insertQuadFromIndex: function (fromIndex, newIndex) {
        if (fromIndex === newIndex)
            return;
        cc.assert(newIndex >= 0 || newIndex < this._totalQuads, cc._LogInfos.TextureAtlas_insertQuadFromIndex);
        cc.assert(fromIndex >= 0 || fromIndex < this._totalQuads, cc._LogInfos.TextureAtlas_insertQuadFromIndex_2);
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        var locQuadsReader = this._quadsReader;
        var sourceArr = locQuadsReader.subarray(fromIndex * quadSize, quadSize);
        var startOffset, moveLength;
        if (fromIndex > newIndex) {
            startOffset = newIndex * quadSize;
            moveLength = (fromIndex - newIndex) * quadSize;
            locQuadsReader.set(locQuadsReader.subarray(startOffset, startOffset + moveLength), startOffset + quadSize);
            locQuadsReader.set(sourceArr, startOffset);
        } else {
            startOffset = (fromIndex + 1) * quadSize;
            moveLength = (newIndex - fromIndex) * quadSize;
            locQuadsReader.set(locQuadsReader.subarray(startOffset, startOffset + moveLength), startOffset - quadSize);
            locQuadsReader.set(sourceArr, newIndex * quadSize);
        }
        this.dirty = true;
    },
    removeQuadAtIndex: function (index) {
        cc.assert(index < this._totalQuads, cc._LogInfos.TextureAtlas_removeQuadAtIndex);
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        this._totalQuads--;
        this._quads.length = this._totalQuads;
        if (index !== this._totalQuads) {
            var startOffset = (index + 1) * quadSize;
            var moveLength = (this._totalQuads - index) * quadSize;
            this._quadsReader.set(this._quadsReader.subarray(startOffset, startOffset + moveLength), startOffset - quadSize);
        }
        this.dirty = true;
    },
    removeQuadsAtIndex: function (index, amount) {
        cc.assert(index + amount <= this._totalQuads, cc._LogInfos.TextureAtlas_removeQuadsAtIndex);
        this._totalQuads -= amount;
        if (index !== this._totalQuads) {
            var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
            var srcOffset = (index + amount) * quadSize;
            var moveLength = (this._totalQuads - index) * quadSize;
            var dstOffset = index * quadSize;
            this._quadsReader.set(this._quadsReader.subarray(srcOffset, srcOffset + moveLength), dstOffset);
        }
        this.dirty = true;
    },
    removeAllQuads: function () {
        this._quads.length = 0;
        this._totalQuads = 0;
    },
    _setDirty: function (dirty) {
        this.dirty = dirty;
    },
    resizeCapacity: function (newCapacity) {
        if (newCapacity === this._capacity)
            return true;
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        var oldCapacity = this._capacity;
        this._totalQuads = Math.min(this._totalQuads, newCapacity);
        this._capacity = 0 | newCapacity;
        var i, capacity = this._capacity, locTotalQuads = this._totalQuads;
        if (this._quads === null) {
            this._quads = [];
            this._quadsArrayBuffer = new ArrayBuffer(quadSize * capacity);
            this._quadsReader = new Uint8Array(this._quadsArrayBuffer);
            for (i = 0; i < capacity; i++)
                this._quads = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._quadsArrayBuffer, i * quadSize);
        } else {
            var newQuads, newArrayBuffer, quads = this._quads;
            if (capacity > oldCapacity) {
                newQuads = [];
                newArrayBuffer = new ArrayBuffer(quadSize * capacity);
                for (i = 0; i < locTotalQuads; i++) {
                    newQuads[i] = new cc.V3F_C4B_T2F_Quad(quads[i].tl, quads[i].bl, quads[i].tr, quads[i].br,
                        newArrayBuffer, i * quadSize);
                }
                for (; i < capacity; i++)
                    newQuads[i] = new cc.V3F_C4B_T2F_Quad(null, null, null, null, newArrayBuffer, i * quadSize);
                this._quadsReader = new Uint8Array(newArrayBuffer);
                this._quads = newQuads;
                this._quadsArrayBuffer = newArrayBuffer;
            } else {
                var count = Math.max(locTotalQuads, capacity);
                newQuads = [];
                newArrayBuffer = new ArrayBuffer(quadSize * capacity);
                for (i = 0; i < count; i++) {
                    newQuads[i] = new cc.V3F_C4B_T2F_Quad(quads[i].tl, quads[i].bl, quads[i].tr, quads[i].br,
                        newArrayBuffer, i * quadSize);
                }
                this._quadsReader = new Uint8Array(newArrayBuffer);
                this._quads = newQuads;
                this._quadsArrayBuffer = newArrayBuffer;
            }
        }
        if (this._indices === null) {
            this._indices = new Uint16Array(capacity * 6);
        } else {
            if (capacity > oldCapacity) {
                var tempIndices = new Uint16Array(capacity * 6);
                tempIndices.set(this._indices, 0);
                this._indices = tempIndices;
            } else {
                this._indices = this._indices.subarray(0, capacity * 6);
            }
        }
        this._setupIndices();
        this._mapBuffers();
        this.dirty = true;
        return true;
    },
    increaseTotalQuadsWith: function (amount) {
        this._totalQuads += amount;
    },
    moveQuadsFromIndex: function (oldIndex, amount, newIndex) {
        if (newIndex === undefined) {
            newIndex = amount;
            amount = this._totalQuads - oldIndex;
            cc.assert((newIndex + (this._totalQuads - oldIndex)) <= this._capacity, cc._LogInfos.TextureAtlas_moveQuadsFromIndex);
            if (amount === 0)
                return;
        } else {
            cc.assert((newIndex + amount) <= this._totalQuads, cc._LogInfos.TextureAtlas_moveQuadsFromIndex_2);
            cc.assert(oldIndex < this._totalQuads, cc._LogInfos.TextureAtlas_moveQuadsFromIndex_3);
            if (oldIndex === newIndex)
                return;
        }
        var quadSize = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        var srcOffset = oldIndex * quadSize;
        var srcLength = amount * quadSize;
        var locQuadsReader = this._quadsReader;
        var sourceArr = locQuadsReader.subarray(srcOffset, srcOffset + srcLength);
        var dstOffset = newIndex * quadSize;
        var moveLength, moveStart;
        if (newIndex < oldIndex) {
            moveLength = (oldIndex - newIndex) * quadSize;
            moveStart = newIndex * quadSize;
            locQuadsReader.set(locQuadsReader.subarray(moveStart, moveStart + moveLength), moveStart + srcLength)
        } else {
            moveLength = (newIndex - oldIndex) * quadSize;
            moveStart = (oldIndex + amount) * quadSize;
            locQuadsReader.set(locQuadsReader.subarray(moveStart, moveStart + moveLength), srcOffset);
        }
        locQuadsReader.set(sourceArr, dstOffset);
        this.dirty = true;
    },
    fillWithEmptyQuadsFromIndex: function (index, amount) {
        var count = amount * cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
        var clearReader = new Uint8Array(this._quadsArrayBuffer, index * cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT, count);
        for (var i = 0; i < count; i++)
            clearReader[i] = 0;
    },
    drawQuads: function () {
        this.drawNumberOfQuads(this._totalQuads, 0);
    },
    _releaseBuffer: function () {
        var gl = cc._renderContext;
        if (this._buffersVBO) {
            if (this._buffersVBO[0])
                gl.deleteBuffer(this._buffersVBO[0]);
            if (this._buffersVBO[1])
                gl.deleteBuffer(this._buffersVBO[1])
        }
        if (this._quadsWebBuffer)
            gl.deleteBuffer(this._quadsWebBuffer);
    }
});
var _p = cc.TextureAtlas.prototype;
_p.totalQuads;
cc.defineGetterSetter(_p, "totalQuads", _p.getTotalQuads);
_p.capacity;
cc.defineGetterSetter(_p, "capacity", _p.getCapacity);
_p.quads;
cc.defineGetterSetter(_p, "quads", _p.getQuads, _p.setQuads);
cc.TextureAtlas.create = function (fileName, capacity) {
    return new cc.TextureAtlas(fileName, capacity);
};
cc.TextureAtlas.createWithTexture = cc.TextureAtlas.create;
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
        cc.assert(cc.isFunction(cc._tmp.WebGLTextureAtlas), cc._LogInfos.MissingFile, "TexturesWebGL.js");
        cc._tmp.WebGLTextureAtlas();
        delete cc._tmp.WebGLTextureAtlas;
    }
});
cc.assert(cc.isFunction(cc._tmp.PrototypeTextureAtlas), cc._LogInfos.MissingFile, "TexturesPropertyDefine.js");
cc._tmp.PrototypeTextureAtlas();
delete cc._tmp.PrototypeTextureAtlas;
cc.PI2 = Math.PI * 2;
cc.DrawingPrimitiveCanvas = cc.Class.extend({
    _cacheArray:[],
    _renderContext:null,
    ctor:function (renderContext) {
        this._renderContext = renderContext;
    },
    drawPoint:function (point, size) {
        if (!size) {
            size = 1;
        }
        var locScaleX = cc.view.getScaleX(), locScaleY = cc.view.getScaleY();
        var newPoint = cc.p(point.x  * locScaleX, point.y * locScaleY);
        var ctx = this._renderContext.getContext();
        ctx.beginPath();
        ctx.arc(newPoint.x, -newPoint.y, size * locScaleX, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
    },
    drawPoints:function (points, numberOfPoints, size) {
        if (points == null)
            return;
        if (!size) {
            size = 1;
        }
        var locContext = this._renderContext.getContext(),locScaleX = cc.view.getScaleX(), locScaleY = cc.view.getScaleY();
        locContext.beginPath();
        for (var i = 0, len = points.length; i < len; i++)
            locContext.arc(points[i].x * locScaleX, -points[i].y * locScaleY, size * locScaleX, 0, Math.PI * 2, false);
        locContext.closePath();
        locContext.fill();
    },
    drawLine:function (origin, destination) {
        var locContext = this._renderContext.getContext(), locScaleX = cc.view.getScaleX(), locScaleY = cc.view.getScaleY();
        locContext.beginPath();
        locContext.moveTo(origin.x , -origin.y );
        locContext.lineTo(destination.x, -destination.y );
        locContext.closePath();
        locContext.stroke();
    },
    drawRect:function (origin, destination) {
        this.drawLine(cc.p(origin.x, origin.y), cc.p(destination.x, origin.y));
        this.drawLine(cc.p(destination.x, origin.y), cc.p(destination.x, destination.y));
        this.drawLine(cc.p(destination.x, destination.y), cc.p(origin.x, destination.y));
        this.drawLine(cc.p(origin.x, destination.y), cc.p(origin.x, origin.y));
    },
    drawSolidRect:function (origin, destination, color) {
        var vertices = [
            origin,
            cc.p(destination.x, origin.y),
            destination,
            cc.p(origin.x, destination.y)
        ];
        this.drawSolidPoly(vertices, 4, color);
    },
    drawPoly:function (vertices, numOfVertices, closePolygon, fill) {
        fill = fill || false;
        if (vertices == null)
            return;
        if (vertices.length < 3)
            throw new Error("Polygon's point must greater than 2");
        var firstPoint = vertices[0], locContext = this._renderContext.getContext();
        var locScaleX = cc.view.getScaleX(), locScaleY = cc.view.getScaleY();
        locContext.beginPath();
        locContext.moveTo(firstPoint.x , -firstPoint.y );
        for (var i = 1, len = vertices.length; i < len; i++)
            locContext.lineTo(vertices[i].x , -vertices[i].y );
        if (closePolygon)
            locContext.closePath();
        if (fill)
            locContext.fill();
        else
            locContext.stroke();
    },
    drawSolidPoly:function (polygons, numberOfPoints, color) {
        this.setDrawColor(color.r, color.g, color.b, color.a);
        this.drawPoly(polygons, numberOfPoints, true, true);
    },
    drawCircle: function (center, radius, angle, segments, drawLineToCenter) {
        drawLineToCenter = drawLineToCenter || false;
        var locContext = this._renderContext.getContext();
        var locScaleX = cc.view.getScaleX(), locScaleY = cc.view.getScaleY();
        locContext.beginPath();
        var endAngle = angle - Math.PI * 2;
        locContext.arc(0 | (center.x ), 0 | -(center.y ), radius , -angle, -endAngle, false);
        if (drawLineToCenter) {
            locContext.lineTo(0 | (center.x ), 0 | -(center.y ));
        }
        locContext.stroke();
    },
    drawQuadBezier:function (origin, control, destination, segments) {
        var vertices = this._cacheArray;
        vertices.length =0;
        var t = 0.0;
        for (var i = 0; i < segments; i++) {
            var x = Math.pow(1 - t, 2) * origin.x + 2.0 * (1 - t) * t * control.x + t * t * destination.x;
            var y = Math.pow(1 - t, 2) * origin.y + 2.0 * (1 - t) * t * control.y + t * t * destination.y;
            vertices.push(cc.p(x, y));
            t += 1.0 / segments;
        }
        vertices.push(cc.p(destination.x, destination.y));
        this.drawPoly(vertices, segments + 1, false, false);
    },
    drawCubicBezier:function (origin, control1, control2, destination, segments) {
        var vertices = this._cacheArray;
        vertices.length =0;
        var t = 0;
        for (var i = 0; i < segments; i++) {
            var x = Math.pow(1 - t, 3) * origin.x + 3.0 * Math.pow(1 - t, 2) * t * control1.x + 3.0 * (1 - t) * t * t * control2.x + t * t * t * destination.x;
            var y = Math.pow(1 - t, 3) * origin.y + 3.0 * Math.pow(1 - t, 2) * t * control1.y + 3.0 * (1 - t) * t * t * control2.y + t * t * t * destination.y;
            vertices.push(cc.p(x , y ));
            t += 1.0 / segments;
        }
        vertices.push(cc.p(destination.x , destination.y));
        this.drawPoly(vertices, segments + 1, false, false);
    },
    drawCatmullRom:function (points, segments) {
        this.drawCardinalSpline(points, 0.5, segments);
    },
    drawCardinalSpline:function (config, tension, segments) {
        cc._renderContext.setStrokeStyle("rgba(255,255,255,1)");
        var points = this._cacheArray;
        points.length = 0;
        var p, lt;
        var deltaT = 1.0 / config.length;
        for (var i = 0; i < segments + 1; i++) {
            var dt = i / segments;
            if (dt === 1) {
                p = config.length - 1;
                lt = 1;
            } else {
                p = 0 | (dt / deltaT);
                lt = (dt - deltaT * p) / deltaT;
            }
            var newPos = cc.CardinalSplineAt(
                cc.getControlPointAt(config, p - 1),
                cc.getControlPointAt(config, p - 0),
                cc.getControlPointAt(config, p + 1),
                cc.getControlPointAt(config, p + 2),
                tension, lt);
            points.push(newPos);
        }
        this.drawPoly(points, segments + 1, false, false);
    },
    drawImage:function (image, sourcePoint, sourceSize, destPoint, destSize) {
        var len = arguments.length;
        var ctx = this._renderContext.getContext();
        switch (len) {
            case 2:
                var height = image.height;
                ctx.drawImage(image, sourcePoint.x, -(sourcePoint.y + height));
                break;
            case 3:
                ctx.drawImage(image, sourcePoint.x, -(sourcePoint.y + sourceSize.height), sourceSize.width, sourceSize.height);
                break;
            case 5:
                ctx.drawImage(image, sourcePoint.x, sourcePoint.y, sourceSize.width, sourceSize.height, destPoint.x, -(destPoint.y + destSize.height),
                    destSize.width, destSize.height);
                break;
            default:
                throw new Error("Argument must be non-nil");
                break;
        }
    },
    drawStar:function (ctx, radius, color) {
        var wrapper = ctx || this._renderContext;
        var context = wrapper.getContext();
        var colorStr = "rgba(" + (0 | color.r) + "," + (0 | color.g) + "," + (0 | color.b);
        wrapper.setFillStyle(colorStr + ",1)");
        var subRadius = radius / 10;
        context.beginPath();
        context.moveTo(-radius, radius);
        context.lineTo(0, subRadius);
        context.lineTo(radius, radius);
        context.lineTo(subRadius, 0);
        context.lineTo(radius, -radius);
        context.lineTo(0, -subRadius);
        context.lineTo(-radius, -radius);
        context.lineTo(-subRadius, 0);
        context.lineTo(-radius, radius);
        context.closePath();
        context.fill();
        var rg = context.createRadialGradient(0, 0, subRadius, 0, 0, radius);
        rg.addColorStop(0, colorStr + ", 1)");
        rg.addColorStop(0.3, colorStr + ", 0.8)");
        rg.addColorStop(1.0, colorStr + ", 0.0)");
        wrapper.setFillStyle(rg);
        context.beginPath();
        var startAngle_1 = 0;
        var endAngle_1 = cc.PI2;
        context.arc(0, 0, radius - subRadius, startAngle_1, endAngle_1, false);
        context.closePath();
        context.fill();
    },
    drawColorBall:function (ctx, radius, color) {
        var wrapper = ctx || this._renderContext;
        var context = wrapper.getContext();
        radius *= cc.view.getScaleX();
        var colorStr = "rgba(" +(0|color.r) + "," + (0|color.g) + "," + (0|color.b);
        var subRadius = radius / 10;
        var g1 = context.createRadialGradient(0, 0, subRadius, 0, 0, radius);
        g1.addColorStop(0, colorStr + ", 1)");
        g1.addColorStop(0.3, colorStr + ", 0.8)");
        g1.addColorStop(0.6, colorStr + ", 0.4)");
        g1.addColorStop(1.0, colorStr + ", 0.0)");
        wrapper.setFillStyle(g1);
        context.beginPath();
        var startAngle_1 = 0;
        var endAngle_1 = cc.PI2;
        context.arc(0, 0, radius, startAngle_1, endAngle_1, false);
        context.closePath();
        context.fill();
    },
    fillText:function (strText, x, y) {
        this._renderContext.getContext().fillText(strText, x, -y);
    },
    setDrawColor:function (r, g, b, a) {
        this._renderContext.setFillStyle("rgba(" + r + "," + g + "," + b + "," + a / 255 + ")");
        this._renderContext.setStrokeStyle("rgba(" + r + "," + g + "," + b + "," + a / 255 + ")");
    },
    setPointSize:function (pointSize) {
    },
    setLineWidth:function (width) {
        this._renderContext.getContext().lineWidth = width * cc.view.getScaleX();
    }
});
(function(){
    cc.AtlasNode.WebGLRenderCmd = function(renderableObject){
        cc.Node.WebGLRenderCmd.call(this, renderableObject);
        this._needDraw = true;
        this._textureAtlas = null;
        this._colorUnmodified = cc.color.WHITE;
        this._colorF32Array = null;
        this._uniformColor = null;
        this._matrix = new cc.math.Matrix4();
        this._matrix.identity();
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURE_UCOLOR);
        this._uniformColor = cc._renderContext.getUniformLocation(this._shaderProgram.getProgram(), "u_color");
    };
    var proto = cc.AtlasNode.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.AtlasNode.WebGLRenderCmd;
    proto._updateBlendFunc = function () {
        var node = this._node;
        if (!this._textureAtlas.texture.hasPremultipliedAlpha()) {
            node._blendFunc.src = cc.SRC_ALPHA;
            node._blendFunc.dst = cc.ONE_MINUS_SRC_ALPHA;
        }
    };
    proto._updateOpacityModifyRGB = function () {
        this._node._opacityModifyRGB = this._textureAtlas.texture.hasPremultipliedAlpha();
    };
    proto.rendering = function (ctx) {
        var context = ctx || cc._renderContext, node = this._node;
        var wt = this._worldTransform;
        this._matrix.mat[0] = wt.a;
        this._matrix.mat[4] = wt.c;
        this._matrix.mat[12] = wt.tx;
        this._matrix.mat[1] = wt.b;
        this._matrix.mat[5] = wt.d;
        this._matrix.mat[13] = wt.ty;
        this._shaderProgram.use();
        this._shaderProgram._setUniformForMVPMatrixWithMat4(this._matrix);
        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        if (this._uniformColor && this._colorF32Array) {
            context.uniform4fv(this._uniformColor, this._colorF32Array);
            this._textureAtlas.drawNumberOfQuads(node.quadsToDraw, 0);
        }
    };
    proto.initWithTexture = function(texture, tileWidth, tileHeight, itemsToRender){
        var node = this._node;
        node._itemWidth = tileWidth;
        node._itemHeight = tileHeight;
        this._colorUnmodified = cc.color.WHITE;
        node._opacityModifyRGB = true;
        node._blendFunc.src = cc.BLEND_SRC;
        node._blendFunc.dst = cc.BLEND_DST;
        var locRealColor = node._realColor;
        this._colorF32Array = new Float32Array([locRealColor.r / 255.0, locRealColor.g / 255.0, locRealColor.b / 255.0, node._realOpacity / 255.0]);
        this._textureAtlas = new cc.TextureAtlas();
        this._textureAtlas.initWithTexture(texture, itemsToRender);
        if (!this._textureAtlas) {
            cc.log(cc._LogInfos.AtlasNode__initWithTexture);
            return false;
        }
        this._updateBlendFunc();
        this._updateOpacityModifyRGB();
        this._calculateMaxItems();
        node.quadsToDraw = itemsToRender;
        return true;
    };
    proto.setColor = function(color3){
        var temp = cc.color(color3.r, color3.g, color3.b), node = this._node;
        this._colorUnmodified = color3;
        var locDisplayedOpacity = this._displayedOpacity;
        if (node._opacityModifyRGB) {
            temp.r = temp.r * locDisplayedOpacity / 255;
            temp.g = temp.g * locDisplayedOpacity / 255;
            temp.b = temp.b * locDisplayedOpacity / 255;
        }
        cc.Node.prototype.setColor.call(node, temp);
    };
    proto.setOpacity = function(opacity){
        var node = this._node;
        cc.Node.prototype.setOpacity.call(node, opacity);
        if (node._opacityModifyRGB) {
            node.color = this._colorUnmodified;
        }
    };
    proto._updateColor = function () {
        if (this._colorF32Array) {
            var locDisplayedColor = this._displayedColor;
            this._colorF32Array[0] = locDisplayedColor.r / 255.0;
            this._colorF32Array[1] = locDisplayedColor.g / 255.0;
            this._colorF32Array[2] = locDisplayedColor.b / 255.0;
            this._colorF32Array[3] = this._displayedOpacity / 255.0;
        }
    };
    proto.getTexture = function(){
        return this._textureAtlas.texture;
    };
    proto.setTexture = function(texture){
        this._textureAtlas.texture = texture;
        this._updateBlendFunc();
        this._updateOpacityModifyRGB();
    };
    proto._calculateMaxItems = function(){
        var node = this._node;
        var selTexture = this._textureAtlas.texture;
        var size = selTexture.getContentSize();
        if (node._ignoreContentScaleFactor)
            size = selTexture.getContentSizeInPixels();
        node._itemsPerColumn = 0 | (size.height / node._itemHeight);
        node._itemsPerRow = 0 | (size.width / node._itemWidth);
    };
})();
cc.math = cc.math || {};
cc.math.EPSILON = 1.0 / 64.0;
cc.math.square = function(s){
    return s*s;
};
cc.math.almostEqual = function(lhs,rhs){
    return (lhs + cc.math.EPSILON > rhs && lhs - cc.math.EPSILON < rhs);
};
(function(cc){
    cc.math.Vec2 = function (x, y) {
        if(y === undefined){
            this.x = x.x;
            this.y = x.y;
        }else{
            this.x = x || 0;
            this.y = y || 0;
        }
    };
    var proto = cc.math.Vec2.prototype;
    proto.fill = function(x, y){
        this.x = x;
        this.y = y;
    };
    proto.length = function(){
        return Math.sqrt(cc.math.square(this.x) + cc.math.square(this.y));
    };
    proto.lengthSq = function(){
        return cc.math.square(this.x) + cc.math.square(this.y);
    };
    proto.normalize = function(){
        var l = 1.0 / this.length();
        this.x *= l;
        this.y *= l;
        return this;
    };
    cc.math.Vec2.add = function (pOut, pV1, pV2) {
        pOut.x = pV1.x + pV2.x;
        pOut.y = pV1.y + pV2.y;
        return pOut
    };
    proto.add = function(vec){
        this.x += vec.x;
        this.y += vec.y;
        return this;
    };
    proto.dot = function (vec) {
        return this.x * vec.x + this.y * vec.y;
    };
    cc.math.Vec2.subtract = function (pOut, pV1, pV2) {
        pOut.x = pV1.x - pV2.x;
        pOut.y = pV1.y - pV2.y;
        return pOut;
    };
    proto.subtract = function(vec){
        this.x -= vec.x;
        this.y -= vec.y;
        return this;
    };
    proto.transform = function (mat3) {
        var x = this.x, y = this.y;
        this.x = x * mat3.mat[0] + y * mat3.mat[3] + mat3.mat[6];
        this.y = x * mat3.mat[1] + y * mat3.mat[4] + mat3.mat[7];
        return this;
    };
    cc.math.Vec2.scale = function (pOut, pIn, s) {
        pOut.x = pIn.x * s;
        pOut.y = pIn.y * s;
        return pOut;
    };
    proto.scale = function(s) {
        this.x *= s;
        this.y *= s;
        return this;
    };
    proto.equals = function (vec) {
        return (this.x < vec.x + cc.math.EPSILON && this.x > vec.x - cc.math.EPSILON) &&
            (this.y < vec.y + cc.math.EPSILON && this.y > vec.y - cc.math.EPSILON);
    };
})(cc);
(function(cc) {
    cc.math.Vec3 = cc.kmVec3 = function (x, y, z) {
        if(x && y === undefined){
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        } else {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
        }
    };
    cc.math.vec3 = function(x, y, z){
        return new cc.math.Vec3(x, y, z);
    };
    var _p = cc.math.Vec3.prototype;
    _p.fill = function (x, y, z) {
        if (x && y === undefined) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        } else {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        return this;
    };
    _p.length = function () {
        return Math.sqrt(cc.math.square(this.x) + cc.math.square(this.y) + cc.math.square(this.z));
    };
    _p.lengthSq = function () {
        return cc.math.square(this.x) + cc.math.square(this.y) + cc.math.square(this.z)
    };
    _p.normalize = function () {
        var l = 1.0 / this.length();
        this.x *= l;
        this.y *= l;
        this.z *= l;
        return this;
    };
    _p.cross = function (vec3) {
        var x = this.x, y = this.y, z = this.z;
        this.x = (y * vec3.z) - (z * vec3.y);
        this.y = (z * vec3.x) - (x * vec3.z);
        this.z = (x * vec3.y) - (y * vec3.x);
        return this;
    };
    _p.dot = function (vec) {
        return (  this.x * vec.x + this.y * vec.y + this.z * vec.z );
    };
    _p.add = function(vec){
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this;
    };
    _p.subtract = function (vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    };
    _p.transform = function (mat4) {
        var x = this.x, y = this.y, z = this.z, mat = mat4.mat;
        this.x = x * mat[0] + y * mat[4] + z * mat[8] + mat[12];
        this.y = x * mat[1] + y * mat[5] + z * mat[9] + mat[13];
        this.z = x * mat[2] + y * mat[6] + z * mat[10] + mat[14];
        return this;
    };
    _p.transformNormal = function(mat4){
        var x = this.x, y = this.y, z = this.z, mat = mat4.mat;
        this.x = x * mat[0] + y * mat[4] + z * mat[8];
        this.y = x * mat[1] + y * mat[5] + z * mat[9];
        this.z = x * mat[2] + y * mat[6] + z * mat[10];
        return this;
    };
    _p.transformCoord = function(mat4){
        var v = new cc.math.Vec4(this.x, this.y, this.z, 1.0);
        v.transform(mat4);
        this.x = v.x / v.w;
        this.y = v.y / v.w;
        this.z = v.z / v.w;
        return this;
    };
    _p.scale = function(scale){
        this.x *= scale;
        this.y *= scale;
        this.z *= scale;
        return this;
    };
    _p.equals = function(vec){
        var EPSILON = cc.math.EPSILON;
        return (this.x < (vec.x + EPSILON) && this.x > (vec.x - EPSILON)) &&
            (this.y < (vec.y + EPSILON) && this.y > (vec.y - EPSILON)) &&
            (this.z < (vec.z + EPSILON) && this.z > (vec.z - EPSILON));
    };
    _p.inverseTransform = function(mat4){
        var mat = mat4.mat;
        var v1 = new cc.math.Vec3(this.x - mat[12], this.y - mat[13], this.z - mat[14]);
        this.x = v1.x * mat[0] + v1.y * mat[1] + v1.z * mat[2];
        this.y = v1.x * mat[4] + v1.y * mat[5] + v1.z * mat[6];
        this.z = v1.x * mat[8] + v1.y * mat[9] + v1.z * mat[10];
        return this;
    };
    _p.inverseTransformNormal = function(mat4){
        var x = this.x, y = this.y, z = this.z, mat = mat4.mat;
        this.x = x * mat[0] + y * mat[1] + z * mat[2];
        this.y = x * mat[4] + y * mat[5] + z * mat[6];
        this.z = x * mat[8] + y * mat[9] + z * mat[10];
        return this;
    };
    _p.assignFrom = function(vec){
        if(!vec)
            return this;
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
         return this;
    };
    cc.math.Vec3.zero = function(vec){
        vec.x = vec.y = vec.z = 0.0;
        return vec;
    };
    _p.toTypeArray = function(){
        var tyArr = new Float32Array(3);
        tyArr[0] = this.x;
        tyArr[1] = this.y;
        tyArr[2] = this.z;
        return tyArr;
    };
})(cc);
(function(cc) {
    cc.math.Vec4 = function (x, y, z, w) {
        if (x && y === undefined) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            this.w = x.w;
        } else {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
            this.w = w || 0;
        }
    };
    cc.kmVec4 = cc.math.Vec4;
    var proto = cc.math.Vec4.prototype;
    proto.fill = function (x, y, z, w) {
        if (x && y === undefined) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            this.w = x.w;
        } else {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }
    };
    proto.add = function(vec) {
        if(!vec)
            return this;
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        this.w += vec.w;
        return this;
    };
    proto.dot = function(vec){
        return ( this.x * vec.x + this.y * vec.y + this.z * vec.z + this.w * vec.w );
    };
    proto.length = function(){
        return Math.sqrt(cc.math.square(this.x) + cc.math.square(this.y) + cc.math.square(this.z) + cc.math.square(this.w));
    };
    proto.lengthSq = function(){
        return cc.math.square(this.x) + cc.math.square(this.y) + cc.math.square(this.z) + cc.math.square(this.w);
    };
    proto.lerp = function(vec, t){
        return this;
    };
    proto.normalize = function() {
        var l = 1.0 / this.length();
        this.x *= l;
        this.y *= l;
        this.z *= l;
        this.w *= l;
        return this;
    };
    proto.scale = function(scale){
        this.normalize();
        this.x *= scale;
        this.y *= scale;
        this.z *= scale;
        this.w *= scale;
        return this;
    };
    proto.subtract = function(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        this.w -= vec.w;
    };
    proto.transform = function(mat4) {
        var x = this.x, y = this.y, z = this.z, w = this.w, mat = mat4.mat;
        this.x = x * mat[0] + y * mat[4] + z * mat[8] + w * mat[12];
        this.y = x * mat[1] + y * mat[5] + z * mat[9] + w * mat[13];
        this.z = x * mat[2] + y * mat[6] + z * mat[10] + w * mat[14];
        this.w = x * mat[3] + y * mat[7] + z * mat[11] + w * mat[15];
        return this;
    };
    cc.math.Vec4.transformArray = function(vecArray, mat4){
        var retArray = [];
        for (var i = 0; i < vecArray.length; i++) {
            var selVec = new cc.math.Vec4(vecArray[i]);
            selVec.transform(mat4);
            retArray.push(selVec);
        }
        return retArray;
    };
    proto.equals = function(vec){
       var EPSILON = cc.math.EPSILON;
        return (this.x < vec.x + EPSILON && this.x > vec.x - EPSILON) &&
            (this.y < vec.y + EPSILON && this.y > vec.y - EPSILON) &&
            (this.z < vec.z + EPSILON && this.z > vec.z - EPSILON) &&
            (this.w < vec.w + EPSILON && this.w > vec.w - EPSILON);
    };
    proto.assignFrom = function(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        this.w = vec.w;
        return this;
    };
    proto.toTypeArray = function(){
        var tyArr = new Float32Array(4);
        tyArr[0] = this.x;
        tyArr[1] = this.y;
        tyArr[2] = this.z;
        tyArr[3] = this.w;
        return tyArr;
    };
})(cc);
(function(cc){
    cc.math.Ray2 = function (start, dir) {
        this.start = start || new cc.math.Vec2();
        this.dir = dir || new cc.math.Vec2();
    };
    cc.math.Ray2.prototype.fill = function (px, py, vx, vy) {
        this.start.x = px;
        this.start.y = py;
        this.dir.x = vx;
        this.dir.y = vy;
    };
    cc.math.Ray2.prototype.intersectLineSegment = function (p1, p2, intersection) {
        var x1 = this.start.x, y1 = this.start.y;
        var x2 = this.start.x + this.dir.x, y2 = this.start.y + this.dir.y;
        var x3 = p1.x, y3 = p1.y;
        var x4 = p2.x, y4 = p2.y;
        var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        var ua, x, y;
        if (denom > -cc.math.EPSILON && denom < cc.math.EPSILON)
            return false;
        ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        x = x1 + ua * (x2 - x1);
        y = y1 + ua * (y2 - y1);
        if (x < Math.min(p1.x, p2.x) - cc.math.EPSILON ||
            x > Math.max(p1.x, p2.x) + cc.math.EPSILON ||
            y < Math.min(p1.y, p2.y) - cc.math.EPSILON ||
            y > Math.max(p1.y, p2.y) + cc.math.EPSILON) {
            return false;
        }
        if (x < Math.min(x1, x2) - cc.math.EPSILON ||
            x > Math.max(x1, x2) + cc.math.EPSILON ||
            y < Math.min(y1, y2) - cc.math.EPSILON ||
            y > Math.max(y1, y2) + cc.math.EPSILON) {
            return false;
        }
        intersection.x = x;
        intersection.y = y;
        return true;
    };
    function calculate_line_normal(p1, p2, normalOut){
        var tmp = new cc.math.Vec2(p2);
        tmp.subtract(p1);
        normalOut.x = -tmp.y;
        normalOut.y = tmp.x;
        normalOut.normalize();
    }
    cc.math.Ray2.prototype.intersectTriangle = function(p1, p2, p3, intersection, normal_out){
        var intersect = new cc.math.Vec2(), final_intersect = new cc.math.Vec2();
        var normal = new cc.math.Vec2(), distance = 10000.0, intersected = false;
        var this_distance;
        if(this.intersectLineSegment(p1, p2, intersect)) {
            intersected = true;
            this_distance = intersect.subtract(this.start).length();
            if(this_distance < distance) {
                final_intersect.x = intersect.x;
                final_intersect.y = intersect.y;
                distance = this_distance;
                calculate_line_normal(p1, p2, normal);
            }
        }
        if(this.intersectLineSegment(p2, p3, intersect)) {
            intersected = true;
            this_distance = intersect.subtract(this.start).length();
            if(this_distance < distance) {
                final_intersect.x = intersect.x;
                final_intersect.y = intersect.y;
                distance = this_distance;
                calculate_line_normal(p2, p3, normal);
            }
        }
        if(this.intersectLineSegment(p3, p1, intersect)) {
            intersected = true;
            this_distance = intersect.subtract(this.start).length();
            if(this_distance < distance) {
                final_intersect.x = intersect.x;
                final_intersect.y = intersect.y;
                distance = this_distance;
                calculate_line_normal(p3, p1, normal);
            }
        }
        if(intersected) {
            intersection.x = final_intersect.x;
            intersection.y = final_intersect.y;
            if(normal_out) {
                normal_out.x = normal.x;
                normal_out.y = normal.y;
            }
        }
        return intersected;
    };
})(cc);
window.Uint16Array = window.Uint16Array || window.Array;
window.Float32Array = window.Float32Array || window.Array;
(function(cc){
    cc.math.Matrix3 = function(mat3) {
        if (mat3 && mat3.mat) {
            this.mat = new Float32Array(mat3.mat);
        } else {
            this.mat = new Float32Array(9);
        }
    };
    cc.kmMat3 = cc.math.Matrix3;
    var _p = cc.math.Matrix3.prototype;
    _p.fill = function(mat3) {
        var mat = this.mat, matIn = mat3.mat;
        mat[0] = matIn[0];
        mat[1] = matIn[1];
        mat[2] = matIn[2];
        mat[3] = matIn[3];
        mat[4] = matIn[4];
        mat[5] = matIn[5];
        mat[6] = matIn[6];
        mat[7] = matIn[7];
        mat[8] = matIn[8];
        return this;
    };
    _p.adjugate = function(){
        var mat = this.mat;
        var m0 = mat[0], m1 = mat[1], m2 = mat[2], m3 = mat[3], m4 = mat[4],
            m5 = mat[5], m6 = mat[6], m7 = mat[7], m8 = mat[8];
        mat[0] = m4 * m8 - m5 * m7;
        mat[1] = m2 * m7 - m1 * m8;
        mat[2] = m1 * m5 - m2 * m4;
        mat[3] = m5 * m6 - m3 * m8;
        mat[4] = m0 * m8 - m2 * m6;
        mat[5] = m2 * m3 - m0 * m5;
        mat[6] = m3 * m7 - m4 * m6;
        mat[8] = m0 * m4 - m1 * m3;
        return this;
    };
    _p.identity = function() {
        var mat = this.mat;
        mat[1] = mat[2] = mat[3] =
            mat[5] = mat[6] = mat[7] = 0;
        mat[0] = mat[4] = mat[8] = 1.0;
        return this;
    };
    var tmpMatrix = new cc.math.Matrix3();
    _p.inverse = function(determinate){
        if (determinate === 0.0)
            return this;
        tmpMatrix.assignFrom(this);
        var detInv = 1.0 / determinate;
        this.adjugate();
        this.multiplyScalar(detInv);
        return this;
    };
    _p.isIdentity = function(){
        var mat = this.mat;
        return (mat[0] === 1 && mat[1] === 0 && mat[2] === 0
        && mat[3] === 0 && mat[4] === 1 && mat[5] === 0
        && mat[6] === 0 && mat[7] === 0 && mat[8] === 1);
    };
    _p.transpose = function(){
        var mat = this.mat;
        var  m1 = mat[1], m2 = mat[2], m3 = mat[3],  m5 = mat[5],
            m6 = mat[6], m7 = mat[7];
        mat[1] = m3;
        mat[2] = m6;
        mat[3] = m1;
        mat[5] = m7;
        mat[6] = m2;
        mat[7] = m5;
        return this;
    };
    _p.determinant = function(){
        var mat = this.mat;
        var output = mat[0] * mat[4] * mat[8] + mat[1] * mat[5] * mat[6] + mat[2] * mat[3] * mat[7];
        output -= mat[2] * mat[4] * mat[6] + mat[0] * mat[5] * mat[7] + mat[1] * mat[3] * mat[8];
        return output;
    };
    _p.multiply = function(mat3){
        var m1 = this.mat, m2 = mat3.mat;
        var a0 = m1[0], a1 = m1[1], a2 = m1[2], a3 = m1[3], a4 = m1[4], a5 = m1[5],
            a6 = m1[6], a7 = m1[7], a8 = m1[8];
        var b0 = m2[0], b1 = m2[1], b2 = m2[2], b3 = m2[3], b4 = m2[4], b5 = m2[5],
            b6 = m2[6], b7 = m2[7], b8 = m2[8];
        m1[0] = a0 * b0 + a3 * b1 + a6 * b2;
        m1[1] = a1 * b0 + a4 * b1 + a7 * b2;
        m1[2] = a2 * b0 + a5 * b1 + a8 * b2;
        m1[3] = a2 * b0 + a5 * b1 + a8 * b2;
        m1[4] = a1 * b3 + a4 * b4 + a7 * b5;
        m1[5] = a2 * b3 + a5 * b4 + a8 * b5;
        m1[6] = a0 * b6 + a3 * b7 + a6 * b8;
        m1[7] = a1 * b6 + a4 * b7 + a7 * b8;
        m1[8] = a2 * b6 + a5 * b7 + a8 * b8;
        return this;
    };
    _p.multiplyScalar = function(factor) {
        var mat = this.mat;
        mat[0] *= factor;
        mat[1] *= factor;
        mat[2] *= factor;
        mat[3] *= factor;
        mat[4] *= factor;
        mat[5] *= factor;
        mat[6] *= factor;
        mat[7] *= factor;
        mat[8] *= factor;
        return this;
    };
    cc.math.Matrix3.rotationAxisAngle = function(axis, radians) {
        var rcos = Math.cos(radians), rsin = Math.sin(radians);
        var retMat = new cc.math.Matrix3();
        var mat = retMat.mat;
        mat[0] = rcos + axis.x * axis.x * (1 - rcos);
        mat[1] = axis.z * rsin + axis.y * axis.x * (1 - rcos);
        mat[2] = -axis.y * rsin + axis.z * axis.x * (1 - rcos);
        mat[3] = -axis.z * rsin + axis.x * axis.y * (1 - rcos);
        mat[4] = rcos + axis.y * axis.y * (1 - rcos);
        mat[5] = axis.x * rsin + axis.z * axis.y * (1 - rcos);
        mat[6] = axis.y * rsin + axis.x * axis.z * (1 - rcos);
        mat[7] = -axis.x * rsin + axis.y * axis.z * (1 - rcos);
        mat[8] = rcos + axis.z * axis.z * (1 - rcos);
        return retMat;
    };
    _p.assignFrom = function(matIn){
        if(this === matIn) {
            cc.log("cc.math.Matrix3.assign(): current matrix equals matIn");
            return this;
        }
        var mat = this.mat, m2 = matIn.mat;
        mat[0] = m2[0];
        mat[1] = m2[1];
        mat[2] = m2[2];
        mat[3] = m2[3];
        mat[4] = m2[4];
        mat[5] = m2[5];
        mat[6] = m2[6];
        mat[7] = m2[7];
        mat[8] = m2[8];
        return this;
    };
    _p.equals = function(mat3) {
        if (this === mat3)
            return true;
        var EPSILON = cc.math.EPSILON,m1 = this.mat, m2 = mat3.mat;
        for (var i = 0; i < 9; ++i) {
            if (!(m1[i] + EPSILON > m2[i] && m1[i] - EPSILON < m2[i]))
                return false;
        }
        return true;
    };
    cc.math.Matrix3.createByRotationX = function(radians) {
        var retMat = new cc.math.Matrix3(), mat = retMat.mat;
        mat[0] = 1.0;
        mat[1] = 0.0;
        mat[2] = 0.0;
        mat[3] = 0.0;
        mat[4] = Math.cos(radians);
        mat[5] = Math.sin(radians);
        mat[6] = 0.0;
        mat[7] = -Math.sin(radians);
        mat[8] = Math.cos(radians);
        return retMat;
    };
    cc.math.Matrix3.createByRotationY = function(radians) {
        var retMat = new cc.math.Matrix3(), mat = retMat.mat;
        mat[0] = Math.cos(radians);
        mat[1] = 0.0;
        mat[2] = -Math.sin(radians);
        mat[3] = 0.0;
        mat[4] = 1.0;
        mat[5] = 0.0;
        mat[6] = Math.sin(radians);
        mat[7] = 0.0;
        mat[8] = Math.cos(radians);
        return retMat;
    };
    cc.math.Matrix3.createByRotationZ = function(radians) {
        var retMat = new cc.math.Matrix3(), mat = retMat.mat;
        mat[0] = Math.cos(radians);
        mat[1] = -Math.sin(radians);
        mat[2] = 0.0;
        mat[3] = Math.sin(radians);
        mat[4] = Math.cos(radians);
        mat[5] = 0.0;
        mat[6] = 0.0;
        mat[7] = 0.0;
        mat[8] = 1.0;
        return retMat;
    };
    cc.math.Matrix3.createByRotation = function(radians) {
        var retMat = new cc.math.Matrix3(), mat = retMat.mat;
        mat[0] = Math.cos(radians);
        mat[1] = Math.sin(radians);
        mat[2] = 0.0;
        mat[3] = -Math.sin(radians);
        mat[4] = Math.cos(radians);
        mat[5] = 0.0;
        mat[6] = 0.0;
        mat[7] = 0.0;
        mat[8] = 1.0;
        return retMat;
    };
    cc.math.Matrix3.createByScale = function(x, y) {
        var ret = new cc.math.Matrix3();
        ret.identity();
        ret.mat[0] = x;
        ret.mat[4] = y;
        return ret;
    };
    cc.math.Matrix3.createByTranslation = function(x, y){
        var ret = new cc.math.Matrix3();
        ret.identity();
        ret.mat[6] = x;
        ret.mat[7] = y;
        return ret;
    };
    cc.math.Matrix3.createByQuaternion = function(quaternion) {
        if(!quaternion)
            return null;
        var ret = new cc.math.Matrix3(), mat = ret.mat;
        mat[0] = 1.0 - 2.0 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z);
        mat[1] = 2.0 * (quaternion.x * quaternion.y - quaternion.w * quaternion.z);
        mat[2] = 2.0 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y);
        mat[3] = 2.0 * (quaternion.x * quaternion.y + quaternion.w * quaternion.z);
        mat[4] = 1.0 - 2.0 * (quaternion.x * quaternion.x + quaternion.z * quaternion.z);
        mat[5] = 2.0 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x);
        mat[6] = 2.0 * (quaternion.x * quaternion.z - quaternion.w * quaternion.y);
        mat[7] = 2.0 * (quaternion.y * quaternion.z + quaternion.w * quaternion.x);
        mat[8] = 1.0 - 2.0 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y);
        return ret;
    };
    _p.rotationToAxisAngle = function() {
        return cc.math.Quaternion.rotationMatrix(this).toAxisAndAngle();
    }
})(cc);
(function(cc) {
    cc.math.Matrix4 = function (mat4) {
        if(mat4 && mat4.mat){
            this.mat = new Float32Array(mat4.mat);
        } else {
            this.mat = new Float32Array(16);
        }
    };
    cc.kmMat4 = cc.math.Matrix4;
    var proto = cc.math.Matrix4.prototype;
    proto.fill = function(scalarArr){
         var mat = this.mat;
        for(var i = 0; i < 16; i++){
            mat[i] = scalarArr[i];
        }
        return this;
    };
    cc.kmMat4Identity = function (pOut) {
        var mat = pOut.mat;
        mat[1] = mat[2] = mat[3] = mat[4] = mat[6] = mat[7]
            = mat[8] = mat[9] = mat[11] = mat[12] = mat[13] = mat[14] = 0;
        mat[0] = mat[5] = mat[10] = mat[15] = 1.0;
        return pOut;
    };
    proto.identity = function(){
        var mat = this.mat;
        mat[1] = mat[2] = mat[3] = mat[4] = mat[6] = mat[7]
            = mat[8] = mat[9] = mat[11] = mat[12] = mat[13] = mat[14] = 0;
        mat[0] = mat[5] = mat[10] = mat[15] = 1.0;
        return this;
    };
    proto.get = function(row, col){
        return this.mat[row + 4 * col];
    };
    proto.set = function(row, col, value){
        this.mat[row + 4 * col] = value;
    };
    proto.swap = function(r1, c1, r2, c2) {
        var mat = this.mat, tmp = mat[r1 + 4 * c1];
        mat[r1 + 4 * c1] = mat[r2 + 4 * c2];
        mat[r2 + 4 * c2] = tmp;
    };
    cc.math.Matrix4._gaussj = function (a, b) {
        var i, icol = 0, irow = 0, j, k, l, ll, n = 4, m = 4, selElement;
        var big, dumb, pivinv;
        var indxc = [0, 0, 0, 0], indxr = [0, 0, 0, 0], ipiv = [0, 0, 0, 0];
        for (i = 0; i < n; i++) {
            big = 0.0;
            for (j = 0; j < n; j++) {
                if (ipiv[j] !== 1) {
                    for (k = 0; k < n; k++) {
                        if (ipiv[k] === 0) {
                            selElement = Math.abs(a.get(j, k));
                            if (selElement >= big) {
                                big = selElement;
                                irow = j;
                                icol = k;
                            }
                        }
                    }
                }
            }
            ++(ipiv[icol]);
            if (irow !== icol) {
                for (l = 0; l < n; l++)
                    a.swap(irow, l, icol, l);
                for (l = 0; l < m; l++)
                    b.swap(irow, l, icol, l);
            }
            indxr[i] = irow;
            indxc[i] = icol;
            if (a.get(icol, icol) === 0.0)
                return false;
            pivinv = 1.0 / a.get(icol, icol);
            a.set(icol, icol, 1.0);
            for (l = 0; l < n; l++)
                a.set(icol, l, a.get(icol, l) * pivinv);
            for (l = 0; l < m; l++)
                b.set(icol, l, b.get(icol, l) * pivinv);
            for (ll = 0; ll < n; ll++) {
                if (ll !== icol) {
                    dumb = a.get(ll, icol);
                    a.set(ll, icol, 0.0);
                    for (l = 0; l < n; l++)
                        a.set(ll, l, a.get(ll, l) - a.get(icol, l) * dumb);
                    for (l = 0; l < m; l++)
                        b.set(ll, l, a.get(ll, l) - b.get(icol, l) * dumb);
                }
            }
        }
        for (l = n - 1; l >= 0; l--) {
            if (indxr[l] !== indxc[l]) {
                for (k = 0; k < n; k++)
                    a.swap(k, indxr[l], k, indxc[l]);
            }
        }
        return true;
    };
    var identityMatrix = new cc.math.Matrix4().identity();
    cc.kmMat4Inverse = function (pOut, pM) {
        var inv = new cc.math.Matrix4(pM);
        var tmp = new cc.math.Matrix4(identityMatrix);
        if (cc.math.Matrix4._gaussj(inv, tmp) === false)
            return null;
        pOut.assignFrom(inv);
        return pOut;
    };
    proto.inverse = function(){
        var inv = new cc.math.Matrix4(this);
        var tmp = new cc.math.Matrix4(identityMatrix);
        if (cc.math.Matrix4._gaussj(inv, tmp) === false)
            return null;
        return inv;
    };
    proto.isIdentity = function () {
        var mat = this.mat;
        return (mat[0] === 1 && mat[1] === 0 && mat[2] === 0 && mat[3] === 0
        && mat[4] === 0 && mat[5] === 1 && mat[6] === 0 && mat[7] === 0
        && mat[8] === 0 && mat[9] === 0 && mat[10] === 1 && mat[11] === 0
        && mat[12] === 0 && mat[13] === 0 && mat[14] === 0 && mat[15] === 1);
    };
    proto.transpose = function() {
        var mat = this.mat;
        var m1 = mat[1], m2 = mat[2], m3 = mat[3],
            m4 = mat[4], m6 = mat[6], m7 = mat[7],
            m8 = mat[8], m9 = mat[9], m11 = mat[11],
            m12 = mat[12], m13 = mat[13], m14 = mat[14];
        mat[1] = m4;
        mat[2] = m8;
        mat[3] = m12;
        mat[4] = m1;
        mat[6] = m9;
        mat[7] = m13;
        mat[8] = m2;
        mat[9] = m6;
        mat[11] = m14;
        mat[12] = m3;
        mat[13] = m7;
        mat[14] = m11;
        return this;
    };
    cc.kmMat4Multiply = function (pOut, pM1, pM2) {
        var outArray = pOut.mat, mat1 = pM1.mat, mat2 = pM2.mat;
        var a00 = mat1[0], a01 = mat1[1], a02 = mat1[2], a03 = mat1[3];
        var a10 = mat1[4], a11 = mat1[5], a12 = mat1[6], a13 = mat1[7];
        var a20 = mat1[8], a21 = mat1[9], a22 = mat1[10], a23 = mat1[11];
        var a30 = mat1[12], a31 = mat1[13], a32 = mat1[14], a33 = mat1[15];
        var b00 = mat2[0], b01 = mat2[1], b02 = mat2[2], b03 = mat2[3];
        var b10 = mat2[4], b11 = mat2[5], b12 = mat2[6], b13 = mat2[7];
        var b20 = mat2[8], b21 = mat2[9], b22 = mat2[10], b23 = mat2[11];
        var b30 = mat2[12], b31 = mat2[13], b32 = mat2[14], b33 = mat2[15];
        outArray[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        outArray[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        outArray[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        outArray[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        outArray[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        outArray[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        outArray[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        outArray[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        outArray[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        outArray[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        outArray[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        outArray[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        outArray[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        outArray[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        outArray[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        outArray[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
        return pOut;
    };
    proto.multiply = function(mat4){
        var mat = this.mat, mat2 = mat4.mat;
        var a00 = mat[0], a01 = mat[1], a02 = mat[2], a03 = mat[3];
        var a10 = mat[4], a11 = mat[5], a12 = mat[6], a13 = mat[7];
        var a20 = mat[8], a21 = mat[9], a22 = mat[10], a23 = mat[11];
        var a30 = mat[12], a31 = mat[13], a32 = mat[14], a33 = mat[15];
        var b00 = mat2[0], b01 = mat2[1], b02 = mat2[2], b03 = mat2[3];
        var b10 = mat2[4], b11 = mat2[5], b12 = mat2[6], b13 = mat2[7];
        var b20 = mat2[8], b21 = mat2[9], b22 = mat2[10], b23 = mat2[11];
        var b30 = mat2[12], b31 = mat2[13], b32 = mat2[14], b33 = mat2[15];
        mat[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        mat[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        mat[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        mat[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        mat[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        mat[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        mat[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        mat[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        mat[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        mat[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        mat[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        mat[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        mat[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        mat[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        mat[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        mat[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
        return this;
    };
    cc.getMat4MultiplyValue = function (pM1, pM2) {
        var m1 = pM1.mat, m2 = pM2.mat;
        var mat = new Float32Array(16);
        mat[0] = m1[0] * m2[0] + m1[4] * m2[1] + m1[8] * m2[2] + m1[12] * m2[3];
        mat[1] = m1[1] * m2[0] + m1[5] * m2[1] + m1[9] * m2[2] + m1[13] * m2[3];
        mat[2] = m1[2] * m2[0] + m1[6] * m2[1] + m1[10] * m2[2] + m1[14] * m2[3];
        mat[3] = m1[3] * m2[0] + m1[7] * m2[1] + m1[11] * m2[2] + m1[15] * m2[3];
        mat[4] = m1[0] * m2[4] + m1[4] * m2[5] + m1[8] * m2[6] + m1[12] * m2[7];
        mat[5] = m1[1] * m2[4] + m1[5] * m2[5] + m1[9] * m2[6] + m1[13] * m2[7];
        mat[6] = m1[2] * m2[4] + m1[6] * m2[5] + m1[10] * m2[6] + m1[14] * m2[7];
        mat[7] = m1[3] * m2[4] + m1[7] * m2[5] + m1[11] * m2[6] + m1[15] * m2[7];
        mat[8] = m1[0] * m2[8] + m1[4] * m2[9] + m1[8] * m2[10] + m1[12] * m2[11];
        mat[9] = m1[1] * m2[8] + m1[5] * m2[9] + m1[9] * m2[10] + m1[13] * m2[11];
        mat[10] = m1[2] * m2[8] + m1[6] * m2[9] + m1[10] * m2[10] + m1[14] * m2[11];
        mat[11] = m1[3] * m2[8] + m1[7] * m2[9] + m1[11] * m2[10] + m1[15] * m2[11];
        mat[12] = m1[0] * m2[12] + m1[4] * m2[13] + m1[8] * m2[14] + m1[12] * m2[15];
        mat[13] = m1[1] * m2[12] + m1[5] * m2[13] + m1[9] * m2[14] + m1[13] * m2[15];
        mat[14] = m1[2] * m2[12] + m1[6] * m2[13] + m1[10] * m2[14] + m1[14] * m2[15];
        mat[15] = m1[3] * m2[12] + m1[7] * m2[13] + m1[11] * m2[14] + m1[15] * m2[15];
        return mat;
    };
    cc.kmMat4Assign = function (pOut, pIn) {
        if (pOut === pIn) {
            cc.log("cc.kmMat4Assign(): pOut equals pIn");
            return pOut;
        }
        var outArr = pOut.mat;
        var inArr = pIn.mat;
        outArr[0] = inArr[0];
        outArr[1] = inArr[1];
        outArr[2] = inArr[2];
        outArr[3] = inArr[3];
        outArr[4] = inArr[4];
        outArr[5] = inArr[5];
        outArr[6] = inArr[6];
        outArr[7] = inArr[7];
        outArr[8] = inArr[8];
        outArr[9] = inArr[9];
        outArr[10] = inArr[10];
        outArr[11] = inArr[11];
        outArr[12] = inArr[12];
        outArr[13] = inArr[13];
        outArr[14] = inArr[14];
        outArr[15] = inArr[15];
        return pOut;
    };
    proto.assignFrom = function(mat4) {
        if (this === mat4) {
            cc.log("cc.mat.Matrix4.assignFrom(): mat4 equals current matrix");
            return this;
        }
        var outArr = this.mat, inArr = mat4.mat;
        outArr[0] = inArr[0];
        outArr[1] = inArr[1];
        outArr[2] = inArr[2];
        outArr[3] = inArr[3];
        outArr[4] = inArr[4];
        outArr[5] = inArr[5];
        outArr[6] = inArr[6];
        outArr[7] = inArr[7];
        outArr[8] = inArr[8];
        outArr[9] = inArr[9];
        outArr[10] = inArr[10];
        outArr[11] = inArr[11];
        outArr[12] = inArr[12];
        outArr[13] = inArr[13];
        outArr[14] = inArr[14];
        outArr[15] = inArr[15];
        return this;
    };
    proto.equals = function(mat4) {
        if (this === mat4) {
            cc.log("cc.kmMat4AreEqual(): pMat1 and pMat2 are same object.");
            return true;
        }
        var matA = this.mat, matB = mat4.mat, EPSILON = cc.math.EPSILON;
        for (var i = 0; i < 16; i++) {
            if (!(matA[i] + EPSILON > matB[i] && matA[i] - EPSILON < matB[i]))
                return false;
        }
        return true;
    };
    cc.math.Matrix4.createByRotationX = function(radians, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var mat = matrix.mat;
        mat[0] = 1.0;
        mat[3] = mat[2] = mat[1] = 0.0;
        mat[4] = 0.0;
        mat[5] = Math.cos(radians);
        mat[6] = Math.sin(radians);
        mat[7] = 0.0;
        mat[8] = 0.0;
        mat[9] = -Math.sin(radians);
        mat[10] = Math.cos(radians);
        mat[11] = 0.0;
        mat[14] = mat[13] = mat[12] = 0.0;
        mat[15] = 1.0;
        return matrix;
    };
    cc.math.Matrix4.createByRotationY = function(radians, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var mat = matrix.mat;
        mat[0] = Math.cos(radians);
        mat[1] = 0.0;
        mat[2] = -Math.sin(radians);
        mat[3] = 0.0;
        mat[7] = mat[6] = mat[4] = 0.0;
        mat[5] = 1.0;
        mat[8] = Math.sin(radians);
        mat[9] = 0.0;
        mat[10] = Math.cos(radians);
        mat[11] = 0.0;
        mat[14] = mat[13] = mat[12] = 0.0;
        mat[15] = 1.0;
        return matrix;
    };
    cc.math.Matrix4.createByRotationZ = function(radians, matrix){
        matrix = matrix || new cc.math.Matrix4();
        var mat = matrix.mat;
        mat[0] = Math.cos(radians);
        mat[1] = Math.sin(radians);
        mat[3] = mat[2] = 0.0;
        mat[4] = -Math.sin(radians);
        mat[5] = Math.cos(radians);
        mat[7] = mat[6] = 0.0;
        mat[11] = mat[9] = mat[8] = 0.0;
        mat[10] = 1.0;
        mat[14] = mat[13] = mat[12] = 0.0;
        mat[15] = 1.0;
        return matrix;
    };
    cc.math.Matrix4.createByPitchYawRoll = function(pitch, yaw, roll, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var cr = Math.cos(pitch), sr = Math.sin(pitch);
        var cp = Math.cos(yaw), sp = Math.sin(yaw);
        var cy = Math.cos(roll), sy = Math.sin(roll);
        var srsp = sr * sp, crsp = cr * sp;
        var mat = matrix.mat;
        mat[0] = cp * cy;
        mat[4] = cp * sy;
        mat[8] = -sp;
        mat[1] = srsp * cy - cr * sy;
        mat[5] = srsp * sy + cr * cy;
        mat[9] = sr * cp;
        mat[2] = crsp * cy + sr * sy;
        mat[6] = crsp * sy - sr * cy;
        mat[10] = cr * cp;
        mat[3] = mat[7] = mat[11] = 0.0;
        mat[15] = 1.0;
        return matrix;
    };
    cc.math.Matrix4.createByQuaternion = function(quaternion, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var mat = matrix.mat;
        mat[0] = 1.0 - 2.0 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z );
        mat[1] = 2.0 * (quaternion.x * quaternion.y + quaternion.z * quaternion.w);
        mat[2] = 2.0 * (quaternion.x * quaternion.z - quaternion.y * quaternion.w);
        mat[3] = 0.0;
        mat[4] = 2.0 * ( quaternion.x * quaternion.y - quaternion.z * quaternion.w );
        mat[5] = 1.0 - 2.0 * ( quaternion.x * quaternion.x + quaternion.z * quaternion.z );
        mat[6] = 2.0 * (quaternion.z * quaternion.y + quaternion.x * quaternion.w );
        mat[7] = 0.0;
        mat[8] = 2.0 * ( quaternion.x * quaternion.z + quaternion.y * quaternion.w );
        mat[9] = 2.0 * ( quaternion.y * quaternion.z - quaternion.x * quaternion.w );
        mat[10] = 1.0 - 2.0 * ( quaternion.x * quaternion.x + quaternion.y * quaternion.y );
        mat[11] = 0.0;
        mat[14] = mat[13] = mat[12] = 0;
        mat[15] = 1.0;
        return matrix;
    };
    cc.math.Matrix4.createByRotationTranslation = function(rotation, translation, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var mat = matrix.mat, rMat = rotation.mat;
        mat[0] = rMat[0];
        mat[1] = rMat[1];
        mat[2] = rMat[2];
        mat[3] = 0.0;
        mat[4] = rMat[3];
        mat[5] = rMat[4];
        mat[6] = rMat[5];
        mat[7] = 0.0;
        mat[8] = rMat[6];
        mat[9] = rMat[7];
        mat[10] = rMat[8];
        mat[11] = 0.0;
        mat[12] = translation.x;
        mat[13] = translation.y;
        mat[14] = translation.z;
        mat[15] = 1.0;
        return matrix;
    };
    cc.math.Matrix4.createByScale = function(x, y, z, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var mat = matrix.mat;
        mat[0] = x;
        mat[5] = y;
        mat[10] = z;
        mat[15] = 1.0;
        mat[1] = mat[2] = mat[3] = mat[4] = mat[6] = mat[7] =
            mat[8] = mat[9] = mat[11] = mat[12] = mat[13] = mat[14] = 0;
         return matrix;
    };
    cc.kmMat4Translation = function (pOut, x, y, z) {
        pOut.mat[0] = pOut.mat[5] = pOut.mat[10] = pOut.mat[15] = 1.0;
        pOut.mat[1] = pOut.mat[2] = pOut.mat[3] =
            pOut.mat[4] = pOut.mat[6] = pOut.mat[7] =
                pOut.mat[8] = pOut.mat[9] = pOut.mat[11] = 0.0;
        pOut.mat[12] = x;
        pOut.mat[13] = y;
        pOut.mat[14] = z;
        return pOut;
    };
    cc.math.Matrix4.createByTranslation = function(x, y, z, matrix){
        matrix = matrix || new cc.math.Matrix4();
        matrix.identity();
        matrix.mat[12] = x;
        matrix.mat[13] = y;
        matrix.mat[14] = z;
        return matrix;
    };
    proto.getUpVec3 = function() {
        var mat = this.mat;
        var ret = new cc.math.Vec3(mat[4],mat[5], mat[6]);
        return ret.normalize();
    };
    proto.getRightVec3 = function(){
        var mat = this.mat;
        var ret = new cc.math.Vec3(mat[0],mat[1], mat[2]);
        return ret.normalize();
    };
    proto.getForwardVec3 = function() {
        var mat = this.mat;
        var ret = new cc.math.Vec3(mat[8],mat[9], mat[10]);
        return ret.normalize();
    };
    cc.kmMat4PerspectiveProjection = function (pOut, fovY, aspect, zNear, zFar) {
        var r = cc.degreesToRadians(fovY / 2);
        var deltaZ = zFar - zNear;
        var s = Math.sin(r);
        if (deltaZ === 0 || s === 0 || aspect === 0)
            return null;
        var cotangent = Math.cos(r) / s;
        pOut.identity();
        pOut.mat[0] = cotangent / aspect;
        pOut.mat[5] = cotangent;
        pOut.mat[10] = -(zFar + zNear) / deltaZ;
        pOut.mat[11] = -1;
        pOut.mat[14] = -2 * zNear * zFar / deltaZ;
        pOut.mat[15] = 0;
        return pOut;
    };
    cc.math.Matrix4.createPerspectiveProjection = function(fovY, aspect, zNear, zFar){
        var r = cc.degreesToRadians(fovY / 2), deltaZ = zFar - zNear;
        var s = Math.sin(r);
        if (deltaZ === 0 || s === 0 || aspect === 0)
            return null;
        var cotangent = Math.cos(r) / s;
        var matrix = new cc.math.Matrix4(), mat = matrix.mat;
        matrix.identity();
        mat[0] = cotangent / aspect;
        mat[5] = cotangent;
        mat[10] = -(zFar + zNear) / deltaZ;
        mat[11] = -1;
        mat[14] = -2 * zNear * zFar / deltaZ;
        mat[15] = 0;
        return matrix;
    };
    cc.kmMat4OrthographicProjection = function (pOut, left, right, bottom, top, nearVal, farVal) {
        pOut.identity();
        pOut.mat[0] = 2 / (right - left);
        pOut.mat[5] = 2 / (top - bottom);
        pOut.mat[10] = -2 / (farVal - nearVal);
        pOut.mat[12] = -((right + left) / (right - left));
        pOut.mat[13] = -((top + bottom) / (top - bottom));
        pOut.mat[14] = -((farVal + nearVal) / (farVal - nearVal));
        return pOut;
    };
    cc.math.Matrix4.createOrthographicProjection = function (left, right, bottom, top, nearVal, farVal) {
        var matrix = new cc.math.Matrix4(), mat = matrix.mat;
        matrix.identity();
        mat[0] = 2 / (right - left);
        mat[5] = 2 / (top - bottom);
        mat[10] = -2 / (farVal - nearVal);
        mat[12] = -((right + left) / (right - left));
        mat[13] = -((top + bottom) / (top - bottom));
        mat[14] = -((farVal + nearVal) / (farVal - nearVal));
        return matrix;
    };
    cc.kmMat4LookAt = function (pOut, pEye, pCenter, pUp) {
        var f = new cc.math.Vec3(pCenter), up = new cc.math.Vec3(pUp);
        f.subtract(pEye);
        f.normalize();
        up.normalize();
        var s = new cc.math.Vec3(f);
        s.cross(up);
        s.normalize();
        var u = new cc.math.Vec3(s);
        u.cross(f);
        s.normalize();
        pOut.identity();
        pOut.mat[0] = s.x;
        pOut.mat[4] = s.y;
        pOut.mat[8] = s.z;
        pOut.mat[1] = u.x;
        pOut.mat[5] = u.y;
        pOut.mat[9] = u.z;
        pOut.mat[2] = -f.x;
        pOut.mat[6] = -f.y;
        pOut.mat[10] = -f.z;
        var translate = cc.math.Matrix4.createByTranslation(-pEye.x, -pEye.y, -pEye.z);
        pOut.multiply(translate);
        return pOut;
    };
    var tempMatrix = new cc.math.Matrix4();
    proto.lookAt = function(eyeVec, centerVec, upVec) {
        var f = new cc.math.Vec3(centerVec), up = new cc.math.Vec3(upVec), mat = this.mat;
        f.subtract(eyeVec);
        f.normalize();
        up.normalize();
        var s = new cc.math.Vec3(f);
        s.cross(up);
        s.normalize();
        var u = new cc.math.Vec3(s);
        u.cross(f);
        s.normalize();
        this.identity();
        mat[0] = s.x;
        mat[4] = s.y;
        mat[8] = s.z;
        mat[1] = u.x;
        mat[5] = u.y;
        mat[9] = u.z;
        mat[2] = -f.x;
        mat[6] = -f.y;
        mat[10] = -f.z;
        tempMatrix = cc.math.Matrix4.createByTranslation(-eyeVec.x, -eyeVec.y, -eyeVec.z, tempMatrix);
        this.multiply(tempMatrix);
        return this;
    };
    cc.kmMat4RotationAxisAngle = function (pOut, axis, radians) {
        var rcos = Math.cos(radians), rsin = Math.sin(radians);
        var normalizedAxis = new cc.math.Vec3(axis);
        normalizedAxis.normalize();
        pOut.mat[0] = rcos + normalizedAxis.x * normalizedAxis.x * (1 - rcos);
        pOut.mat[1] = normalizedAxis.z * rsin + normalizedAxis.y * normalizedAxis.x * (1 - rcos);
        pOut.mat[2] = -normalizedAxis.y * rsin + normalizedAxis.z * normalizedAxis.x * (1 - rcos);
        pOut.mat[3] = 0.0;
        pOut.mat[4] = -normalizedAxis.z * rsin + normalizedAxis.x * normalizedAxis.y * (1 - rcos);
        pOut.mat[5] = rcos + normalizedAxis.y * normalizedAxis.y * (1 - rcos);
        pOut.mat[6] = normalizedAxis.x * rsin + normalizedAxis.z * normalizedAxis.y * (1 - rcos);
        pOut.mat[7] = 0.0;
        pOut.mat[8] = normalizedAxis.y * rsin + normalizedAxis.x * normalizedAxis.z * (1 - rcos);
        pOut.mat[9] = -normalizedAxis.x * rsin + normalizedAxis.y * normalizedAxis.z * (1 - rcos);
        pOut.mat[10] = rcos + normalizedAxis.z * normalizedAxis.z * (1 - rcos);
        pOut.mat[11] = 0.0;
        pOut.mat[12] = 0.0;
        pOut.mat[13] = 0.0;
        pOut.mat[14] = 0.0;
        pOut.mat[15] = 1.0;
        return pOut;
    };
    cc.math.Matrix4.createByAxisAndAngle = function(axis, radians, matrix) {
        matrix = matrix || new cc.math.Matrix4();
        var mat = this.mat, rcos = Math.cos(radians), rsin = Math.sin(radians) ;
        var normalizedAxis = new cc.math.Vec3(axis);
        normalizedAxis.normalize();
        mat[0] = rcos + normalizedAxis.x * normalizedAxis.x * (1 - rcos);
        mat[1] = normalizedAxis.z * rsin + normalizedAxis.y * normalizedAxis.x * (1 - rcos);
        mat[2] = -normalizedAxis.y * rsin + normalizedAxis.z * normalizedAxis.x * (1 - rcos);
        mat[3] = 0.0;
        mat[4] = -normalizedAxis.z * rsin + normalizedAxis.x * normalizedAxis.y * (1 - rcos);
        mat[5] = rcos + normalizedAxis.y * normalizedAxis.y * (1 - rcos);
        mat[6] = normalizedAxis.x * rsin + normalizedAxis.z * normalizedAxis.y * (1 - rcos);
        mat[7] = 0.0;
        mat[8] = normalizedAxis.y * rsin + normalizedAxis.x * normalizedAxis.z * (1 - rcos);
        mat[9] = -normalizedAxis.x * rsin + normalizedAxis.y * normalizedAxis.z * (1 - rcos);
        mat[10] = rcos + normalizedAxis.z * normalizedAxis.z * (1 - rcos);
        mat[11] = 0.0;
        mat[12] = mat[13] = mat[14] = 0.0;
        mat[15] = 1.0;
        return matrix;
    };
    proto.extractRotation = function(){
        var matrix = new cc.math.Matrix3(), mat4 = this.mat, mat3 = matrix.mat;
        mat3[0] = mat4[0];
        mat3[1] = mat4[1];
        mat3[2] = mat4[2];
        mat3[3] = mat4[4];
        mat3[4] = mat4[5];
        mat3[5] = mat4[6];
        mat3[6] = mat4[8];
        mat3[7] = mat4[9];
        mat3[8] = mat4[10];
        return matrix;
    };
    proto.extractPlane = function(planeType) {
        var plane = new cc.math.Plane(), mat = this.mat;
        switch (planeType) {
            case cc.math.Plane.RIGHT:
                plane.a = mat[3] - mat[0];
                plane.b = mat[7] - mat[4];
                plane.c = mat[11] - mat[8];
                plane.d = mat[15] - mat[12];
                break;
            case cc.math.Plane.LEFT:
                plane.a = mat[3] + mat[0];
                plane.b = mat[7] + mat[4];
                plane.c = mat[11] + mat[8];
                plane.d = mat[15] + mat[12];
                break;
            case cc.math.Plane.BOTTOM:
                plane.a = mat[3] + mat[1];
                plane.b = mat[7] + mat[5];
                plane.c = mat[11] + mat[9];
                plane.d = mat[15] + mat[13];
                break;
            case cc.math.Plane.TOP:
                plane.a = mat[3] - mat[1];
                plane.b = mat[7] - mat[5];
                plane.c = mat[11] - mat[9];
                plane.d = mat[15] - mat[13];
                break;
            case cc.math.Plane.FAR:
                plane.a = mat[3] - mat[2];
                plane.b = mat[7] - mat[6];
                plane.c = mat[11] - mat[10];
                plane.d = mat[15] - mat[14];
                break;
            case cc.math.Plane.NEAR:
                plane.a = mat[3] + mat[2];
                plane.b = mat[7] + mat[6];
                plane.c = mat[11] + mat[10];
                plane.d = mat[15] + mat[14];
                break;
            default:
                cc.log("cc.math.Matrix4.extractPlane: Invalid plane index");
                break;
        }
        var t = Math.sqrt(plane.a * plane.a + plane.b * plane.b + plane.c * plane.c);
        plane.a /= t;
        plane.b /= t;
        plane.c /= t;
        plane.d /= t;
        return plane;
    };
    proto.toAxisAndAngle = function() {
        var rotation = this.extractRotation();
        var temp = cc.math.Quaternion.rotationMatrix(rotation);
        return temp.toAxisAndAngle();
    };
})(cc);
(function(cc){
    cc.math.Plane = function (a, b, c, d) {
        if (a && b === undefined) {
            this.a = a.a;
            this.b = a.b;
            this.c = a.c;
            this.d = a.d;
        } else {
            this.a = a || 0;
            this.b = b || 0;
            this.c = c || 0;
            this.d = d || 0;
        }
    };
    cc.kmPlane = cc.math.Plane;
    var proto = cc.math.Plane.prototype;
    cc.math.Plane.LEFT = 0;
    cc.math.Plane.RIGHT = 1;
    cc.math.Plane.BOTTOM = 2;
    cc.math.Plane.TOP = 3;
    cc.math.Plane.NEAR = 4;
    cc.math.Plane.FAR = 5;
    cc.math.Plane.POINT_INFRONT_OF_PLANE = 0;
    cc.math.Plane.POINT_BEHIND_PLANE = 1;
    cc.math.Plane.POINT_ON_PLANE = 2;
    proto.dot = function(vec4){
        return (this.a * vec4.x + this.b * vec4.y + this.c * vec4.z + this.d * vec4.w);
    };
    proto.dotCoord = function(vec3) {
        return (this.a * vec3.x + this.b * vec3.y + this.c * vec3.z + this.d);
    };
    proto.dotNormal = function(vec3) {
        return (this.a * vec3.x + this.b * vec3.y + this.c * vec3.z);
    };
    cc.math.Plane.fromPointNormal = function(vec3, normal) {
        return new cc.math.Plane(normal.x, normal.y, normal.z, -normal.dot(vec3));
    };
    cc.math.Plane.fromPoints = function(vec1, vec2, vec3) {
        var  v1 = new cc.math.Vec3(vec2), v2 = new cc.math.Vec3(vec3), plane = new cc.math.Plane();
        v1.subtract(vec1);
        v2.subtract(vec1);
        v1.cross(v2);
        v1.normalize();
        plane.a = v1.x;
        plane.b = v1.y;
        plane.c = v1.z;
        plane.d = v1.scale(-1.0).dot(vec1);
        return plane;
    };
    proto.normalize = function(){
        var n = new cc.math.Vec3(this.a, this.b, this.c), l = 1.0 / n.length();
        n.normalize();
        this.a = n.x;
        this.b = n.y;
        this.c = n.z;
        this.d = this.d * l;
        return this;
    };
    proto.classifyPoint = function(vec3) {
        var distance = this.a * vec3.x + this.b * vec3.y + this.c * vec3.z + this.d;
        if(distance > 0.001)
            return cc.math.Plane.POINT_INFRONT_OF_PLANE;
        if(distance < -0.001)
            return cc.math.Plane.POINT_BEHIND_PLANE;
        return cc.math.Plane.POINT_ON_PLANE;
    };
})(cc);
(function(cc) {
    cc.math.Quaternion = function (x, y, z, w) {
        if (x && y === undefined) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            this.w = x.w;
        } else {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
            this.w = w || 0;
        }
    };
    cc.kmQuaternion = cc.math.Quaternion;
    var proto = cc.math.Quaternion.prototype;
    proto.conjugate = function (quaternion) {
        this.x = -quaternion.x;
        this.y = -quaternion.y;
        this.z = -quaternion.z;
        this.w = quaternion.w;
        return this;
    };
    proto.dot = function(quaternion) {
        return (this.w * quaternion.w + this.x * quaternion.x + this.y * quaternion.y + this.z * quaternion.z);
    };
    proto.exponential = function(){
        return this;
    };
    proto.identity = function(){
        this.x = 0.0;
        this.y = 0.0;
        this.z = 0.0;
        this.w = 1.0;
        return this;
    };
    proto.inverse = function(){
        var len = this.length();
        if (Math.abs(len) > cc.math.EPSILON) {
            this.x = 0.0;
            this.y = 0.0;
            this.z = 0.0;
            this.w = 0.0;
            return this;
        }
        this.conjugate(this).scale(1.0 / len);
        return this;
    };
    proto.isIdentity = function(){
        return (this.x === 0.0 && this.y === 0.0 && this.z === 0.0 && this.w === 1.0);
    };
    proto.length = function() {
        return Math.sqrt(this.lengthSq());
    };
    proto.lengthSq = function() {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    };
    proto.multiply = function(quaternion) {
        var x = this.x, y = this.y, z = this.z, w = this.w;
        this.w = w * quaternion.w - x * quaternion.x - y * quaternion.y - z * quaternion.z;
        this.x = w * quaternion.x + x * quaternion.w + y * quaternion.z - z * quaternion.y;
        this.y = w * quaternion.y + y * quaternion.w + z * quaternion.x - x * quaternion.z;
        this.z = w * quaternion.z + z * quaternion.w + x * quaternion.y - y * quaternion.x;
        return this;
    };
    proto.normalize = function(){
        var length = this.length();
        if (Math.abs(length) <= cc.math.EPSILON)
            throw new Error("current quaternion is an invalid value");
        this.scale(1.0 / length);
        return this;
    };
    proto.rotationAxis = function(axis, angle){
        var rad = angle * 0.5, scale = Math.sin(rad);
        this.w = Math.cos(rad);
        this.x = axis.x * scale;
        this.y = axis.y * scale;
        this.z = axis.z * scale;
        return this;
    };
    cc.math.Quaternion.rotationMatrix = function (mat3) {
        if (!mat3)
            return null;
        var x, y, z, w;
        var m4x4 = [], mat = mat3.mat, scale = 0.0;
        m4x4[0] = mat[0];
        m4x4[1] = mat[3];
        m4x4[2] = mat[6];
        m4x4[4] = mat[1];
        m4x4[5] = mat[4];
        m4x4[6] = mat[7];
        m4x4[8] = mat[2];
        m4x4[9] = mat[5];
        m4x4[10] = mat[8];
        m4x4[15] = 1;
        var pMatrix = m4x4[0];
        var diagonal = pMatrix[0] + pMatrix[5] + pMatrix[10] + 1;
        if (diagonal > cc.math.EPSILON) {
            scale = Math.sqrt(diagonal) * 2;
            x = ( pMatrix[9] - pMatrix[6] ) / scale;
            y = ( pMatrix[2] - pMatrix[8] ) / scale;
            z = ( pMatrix[4] - pMatrix[1] ) / scale;
            w = 0.25 * scale;
        } else {
            if (pMatrix[0] > pMatrix[5] && pMatrix[0] > pMatrix[10]) {
                scale = Math.sqrt(1.0 + pMatrix[0] - pMatrix[5] - pMatrix[10]) * 2.0;
                x = 0.25 * scale;
                y = (pMatrix[4] + pMatrix[1] ) / scale;
                z = (pMatrix[2] + pMatrix[8] ) / scale;
                w = (pMatrix[9] - pMatrix[6] ) / scale;
            }
            else if (pMatrix[5] > pMatrix[10]) {
                scale = Math.sqrt(1.0 + pMatrix[5] - pMatrix[0] - pMatrix[10]) * 2.0;
                x = (pMatrix[4] + pMatrix[1] ) / scale;
                y = 0.25 * scale;
                z = (pMatrix[9] + pMatrix[6] ) / scale;
                w = (pMatrix[2] - pMatrix[8] ) / scale;
            } else {
                scale = Math.sqrt(1.0 + pMatrix[10] - pMatrix[0] - pMatrix[5]) * 2.0;
                x = (pMatrix[2] + pMatrix[8] ) / scale;
                y = (pMatrix[9] + pMatrix[6] ) / scale;
                z = 0.25 * scale;
                w = (pMatrix[4] - pMatrix[1] ) / scale;
            }
        }
        return new cc.math.Quaternion(x, y, z, w);
    };
    cc.math.Quaternion.rotationYawPitchRoll = function (yaw, pitch, roll) {
        var ex, ey, ez;
        var cr, cp, cy, sr, sp, sy, cpcy, spsy;
        ex = cc.degreesToRadians(pitch) / 2.0;
        ey = cc.degreesToRadians(yaw) / 2.0;
        ez = cc.degreesToRadians(roll) / 2.0;
        cr = Math.cos(ex);
        cp = Math.cos(ey);
        cy = Math.cos(ez);
        sr = Math.sin(ex);
        sp = Math.sin(ey);
        sy = Math.sin(ez);
        cpcy = cp * cy;
        spsy = sp * sy;
        var ret = new cc.math.Quaternion();
        ret.w = cr * cpcy + sr * spsy;
        ret.x = sr * cpcy - cr * spsy;
        ret.y = cr * sp * cy + sr * cp * sy;
        ret.z = cr * cp * sy - sr * sp * cy;
        ret.normalize();
        return ret;
    };
    proto.slerp = function(quaternion, t) {
        if (this.x === quaternion.x && this.y === quaternion.y && this.z === quaternion.z && this.w === quaternion.w) {
            return this;
        }
        var ct = this.dot(quaternion), theta = Math.acos(ct), st = Math.sqrt(1.0 - cc.math.square(ct));
        var stt = Math.sin(t * theta) / st, somt = Math.sin((1.0 - t) * theta) / st;
        var temp2 = new cc.math.Quaternion(quaternion);
        this.scale(somt);
        temp2.scale(stt);
        this.add(temp2);
        return this;
    };
    proto.toAxisAndAngle = function(){
        var tempAngle;
        var scale;
        var retAngle, retAxis = new cc.math.Vec3();
        tempAngle = Math.acos(this.w);
        scale = Math.sqrt(cc.math.square(this.x) + cc.math.square(this.y) + cc.math.square(this.z));
        if (((scale > -cc.math.EPSILON) && scale < cc.math.EPSILON)
            || (scale < 2 * Math.PI + cc.math.EPSILON && scale > 2 * Math.PI - cc.math.EPSILON)) {
            retAngle = 0.0;
            retAxis.x = 0.0;
            retAxis.y = 0.0;
            retAxis.z = 1.0;
        } else {
            retAngle = tempAngle * 2.0;
            retAxis.x = this.x / scale;
            retAxis.y = this.y / scale;
            retAxis.z = this.z / scale;
            retAxis.normalize();
        }
         return {axis: retAxis, angle: retAngle};
    };
    proto.scale = function(scale) {
        this.x *= scale;
        this.y *= scale;
        this.z *= scale;
        this.w *= scale;
        return this;
    };
    proto.assignFrom = function(quaternion){
        this.x = quaternion.x;
        this.y = quaternion.y;
        this.z = quaternion.z;
        this.w = quaternion.w;
        return this;
    };
    proto.add = function(quaternion) {
        this.x += quaternion.x;
        this.y += quaternion.y;
        this.z += quaternion.z;
        this.w += quaternion.w;
        return this;
    };
    cc.math.Quaternion.rotationBetweenVec3 = function(vec1, vec2, fallback) {
        var v1 = new cc.math.Vec3(vec1), v2 = new cc.math.Vec3(vec2);
        v1.normalize();
        v2.normalize();
        var a = v1.dot(v2), quaternion = new cc.math.Quaternion();
        if (a >= 1.0) {
            quaternion.identity();
            return quaternion;
        }
        if (a < (1e-6 - 1.0)) {
            if (Math.abs(fallback.lengthSq()) < cc.math.EPSILON) {
                quaternion.rotationAxis(fallback, Math.PI);
            } else {
                var axis = new cc.math.Vec3(1.0, 0.0, 0.0);
                axis.cross(vec1);
                if (Math.abs(axis.lengthSq()) < cc.math.EPSILON) {
                    axis.fill(0.0, 1.0, 0.0);
                    axis.cross(vec1);
                }
                axis.normalize();
                quaternion.rotationAxis(axis, Math.PI);
            }
        } else {
            var s = Math.sqrt((1 + a) * 2), invs = 1 / s;
            v1.cross(v2);
            quaternion.x = v1.x * invs;
            quaternion.y = v1.y * invs;
            quaternion.z = v1.z * invs;
            quaternion.w = s * 0.5;
            quaternion.normalize();
        }
        return quaternion;
    };
    proto.multiplyVec3 = function(vec){
        var x = this.x, y = this.y, z = this.z, retVec = new cc.math.Vec3(vec);
        var uv = new cc.math.Vec3(x, y, z), uuv = new cc.math.Vec3(x, y, z);
        uv.cross(vec);
        uuv.cross(uv);
        uv.scale((2.0 * q.w));
        uuv.scale(2.0);
        retVec.add(uv);
        retVec.add(uuv);
        return retVec;
    };
})(cc);
cc.math.AABB = function (min, max) {
    this.min = min || new cc.math.Vec3();
    this.max = max || new cc.math.Vec3();
};
cc.math.AABB.prototype.containsPoint = function (point) {
    return (point.x >= this.min.x && point.x <= this.max.x &&
    point.y >= this.min.y && point.y <= this.max.y &&
    point.z >= this.min.z && point.z <= this.max.z);
};
cc.math.AABB.containsPoint = function (pPoint, pBox) {
    return (pPoint.x >= pBox.min.x && pPoint.x <= pBox.max.x &&
        pPoint.y >= pBox.min.y && pPoint.y <= pBox.max.y &&
        pPoint.z >= pBox.min.z && pPoint.z <= pBox.max.z);
};
cc.math.AABB.prototype.assignFrom = function(aabb){
    this.min.assignFrom(aabb.min);
    this.max.assignFrom(aabb.max);
};
cc.math.AABB.assign = function (pOut, pIn) {
    pOut.min.assignFrom(pIn.min);
    pOut.max.assignFrom(pIn.max);
    return pOut;
};
(function(cc){
    cc.math.Matrix4Stack = function(top, stack) {
        this.top = top;
        this.stack = stack || [];
    };
    cc.km_mat4_stack = cc.math.Matrix4Stack;
    var proto = cc.math.Matrix4Stack.prototype;
    proto.initialize = function() {
        this.stack.length = 0;
        this.top = null;
    };
    cc.km_mat4_stack_push = function(stack, item){
        stack.stack.push(stack.top);
        stack.top = new cc.math.Matrix4(item);
    };
    cc.km_mat4_stack_pop = function(stack, pOut){
        stack.top = stack.stack.pop();
    };
    cc.km_mat4_stack_release = function(stack){
        stack.stack = null;
        stack.top = null;
    };
    proto.push = function(item) {
        item = item || this.top;
        this.stack.push(this.top);
        this.top = new cc.math.Matrix4(item);
    };
    proto.pop = function() {
        this.top = this.stack.pop();
    };
    proto.release = function(){
        this.stack = null;
        this.top = null;
        this._matrixPool = null;
    };
    proto._getFromPool = function (item) {
        var pool = this._matrixPool;
        if (pool.length === 0)
            return new cc.math.Matrix4(item);
        var ret = pool.pop();
        ret.assignFrom(item);
        return ret;
    };
    proto._putInPool = function(matrix){
        this._matrixPool.push(matrix);
    };
})(cc);
(function(cc) {
    cc.KM_GL_MODELVIEW = 0x1700;
    cc.KM_GL_PROJECTION = 0x1701;
    cc.KM_GL_TEXTURE = 0x1702;
    cc.modelview_matrix_stack = new cc.math.Matrix4Stack();
    cc.projection_matrix_stack = new cc.math.Matrix4Stack();
    cc.texture_matrix_stack = new cc.math.Matrix4Stack();
    cc.current_stack = null;
    var initialized = false;
    cc.lazyInitialize = function () {
        if (!initialized) {
            var identity = new cc.math.Matrix4();
            cc.modelview_matrix_stack.initialize();
            cc.projection_matrix_stack.initialize();
            cc.texture_matrix_stack.initialize();
            cc.current_stack = cc.modelview_matrix_stack;
            cc.initialized = true;
            identity.identity();
            cc.modelview_matrix_stack.push(identity);
            cc.projection_matrix_stack.push(identity);
            cc.texture_matrix_stack.push(identity);
        }
    };
    cc.lazyInitialize();
    cc.kmGLFreeAll = function () {
        cc.modelview_matrix_stack.release();
        cc.modelview_matrix_stack = null;
        cc.projection_matrix_stack.release();
        cc.projection_matrix_stack = null;
        cc.texture_matrix_stack.release();
        cc.texture_matrix_stack = null;
        cc.initialized = false;
        cc.current_stack = null;
    };
    cc.kmGLPushMatrix = function () {
        cc.current_stack.push(cc.current_stack.top);
    };
    cc.kmGLPushMatrixWitMat4 = function (saveMat) {
        cc.current_stack.stack.push(cc.current_stack.top);
        saveMat.assignFrom(cc.current_stack.top);
        cc.current_stack.top = saveMat;
    };
    cc.kmGLPopMatrix = function () {
        cc.current_stack.top = cc.current_stack.stack.pop();
    };
    cc.kmGLMatrixMode = function (mode) {
        switch (mode) {
            case cc.KM_GL_MODELVIEW:
                cc.current_stack = cc.modelview_matrix_stack;
                break;
            case cc.KM_GL_PROJECTION:
                cc.current_stack = cc.projection_matrix_stack;
                break;
            case cc.KM_GL_TEXTURE:
                cc.current_stack = cc.texture_matrix_stack;
                break;
            default:
                throw new Error("Invalid matrix mode specified");
                break;
        }
    };
    cc.kmGLLoadIdentity = function () {
        cc.current_stack.top.identity();
    };
    cc.kmGLLoadMatrix = function (pIn) {
        cc.current_stack.top.assignFrom(pIn);
    };
    cc.kmGLMultMatrix = function (pIn) {
        cc.current_stack.top.multiply(pIn);
    };
    var tempMatrix = new cc.math.Matrix4();
    cc.kmGLTranslatef = function (x, y, z) {
        var translation = cc.math.Matrix4.createByTranslation(x, y, z, tempMatrix);
        cc.current_stack.top.multiply(translation);
    };
    var tempVector3 = new cc.math.Vec3();
    cc.kmGLRotatef = function (angle, x, y, z) {
        tempVector3.fill(x, y, z);
        var rotation = cc.math.Matrix4.createByAxisAndAngle(tempVector3, cc.degreesToRadians(angle), tempMatrix);
        cc.current_stack.top.multiply(rotation);
    };
    cc.kmGLScalef = function (x, y, z) {
        var scaling = cc.math.Matrix4.createByScale(x, y, z, tempMatrix);
        cc.current_stack.top.multiply(scaling);
    };
    cc.kmGLGetMatrix = function (mode, pOut) {
        switch (mode) {
            case cc.KM_GL_MODELVIEW:
                pOut.assignFrom(cc.modelview_matrix_stack.top);
                break;
            case cc.KM_GL_PROJECTION:
                pOut.assignFrom(cc.projection_matrix_stack.top);
                break;
            case cc.KM_GL_TEXTURE:
                pOut.assignFrom(cc.texture_matrix_stack.top);
                break;
            default:
                throw new Error("Invalid matrix mode specified");
                break;
        }
    };
})(cc);
//-----------------------Shader_Position_uColor Shader Source--------------------------
cc.SHADER_POSITION_UCOLOR_FRAG =
        "precision lowp float;\n"
        + "varying vec4 v_fragmentColor;\n"
        + "void main()                              \n"
        + "{ \n"
        + "    gl_FragColor = v_fragmentColor;      \n"
        + "}\n";
cc.SHADER_POSITION_UCOLOR_VERT =
        "attribute vec4 a_position;\n"
        + "uniform    vec4 u_color;\n"
        + "uniform float u_pointSize;\n"
        + "varying lowp vec4 v_fragmentColor; \n"
        + "void main(void)   \n"
        + "{\n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "    gl_PointSize = u_pointSize;          \n"
        + "    v_fragmentColor = u_color;           \n"
        + "}";
cc.SHADER_POSITION_COLOR_FRAG =
        "precision lowp float; \n"
        + "varying vec4 v_fragmentColor; \n"
        + "void main() \n"
        + "{ \n"
        + "     gl_FragColor = v_fragmentColor; \n"
        + "} ";
cc.SHADER_POSITION_COLOR_VERT =
        "attribute vec4 a_position;\n"
        + "attribute vec4 a_color;\n"
        + "varying lowp vec4 v_fragmentColor;\n"
        + "void main()\n"
        + "{\n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "    v_fragmentColor = a_color;             \n"
        + "}";
cc.SHADER_SPRITE_POSITION_COLOR_VERT =
        "attribute vec4 a_position;\n"
        + "attribute vec4 a_color;\n"
        + "varying lowp vec4 v_fragmentColor;\n"
        + "void main()\n"
        + "{\n"
        + "    gl_Position = CC_PMatrix * a_position;  \n"
        + "    v_fragmentColor = a_color;             \n"
        + "}";
cc.SHADER_POSITION_COLOR_LENGTH_TEXTURE_FRAG =
        "// #extension GL_OES_standard_derivatives : enable\n"
        + "varying mediump vec4 v_color;\n"
        + "varying mediump vec2 v_texcoord;\n"
        + "void main()	\n"
        + "{ \n"
        + "// #if defined GL_OES_standard_derivatives	\n"
        + "// gl_FragColor = v_color*smoothstep(0.0, length(fwidth(v_texcoord)), 1.0 - length(v_texcoord)); \n"
        + "// #else	\n"
        + "gl_FragColor = v_color * step(0.0, 1.0 - length(v_texcoord)); \n"
        + "// #endif \n"
        + "}";
cc.SHADER_POSITION_COLOR_LENGTH_TEXTURE_VERT =
        "attribute mediump vec4 a_position; \n"
        + "attribute mediump vec2 a_texcoord; \n"
        + "attribute mediump vec4 a_color;	\n"
        + "varying mediump vec4 v_color; \n"
        + "varying mediump vec2 v_texcoord;	\n"
        + "void main() \n"
        + "{ \n"
        + "     v_color = a_color;//vec4(a_color.rgb * a_color.a, a_color.a); \n"
        + "     v_texcoord = a_texcoord; \n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_FRAG =
        "precision lowp float;   \n"
        + "varying vec2 v_texCoord;  \n"
        + "void main() \n"
        + "{  \n"
        + "    gl_FragColor =  texture2D(CC_Texture0, v_texCoord);   \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_VERT =
        "attribute vec4 a_position; \n"
        + "attribute vec2 a_texCoord; \n"
        + "varying mediump vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "    v_texCoord = a_texCoord;               \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_UCOLOR_FRAG =
        "precision lowp float;  \n"
        + "uniform vec4 u_color; \n"
        + "varying vec2 v_texCoord; \n"
        + "void main() \n"
        + "{  \n"
        + "    gl_FragColor =  texture2D(CC_Texture0, v_texCoord) * u_color;    \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_UCOLOR_VERT =
        "attribute vec4 a_position;\n"
        + "attribute vec2 a_texCoord; \n"
        + "varying mediump vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "    v_texCoord = a_texCoord;                 \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_A8COLOR_FRAG =
        "precision lowp float;  \n"
        + "varying vec4 v_fragmentColor; \n"
        + "varying vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_FragColor = vec4( v_fragmentColor.rgb,         \n"
        + "        v_fragmentColor.a * texture2D(CC_Texture0, v_texCoord).a   \n"
        + "    ); \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_A8COLOR_VERT =
        "attribute vec4 a_position; \n"
        + "attribute vec2 a_texCoord; \n"
        + "attribute vec4 a_color;  \n"
        + "varying lowp vec4 v_fragmentColor; \n"
        + "varying mediump vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "    v_fragmentColor = a_color; \n"
        + "    v_texCoord = a_texCoord; \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_COLOR_FRAG =
        "precision lowp float;\n"
        + "varying vec4 v_fragmentColor; \n"
        + "varying vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_FragColor = v_fragmentColor * texture2D(CC_Texture0, v_texCoord); \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_COLOR_VERT =
        "attribute vec4 a_position; \n"
        + "attribute vec2 a_texCoord; \n"
        + "attribute vec4 a_color;  \n"
        + "varying lowp vec4 v_fragmentColor; \n"
        + "varying mediump vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_Position = (CC_PMatrix * CC_MVMatrix) * a_position;  \n"
        + "    v_fragmentColor = a_color; \n"
        + "    v_texCoord = a_texCoord; \n"
        + "}";
cc.SHADER_SPRITE_POSITION_TEXTURE_COLOR_VERT =
        "attribute vec4 a_position; \n"
        + "attribute vec2 a_texCoord; \n"
        + "attribute vec4 a_color;  \n"
        + "varying lowp vec4 v_fragmentColor; \n"
        + "varying mediump vec2 v_texCoord; \n"
        + "void main() \n"
        + "{ \n"
        + "    gl_Position = CC_PMatrix * a_position;  \n"
        + "    v_fragmentColor = a_color; \n"
        + "    v_texCoord = a_texCoord; \n"
        + "}";
cc.SHADER_POSITION_TEXTURE_COLOR_ALPHATEST_FRAG =
        "precision lowp float;   \n"
        + "varying vec4 v_fragmentColor; \n"
        + "varying vec2 v_texCoord;   \n"
        + "uniform float CC_alpha_value; \n"
        + "void main() \n"
        + "{  \n"
        + "    vec4 texColor = texture2D(CC_Texture0, v_texCoord);  \n"
        + "    if ( texColor.a <= CC_alpha_value )          \n"
        + "        discard; \n"
        + "    gl_FragColor = texColor * v_fragmentColor;  \n"
        + "}";
cc.SHADEREX_SWITCHMASK_FRAG =
        "precision lowp float; \n"
        + "varying vec4 v_fragmentColor; \n"
        + "varying vec2 v_texCoord; \n"
        + "uniform sampler2D u_texture;  \n"
        + "uniform sampler2D   u_mask;   \n"
        + "void main()  \n"
        + "{  \n"
        + "    vec4 texColor   = texture2D(u_texture, v_texCoord);  \n"
        + "    vec4 maskColor  = texture2D(u_mask, v_texCoord); \n"
        + "    vec4 finalColor = vec4(texColor.r, texColor.g, texColor.b, maskColor.a * texColor.a);        \n"
        + "    gl_FragColor    = v_fragmentColor * finalColor; \n"
        + "}";
cc.shaderCache = {
    TYPE_POSITION_TEXTURECOLOR: 0,
    TYPE_POSITION_TEXTURECOLOR_ALPHATEST: 1,
    TYPE_POSITION_COLOR: 2,
    TYPE_POSITION_TEXTURE: 3,
    TYPE_POSITION_TEXTURE_UCOLOR: 4,
    TYPE_POSITION_TEXTURE_A8COLOR: 5,
    TYPE_POSITION_UCOLOR: 6,
    TYPE_POSITION_LENGTH_TEXTURECOLOR: 7,
    TYPE_SPRITE_POSITION_TEXTURECOLOR: 8,
    TYPE_SPRITE_POSITION_TEXTURECOLOR_ALPHATEST: 9,
    TYPE_SPRITE_POSITION_COLOR: 10,
    TYPE_MAX: 10,
    _programs: {},
    _init: function () {
        this.loadDefaultShaders();
        return true;
    },
    _loadDefaultShader: function (program, type) {
        switch (type) {
            case this.TYPE_POSITION_TEXTURECOLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_TEXTURE_COLOR_VERT, cc.SHADER_POSITION_TEXTURE_COLOR_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_SPRITE_POSITION_TEXTURECOLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_SPRITE_POSITION_TEXTURE_COLOR_VERT, cc.SHADER_POSITION_TEXTURE_COLOR_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_POSITION_TEXTURECOLOR_ALPHATEST:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_TEXTURE_COLOR_VERT, cc.SHADER_POSITION_TEXTURE_COLOR_ALPHATEST_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_SPRITE_POSITION_TEXTURECOLOR_ALPHATEST:
                program.initWithVertexShaderByteArray(cc.SHADER_SPRITE_POSITION_TEXTURE_COLOR_VERT, cc.SHADER_POSITION_TEXTURE_COLOR_ALPHATEST_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_POSITION_COLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_COLOR_VERT, cc.SHADER_POSITION_COLOR_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                break;
            case this.TYPE_SPRITE_POSITION_COLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_SPRITE_POSITION_COLOR_VERT, cc.SHADER_POSITION_COLOR_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                break;
            case this.TYPE_POSITION_TEXTURE:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_TEXTURE_VERT, cc.SHADER_POSITION_TEXTURE_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_POSITION_TEXTURE_UCOLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_TEXTURE_UCOLOR_VERT, cc.SHADER_POSITION_TEXTURE_UCOLOR_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_POSITION_TEXTURE_A8COLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_TEXTURE_A8COLOR_VERT, cc.SHADER_POSITION_TEXTURE_A8COLOR_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                break;
            case this.TYPE_POSITION_UCOLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_UCOLOR_VERT, cc.SHADER_POSITION_UCOLOR_FRAG);
                program.addAttribute("aVertex", cc.VERTEX_ATTRIB_POSITION);
                break;
            case this.TYPE_POSITION_LENGTH_TEXTURECOLOR:
                program.initWithVertexShaderByteArray(cc.SHADER_POSITION_COLOR_LENGTH_TEXTURE_VERT, cc.SHADER_POSITION_COLOR_LENGTH_TEXTURE_FRAG);
                program.addAttribute(cc.ATTRIBUTE_NAME_POSITION, cc.VERTEX_ATTRIB_POSITION);
                program.addAttribute(cc.ATTRIBUTE_NAME_TEX_COORD, cc.VERTEX_ATTRIB_TEX_COORDS);
                program.addAttribute(cc.ATTRIBUTE_NAME_COLOR, cc.VERTEX_ATTRIB_COLOR);
                break;
            default:
                cc.log("cocos2d: cc.shaderCache._loadDefaultShader, error shader type");
                return;
        }
        program.link();
        program.updateUniforms();
    },
    loadDefaultShaders: function () {
        var program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURECOLOR);
        this._programs[cc.SHADER_POSITION_TEXTURECOLOR] = program;
        this._programs["ShaderPositionTextureColor"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_SPRITE_POSITION_TEXTURECOLOR);
        this._programs[cc.SHADER_SPRITE_POSITION_TEXTURECOLOR] = program;
        this._programs["ShaderSpritePositionTextureColor"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURECOLOR_ALPHATEST);
        this._programs[cc.SHADER_POSITION_TEXTURECOLORALPHATEST] = program;
        this._programs["ShaderPositionTextureColorAlphaTest"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_SPRITE_POSITION_TEXTURECOLOR_ALPHATEST);
        this._programs[cc.SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST] = program;
        this._programs["ShaderSpritePositionTextureColorAlphaTest"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_COLOR);
        this._programs[cc.SHADER_POSITION_COLOR] = program;
        this._programs["ShaderPositionColor"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_SPRITE_POSITION_COLOR);
        this._programs[cc.SHADER_SPRITE_POSITION_COLOR] = program;
        this._programs["ShaderSpritePositionColor"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURE);
        this._programs[cc.SHADER_POSITION_TEXTURE] = program;
        this._programs["ShaderPositionTexture"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURE_UCOLOR);
        this._programs[cc.SHADER_POSITION_TEXTURE_UCOLOR] = program;
        this._programs["ShaderPositionTextureUColor"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURE_A8COLOR);
        this._programs[cc.SHADER_POSITION_TEXTUREA8COLOR] = program;
        this._programs["ShaderPositionTextureA8Color"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_UCOLOR);
        this._programs[cc.SHADER_POSITION_UCOLOR] = program;
        this._programs["ShaderPositionUColor"] = program;
        program = new cc.GLProgram();
        this._loadDefaultShader(program, this.TYPE_POSITION_LENGTH_TEXTURECOLOR);
        this._programs[cc.SHADER_POSITION_LENGTHTEXTURECOLOR] = program;
        this._programs["ShaderPositionLengthTextureColor"] = program;
    },
    reloadDefaultShaders: function () {
        var program = this.programForKey(cc.SHADER_POSITION_TEXTURECOLOR);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURECOLOR);
        program = this.programForKey(cc.SHADER_SPRITE_POSITION_TEXTURECOLOR);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_SPRITE_POSITION_TEXTURECOLOR);
        program = this.programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURECOLOR_ALPHATEST);
        program = this.programForKey(cc.SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_SPRITE_POSITION_TEXTURECOLOR_ALPHATEST);
        program = this.programForKey(cc.SHADER_POSITION_COLOR);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_COLOR);
        program = this.programForKey(cc.SHADER_POSITION_TEXTURE);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURE);
        program = this.programForKey(cc.SHADER_POSITION_TEXTURE_UCOLOR);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURE_UCOLOR);
        program = this.programForKey(cc.SHADER_POSITION_TEXTUREA8COLOR);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_TEXTURE_A8COLOR);
        program = this.programForKey(cc.SHADER_POSITION_UCOLOR);
        program.reset();
        this._loadDefaultShader(program, this.TYPE_POSITION_UCOLOR);
    },
    programForKey: function (key) {
        return this._programs[key];
    },
    getProgram: function (shaderName) {
        return this._programs[shaderName];
    },
    addProgram: function (program, key) {
        this._programs[key] = program;
    }
};
cc.GLProgram = cc.Class.extend({
    _glContext: null,
    _programObj: null,
    _vertShader: null,
    _fragShader: null,
    _uniforms: null,
    _hashForUniforms: null,
    _usesTime: false,
    _updateUniformLocation: function (location) {
        if (!location)
            return false;
        var updated;
        var element = this._hashForUniforms[location];
        if (!element) {
            element = [
                arguments[1],
                arguments[2],
                arguments[3],
                arguments[4]
            ];
            this._hashForUniforms[location] = element;
            updated = true;
        } else {
            updated = false;
            var count = arguments.length-1;
            for (var i = 0; i < count; ++i) {
                if (arguments[i+1] !== element[i]) {
                    element[i] = arguments[i+1];
                    updated = true;
                }
            }
        }
        return updated;
    },
    _description: function () {
        return "<CCGLProgram = " + this.toString() + " | Program = " + this._programObj.toString() + ", VertexShader = " +
            this._vertShader.toString() + ", FragmentShader = " + this._fragShader.toString() + ">";
    },
    _compileShader: function (shader, type, source) {
        if (!source || !shader)
            return false;
        var preStr = cc.GLProgram._isHighpSupported() ? "precision highp float;\n" : "precision mediump float;\n";
        source = preStr
            + "uniform mat4 CC_PMatrix;         \n"
            + "uniform mat4 CC_MVMatrix;        \n"
            + "uniform mat4 CC_MVPMatrix;       \n"
            + "uniform vec4 CC_Time;            \n"
            + "uniform vec4 CC_SinTime;         \n"
            + "uniform vec4 CC_CosTime;         \n"
            + "uniform vec4 CC_Random01;        \n"
            + "uniform sampler2D CC_Texture0;   \n"
            + "//CC INCLUDES END                \n" + source;
        this._glContext.shaderSource(shader, source);
        this._glContext.compileShader(shader);
        var status = this._glContext.getShaderParameter(shader, this._glContext.COMPILE_STATUS);
        if (!status) {
            cc.log("cocos2d: ERROR: Failed to compile shader:\n" + this._glContext.getShaderSource(shader));
            if (type === this._glContext.VERTEX_SHADER)
                cc.log("cocos2d: \n" + this.vertexShaderLog());
            else
                cc.log("cocos2d: \n" + this.fragmentShaderLog());
        }
        return ( status === true );
    },
    ctor: function (vShaderFileName, fShaderFileName, glContext) {
        this._uniforms = {};
        this._hashForUniforms = {};
        this._glContext = glContext || cc._renderContext;
		vShaderFileName && fShaderFileName && this.init(vShaderFileName, fShaderFileName);
    },
    destroyProgram: function () {
        this._vertShader = null;
        this._fragShader = null;
        this._uniforms = null;
        this._hashForUniforms = null;
        this._glContext.deleteProgram(this._programObj);
    },
    initWithVertexShaderByteArray: function (vertShaderStr, fragShaderStr) {
        var locGL = this._glContext;
        this._programObj = locGL.createProgram();
        this._vertShader = null;
        this._fragShader = null;
        if (vertShaderStr) {
            this._vertShader = locGL.createShader(locGL.VERTEX_SHADER);
            if (!this._compileShader(this._vertShader, locGL.VERTEX_SHADER, vertShaderStr)) {
                cc.log("cocos2d: ERROR: Failed to compile vertex shader");
            }
        }
        if (fragShaderStr) {
            this._fragShader = locGL.createShader(locGL.FRAGMENT_SHADER);
            if (!this._compileShader(this._fragShader, locGL.FRAGMENT_SHADER, fragShaderStr)) {
                cc.log("cocos2d: ERROR: Failed to compile fragment shader");
            }
        }
        if (this._vertShader)
            locGL.attachShader(this._programObj, this._vertShader);
        cc.checkGLErrorDebug();
        if (this._fragShader)
            locGL.attachShader(this._programObj, this._fragShader);
        for (var key in this._hashForUniforms) {
            delete this._hashForUniforms[key];
        }
        cc.checkGLErrorDebug();
        return true;
    },
    initWithString: function (vertShaderStr, fragShaderStr) {
        return this.initWithVertexShaderByteArray(vertShaderStr, fragShaderStr);
    },
    initWithVertexShaderFilename: function (vShaderFilename, fShaderFileName) {
        var vertexSource = cc.loader.getRes(vShaderFilename);
        if(!vertexSource) throw new Error("Please load the resource firset : " + vShaderFilename);
        var fragmentSource = cc.loader.getRes(fShaderFileName);
        if(!fragmentSource) throw new Error("Please load the resource firset : " + fShaderFileName);
        return this.initWithVertexShaderByteArray(vertexSource, fragmentSource);
    },
    init: function (vShaderFilename, fShaderFileName) {
        return this.initWithVertexShaderFilename(vShaderFilename, fShaderFileName);
    },
    addAttribute: function (attributeName, index) {
        this._glContext.bindAttribLocation(this._programObj, index, attributeName);
    },
    link: function () {
        if(!this._programObj) {
            cc.log("cc.GLProgram.link(): Cannot link invalid program");
            return false;
        }
        this._glContext.linkProgram(this._programObj);
        if (this._vertShader)
            this._glContext.deleteShader(this._vertShader);
        if (this._fragShader)
            this._glContext.deleteShader(this._fragShader);
        this._vertShader = null;
        this._fragShader = null;
        if (cc.game.config[cc.game.CONFIG_KEY.debugMode]) {
            var status = this._glContext.getProgramParameter(this._programObj, this._glContext.LINK_STATUS);
            if (!status) {
                cc.log("cocos2d: ERROR: Failed to link program: " + this._glContext.getProgramInfoLog(this._programObj));
                cc.glDeleteProgram(this._programObj);
                this._programObj = null;
                return false;
            }
        }
        return true;
    },
    use: function () {
        cc.glUseProgram(this._programObj);
    },
    updateUniforms: function () {
        this._uniforms[cc.UNIFORM_PMATRIX_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_PMATRIX_S);
        this._uniforms[cc.UNIFORM_MVMATRIX_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_MVMATRIX_S);
        this._uniforms[cc.UNIFORM_MVPMATRIX_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_MVPMATRIX_S);
        this._uniforms[cc.UNIFORM_TIME_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_TIME_S);
        this._uniforms[cc.UNIFORM_SINTIME_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_SINTIME_S);
        this._uniforms[cc.UNIFORM_COSTIME_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_COSTIME_S);
        this._usesTime = (this._uniforms[cc.UNIFORM_TIME_S] != null || this._uniforms[cc.UNIFORM_SINTIME_S] != null || this._uniforms[cc.UNIFORM_COSTIME_S] != null);
        this._uniforms[cc.UNIFORM_RANDOM01_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_RANDOM01_S);
        this._uniforms[cc.UNIFORM_SAMPLER_S] = this._glContext.getUniformLocation(this._programObj, cc.UNIFORM_SAMPLER_S);
        this.use();
        this.setUniformLocationWith1i(this._uniforms[cc.UNIFORM_SAMPLER_S], 0);
    },
    _addUniformLocation: function (name) {
        var location = this._glContext.getUniformLocation(this._programObj, name);
        this._uniforms[name] = location;
    },
    getUniformLocationForName: function (name) {
        if (!name)
            throw new Error("cc.GLProgram.getUniformLocationForName(): uniform name should be non-null");
        if (!this._programObj)
            throw new Error("cc.GLProgram.getUniformLocationForName(): Invalid operation. Cannot get uniform location when program is not initialized");
        var location = this._uniforms[name] || this._glContext.getUniformLocation(this._programObj, name);
        return location;
    },
    getUniformMVPMatrix: function () {
        return this._uniforms[cc.UNIFORM_MVPMATRIX_S];
    },
    getUniformSampler: function () {
        return this._uniforms[cc.UNIFORM_SAMPLER_S];
    },
    setUniformLocationWith1i: function (location, i1) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, i1);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform1i(locObj, i1);
            }
        }
        else {
            gl.uniform1i(location, i1);
        }
    },
    setUniformLocationWith2i: function (location, i1, i2) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, i1, i2);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform2i(locObj, i1, i2);
            }
        }
        else {
            gl.uniform2i(location, i1, i2);
        }
    },
    setUniformLocationWith3i: function (location, i1, i2, i3) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, i1, i2, i3);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform3i(locObj, i1, i2, i3);
            }
        }
        else {
            gl.uniform3i(location, i1, i2, i3);
        }
    },
    setUniformLocationWith4i: function (location, i1, i2, i3, i4) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, i1, i2, i3, i4);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform4i(locObj, i1, i2, i3, i4);
            }
        }
        else {
            gl.uniform4i(location, i1, i2, i3, i4);
        }
    },
    setUniformLocationWith2iv: function (location, intArray) {
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniform2iv(locObj, intArray);
    },
    setUniformLocationWith3iv:function(location, intArray){
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniform3iv(locObj, intArray);
    },
    setUniformLocationWith4iv:function(location, intArray){
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniform4iv(locObj, intArray);
    },
    setUniformLocationI32: function (location, i1) {
        this.setUniformLocationWith1i(location, i1);
    },
    setUniformLocationWith1f: function (location, f1) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, f1);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform1f(locObj, f1);
            }
        }
        else {
            gl.uniform1f(location, f1);
        }
    },
    setUniformLocationWith2f: function (location, f1, f2) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, f1, f2);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform2f(locObj, f1, f2);
            }
        }
        else {
            gl.uniform2f(location, f1, f2);
        }
    },
    setUniformLocationWith3f: function (location, f1, f2, f3) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, f1, f2, f3);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform3f(locObj, f1, f2, f3);
            }
        }
        else {
            gl.uniform3f(location, f1, f2, f3);
        }
    },
    setUniformLocationWith4f: function (location, f1, f2, f3, f4) {
        var gl = this._glContext;
        if (typeof location === 'string') {
            var updated = this._updateUniformLocation(location, f1, f2, f3, f4);
            if (updated) {
                var locObj = this.getUniformLocationForName(location);
                gl.uniform4f(locObj, f1, f2, f3, f4);
            }
        }
        else {
            gl.uniform4f(location, f1, f2, f3, f4);
        }
    },
    setUniformLocationWith2fv: function (location, floatArray) {
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniform2fv(locObj, floatArray);
    },
    setUniformLocationWith3fv: function (location, floatArray) {
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniform3fv(locObj, floatArray);
    },
    setUniformLocationWith4fv: function (location, floatArray) {
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniform4fv(locObj, floatArray);
    },
    setUniformLocationWithMatrix4fv: function (location, matrixArray) {
        var locObj = typeof location === 'string' ? this.getUniformLocationForName(location) : location;
        this._glContext.uniformMatrix4fv(locObj, false, matrixArray);
    },
    setUniformLocationF32: function () {
        if (arguments.length < 2)
            return;
        switch (arguments.length) {
            case 2:
                this.setUniformLocationWith1f(arguments[0], arguments[1]);
                break;
            case 3:
                this.setUniformLocationWith2f(arguments[0], arguments[1], arguments[2]);
                break;
            case 4:
                this.setUniformLocationWith3f(arguments[0], arguments[1], arguments[2], arguments[3]);
                break;
            case 5:
                this.setUniformLocationWith4f(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
                break;
        }
    },
    setUniformsForBuiltins: function () {
        var matrixP = new cc.math.Matrix4();
        var matrixMV = new cc.math.Matrix4();
        var matrixMVP = new cc.math.Matrix4();
        cc.kmGLGetMatrix(cc.KM_GL_PROJECTION, matrixP);
        cc.kmGLGetMatrix(cc.KM_GL_MODELVIEW, matrixMV);
        cc.kmMat4Multiply(matrixMVP, matrixP, matrixMV);
        this.setUniformLocationWithMatrix4fv(this._uniforms[cc.UNIFORM_PMATRIX_S], matrixP.mat, 1);
        this.setUniformLocationWithMatrix4fv(this._uniforms[cc.UNIFORM_MVMATRIX_S], matrixMV.mat, 1);
        this.setUniformLocationWithMatrix4fv(this._uniforms[cc.UNIFORM_MVPMATRIX_S], matrixMVP.mat, 1);
        if (this._usesTime) {
            var director = cc.director;
            var time = director.getTotalFrames() * director.getAnimationInterval();
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_TIME_S], time / 10.0, time, time * 2, time * 4);
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_SINTIME_S], time / 8.0, time / 4.0, time / 2.0, Math.sin(time));
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_COSTIME_S], time / 8.0, time / 4.0, time / 2.0, Math.cos(time));
        }
        if (this._uniforms[cc.UNIFORM_RANDOM01_S] !== -1)
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_RANDOM01_S], Math.random(), Math.random(), Math.random(), Math.random());
    },
    _setUniformsForBuiltinsForRenderer: function (node) {
        if(!node || !node._renderCmd)
            return;
        var matrixP = new cc.math.Matrix4();
        var matrixMVP = new cc.math.Matrix4();
        cc.kmGLGetMatrix(cc.KM_GL_PROJECTION, matrixP);
        cc.kmMat4Multiply(matrixMVP, matrixP, node._renderCmd._stackMatrix);
        this.setUniformLocationWithMatrix4fv(this._uniforms[cc.UNIFORM_PMATRIX_S], matrixP.mat, 1);
        this.setUniformLocationWithMatrix4fv(this._uniforms[cc.UNIFORM_MVMATRIX_S], node._renderCmd._stackMatrix.mat, 1);
        this.setUniformLocationWithMatrix4fv(this._uniforms[cc.UNIFORM_MVPMATRIX_S], matrixMVP.mat, 1);
        if (this._usesTime) {
            var director = cc.director;
            var time = director.getTotalFrames() * director.getAnimationInterval();
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_TIME_S], time / 10.0, time, time * 2, time * 4);
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_SINTIME_S], time / 8.0, time / 4.0, time / 2.0, Math.sin(time));
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_COSTIME_S], time / 8.0, time / 4.0, time / 2.0, Math.cos(time));
        }
        if (this._uniforms[cc.UNIFORM_RANDOM01_S] !== -1)
            this.setUniformLocationWith4f(this._uniforms[cc.UNIFORM_RANDOM01_S], Math.random(), Math.random(), Math.random(), Math.random());
    },
    setUniformForModelViewProjectionMatrix: function () {
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_MVPMATRIX_S], false,
        cc.getMat4MultiplyValue(cc.projection_matrix_stack.top, cc.modelview_matrix_stack.top));
    },
    setUniformForModelViewProjectionMatrixWithMat4: function (swapMat4) {
        cc.kmMat4Multiply(swapMat4, cc.projection_matrix_stack.top, cc.modelview_matrix_stack.top);
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_MVPMATRIX_S], false, swapMat4.mat);
    },
    setUniformForModelViewAndProjectionMatrixWithMat4: function () {
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_MVMATRIX_S], false, cc.modelview_matrix_stack.top.mat);
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_PMATRIX_S], false, cc.projection_matrix_stack.top.mat);
    },
    _setUniformForMVPMatrixWithMat4: function(modelViewMatrix){
        if(!modelViewMatrix)
            throw new Error("modelView matrix is undefined.");
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_MVMATRIX_S], false, modelViewMatrix.mat);
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_PMATRIX_S], false, cc.projection_matrix_stack.top.mat);
    },
    _updateProjectionUniform: function(){
        this._glContext.uniformMatrix4fv(this._uniforms[cc.UNIFORM_PMATRIX_S], false, cc.projection_matrix_stack.top.mat);
    },
    vertexShaderLog: function () {
        return this._glContext.getShaderInfoLog(this._vertShader);
    },
    getVertexShaderLog: function () {
        return this._glContext.getShaderInfoLog(this._vertShader);
    },
    getFragmentShaderLog: function () {
        return this._glContext.getShaderInfoLog(this._vertShader);
    },
    fragmentShaderLog: function () {
        return this._glContext.getShaderInfoLog(this._fragShader);
    },
    programLog: function () {
        return this._glContext.getProgramInfoLog(this._programObj);
    },
    getProgramLog: function () {
        return this._glContext.getProgramInfoLog(this._programObj);
    },
    reset: function () {
        this._vertShader = null;
        this._fragShader = null;
        this._uniforms.length = 0;
        this._glContext.deleteProgram(this._programObj);
        this._programObj = null;
        for (var key in this._hashForUniforms) {
            this._hashForUniforms[key].length = 0;
            delete this._hashForUniforms[key];
        }
    },
    getProgram: function () {
        return this._programObj;
    },
    retain: function () {
    },
    release: function () {
    }
});
cc.GLProgram.create = function (vShaderFileName, fShaderFileName) {
    return new cc.GLProgram(vShaderFileName, fShaderFileName);
};
cc.GLProgram._highpSupported = null;
cc.GLProgram._isHighpSupported = function(){
    if(cc.GLProgram._highpSupported == null){
        var ctx = cc._renderContext;
        var highp = ctx.getShaderPrecisionFormat(ctx.FRAGMENT_SHADER, ctx.HIGH_FLOAT);
        cc.GLProgram._highpSupported = highp.precision !== 0;
    }
    return cc.GLProgram._highpSupported;
};
cc.setProgram = function (node, program) {
    node.shaderProgram = program;
    var children = node.children;
    if (!children)
        return;
    for (var i = 0; i < children.length; i++)
        cc.setProgram(children[i], program);
};
cc._currentProjectionMatrix = -1;
if (cc.ENABLE_GL_STATE_CACHE) {
    cc.MAX_ACTIVETEXTURE = 16;
    cc._currentShaderProgram = -1;
    cc._currentBoundTexture = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    cc._blendingSource = -1;
    cc._blendingDest = -1;
    cc._GLServerState = 0;
    if(cc.TEXTURE_ATLAS_USE_VAO)
        cc._uVAO = 0;
    var _currBuffers = {};
    WebGLRenderingContext.prototype.glBindBuffer = WebGLRenderingContext.prototype.bindBuffer;
    WebGLRenderingContext.prototype.bindBuffer = function (target, buffer) {
        if (_currBuffers[target] !== buffer) {
            this.glBindBuffer(target, buffer);
            _currBuffers[target] = buffer;
            return false;
        }
        else {
            return true;
        }
    };
    WebGLRenderingContext.prototype.glEnableVertexAttribArray = WebGLRenderingContext.prototype.enableVertexAttribArray;
    WebGLRenderingContext.prototype.enableVertexAttribArray = function (index) {
        if (index === cc.VERTEX_ATTRIB_FLAG_POSITION) {
            if (!this._vertexAttribPosition) {
                this.glEnableVertexAttribArray(index);
                this._vertexAttribPosition = true;
            }
        }
        else if (index === cc.VERTEX_ATTRIB_FLAG_COLOR) {
            if (!this._vertexAttribColor) {
                this.glEnableVertexAttribArray(index);
                this._vertexAttribColor = true;
            }
        }
        else if (index === cc.VERTEX_ATTRIB_FLAG_TEX_COORDS) {
            if (!this._vertexAttribTexCoords) {
                this.glEnableVertexAttribArray(index);
                this._vertexAttribTexCoords = true;
            }
        }
        else {
            this.glEnableVertexAttribArray(index);
        }
    };
    WebGLRenderingContext.prototype.glDisableVertexAttribArray = WebGLRenderingContext.prototype.disableVertexAttribArray;
    WebGLRenderingContext.prototype.disableVertexAttribArray = function (index) {
        if (index === cc.VERTEX_ATTRIB_FLAG_COLOR) {
            if (this._vertexAttribColor) {
                this.glDisableVertexAttribArray(index);
                this._vertexAttribColor = false;
            }
        }
        else if (index === cc.VERTEX_ATTRIB_FLAG_TEX_COORDS) {
            if (this._vertexAttribTexCoords) {
                this.glDisableVertexAttribArray(index);
                this._vertexAttribTexCoords = false;
            }
        }
        else if (index !== 0) {
            this.glDisableVertexAttribArray(index);
        }
    };
}
cc.glInvalidateStateCache = function () {
    cc.kmGLFreeAll();
    cc._currentProjectionMatrix = -1;
    if (cc.ENABLE_GL_STATE_CACHE) {
        cc._currentShaderProgram = -1;
        for (var i = 0; i < cc.MAX_ACTIVETEXTURE; i++) {
            cc._currentBoundTexture[i] = -1;
        }
        cc._blendingSource = -1;
        cc._blendingDest = -1;
        cc._GLServerState = 0;
    }
};
cc.glUseProgram = cc.ENABLE_GL_STATE_CACHE ? function (program) {
    if (program !== cc._currentShaderProgram) {
        cc._currentShaderProgram = program;
        cc._renderContext.useProgram(program);
    }
} : function (program) {
    cc._renderContext.useProgram(program);
};
cc.glDeleteProgram = function (program) {
    if (cc.ENABLE_GL_STATE_CACHE) {
        if (program === cc._currentShaderProgram)
            cc._currentShaderProgram = -1;
    }
    gl.deleteProgram(program);
};
cc.setBlending = function (sfactor, dfactor) {
    var ctx = cc._renderContext;
    if ((sfactor === ctx.ONE) && (dfactor === ctx.ZERO)) {
        ctx.disable(ctx.BLEND);
    } else {
        ctx.enable(ctx.BLEND);
        cc._renderContext.blendFunc(sfactor,dfactor);
    }
};
cc.glBlendFunc = cc.ENABLE_GL_STATE_CACHE ? function (sfactor, dfactor) {
    if ((sfactor !== cc._blendingSource) || (dfactor !== cc._blendingDest)) {
        cc._blendingSource = sfactor;
        cc._blendingDest = dfactor;
        cc.setBlending(sfactor, dfactor);
    }
} : cc.setBlending;
cc.glBlendFuncForParticle = function(sfactor, dfactor) {
    if ((sfactor !== cc._blendingSource) || (dfactor !== cc._blendingDest)) {
        cc._blendingSource = sfactor;
        cc._blendingDest = dfactor;
        var ctx = cc._renderContext;
        if ((sfactor === ctx.ONE) && (dfactor === ctx.ZERO)) {
            ctx.disable(ctx.BLEND);
        } else {
            ctx.enable(ctx.BLEND);
            ctx.blendFuncSeparate(ctx.SRC_ALPHA, dfactor, sfactor, dfactor);
        }
    }
};
cc.glBlendResetToCache = function () {
    var ctx = cc._renderContext;
    ctx.blendEquation(ctx.FUNC_ADD);
    if (cc.ENABLE_GL_STATE_CACHE)
        cc.setBlending(cc._blendingSource, cc._blendingDest);
    else
        cc.setBlending(ctx.BLEND_SRC, ctx.BLEND_DST);
};
cc.setProjectionMatrixDirty = function () {
    cc._currentProjectionMatrix = -1;
};
cc.glBindTexture2D = function (textureId) {
    cc.glBindTexture2DN(0, textureId);
};
cc.glBindTexture2DN = cc.ENABLE_GL_STATE_CACHE ? function (textureUnit, textureId) {
    if (cc._currentBoundTexture[textureUnit] === textureId)
        return;
    cc._currentBoundTexture[textureUnit] = textureId;
    var ctx = cc._renderContext;
    ctx.activeTexture(ctx.TEXTURE0 + textureUnit);
    if(textureId)
        ctx.bindTexture(ctx.TEXTURE_2D, textureId._webTextureObj);
    else
        ctx.bindTexture(ctx.TEXTURE_2D, null);
} : function (textureUnit, textureId) {
    var ctx = cc._renderContext;
    ctx.activeTexture(ctx.TEXTURE0 + textureUnit);
    if(textureId)
        ctx.bindTexture(ctx.TEXTURE_2D, textureId._webTextureObj);
    else
        ctx.bindTexture(ctx.TEXTURE_2D, null);
};
cc.glDeleteTexture = function (textureId) {
    cc.glDeleteTextureN(0, textureId);
};
cc.glDeleteTextureN = function (textureUnit, textureId) {
    if (cc.ENABLE_GL_STATE_CACHE) {
        if (textureId === cc._currentBoundTexture[ textureUnit ])
            cc._currentBoundTexture[ textureUnit ] = -1;
    }
    cc._renderContext.deleteTexture(textureId._webTextureObj);
};
cc.glBindVAO = function (vaoId) {
    if (!cc.TEXTURE_ATLAS_USE_VAO)
        return;
    if (cc.ENABLE_GL_STATE_CACHE) {
        if (cc._uVAO !== vaoId) {
            cc._uVAO = vaoId;
        }
    } else {
    }
};
cc.glEnable = function (flags) {
    if (cc.ENABLE_GL_STATE_CACHE) {
    } else {
    }
};
cc.v2fzero = function () {
    return {x: 0, y: 0};
};
cc.v2f = function (x, y) {
    return {x: x, y: y};
};
cc.v2fadd = function (v0, v1) {
    return cc.v2f(v0.x + v1.x, v0.y + v1.y);
};
cc.v2fsub = function (v0, v1) {
    return cc.v2f(v0.x - v1.x, v0.y - v1.y);
};
cc.v2fmult = function (v, s) {
    return cc.v2f(v.x * s, v.y * s);
};
cc.v2fperp = function (p0) {
    return cc.v2f(-p0.y, p0.x);
};
cc.v2fneg = function (p0) {
    return cc.v2f(-p0.x, -p0.y);
};
cc.v2fdot = function (p0, p1) {
    return  p0.x * p1.x + p0.y * p1.y;
};
cc.v2fforangle = function (_a_) {
    return cc.v2f(Math.cos(_a_), Math.sin(_a_));
};
cc.v2fnormalize = function (p) {
    var r = cc.pNormalize(cc.p(p.x, p.y));
    return cc.v2f(r.x, r.y);
};
cc.__v2f = function (v) {
    return cc.v2f(v.x, v.y);
};
cc.__t = function (v) {
    return {u: v.x, v: v.y};
};
cc.DrawNode = cc.Node.extend({
    _buffer:null,
    _blendFunc:null,
    _lineWidth: 1,
    _drawColor: null,
    getBlendFunc: function () {
        return this._blendFunc;
    },
    setBlendFunc: function (blendFunc, dst) {
        if (dst === undefined) {
            this._blendFunc.src = blendFunc.src;
            this._blendFunc.dst = blendFunc.dst;
        } else {
            this._blendFunc.src = blendFunc;
            this._blendFunc.dst = dst;
        }
    },
    setLineWidth: function (width) {
        this._lineWidth = width;
    },
    getLineWidth: function () {
        return this._lineWidth;
    },
    setDrawColor: function (color) {
        var locDrawColor = this._drawColor;
        locDrawColor.r = color.r;
        locDrawColor.g = color.g;
        locDrawColor.b = color.b;
        locDrawColor.a = (color.a == null) ? 255 : color.a;
    },
    getDrawColor: function () {
        return  cc.color(this._drawColor.r, this._drawColor.g, this._drawColor.b, this._drawColor.a);
    }
});
cc.DrawNode.create = function () {
    return new cc.DrawNode();
};
cc.DrawNode.TYPE_DOT = 0;
cc.DrawNode.TYPE_SEGMENT = 1;
cc.DrawNode.TYPE_POLY = 2;
cc.game.addEventListener(cc.game.EVENT_RENDERER_INITED, function () {
    if (cc._renderType === cc.game.RENDER_TYPE_CANVAS) {
        cc._DrawNodeElement = function (type, verts, fillColor, lineWidth, lineColor, lineCap, isClosePolygon, isFill, isStroke) {
            var _t = this;
            _t.type = type;
            _t.verts = verts || null;
            _t.fillColor = fillColor || null;
            _t.lineWidth = lineWidth || 0;
            _t.lineColor = lineColor || null;
            _t.lineCap = lineCap || "butt";
            _t.isClosePolygon = isClosePolygon || false;
            _t.isFill = isFill || false;
            _t.isStroke = isStroke || false;
        };
        cc.extend(cc.DrawNode.prototype, {
            _className:"DrawNodeCanvas",
            ctor: function () {
                cc.Node.prototype.ctor.call(this);
                var locCmd = this._renderCmd;
                locCmd._buffer = this._buffer = [];
                locCmd._drawColor = this._drawColor = cc.color(255, 255, 255, 255);
                locCmd._blendFunc = this._blendFunc = new cc.BlendFunc(cc.SRC_ALPHA, cc.ONE_MINUS_SRC_ALPHA);
                this.init();
                this._localBB = new cc.Rect();
            },
            setLocalBB: function(rectorX, y, width, height) {
                var localBB = this._localBB;
                if(y === undefined) {
                    localBB.x = rectorX.x;
                    localBB.y = rectorX.y;
                    localBB.width = rectorX.width;
                    localBB.height = rectorX.height;
                } else {
                    localBB.x = rectorX;
                    localBB.y = y;
                    localBB.width = width;
                    localBB.height = height;
                }
            },
            drawRect: function (origin, destination, fillColor, lineWidth, lineColor) {
                lineWidth = (lineWidth == null) ? this._lineWidth : lineWidth;
                lineColor = lineColor || this.getDrawColor();
                if(lineColor.a == null)
                    lineColor.a = 255;
                var vertices = [
                    origin,
                    cc.p(destination.x, origin.y),
                    destination,
                    cc.p(origin.x, destination.y)
                ];
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = vertices;
                element.lineWidth = lineWidth;
                element.lineColor = lineColor;
                element.isClosePolygon = true;
                element.isStroke = true;
                element.lineCap = "butt";
                element.fillColor = fillColor;
                if (fillColor) {
                    if(fillColor.a == null)
                        fillColor.a = 255;
                    element.isFill = true;
                }
                this._buffer.push(element);
            },
            drawCircle: function (center, radius, angle, segments, drawLineToCenter, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var coef = 2.0 * Math.PI / segments;
                var vertices = [];
                for (var i = 0; i <= segments; i++) {
                    var rads = i * coef;
                    var j = radius * Math.cos(rads + angle) + center.x;
                    var k = radius * Math.sin(rads + angle) + center.y;
                    vertices.push(cc.p(j, k));
                }
                if (drawLineToCenter) {
                    vertices.push(cc.p(center.x, center.y));
                }
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = vertices;
                element.lineWidth = lineWidth;
                element.lineColor = color;
                element.isClosePolygon = true;
                element.isStroke = true;
                this._buffer.push(element);
            },
            drawQuadBezier: function (origin, control, destination, segments, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var vertices = [], t = 0.0;
                for (var i = 0; i < segments; i++) {
                    var x = Math.pow(1 - t, 2) * origin.x + 2.0 * (1 - t) * t * control.x + t * t * destination.x;
                    var y = Math.pow(1 - t, 2) * origin.y + 2.0 * (1 - t) * t * control.y + t * t * destination.y;
                    vertices.push(cc.p(x, y));
                    t += 1.0 / segments;
                }
                vertices.push(cc.p(destination.x, destination.y));
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = vertices;
                element.lineWidth = lineWidth;
                element.lineColor = color;
                element.isStroke = true;
                element.lineCap = "round";
                this._buffer.push(element);
            },
            drawCubicBezier: function (origin, control1, control2, destination, segments, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var vertices = [], t = 0;
                for (var i = 0; i < segments; i++) {
                    var x = Math.pow(1 - t, 3) * origin.x + 3.0 * Math.pow(1 - t, 2) * t * control1.x + 3.0 * (1 - t) * t * t * control2.x + t * t * t * destination.x;
                    var y = Math.pow(1 - t, 3) * origin.y + 3.0 * Math.pow(1 - t, 2) * t * control1.y + 3.0 * (1 - t) * t * t * control2.y + t * t * t * destination.y;
                    vertices.push(cc.p(x, y));
                    t += 1.0 / segments;
                }
                vertices.push(cc.p(destination.x, destination.y));
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = vertices;
                element.lineWidth = lineWidth;
                element.lineColor = color;
                element.isStroke = true;
                element.lineCap = "round";
                this._buffer.push(element);
            },
            drawCatmullRom: function (points, segments, lineWidth, color) {
                this.drawCardinalSpline(points, 0.5, segments, lineWidth, color);
            },
            drawCardinalSpline: function (config, tension, segments, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if(color.a == null)
                    color.a = 255;
                var vertices = [], p, lt, deltaT = 1.0 / config.length;
                for (var i = 0; i < segments + 1; i++) {
                    var dt = i / segments;
                    if (dt === 1) {
                        p = config.length - 1;
                        lt = 1;
                    } else {
                        p = 0 | (dt / deltaT);
                        lt = (dt - deltaT * p) / deltaT;
                    }
                    var newPos = cc.cardinalSplineAt(
                        cc.getControlPointAt(config, p - 1),
                        cc.getControlPointAt(config, p - 0),
                        cc.getControlPointAt(config, p + 1),
                        cc.getControlPointAt(config, p + 2),
                        tension, lt);
                    vertices.push(newPos);
                }
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = vertices;
                element.lineWidth = lineWidth;
                element.lineColor = color;
                element.isStroke = true;
                element.lineCap = "round";
                this._buffer.push(element);
            },
            drawDot: function (pos, radius, color) {
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_DOT);
                element.verts = [pos];
                element.lineWidth = radius;
                element.fillColor = color;
                this._buffer.push(element);
            },
            drawDots: function(points, radius, color){
                if(!points || points.length == 0)
                    return;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                for(var i = 0, len = points.length; i < len; i++)
                   this.drawDot(points[i], radius, color);
            },
            drawSegment: function (from, to, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = [from, to];
                element.lineWidth = lineWidth * 2;
                element.lineColor = color;
                element.isStroke = true;
                element.lineCap = "round";
                this._buffer.push(element);
            },
            drawPoly_: function (verts, fillColor, lineWidth, color) {
                lineWidth = (lineWidth == null ) ? this._lineWidth : lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var element = new cc._DrawNodeElement(cc.DrawNode.TYPE_POLY);
                element.verts = verts;
                element.fillColor = fillColor;
                element.lineWidth = lineWidth;
                element.lineColor = color;
                element.isClosePolygon = true;
                element.isStroke = true;
                element.lineCap = "round";
                if (fillColor)
                    element.isFill = true;
                this._buffer.push(element);
            },
            drawPoly: function (verts, fillColor, lineWidth, lineColor) {
                var vertsCopy = [];
                for (var i=0; i < verts.length; i++) {
                    vertsCopy.push(cc.p(verts[i].x, verts[i].y));
                }
                return this.drawPoly_(vertsCopy, fillColor, lineWidth, lineColor);
            },
            clear: function () {
                this._buffer.length = 0;
            },
            _createRenderCmd: function(){
                return new cc.DrawNode.CanvasRenderCmd(this);
            }
        });
    }
    else if (cc._renderType === cc.game.RENDER_TYPE_WEBGL) {
        cc.extend(cc.DrawNode.prototype, {
            _bufferCapacity:0,
            _trianglesArrayBuffer:null,
            _trianglesWebBuffer:null,
            _trianglesReader:null,
            _dirty:false,
            _className:"DrawNodeWebGL",
            ctor:function () {
                cc.Node.prototype.ctor.call(this);
                this._buffer = [];
                this._blendFunc = new cc.BlendFunc(cc.SRC_ALPHA, cc.ONE_MINUS_SRC_ALPHA);
                this._drawColor = cc.color(255,255,255,255);
                this.init();
            },
            init:function () {
                if (cc.Node.prototype.init.call(this)) {
                    this.shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_LENGTHTEXTURECOLOR);
                    this._ensureCapacity(64);
                    this._trianglesWebBuffer = cc._renderContext.createBuffer();
                    this._dirty = true;
                    return true;
                }
                return false;
            },
            drawRect: function (origin, destination, fillColor, lineWidth, lineColor) {
                lineWidth = (lineWidth == null) ? this._lineWidth : lineWidth;
                lineColor = lineColor || this.getDrawColor();
                if (lineColor.a == null)
                    lineColor.a = 255;
                var vertices = [origin, cc.p(destination.x, origin.y), destination, cc.p(origin.x, destination.y)];
                if(fillColor == null)
                    this._drawSegments(vertices, lineWidth, lineColor, true);
                else
                    this.drawPoly(vertices, fillColor, lineWidth, lineColor);
            },
            drawCircle: function (center, radius, angle, segments, drawLineToCenter, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var coef = 2.0 * Math.PI / segments, vertices = [], i, len;
                for (i = 0; i <= segments; i++) {
                    var rads = i * coef;
                    var j = radius * Math.cos(rads + angle) + center.x;
                    var k = radius * Math.sin(rads + angle) + center.y;
                    vertices.push(cc.p(j, k));
                }
                if (drawLineToCenter)
                    vertices.push(cc.p(center.x, center.y));
                lineWidth *= 0.5;
                for (i = 0, len = vertices.length; i < len - 1; i++)
                    this.drawSegment(vertices[i], vertices[i + 1], lineWidth, color);
            },
            drawQuadBezier: function (origin, control, destination, segments, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var vertices = [], t = 0.0;
                for (var i = 0; i < segments; i++) {
                    var x = Math.pow(1 - t, 2) * origin.x + 2.0 * (1 - t) * t * control.x + t * t * destination.x;
                    var y = Math.pow(1 - t, 2) * origin.y + 2.0 * (1 - t) * t * control.y + t * t * destination.y;
                    vertices.push(cc.p(x, y));
                    t += 1.0 / segments;
                }
                vertices.push(cc.p(destination.x, destination.y));
                this._drawSegments(vertices, lineWidth, color, false);
            },
            drawCubicBezier: function (origin, control1, control2, destination, segments, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var vertices = [], t = 0;
                for (var i = 0; i < segments; i++) {
                    var x = Math.pow(1 - t, 3) * origin.x + 3.0 * Math.pow(1 - t, 2) * t * control1.x + 3.0 * (1 - t) * t * t * control2.x + t * t * t * destination.x;
                    var y = Math.pow(1 - t, 3) * origin.y + 3.0 * Math.pow(1 - t, 2) * t * control1.y + 3.0 * (1 - t) * t * t * control2.y + t * t * t * destination.y;
                    vertices.push(cc.p(x, y));
                    t += 1.0 / segments;
                }
                vertices.push(cc.p(destination.x, destination.y));
                this._drawSegments(vertices, lineWidth, color, false);
            },
            drawCatmullRom: function (points, segments, lineWidth, color) {
                this.drawCardinalSpline(points, 0.5, segments, lineWidth, color);
            },
            drawCardinalSpline: function (config, tension, segments, lineWidth, color) {
                lineWidth = lineWidth || this._lineWidth;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var vertices = [], p, lt, deltaT = 1.0 / config.length;
                for (var i = 0; i < segments + 1; i++) {
                    var dt = i / segments;
                    if (dt === 1) {
                        p = config.length - 1;
                        lt = 1;
                    } else {
                        p = 0 | (dt / deltaT);
                        lt = (dt - deltaT * p) / deltaT;
                    }
                    var newPos = cc.cardinalSplineAt(
                        cc.getControlPointAt(config, p - 1),
                        cc.getControlPointAt(config, p - 0),
                        cc.getControlPointAt(config, p + 1),
                        cc.getControlPointAt(config, p + 2),
                        tension, lt);
                    vertices.push(newPos);
                }
                lineWidth *= 0.5;
                for (var j = 0, len = vertices.length; j < len - 1; j++)
                    this.drawSegment(vertices[j], vertices[j + 1], lineWidth, color);
            },
            _render:function () {
                var gl = cc._renderContext;
                gl.bindBuffer(gl.ARRAY_BUFFER, this._trianglesWebBuffer);
                if (this._dirty) {
                    gl.bufferData(gl.ARRAY_BUFFER, this._trianglesArrayBuffer, gl.STREAM_DRAW);
                    this._dirty = false;
                }
                var triangleSize = cc.V2F_C4B_T2F.BYTES_PER_ELEMENT;
                gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
                gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
                gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
                gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, gl.FLOAT, false, triangleSize, 0);
                gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.UNSIGNED_BYTE, true, triangleSize, 8);
                gl.vertexAttribPointer(cc.VERTEX_ATTRIB_TEX_COORDS, 2, gl.FLOAT, false, triangleSize, 12);
                gl.drawArrays(gl.TRIANGLES, 0, this._buffer.length * 3);
                cc.incrementGLDraws(1);
            },
            _ensureCapacity:function(count){
                var _t = this;
                var locBuffer = _t._buffer;
                if(locBuffer.length + count > _t._bufferCapacity){
                    var TriangleLength = cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT;
                    _t._bufferCapacity += Math.max(_t._bufferCapacity, count);
                    if((locBuffer == null) || (locBuffer.length === 0)){
                        _t._buffer = [];
                        _t._trianglesArrayBuffer = new ArrayBuffer(TriangleLength * _t._bufferCapacity);
                        _t._trianglesReader = new Uint8Array(_t._trianglesArrayBuffer);
                    } else {
                        var newTriangles = [];
                        var newArrayBuffer = new ArrayBuffer(TriangleLength * _t._bufferCapacity);
                        for(var i = 0; i < locBuffer.length;i++){
                            newTriangles[i] = new cc.V2F_C4B_T2F_Triangle(locBuffer[i].a,locBuffer[i].b,locBuffer[i].c,
                                newArrayBuffer, i * TriangleLength);
                        }
                        _t._trianglesReader = new Uint8Array(newArrayBuffer);
                        _t._trianglesArrayBuffer = newArrayBuffer;
                        _t._buffer = newTriangles;
                    }
                }
            },
            drawDot:function (pos, radius, color) {
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                var c4bColor = {r: 0 | color.r, g: 0 | color.g, b: 0 | color.b, a: 0 | color.a};
                var a = {vertices: {x: pos.x - radius, y: pos.y - radius}, colors: c4bColor, texCoords: {u: -1.0, v: -1.0}};
                var b = {vertices: {x: pos.x - radius, y: pos.y + radius}, colors: c4bColor, texCoords: {u: -1.0, v: 1.0}};
                var c = {vertices: {x: pos.x + radius, y: pos.y + radius}, colors: c4bColor, texCoords: {u: 1.0, v: 1.0}};
                var d = {vertices: {x: pos.x + radius, y: pos.y - radius}, colors: c4bColor, texCoords: {u: 1.0, v: -1.0}};
                this._ensureCapacity(2*3);
                this._buffer.push(new cc.V2F_C4B_T2F_Triangle(a, b, c, this._trianglesArrayBuffer, this._buffer.length * cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT));
                this._buffer.push(new cc.V2F_C4B_T2F_Triangle(a, c, d, this._trianglesArrayBuffer, this._buffer.length * cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT));
                this._dirty = true;
            },
            drawDots: function(points, radius,color) {
                if(!points || points.length === 0)
                    return;
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                for(var i = 0, len = points.length; i < len; i++)
                    this.drawDot(points[i], radius, color);
            },
            drawSegment:function (from, to, radius, color) {
                color = color || this.getDrawColor();
                if (color.a == null)
                    color.a = 255;
                radius = radius || (this._lineWidth * 0.5);
                var vertexCount = 6*3;
                this._ensureCapacity(vertexCount);
                var c4bColor = {r: 0 | color.r, g: 0 | color.g, b: 0 | color.b, a: 0 | color.a};
                var a = cc.__v2f(from), b = cc.__v2f(to);
                var n = cc.v2fnormalize(cc.v2fperp(cc.v2fsub(b, a))), t = cc.v2fperp(n);
                var nw = cc.v2fmult(n, radius), tw = cc.v2fmult(t, radius);
                var v0 = cc.v2fsub(b, cc.v2fadd(nw, tw));
                var v1 = cc.v2fadd(b, cc.v2fsub(nw, tw));
                var v2 = cc.v2fsub(b, nw);
                var v3 = cc.v2fadd(b, nw);
                var v4 = cc.v2fsub(a, nw);
                var v5 = cc.v2fadd(a, nw);
                var v6 = cc.v2fsub(a, cc.v2fsub(nw, tw));
                var v7 = cc.v2fadd(a, cc.v2fadd(nw, tw));
                var TriangleLength = cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT, triangleBuffer = this._trianglesArrayBuffer, locBuffer = this._buffer;
                locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v0, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(cc.v2fadd(n, t)))},
                    {vertices: v1, colors: c4bColor, texCoords: cc.__t(cc.v2fsub(n, t))}, {vertices: v2, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(n))},
                    triangleBuffer, locBuffer.length * TriangleLength));
                locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v3, colors: c4bColor, texCoords: cc.__t(n)},
                    {vertices: v1, colors: c4bColor, texCoords: cc.__t(cc.v2fsub(n, t))}, {vertices: v2, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(n))},
                    triangleBuffer, locBuffer.length * TriangleLength));
                locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v3, colors: c4bColor, texCoords: cc.__t(n)},
                    {vertices: v4, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(n))}, {vertices: v2, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(n))},
                    triangleBuffer, locBuffer.length * TriangleLength));
                locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v3, colors: c4bColor, texCoords: cc.__t(n)},
                    {vertices: v4, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(n))}, {vertices: v5, colors: c4bColor, texCoords: cc.__t(n)},
                    triangleBuffer, locBuffer.length * TriangleLength));
                locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v6, colors: c4bColor, texCoords: cc.__t(cc.v2fsub(t, n))},
                    {vertices: v4, colors: c4bColor, texCoords: cc.__t(cc.v2fneg(n))}, {vertices: v5, colors: c4bColor, texCoords: cc.__t(n)},
                    triangleBuffer, locBuffer.length * TriangleLength));
                locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v6, colors: c4bColor, texCoords: cc.__t(cc.v2fsub(t, n))},
                    {vertices: v7, colors: c4bColor, texCoords: cc.__t(cc.v2fadd(n, t))}, {vertices: v5, colors: c4bColor, texCoords: cc.__t(n)},
                    triangleBuffer, locBuffer.length * TriangleLength));
                this._dirty = true;
            },
            drawPoly:function (verts, fillColor, borderWidth, borderColor) {
                if(fillColor == null){
                    this._drawSegments(verts, borderWidth, borderColor, true);
                    return;
                }
                if (fillColor.a == null)
                    fillColor.a = 255;
                if (borderColor.a == null)
                    borderColor.a = 255;
                borderWidth = (borderWidth == null)? this._lineWidth : borderWidth;
                borderWidth *= 0.5;
                var c4bFillColor = {r: 0 | fillColor.r, g: 0 | fillColor.g, b: 0 | fillColor.b, a: 0 | fillColor.a};
                var c4bBorderColor = {r: 0 | borderColor.r, g: 0 | borderColor.g, b: 0 | borderColor.b, a: 0 | borderColor.a};
                var extrude = [], i, v0, v1, v2, count = verts.length;
                for (i = 0; i < count; i++) {
                    v0 = cc.__v2f(verts[(i - 1 + count) % count]);
                    v1 = cc.__v2f(verts[i]);
                    v2 = cc.__v2f(verts[(i + 1) % count]);
                    var n1 = cc.v2fnormalize(cc.v2fperp(cc.v2fsub(v1, v0)));
                    var n2 = cc.v2fnormalize(cc.v2fperp(cc.v2fsub(v2, v1)));
                    var offset = cc.v2fmult(cc.v2fadd(n1, n2), 1.0 / (cc.v2fdot(n1, n2) + 1.0));
                    extrude[i] = {offset: offset, n: n2};
                }
                var outline = (borderWidth > 0.0), triangleCount = 3 * count - 2, vertexCount = 3 * triangleCount;
                this._ensureCapacity(vertexCount);
                var triangleBytesLen = cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT, trianglesBuffer = this._trianglesArrayBuffer;
                var locBuffer = this._buffer;
                var inset = (outline == false ? 0.5 : 0.0);
                for (i = 0; i < count - 2; i++) {
                    v0 = cc.v2fsub(cc.__v2f(verts[0]), cc.v2fmult(extrude[0].offset, inset));
                    v1 = cc.v2fsub(cc.__v2f(verts[i + 1]), cc.v2fmult(extrude[i + 1].offset, inset));
                    v2 = cc.v2fsub(cc.__v2f(verts[i + 2]), cc.v2fmult(extrude[i + 2].offset, inset));
                    locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: v0, colors: c4bFillColor, texCoords: cc.__t(cc.v2fzero())},
                        {vertices: v1, colors: c4bFillColor, texCoords: cc.__t(cc.v2fzero())}, {vertices: v2, colors: c4bFillColor, texCoords: cc.__t(cc.v2fzero())},
                        trianglesBuffer, locBuffer.length * triangleBytesLen));
                }
                for (i = 0; i < count; i++) {
                    var j = (i + 1) % count;
                    v0 = cc.__v2f(verts[i]);
                    v1 = cc.__v2f(verts[j]);
                    var n0 = extrude[i].n;
                    var offset0 = extrude[i].offset;
                    var offset1 = extrude[j].offset;
                    var inner0 = outline ? cc.v2fsub(v0, cc.v2fmult(offset0, borderWidth)) : cc.v2fsub(v0, cc.v2fmult(offset0, 0.5));
                    var inner1 = outline ? cc.v2fsub(v1, cc.v2fmult(offset1, borderWidth)) : cc.v2fsub(v1, cc.v2fmult(offset1, 0.5));
                    var outer0 = outline ? cc.v2fadd(v0, cc.v2fmult(offset0, borderWidth)) : cc.v2fadd(v0, cc.v2fmult(offset0, 0.5));
                    var outer1 = outline ? cc.v2fadd(v1, cc.v2fmult(offset1, borderWidth)) : cc.v2fadd(v1, cc.v2fmult(offset1, 0.5));
                    if (outline) {
                        locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: inner0, colors: c4bBorderColor, texCoords: cc.__t(cc.v2fneg(n0))},
                            {vertices: inner1, colors: c4bBorderColor, texCoords: cc.__t(cc.v2fneg(n0))}, {vertices: outer1, colors: c4bBorderColor, texCoords: cc.__t(n0)},
                            trianglesBuffer, locBuffer.length * triangleBytesLen));
                        locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: inner0, colors: c4bBorderColor, texCoords: cc.__t(cc.v2fneg(n0))},
                            {vertices: outer0, colors: c4bBorderColor, texCoords: cc.__t(n0)}, {vertices: outer1, colors: c4bBorderColor, texCoords: cc.__t(n0)},
                            trianglesBuffer, locBuffer.length * triangleBytesLen));
                    } else {
                        locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: inner0, colors: c4bFillColor, texCoords: cc.__t(cc.v2fzero())},
                            {vertices: inner1, colors: c4bFillColor, texCoords: cc.__t(cc.v2fzero())}, {vertices: outer1, colors: c4bFillColor, texCoords: cc.__t(n0)},
                            trianglesBuffer, locBuffer.length * triangleBytesLen));
                        locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: inner0, colors: c4bFillColor, texCoords: cc.__t(cc.v2fzero())},
                            {vertices: outer0, colors: c4bFillColor, texCoords: cc.__t(n0)}, {vertices: outer1, colors: c4bFillColor, texCoords: cc.__t(n0)},
                            trianglesBuffer, locBuffer.length * triangleBytesLen));
                    }
                }
                extrude = null;
                this._dirty = true;
            },
            _drawSegments: function(verts, borderWidth, borderColor, closePoly){
                borderWidth = (borderWidth == null) ? this._lineWidth : borderWidth;
                borderColor = borderColor || this._drawColor;
                if(borderColor.a == null)
                    borderColor.a = 255;
                borderWidth *= 0.5;
                if (borderWidth <= 0)
                    return;
                var c4bBorderColor = {r: 0 | borderColor.r, g: 0 | borderColor.g, b: 0 | borderColor.b, a: 0 | borderColor.a };
                var extrude = [], i, v0, v1, v2, count = verts.length;
                for (i = 0; i < count; i++) {
                    v0 = cc.__v2f(verts[(i - 1 + count) % count]);
                    v1 = cc.__v2f(verts[i]);
                    v2 = cc.__v2f(verts[(i + 1) % count]);
                    var n1 = cc.v2fnormalize(cc.v2fperp(cc.v2fsub(v1, v0)));
                    var n2 = cc.v2fnormalize(cc.v2fperp(cc.v2fsub(v2, v1)));
                    var offset = cc.v2fmult(cc.v2fadd(n1, n2), 1.0 / (cc.v2fdot(n1, n2) + 1.0));
                    extrude[i] = {offset: offset, n: n2};
                }
                var triangleCount = 3 * count - 2, vertexCount = 3 * triangleCount;
                this._ensureCapacity(vertexCount);
                var triangleBytesLen = cc.V2F_C4B_T2F_Triangle.BYTES_PER_ELEMENT, trianglesBuffer = this._trianglesArrayBuffer;
                var locBuffer = this._buffer;
                var len = closePoly ? count : count - 1;
                for (i = 0; i < len; i++) {
                    var j = (i + 1) % count;
                    v0 = cc.__v2f(verts[i]);
                    v1 = cc.__v2f(verts[j]);
                    var n0 = extrude[i].n;
                    var offset0 = extrude[i].offset;
                    var offset1 = extrude[j].offset;
                    var inner0 = cc.v2fsub(v0, cc.v2fmult(offset0, borderWidth));
                    var inner1 = cc.v2fsub(v1, cc.v2fmult(offset1, borderWidth));
                    var outer0 = cc.v2fadd(v0, cc.v2fmult(offset0, borderWidth));
                    var outer1 = cc.v2fadd(v1, cc.v2fmult(offset1, borderWidth));
                    locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: inner0, colors: c4bBorderColor, texCoords: cc.__t(cc.v2fneg(n0))},
                        {vertices: inner1, colors: c4bBorderColor, texCoords: cc.__t(cc.v2fneg(n0))}, {vertices: outer1, colors: c4bBorderColor, texCoords: cc.__t(n0)},
                        trianglesBuffer, locBuffer.length * triangleBytesLen));
                    locBuffer.push(new cc.V2F_C4B_T2F_Triangle({vertices: inner0, colors: c4bBorderColor, texCoords: cc.__t(cc.v2fneg(n0))},
                        {vertices: outer0, colors: c4bBorderColor, texCoords: cc.__t(n0)}, {vertices: outer1, colors: c4bBorderColor, texCoords: cc.__t(n0)},
                        trianglesBuffer, locBuffer.length * triangleBytesLen));
                }
                extrude = null;
                this._dirty = true;
            },
            clear:function () {
                this._buffer.length = 0;
                this._dirty = true;
            },
            _createRenderCmd: function () {
                return new cc.DrawNode.WebGLRenderCmd(this);
            }
        });
    }
});
(function(){
    cc.DrawNode.CanvasRenderCmd = function(renderableObject){
        cc.Node.CanvasRenderCmd.call(this, renderableObject);
        this._needDraw = true;
        this._buffer = null;
        this._drawColor = null;
        this._blendFunc = null;
    };
    cc.DrawNode.CanvasRenderCmd.prototype = Object.create(cc.Node.CanvasRenderCmd.prototype);
    cc.DrawNode.CanvasRenderCmd.prototype.constructor = cc.DrawNode.CanvasRenderCmd;
    cc.DrawNode.CanvasRenderCmd.prototype.getLocalBB = function () {
        var node = this._node;
        return node._localBB;
    };
    cc.extend( cc.DrawNode.CanvasRenderCmd.prototype, {
        rendering: function (ctx, scaleX, scaleY) {
            var wrapper = ctx || cc._renderContext, context = wrapper.getContext(), node = this._node;
            var alpha = node._displayedOpacity / 255;
            if (alpha === 0)
                return;
            wrapper.setTransform(this._worldTransform, scaleX, scaleY);
            wrapper.setGlobalAlpha(alpha);
            if ((this._blendFunc && (this._blendFunc.src === cc.SRC_ALPHA) && (this._blendFunc.dst === cc.ONE)))
                wrapper.setCompositeOperation('lighter');
            var locBuffer = this._buffer;
            for (var i = 0, len = locBuffer.length; i < len; i++) {
                var element = locBuffer[i];
                switch (element.type) {
                    case cc.DrawNode.TYPE_DOT:
                        this._drawDot(wrapper, element, scaleX, scaleY);
                        break;
                    case cc.DrawNode.TYPE_SEGMENT:
                        this._drawSegment(wrapper, element, scaleX, scaleY);
                        break;
                    case cc.DrawNode.TYPE_POLY:
                        this._drawPoly(wrapper, element, scaleX, scaleY);
                        break;
                }
            }
        },
        _drawDot: function (wrapper, element) {
            var locColor = element.fillColor, locPos = element.verts[0], locRadius = element.lineWidth;
            var ctx = wrapper.getContext();
            wrapper.setFillStyle("rgba(" + (0 | locColor.r) + "," + (0 | locColor.g) + "," + (0 | locColor.b) + "," + locColor.a / 255 + ")");
            ctx.beginPath();
            ctx.arc(locPos.x , -locPos.y , locRadius , 0, Math.PI * 2, false);
            ctx.closePath();
            ctx.fill();
        },
        _drawSegment: function (wrapper, element, scaleX) {
            var locColor = element.lineColor;
            var locFrom = element.verts[0], locTo = element.verts[1];
            var locLineWidth = element.lineWidth, locLineCap = element.lineCap;
            var ctx = wrapper.getContext();
            wrapper.setStrokeStyle("rgba(" + (0 | locColor.r) + "," + (0 | locColor.g) + "," + (0 | locColor.b) + "," + locColor.a / 255 + ")");
            ctx.lineWidth = locLineWidth * scaleX;
            ctx.beginPath();
            ctx.lineCap = locLineCap;
            ctx.moveTo(locFrom.x , -locFrom.y );
            ctx.lineTo(locTo.x , -locTo.y );
            ctx.stroke();
        },
        _drawPoly: function (wrapper, element, scaleX) {
            var locVertices = element.verts, locLineCap = element.lineCap;
            if (locVertices == null)
                return;
            var locFillColor = element.fillColor, locLineWidth = element.lineWidth;
            var locLineColor = element.lineColor, locIsClosePolygon = element.isClosePolygon;
            var locIsFill = element.isFill, locIsStroke = element.isStroke;
            var ctx = wrapper.getContext();
            var firstPoint = locVertices[0];
            ctx.lineCap = locLineCap;
            if (locFillColor)
                wrapper.setFillStyle("rgba(" + (0 | locFillColor.r) + "," + (0 | locFillColor.g) + ","
                    + (0 | locFillColor.b) + "," + locFillColor.a / 255 + ")");
            if (locLineWidth)
                ctx.lineWidth = locLineWidth * scaleX;
            if (locLineColor)
                wrapper.setStrokeStyle("rgba(" + (0 | locLineColor.r) + "," + (0 | locLineColor.g) + ","
                    + (0 | locLineColor.b) + "," + locLineColor.a / 255 + ")");
            ctx.beginPath();
            ctx.moveTo(firstPoint.x , -firstPoint.y );
            for (var i = 1, len = locVertices.length; i < len; i++)
                ctx.lineTo(locVertices[i].x , -locVertices[i].y );
            if (locIsClosePolygon)
                ctx.closePath();
            if (locIsFill)
                ctx.fill();
            if (locIsStroke)
                ctx.stroke();
        }
    });
})();
(function(){
    cc.DrawNode.WebGLRenderCmd = function (renderableObject) {
        cc.Node.WebGLRenderCmd.call(this, renderableObject);
        this._needDraw = true;
        this._matrix = new cc.math.Matrix4();
        this._matrix.identity();
    };
    cc.DrawNode.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    cc.DrawNode.WebGLRenderCmd.prototype.constructor = cc.DrawNode.WebGLRenderCmd;
    cc.DrawNode.WebGLRenderCmd.prototype.rendering = function (ctx) {
        var node = this._node;
        if (node._buffer.length > 0) {
            var wt = this._worldTransform;
            this._matrix.mat[0] = wt.a;
            this._matrix.mat[4] = wt.c;
            this._matrix.mat[12] = wt.tx;
            this._matrix.mat[1] = wt.b;
            this._matrix.mat[5] = wt.d;
            this._matrix.mat[13] = wt.ty;
            cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
            this._shaderProgram.use();
            this._shaderProgram._setUniformForMVPMatrixWithMat4(this._matrix);
            node._render();
        }
    };
})();
(function () {
    var box2dAPI = {
        _ignoreBodyRotation:false,
        _body:null,
        _PTMRatio:32,
        _rotation:1,
        ctor:function(fileName, rect){
            cc.Sprite.prototype.ctor.call(this);
            if (fileName === undefined) {
                cc.PhysicsSprite.prototype.init.call(this);
            }else if (cc.isString(fileName)) {
                if (fileName[0] === "#") {
                    var frameName = fileName.substr(1, fileName.length - 1);
                    var spriteFrame = cc.spriteFrameCache.getSpriteFrame(frameName);
                    this.initWithSpriteFrame(spriteFrame);
                } else {
                    this.init(fileName, rect);
                }
            }else if (cc.isObject(fileName)) {
                if (fileName instanceof cc.Texture2D) {
                    this.initWithTexture(fileName, rect);
                } else if (fileName instanceof cc.SpriteFrame) {
                    this.initWithSpriteFrame(fileName);
                }
            }
        },
        setBody:function (body) {
            this._body = body;
        },
        getBody:function () {
            return this._body;
        },
        setPTMRatio:function (r) {
            this._PTMRatio = r;
        },
        getPTMRatio:function () {
            return this._PTMRatio;
        },
        getPosition:function () {
            var pos = this._body.GetPosition();
            var locPTMRatio =this._PTMRatio;
            return cc.p(pos.x * locPTMRatio, pos.y * locPTMRatio);
        },
        setPosition:function (p) {
            var angle = this._body.GetAngle();
            var locPTMRatio =this._PTMRatio;
            this._body.setTransform(Box2D.b2Vec2(p.x / locPTMRatio, p.y / locPTMRatio), angle);
            this.setNodeDirty();
        },
        getRotation:function () {
            return (this._ignoreBodyRotation ? cc.radiansToDegrees(this._rotationRadians) : cc.radiansToDegrees(this._body.GetAngle()));
        },
        setRotation:function (r) {
            if (this._ignoreBodyRotation) {
                this._rotation = r;
            } else {
                var locBody = this._body;
                var p = locBody.GetPosition();
                locBody.SetTransform(p, cc.degreesToRadians(r));
            }
            this.setNodeDirty();
        },
        _syncPosition:function () {
            var locPosition = this._position,
                pos = this._body.GetPosition(),
                x = pos.x * this._PTMRatio,
                y = pos.y * this._PTMRatio;
            if (locPosition.x !== pos.x || locPosition.y !== pos.y) {
                cc.Sprite.prototype.setPosition.call(this, x, y);
            }
        },
        _syncRotation:function () {
            this._rotationRadians = this._body.GetAngle();
            var a = cc.radiansToDegrees(this._rotationRadians);
            if (this._rotationX !== a) {
                cc.Sprite.prototype.setRotation.call(this, a);
            }
        },
        setIgnoreBodyRotation: function(b) {
            this._ignoreBodyRotation = b;
        }
    };
    var chipmunkAPI = {
        _ignoreBodyRotation:false,
        _body:null,
        _rotation:1,
        ctor:function(fileName, rect){
            cc.Sprite.prototype.ctor.call(this);
            if (fileName === undefined) {
                cc.PhysicsSprite.prototype.init.call(this);
            }else if (cc.isString(fileName)) {
                if (fileName[0] === "#") {
                    var frameName = fileName.substr(1, fileName.length - 1);
                    var spriteFrame = cc.spriteFrameCache.getSpriteFrame(frameName);
                    this.initWithSpriteFrame(spriteFrame);
                } else {
                    this.init(fileName, rect);
                }
            }else if (cc.isObject(fileName)) {
                if (fileName instanceof cc.Texture2D) {
                    this.initWithTexture(fileName, rect);
                } else if (fileName instanceof cc.SpriteFrame) {
                    this.initWithSpriteFrame(fileName);
                }
            }
            cc.renderer.pushRenderCommand(this._renderCmd);
        },
        visit: function(){
            cc.renderer.pushRenderCommand(this._renderCmd);
            cc.Sprite.prototype.visit.call(this);
        },
        setBody:function (body) {
            this._body = body;
        },
        getBody:function () {
            return this._body;
        },
        getPosition:function () {
            var locBody = this._body;
            return {x:locBody.p.x, y:locBody.p.y};
        },
        getPositionX:function () {
            return this._body.p.x;
        },
        getPositionY:function () {
            return this._body.p.y;
        },
        setPosition:function (newPosOrxValue, yValue) {
            if (yValue === undefined) {
                this._body.p.x = newPosOrxValue.x;
                this._body.p.y = newPosOrxValue.y;
            } else {
                this._body.p.x = newPosOrxValue;
                this._body.p.y = yValue;
            }
        },
        setPositionX:function (xValue) {
            this._body.p.x = xValue;
        },
        setPositionY:function (yValue) {
            this._body.p.y = yValue;
        },
        _syncPosition:function () {
            var locPosition = this._position, locBody = this._body;
            if (locPosition.x !== locBody.p.x || locPosition.y !== locBody.p.y) {
                cc.Sprite.prototype.setPosition.call(this, locBody.p.x, locBody.p.y);
            }
        },
        getRotation:function () {
            return this._ignoreBodyRotation ? this._rotationX : -cc.radiansToDegrees(this._body.a);
        },
        setRotation:function (r) {
            if (this._ignoreBodyRotation) {
                cc.Sprite.prototype.setRotation.call(this, r);
            } else {
                this._body.a = -cc.degreesToRadians(r);
            }
        },
        _syncRotation:function () {
            var a = -cc.radiansToDegrees(this._body.a);
            if (this._rotationX !== a) {
                cc.Sprite.prototype.setRotation.call(this, a);
            }
        },
        getNodeToParentTransform:function () {
            return this._renderCmd.getNodeToParentTransform();
        },
        isDirty:function(){
           return !this._body.isSleeping();
        },
        setDirty: function(){ },
        setIgnoreBodyRotation: function(b) {
            this._ignoreBodyRotation = b;
        },
        _createRenderCmd: function(){
            if(cc._renderType === cc.game.RENDER_TYPE_CANVAS)
                return new cc.PhysicsSprite.CanvasRenderCmd(this);
            else
                return new cc.PhysicsSprite.WebGLRenderCmd(this);
        }
    };
    cc.PhysicsSprite = cc.Sprite.extend(chipmunkAPI);
    cc.PhysicsSprite._className = "PhysicsSprite";
    var _p = cc.PhysicsSprite.prototype;
    _p.body;
    cc.defineGetterSetter(_p, "body", _p.getBody, _p.setBody);
    _p.dirty;
    cc.defineGetterSetter(_p, "dirty", _p.isDirty, _p.setDirty);
    cc.PhysicsSprite.create = function (fileName, rect) {
        return new cc.PhysicsSprite(fileName, rect);
    };
    cc.PhysicsSprite.createWithSpriteFrameName = cc.PhysicsSprite.create;
    cc.PhysicsSprite.createWithSpriteFrame = cc.PhysicsSprite.create;
})();
(function(){
    cc.PhysicsSprite.CanvasRenderCmd = function(renderableObject){
        cc.Sprite.CanvasRenderCmd.call(this, renderableObject);
        this._needDraw = true;
    };
    var proto = cc.PhysicsSprite.CanvasRenderCmd.prototype = Object.create(cc.Sprite.CanvasRenderCmd.prototype);
    proto.constructor = cc.PhysicsSprite.CanvasRenderCmd;
    proto.rendering = function(ctx, scaleX, scaleY){
        var node  = this._node;
        node._syncPosition();
        if(!node._ignoreBodyRotation)
            node._syncRotation();
        this.transform(this.getParentRenderCmd());
        cc.Sprite.CanvasRenderCmd.prototype.rendering.call(this, ctx, scaleX, scaleY);
    };
})();
cc.__convertVerts = function (verts) {
    var ret = [];
    for (var i = 0; i < verts.length / 2; i++) {
        ret[i] = {x:verts[i * 2], y:verts[i * 2 + 1]};
    }
    return ret;
};
cc.ColorForBody = function (body) {
    if (body.isRogue() || body.isSleeping()) {
        return cc.color(128, 128, 128, 128);
    } else if (body.nodeIdleTime > body.space.sleepTimeThreshold) {
        return cc.color(84, 84, 84, 128);
    } else {
        return cc.color(255, 0, 0, 128);
    }
};
cc.DrawShape = function (shape, renderer) {
    var body = shape.body;
    var color = cc.ColorForBody(body);
    switch (shape.collisionCode) {
        case cp.CircleShape.prototype.collisionCode:
            this.drawDot(shape.tc, Math.max(shape.r, 1.0), color);
            this.drawSegment(shape.tc, cp.v.add(shape.tc, cp.v.mult(body.rot, shape.r)), 1.0, color);
            break;
        case cp.SegmentShape.prototype.collisionCode:
            this.drawSegment(shape.ta, shape.tb, Math.max(shape.r, 2.0), color);
            break;
        case cp.PolyShape.prototype.collisionCode:
            var line = cc.color(color.r, color.g, color.b, cc.lerp(color.a, 255, 0.5));
            this.drawPoly(cc.__convertVerts(shape.tVerts), color, 1.0, line);
            break;
        default:
            cc.log("cc.DrawShape(): Bad assertion in DrawShape()");
            break;
    }
};
cc.DrawConstraint = function (constraint, renderer) {
    var body_a = constraint.a;
    var body_b = constraint.b;
    var a, b;
    if (constraint instanceof cp.PinJoint) {
        a = body_a.local2World(constraint.anchr1);
        b = body_b.local2World(constraint.anchr2);
        this.drawDot(a, 3.0, cc.CONSTRAINT_COLOR);
        this.drawDot(b, 3.0, cc.CONSTRAINT_COLOR);
        this.drawSegment(a, b, 1.0, cc.CONSTRAINT_COLOR);
    } else if (constraint instanceof cp.SlideJoint) {
        a = body_a.local2World(constraint.anchr1);
        b = body_b.local2World(constraint.anchr2);
        this.drawDot(a, 3.0, cc.CONSTRAINT_COLOR);
        this.drawDot(b, 3.0, cc.CONSTRAINT_COLOR);
        this.drawSegment(a, b, 1.0, cc.CONSTRAINT_COLOR);
    } else if (constraint instanceof cp.PivotJoint) {
        a = body_a.local2World(constraint.anchr1);
        b = body_b.local2World(constraint.anchr2);
        this.drawDot(a, 3.0, cc.CONSTRAINT_COLOR);
        this.drawDot(b, 3.0, cc.CONSTRAINT_COLOR);
    } else if (constraint instanceof cp.GrooveJoint) {
        a = body_a.local2World(constraint.grv_a);
        b = body_a.local2World(constraint.grv_b);
        var c = body_b.local2World(constraint.anchr2);
        this.drawDot(c, 3.0, cc.CONSTRAINT_COLOR);
        this.drawSegment(a, b, 1.0, cc.CONSTRAINT_COLOR);
    } else if (constraint instanceof cp.DampedSpring) {
    } else {
    }
};
cc.CONSTRAINT_COLOR = cc.color(0, 255, 0, 128);
cc.PhysicsDebugNode = cc.DrawNode.extend({
    _space:null,
    _className:"PhysicsDebugNode",
    ctor: function (space) {
        cc.DrawNode.prototype.ctor.call(this);
        this._space = space;
    },
    getSpace:function () {
        return this._space;
    },
    setSpace:function (space) {
        this._space = space;
    },
    draw:function (context) {
        if (!this._space)
            return;
        this._space.eachShape(cc.DrawShape.bind(this));
        this._space.eachConstraint(cc.DrawConstraint.bind(this));
        cc.DrawNode.prototype.draw.call(this);
        this.clear();
    },
    _createRenderCmd: function(){
        if(cc._renderType === cc.game.RENDER_TYPE_CANVAS)
            return new cc.PhysicsDebugNode.CanvasRenderCmd(this);
        else
            return new cc.PhysicsDebugNode.WebGLRenderCmd(this);
    }
});
cc.PhysicsDebugNode.create = function (space) {
    return new cc.PhysicsDebugNode(space);
};
(function(){
    cc.PhysicsDebugNode.CanvasRenderCmd = function(renderableObject){
        cc.Node.CanvasRenderCmd.call(this, renderableObject);
        this._buffer = renderableObject._buffer;
        this._needDraw = true;
    };
    var proto = cc.PhysicsDebugNode.CanvasRenderCmd.prototype = Object.create(cc.Node.CanvasRenderCmd.prototype);
    proto.constructor = cc.PhysicsDebugNode.CanvasRenderCmd;
    proto.rendering = function(ctx, scaleX, scaleY){
        var node = this._node;
        if (!node._space)
            return;
        node._space.eachShape(cc.DrawShape.bind(node));
        node._space.eachConstraint(cc.DrawConstraint.bind(node));
        cc.DrawNode.CanvasRenderCmd.prototype.rendering.call(this, ctx, scaleX, scaleY);
        node.clear();
    };
    proto._drawDot = cc.DrawNode.CanvasRenderCmd.prototype._drawDot;
    proto._drawSegment = cc.DrawNode.CanvasRenderCmd.prototype._drawSegment;
    proto._drawPoly = cc.DrawNode.CanvasRenderCmd.prototype._drawPoly;
})();
(function(){
    cc.PhysicsDebugNode.WebGLRenderCmd = function (renderableObject) {
        cc.Node.WebGLRenderCmd.call(this, renderableObject);
        this._needDraw = true;
        this._matrix = new cc.math.Matrix4();
        this._matrix.identity();
    };
    cc.PhysicsDebugNode.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    cc.PhysicsDebugNode.WebGLRenderCmd.prototype.constructor = cc.PhysicsDebugNode.WebGLRenderCmd;
    cc.PhysicsDebugNode.WebGLRenderCmd.prototype.rendering = function (ctx) {
        var node = this._node;
        if (!node._space)
            return;
        node._space.eachShape(cc.DrawShape.bind(node));
        node._space.eachConstraint(cc.DrawConstraint.bind(node));
        var wt = this._worldTransform;
        this._matrix.mat[0] = wt.a;
        this._matrix.mat[4] = wt.c;
        this._matrix.mat[12] = wt.tx;
        this._matrix.mat[1] = wt.b;
        this._matrix.mat[5] = wt.d;
        this._matrix.mat[13] = wt.ty;
        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        this._shaderProgram.use();
        this._shaderProgram._setUniformForMVPMatrixWithMat4(this._matrix);
        node._render();
        node.clear();
    };
})();
(function(){
    cc.PhysicsSprite.WebGLRenderCmd = function(renderableObject){
        cc.Sprite.WebGLRenderCmd.call(this, renderableObject);
        this._needDraw = true;
    };
    var proto = cc.PhysicsSprite.WebGLRenderCmd.prototype = Object.create(cc.Sprite.WebGLRenderCmd.prototype);
    proto.constructor = cc.PhysicsSprite.WebGLRenderCmd;
    proto.spUploadData = cc.Sprite.WebGLRenderCmd.prototype.uploadData;
    proto.uploadData = function (f32buffer, ui32buffer, vertexDataOffset) {
        var node  = this._node;
        node._syncPosition();
        if(!node._ignoreBodyRotation)
            node._syncRotation();
        this.transform(this.getParentRenderCmd(), true);
        return this.spUploadData(f32buffer, ui32buffer, vertexDataOffset);
    };
})();
(function(){
Object.create = Object.create || function(o) {
	function F() {}
	F.prototype = o;
	return new F();
};
var cp;
if(typeof exports === 'undefined'){
	cp = {};
	if(typeof window === 'object'){
		window["cp"] = cp;
	}
} else {
	cp = exports;
}
var assert = function(value, message)
{
	if (!value) {
		throw new Error('Assertion failed: ' + message);
	}
};
var assertSoft = function(value, message)
{
	if(!value && console && console.warn) {
		console.warn("ASSERTION FAILED: " + message);
		if(console.trace) {
			console.trace();
		}
	}
};
var mymin = function(a, b)
{
	return a < b ? a : b;
};
var mymax = function(a, b)
{
	return a > b ? a : b;
};
var min, max;
if (typeof window === 'object' && window.navigator.userAgent.indexOf('Firefox') > -1){
	min = Math.min;
	max = Math.max;
} else {
	min = mymin;
	max = mymax;
}
var hashPair = function(a, b)
{
	return a < b ? a + ' ' + b : b + ' ' + a;
};
var deleteObjFromList = function(arr, obj)
{
	for(var i=0; i<arr.length; i++){
		if(arr[i] === obj){
			arr[i] = arr[arr.length - 1];
			arr.length--;
			return;
		}
	}
};
var closestPointOnSegment = function(p, a, b)
{
	var delta = vsub(a, b);
	var t = clamp01(vdot(delta, vsub(p, b))/vlengthsq(delta));
	return vadd(b, vmult(delta, t));
};
var closestPointOnSegment2 = function(px, py, ax, ay, bx, by)
{
	var deltax = ax - bx;
	var deltay = ay - by;
	var t = clamp01(vdot2(deltax, deltay, px - bx, py - by)/vlengthsq2(deltax, deltay));
	return new Vect(bx + deltax * t, by + deltay * t);
};
cp.momentForCircle = function(m, r1, r2, offset)
{
	return m*(0.5*(r1*r1 + r2*r2) + vlengthsq(offset));
};
cp.areaForCircle = function(r1, r2)
{
	return Math.PI*Math.abs(r1*r1 - r2*r2);
};
cp.momentForSegment = function(m, a, b)
{
	var offset = vmult(vadd(a, b), 0.5);
	return m*(vdistsq(b, a)/12 + vlengthsq(offset));
};
cp.areaForSegment = function(a, b, r)
{
	return r*(Math.PI*r + 2*vdist(a, b));
};
cp.momentForPoly = function(m, verts, offset)
{
	var sum1 = 0;
	var sum2 = 0;
	var len = verts.length;
	for(var i=0; i<len; i+=2){
		var v1x = verts[i] + offset.x;
	 	var v1y = verts[i+1] + offset.y;
		var v2x = verts[(i+2)%len] + offset.x;
		var v2y = verts[(i+3)%len] + offset.y;
		var a = vcross2(v2x, v2y, v1x, v1y);
		var b = vdot2(v1x, v1y, v1x, v1y) + vdot2(v1x, v1y, v2x, v2y) + vdot2(v2x, v2y, v2x, v2y);
		sum1 += a*b;
		sum2 += a;
	}
	return (m*sum1)/(6*sum2);
};
cp.areaForPoly = function(verts)
{
	var area = 0;
	for(var i=0, len=verts.length; i<len; i+=2){
		area += vcross(new Vect(verts[i], verts[i+1]), new Vect(verts[(i+2)%len], verts[(i+3)%len]));
	}
	return -area/2;
};
cp.centroidForPoly = function(verts)
{
	var sum = 0;
	var vsum = new Vect(0,0);
	for(var i=0, len=verts.length; i<len; i+=2){
		var v1 = new Vect(verts[i], verts[i+1]);
		var v2 = new Vect(verts[(i+2)%len], verts[(i+3)%len]);
		var cross = vcross(v1, v2);
		sum += cross;
		vsum = vadd(vsum, vmult(vadd(v1, v2), cross));
	}
	return vmult(vsum, 1/(3*sum));
};
cp.recenterPoly = function(verts)
{
	var centroid = cp.centroidForPoly(verts);
	for(var i=0; i<verts.length; i+=2){
		verts[i] -= centroid.x;
		verts[i+1] -= centroid.y;
	}
};
cp.momentForBox = function(m, width, height)
{
	return m*(width*width + height*height)/12;
};
cp.momentForBox2 = function(m, box)
{
	var width = box.r - box.l;
	var height = box.t - box.b;
	var offset = vmult([box.l + box.r, box.b + box.t], 0.5);
	return cp.momentForBox(m, width, height) + m*vlengthsq(offset);
};
var loopIndexes = cp.loopIndexes = function(verts)
{
	var start = 0, end = 0;
	var minx, miny, maxx, maxy;
	minx = maxx = verts[0];
	miny = maxy = verts[1];
	var count = verts.length >> 1;
  for(var i=1; i<count; i++){
		var x = verts[i*2];
		var y = verts[i*2 + 1];
    if(x < minx || (x == minx && y < miny)){
			minx = x;
			miny = y;
      start = i;
    } else if(x > maxx || (x == maxx && y > maxy)){
			maxx = x;
			maxy = y;
			end = i;
		}
	}
	return [start, end];
};
var SWAP = function(arr, idx1, idx2)
{
	var tmp = arr[idx1*2];
	arr[idx1*2] = arr[idx2*2];
	arr[idx2*2] = tmp;
	tmp = arr[idx1*2+1];
	arr[idx1*2+1] = arr[idx2*2+1];
	arr[idx2*2+1] = tmp;
};
var QHullPartition = function(verts, offs, count, a, b, tol)
{
	if(count === 0) return 0;
	var max = 0;
	var pivot = offs;
	var delta = vsub(b, a);
	var valueTol = tol * vlength(delta);
	var head = offs;
	for(var tail = offs+count-1; head <= tail;){
		var v = new Vect(verts[head * 2], verts[head * 2 + 1]);
		var value = vcross(delta, vsub(v, a));
		if(value > valueTol){
			if(value > max){
				max = value;
				pivot = head;
			}
			head++;
		} else {
			SWAP(verts, head, tail);
			tail--;
		}
	}
	if(pivot != offs) SWAP(verts, offs, pivot);
	return head - offs;
};
var QHullReduce = function(tol, verts, offs, count, a, pivot, b, resultPos)
{
	if(count < 0){
		return 0;
	} else if(count == 0) {
		verts[resultPos*2] = pivot.x;
		verts[resultPos*2+1] = pivot.y;
		return 1;
	} else {
		var left_count = QHullPartition(verts, offs, count, a, pivot, tol);
		var left = new Vect(verts[offs*2], verts[offs*2+1]);
		var index = QHullReduce(tol, verts, offs + 1, left_count - 1, a, left, pivot, resultPos);
		var pivotPos = resultPos + index++;
		verts[pivotPos*2] = pivot.x;
		verts[pivotPos*2+1] = pivot.y;
		var right_count = QHullPartition(verts, offs + left_count, count - left_count, pivot, b, tol);
		var right = new Vect(verts[(offs+left_count)*2], verts[(offs+left_count)*2+1]);
		return index + QHullReduce(tol, verts, offs + left_count + 1, right_count - 1, pivot, right, b, resultPos + index);
	}
};
cp.convexHull = function(verts, result, tolerance)
{
	if(result){
		for (var i = 0; i < verts.length; i++){
			result[i] = verts[i];
		}
	} else {
		result = verts;
	}
	var indexes = loopIndexes(verts);
	var start = indexes[0], end = indexes[1];
	if(start == end){
		result.length = 2;
		return result;
	}
	SWAP(result, 0, start);
	SWAP(result, 1, end == 0 ? start : end);
	var a = new Vect(result[0], result[1]);
	var b = new Vect(result[2], result[3]);
	var count = verts.length >> 1;
	var resultCount = QHullReduce(tolerance, result, 2, count - 2, a, b, a, 1) + 1;
	result.length = resultCount*2;
	assertSoft(polyValidate(result),
		"Internal error: cpConvexHull() and cpPolyValidate() did not agree." +
		"Please report this error with as much info as you can.");
	return result;
};
var clamp = function(f, minv, maxv)
{
	return min(max(f, minv), maxv);
};
var clamp01 = function(f)
{
	return max(0, min(f, 1));
};
var lerp = function(f1, f2, t)
{
	return f1*(1 - t) + f2*t;
};
var lerpconst = function(f1, f2, d)
{
	return f1 + clamp(f2 - f1, -d, d);
};
var Vect = cp.Vect = function(x, y)
{
	this.x = x;
	this.y = y;
};
cp.v = function (x,y) { return new Vect(x, y) };
var vzero = cp.vzero = new Vect(0,0);
var vdot = cp.v.dot = function(v1, v2)
{
	return v1.x*v2.x + v1.y*v2.y;
};
var vdot2 = function(x1, y1, x2, y2)
{
	return x1*x2 + y1*y2;
};
var vlength = cp.v.len = function(v)
{
	return Math.sqrt(vdot(v, v));
};
var vlength2 = cp.v.len2 = function(x, y)
{
	return Math.sqrt(x*x + y*y);
};
var veql = cp.v.eql = function(v1, v2)
{
	return (v1.x === v2.x && v1.y === v2.y);
};
var vadd = cp.v.add = function(v1, v2)
{
	return new Vect(v1.x + v2.x, v1.y + v2.y);
};
Vect.prototype.add = function(v2)
{
	this.x += v2.x;
	this.y += v2.y;
	return this;
};
var vsub = cp.v.sub = function(v1, v2)
{
	return new Vect(v1.x - v2.x, v1.y - v2.y);
};
Vect.prototype.sub = function(v2)
{
	this.x -= v2.x;
	this.y -= v2.y;
	return this;
};
var vneg = cp.v.neg = function(v)
{
	return new Vect(-v.x, -v.y);
};
Vect.prototype.neg = function()
{
	this.x = -this.x;
	this.y = -this.y;
	return this;
};
var vmult = cp.v.mult = function(v, s)
{
	return new Vect(v.x*s, v.y*s);
};
Vect.prototype.mult = function(s)
{
	this.x *= s;
	this.y *= s;
	return this;
};
var vcross = cp.v.cross = function(v1, v2)
{
	return v1.x*v2.y - v1.y*v2.x;
};
var vcross2 = function(x1, y1, x2, y2)
{
	return x1*y2 - y1*x2;
};
var vperp = cp.v.perp = function(v)
{
	return new Vect(-v.y, v.x);
};
var vpvrperp = cp.v.pvrperp = function(v)
{
	return new Vect(v.y, -v.x);
};
var vproject = cp.v.project = function(v1, v2)
{
	return vmult(v2, vdot(v1, v2)/vlengthsq(v2));
};
Vect.prototype.project = function(v2)
{
	this.mult(vdot(this, v2) / vlengthsq(v2));
	return this;
};
var vrotate = cp.v.rotate = function(v1, v2)
{
	return new Vect(v1.x*v2.x - v1.y*v2.y, v1.x*v2.y + v1.y*v2.x);
};
Vect.prototype.rotate = function(v2)
{
	this.x = this.x * v2.x - this.y * v2.y;
	this.y = this.x * v2.y + this.y * v2.x;
	return this;
};
var vunrotate = cp.v.unrotate = function(v1, v2)
{
	return new Vect(v1.x*v2.x + v1.y*v2.y, v1.y*v2.x - v1.x*v2.y);
};
var vlengthsq = cp.v.lengthsq = function(v)
{
	return vdot(v, v);
};
var vlengthsq2 = cp.v.lengthsq2 = function(x, y)
{
	return x*x + y*y;
};
var vlerp = cp.v.lerp = function(v1, v2, t)
{
	return vadd(vmult(v1, 1 - t), vmult(v2, t));
};
var vnormalize = cp.v.normalize = function(v)
{
	return vmult(v, 1/vlength(v));
};
var vnormalize_safe = cp.v.normalize_safe = function(v)
{
	return (v.x === 0 && v.y === 0 ? vzero : vnormalize(v));
};
var vclamp = cp.v.clamp = function(v, len)
{
	return (vdot(v,v) > len*len) ? vmult(vnormalize(v), len) : v;
};
var vlerpconst = cp.v.lerpconst = function(v1, v2, d)
{
	return vadd(v1, vclamp(vsub(v2, v1), d));
};
var vdist = cp.v.dist = function(v1, v2)
{
	return vlength(vsub(v1, v2));
};
var vdistsq = cp.v.distsq = function(v1, v2)
{
	return vlengthsq(vsub(v1, v2));
};
var vnear = cp.v.near = function(v1, v2, dist)
{
	return vdistsq(v1, v2) < dist*dist;
};
var vslerp = cp.v.slerp = function(v1, v2, t)
{
	var omega = Math.acos(vdot(v1, v2));
	if(omega) {
		var denom = 1/Math.sin(omega);
		return vadd(vmult(v1, Math.sin((1 - t)*omega)*denom), vmult(v2, Math.sin(t*omega)*denom));
	} else {
		return v1;
	}
};
var vslerpconst = cp.v.slerpconst = function(v1, v2, a)
{
	var angle = Math.acos(vdot(v1, v2));
	return vslerp(v1, v2, min(a, angle)/angle);
};
var vforangle = cp.v.forangle = function(a)
{
	return new Vect(Math.cos(a), Math.sin(a));
};
var vtoangle = cp.v.toangle = function(v)
{
	return Math.atan2(v.y, v.x);
};
var vstr = cp.v.str = function(v)
{
	return "(" + v.x.toFixed(3) + ", " + v.y.toFixed(3) + ")";
};
var numBB = 0;
var BB = cp.BB = function(l, b, r, t)
{
	this.l = l;
	this.b = b;
	this.r = r;
	this.t = t;
	numBB++;
};
cp.bb = function(l, b, r, t) { return new BB(l, b, r, t); };
var bbNewForCircle = function(p, r)
{
	return new BB(
			p.x - r,
			p.y - r,
			p.x + r,
			p.y + r
		);
};
var bbIntersects = function(a, b)
{
	return (a.l <= b.r && b.l <= a.r && a.b <= b.t && b.b <= a.t);
};
var bbIntersects2 = function(bb, l, b, r, t)
{
	return (bb.l <= r && l <= bb.r && bb.b <= t && b <= bb.t);
};
var bbContainsBB = function(bb, other)
{
	return (bb.l <= other.l && bb.r >= other.r && bb.b <= other.b && bb.t >= other.t);
};
var bbContainsVect = function(bb, v)
{
	return (bb.l <= v.x && bb.r >= v.x && bb.b <= v.y && bb.t >= v.y);
};
var bbContainsVect2 = function(l, b, r, t, v)
{
	return (l <= v.x && r >= v.x && b <= v.y && t >= v.y);
};
var bbMerge = function(a, b){
	return new BB(
			min(a.l, b.l),
			min(a.b, b.b),
			max(a.r, b.r),
			max(a.t, b.t)
		);
};
var bbExpand = function(bb, v){
	return new BB(
			min(bb.l, v.x),
			min(bb.b, v.y),
			max(bb.r, v.x),
			max(bb.t, v.y)
		);
};
var bbArea = function(bb)
{
	return (bb.r - bb.l)*(bb.t - bb.b);
};
var bbMergedArea = function(a, b)
{
	return (max(a.r, b.r) - min(a.l, b.l))*(max(a.t, b.t) - min(a.b, b.b));
};
var bbMergedArea2 = function(bb, l, b, r, t)
{
	return (max(bb.r, r) - min(bb.l, l))*(max(bb.t, t) - min(bb.b, b));
};
var bbIntersectsSegment = function(bb, a, b)
{
	return (bbSegmentQuery(bb, a, b) != Infinity);
};
var bbClampVect = function(bb, v)
{
	var x = min(max(bb.l, v.x), bb.r);
	var y = min(max(bb.b, v.y), bb.t);
	return new Vect(x, y);
};
var bbWrapVect = function(bb, v)
{
	var ix = Math.abs(bb.r - bb.l);
	var modx = (v.x - bb.l) % ix;
	var x = (modx > 0) ? modx : modx + ix;
	var iy = Math.abs(bb.t - bb.b);
	var mody = (v.y - bb.b) % iy;
	var y = (mody > 0) ? mody : mody + iy;
	return new Vect(x + bb.l, y + bb.b);
};
var shapeIDCounter = 0;
var CP_NO_GROUP = cp.NO_GROUP = 0;
var CP_ALL_LAYERS = cp.ALL_LAYERS = ~0;
var CP_ALL_CATEGORIES = cp.ALL_CATEGORIES = ~0;
cp.resetShapeIdCounter = function()
{
	shapeIDCounter = 0;
};
var Shape = cp.Shape = function(body) {
	this.body = body;
	this.bb_l = this.bb_b = this.bb_r = this.bb_t = 0;
	this.hashid = shapeIDCounter++;
	this.sensor = false;
	this.e = 0;
	this.u = 0;
	this.surface_v = vzero;
	this.collision_type = 0;
	this.group = 0;
	this.layers = CP_ALL_LAYERS;
	this.space = null;
	this.collisionCode = this.collisionCode;
};
Shape.prototype.setElasticity = function(e) { this.e = e; };
Shape.prototype.setFriction = function(u) { this.body.activate(); this.u = u; };
Shape.prototype.setLayers = function(layers) { this.body.activate(); this.layers = layers; };
Shape.prototype.setSensor = function(sensor) { this.body.activate(); this.sensor = sensor; };
Shape.prototype.setCollisionType = function(collision_type) { this.body.activate(); this.collision_type = collision_type; };
Shape.prototype.getBody = function() { return this.body; };
Shape.prototype.active = function()
{
	return this.body && this.body.shapeList.indexOf(this) !== -1;
};
Shape.prototype.setBody = function(body)
{
	assert(!this.active(), "You cannot change the body on an active shape. You must remove the shape from the space before changing the body.");
	this.body = body;
};
Shape.prototype.cacheBB = function()
{
	return this.update(this.body.p, this.body.rot);
};
Shape.prototype.update = function(pos, rot)
{
	assert(!isNaN(rot.x), 'Rotation is NaN');
	assert(!isNaN(pos.x), 'Position is NaN');
	this.cacheData(pos, rot);
};
Shape.prototype.pointQuery = function(p)
{
	var info = this.nearestPointQuery(p);
	if (info.d < 0) return info;
};
Shape.prototype.getBB = function()
{
	return new BB(this.bb_l, this.bb_b, this.bb_r, this.bb_t);
};
var PointQueryExtendedInfo = function(shape)
{
	this.shape = shape;
	this.d = Infinity;
	this.n = vzero;
};
var NearestPointQueryInfo = function(shape, p, d)
{
	this.shape = shape;
	this.p = p;
	this.d = d;
};
var SegmentQueryInfo = function(shape, t, n)
{
	this.shape = shape;
	this.t = t;
	this.n = n;
};
SegmentQueryInfo.prototype.hitPoint = function(start, end)
{
	return vlerp(start, end, this.t);
};
SegmentQueryInfo.prototype.hitDist = function(start, end)
{
	return vdist(start, end) * this.t;
};
var CircleShape = cp.CircleShape = function(body, radius, offset)
{
	this.c = this.tc = offset;
	this.r = radius;
	this.type = 'circle';
	Shape.call(this, body);
};
CircleShape.prototype = Object.create(Shape.prototype);
CircleShape.prototype.cacheData = function(p, rot)
{
	var c = this.tc = vrotate(this.c, rot).add(p);
	var r = this.r;
	this.bb_l = c.x - r;
	this.bb_b = c.y - r;
	this.bb_r = c.x + r;
	this.bb_t = c.y + r;
};
CircleShape.prototype.nearestPointQuery = function(p)
{
	var deltax = p.x - this.tc.x;
	var deltay = p.y - this.tc.y;
	var d = vlength2(deltax, deltay);
	var r = this.r;
	var nearestp = new Vect(this.tc.x + deltax * r/d, this.tc.y + deltay * r/d);
	return new NearestPointQueryInfo(this, nearestp, d - r);
};
var circleSegmentQuery = function(shape, center, r, a, b, info)
{
	a = vsub(a, center);
	b = vsub(b, center);
	var qa = vdot(a, a) - 2*vdot(a, b) + vdot(b, b);
	var qb = -2*vdot(a, a) + 2*vdot(a, b);
	var qc = vdot(a, a) - r*r;
	var det = qb*qb - 4*qa*qc;
	if(det >= 0)
	{
		var t = (-qb - Math.sqrt(det))/(2*qa);
		if(0 <= t && t <= 1){
			return new SegmentQueryInfo(shape, t, vnormalize(vlerp(a, b, t)));
		}
	}
};
CircleShape.prototype.segmentQuery = function(a, b)
{
	return circleSegmentQuery(this, this.tc, this.r, a, b);
};
var SegmentShape = cp.SegmentShape = function(body, a, b, r)
{
	this.a = a;
	this.b = b;
	this.n = vperp(vnormalize(vsub(b, a)));
	this.ta = this.tb = this.tn = null;
	this.r = r;
	this.a_tangent = vzero;
	this.b_tangent = vzero;
	this.type = 'segment';
	Shape.call(this, body);
};
SegmentShape.prototype = Object.create(Shape.prototype);
SegmentShape.prototype.cacheData = function(p, rot)
{
	this.ta = vadd(p, vrotate(this.a, rot));
	this.tb = vadd(p, vrotate(this.b, rot));
	this.tn = vrotate(this.n, rot);
	var l,r,b,t;
	if(this.ta.x < this.tb.x){
		l = this.ta.x;
		r = this.tb.x;
	} else {
		l = this.tb.x;
		r = this.ta.x;
	}
	if(this.ta.y < this.tb.y){
		b = this.ta.y;
		t = this.tb.y;
	} else {
		b = this.tb.y;
		t = this.ta.y;
	}
	var rad = this.r;
	this.bb_l = l - rad;
	this.bb_b = b - rad;
	this.bb_r = r + rad;
	this.bb_t = t + rad;
};
SegmentShape.prototype.nearestPointQuery = function(p)
{
	var closest = closestPointOnSegment(p, this.ta, this.tb);
	var deltax = p.x - closest.x;
	var deltay = p.y - closest.y;
	var d = vlength2(deltax, deltay);
	var r = this.r;
	var nearestp = (d ? vadd(closest, vmult(new Vect(deltax, deltay), r/d)) : closest);
	return new NearestPointQueryInfo(this, nearestp, d - r);
};
SegmentShape.prototype.segmentQuery = function(a, b)
{
	var n = this.tn;
	var d = vdot(vsub(this.ta, a), n);
	var r = this.r;
	var flipped_n = (d > 0 ? vneg(n) : n);
	var n_offset = vsub(vmult(flipped_n, r), a);
	var seg_a = vadd(this.ta, n_offset);
	var seg_b = vadd(this.tb, n_offset);
	var delta = vsub(b, a);
	if(vcross(delta, seg_a)*vcross(delta, seg_b) <= 0){
		var d_offset = d + (d > 0 ? -r : r);
		var ad = -d_offset;
		var bd = vdot(delta, n) - d_offset;
		if(ad*bd < 0){
			return new SegmentQueryInfo(this, ad/(ad - bd), flipped_n);
		}
	} else if(r !== 0){
		var info1 = circleSegmentQuery(this, this.ta, this.r, a, b);
		var info2 = circleSegmentQuery(this, this.tb, this.r, a, b);
		if (info1){
			return info2 && info2.t < info1.t ? info2 : info1;
		} else {
			return info2;
		}
	}
};
SegmentShape.prototype.setNeighbors = function(prev, next)
{
	this.a_tangent = vsub(prev, this.a);
	this.b_tangent = vsub(next, this.b);
};
SegmentShape.prototype.setEndpoints = function(a, b)
{
	this.a = a;
	this.b = b;
	this.n = vperp(vnormalize(vsub(b, a)));
};
var polyValidate = function(verts)
{
	var len = verts.length;
	for(var i=0; i<len; i+=2){
		var ax = verts[i];
	 	var ay = verts[i+1];
		var bx = verts[(i+2)%len];
		var by = verts[(i+3)%len];
		var cx = verts[(i+4)%len];
		var cy = verts[(i+5)%len];
		if(vcross2(bx - ax, by - ay, cx - bx, cy - by) > 0){
			return false;
		}
	}
	return true;
};
var PolyShape = cp.PolyShape = function(body, verts, offset)
{
	this.setVerts(verts, offset);
	this.type = 'poly';
	Shape.call(this, body);
};
PolyShape.prototype = Object.create(Shape.prototype);
var SplittingPlane = function(n, d)
{
	this.n = n;
	this.d = d;
};
SplittingPlane.prototype.compare = function(v)
{
	return vdot(this.n, v) - this.d;
};
PolyShape.prototype.setVerts = function(verts, offset)
{
	assert(verts.length >= 4, "Polygons require some verts");
	assert(typeof(verts[0]) === 'number',
			'Polygon verticies should be specified in a flattened list (eg [x1,y1,x2,y2,x3,y3,...])');
	assert(polyValidate(verts), "Polygon is concave or has a reversed winding. Consider using cpConvexHull()");
	var len = verts.length;
	var numVerts = len >> 1;
	this.verts = new Array(len);
	this.tVerts = new Array(len);
	this.planes = new Array(numVerts);
	this.tPlanes = new Array(numVerts);
	for(var i=0; i<len; i+=2){
		var ax = verts[i] + offset.x;
	 	var ay = verts[i+1] + offset.y;
		var bx = verts[(i+2)%len] + offset.x;
		var by = verts[(i+3)%len] + offset.y;
		var n = vnormalize(vperp(new Vect(bx-ax, by-ay)));
		this.verts[i  ] = ax;
		this.verts[i+1] = ay;
		this.planes[i>>1] = new SplittingPlane(n, vdot2(n.x, n.y, ax, ay));
		this.tPlanes[i>>1] = new SplittingPlane(new Vect(0,0), 0);
	}
};
var BoxShape = cp.BoxShape = function(body, width, height)
{
	var hw = width/2;
	var hh = height/2;
	return BoxShape2(body, new BB(-hw, -hh, hw, hh));
};
var BoxShape2 = cp.BoxShape2 = function(body, box)
{
	var verts = [
		box.l, box.b,
		box.l, box.t,
		box.r, box.t,
		box.r, box.b
	];
	return new PolyShape(body, verts, vzero);
};
PolyShape.prototype.transformVerts = function(p, rot)
{
	var src = this.verts;
	var dst = this.tVerts;
	var l = Infinity, r = -Infinity;
	var b = Infinity, t = -Infinity;
	for(var i=0; i<src.length; i+=2){
		var x = src[i];
	 	var y = src[i+1];
		var vx = p.x + x*rot.x - y*rot.y;
		var vy = p.y + x*rot.y + y*rot.x;
		dst[i] = vx;
		dst[i+1] = vy;
		l = min(l, vx);
		r = max(r, vx);
		b = min(b, vy);
		t = max(t, vy);
	}
	this.bb_l = l;
	this.bb_b = b;
	this.bb_r = r;
	this.bb_t = t;
};
PolyShape.prototype.transformAxes = function(p, rot)
{
	var src = this.planes;
	var dst = this.tPlanes;
	for(var i=0; i<src.length; i++){
		var n = vrotate(src[i].n, rot);
		dst[i].n = n;
		dst[i].d = vdot(p, n) + src[i].d;
	}
};
PolyShape.prototype.cacheData = function(p, rot)
{
	this.transformAxes(p, rot);
	this.transformVerts(p, rot);
};
PolyShape.prototype.nearestPointQuery = function(p)
{
	var planes = this.tPlanes;
	var verts = this.tVerts;
	var v0x = verts[verts.length - 2];
	var v0y = verts[verts.length - 1];
	var minDist = Infinity;
	var closestPoint = vzero;
	var outside = false;
	for(var i=0; i<planes.length; i++){
		if(planes[i].compare(p) > 0) outside = true;
		var v1x = verts[i*2];
		var v1y = verts[i*2 + 1];
		var closest = closestPointOnSegment2(p.x, p.y, v0x, v0y, v1x, v1y);
		var dist = vdist(p, closest);
		if(dist < minDist){
			minDist = dist;
			closestPoint = closest;
		}
		v0x = v1x;
		v0y = v1y;
	}
	return new NearestPointQueryInfo(this, closestPoint, (outside ? minDist : -minDist));
};
PolyShape.prototype.segmentQuery = function(a, b)
{
	var axes = this.tPlanes;
	var verts = this.tVerts;
	var numVerts = axes.length;
	var len = numVerts * 2;
	for(var i=0; i<numVerts; i++){
		var n = axes[i].n;
		var an = vdot(a, n);
		if(axes[i].d > an) continue;
		var bn = vdot(b, n);
		var t = (axes[i].d - an)/(bn - an);
		if(t < 0 || 1 < t) continue;
		var point = vlerp(a, b, t);
		var dt = -vcross(n, point);
		var dtMin = -vcross2(n.x, n.y, verts[i*2], verts[i*2+1]);
		var dtMax = -vcross2(n.x, n.y, verts[(i*2+2)%len], verts[(i*2+3)%len]);
		if(dtMin <= dt && dt <= dtMax){
			return new SegmentQueryInfo(this, t, n);
		}
	}
};
PolyShape.prototype.valueOnAxis = function(n, d)
{
	var verts = this.tVerts;
	var m = vdot2(n.x, n.y, verts[0], verts[1]);
	for(var i=2; i<verts.length; i+=2){
		m = min(m, vdot2(n.x, n.y, verts[i], verts[i+1]));
	}
	return m - d;
};
PolyShape.prototype.containsVert = function(vx, vy)
{
	var planes = this.tPlanes;
	for(var i=0; i<planes.length; i++){
		var n = planes[i].n;
		var dist = vdot2(n.x, n.y, vx, vy) - planes[i].d;
		if(dist > 0) return false;
	}
	return true;
};
PolyShape.prototype.containsVertPartial = function(vx, vy, n)
{
	var planes = this.tPlanes;
	for(var i=0; i<planes.length; i++){
		var n2 = planes[i].n;
		if(vdot(n2, n) < 0) continue;
		var dist = vdot2(n2.x, n2.y, vx, vy) - planes[i].d;
		if(dist > 0) return false;
	}
	return true;
};
PolyShape.prototype.getNumVerts = function() { return this.verts.length / 2; };
PolyShape.prototype.getCount = PolyShape.prototype.getNumVerts;
PolyShape.prototype.getVert = function(i)
{
	return new Vect(this.verts[i * 2], this.verts[i * 2 + 1]);
};
var Body = cp.Body = function(m, i) {
	this.p = new Vect(0,0);
	this.vx = this.vy = 0;
	this.f = new Vect(0,0);
	this.w = 0;
	this.t = 0;
	this.v_limit = Infinity;
	this.w_limit = Infinity;
	this.v_biasx = this.v_biasy = 0;
	this.w_bias = 0;
	this.space = null;
	this.shapeList = [];
	this.arbiterList = null;
	this.constraintList = null;
	this.nodeRoot = null;
	this.nodeNext = null;
	this.nodeIdleTime = 0;
	this.setMass(m);
	this.setMoment(i);
	this.rot = new Vect(0,0);
	this.setAngle(0);
};
var createStaticBody = function()
{
	var body = new Body(Infinity, Infinity);
	body.nodeIdleTime = Infinity;
	return body;
};
    cp.StaticBody = createStaticBody;
if (typeof DEBUG !== 'undefined' && DEBUG) {
	var v_assert_nan = function(v, message){assert(v.x == v.x && v.y == v.y, message); };
	var v_assert_infinite = function(v, message){assert(Math.abs(v.x) !== Infinity && Math.abs(v.y) !== Infinity, message);};
	var v_assert_sane = function(v, message){v_assert_nan(v, message); v_assert_infinite(v, message);};
	Body.prototype.sanityCheck = function()
	{
		assert(this.m === this.m && this.m_inv === this.m_inv, "Body's mass is invalid.");
		assert(this.i === this.i && this.i_inv === this.i_inv, "Body's moment is invalid.");
		v_assert_sane(this.p, "Body's position is invalid.");
		v_assert_sane(this.f, "Body's force is invalid.");
		assert(this.vx === this.vx && Math.abs(this.vx) !== Infinity, "Body's velocity is invalid.");
		assert(this.vy === this.vy && Math.abs(this.vy) !== Infinity, "Body's velocity is invalid.");
		assert(this.a === this.a && Math.abs(this.a) !== Infinity, "Body's angle is invalid.");
		assert(this.w === this.w && Math.abs(this.w) !== Infinity, "Body's angular velocity is invalid.");
		assert(this.t === this.t && Math.abs(this.t) !== Infinity, "Body's torque is invalid.");
		v_assert_sane(this.rot, "Body's rotation vector is invalid.");
		assert(this.v_limit === this.v_limit, "Body's velocity limit is invalid.");
		assert(this.w_limit === this.w_limit, "Body's angular velocity limit is invalid.");
	};
} else {
	Body.prototype.sanityCheck = function(){};
}
Body.prototype.getPos = function() { return this.p; };
Body.prototype.getVel = function() { return new Vect(this.vx, this.vy); };
Body.prototype.getAngVel = function() { return this.w; };
Body.prototype.getPosition = Body.prototype.getPos;
Body.prototype.getVelocity = Body.prototype.getVel;
Body.prototype.getAngularVelocity = Body.prototype.getAngVel;
Body.prototype.getCenterOfGravity = function() {
    return this.p;
};
Body.prototype.isSleeping = function()
{
	return this.nodeRoot !== null;
};
Body.prototype.isStatic = function()
{
	return this.nodeIdleTime === Infinity;
};
Body.prototype.isRogue = function()
{
	return this.space === null;
};
Body.prototype.setMass = function(mass)
{
	assert(mass > 0, "Mass must be positive and non-zero.");
	this.activate();
	this.m = mass;
	this.m_inv = 1/mass;
};
Body.prototype.setMoment = function(moment)
{
	assert(moment > 0, "Moment of Inertia must be positive and non-zero.");
	this.activate();
	this.i = moment;
	this.i_inv = 1/moment;
};
Body.prototype.addShape = function(shape)
{
	this.shapeList.push(shape);
};
Body.prototype.removeShape = function(shape)
{
	deleteObjFromList(this.shapeList, shape);
};
var filterConstraints = function(node, body, filter)
{
	if(node === filter){
		return node.next(body);
	} else if(node.a === body){
		node.next_a = filterConstraints(node.next_a, body, filter);
	} else {
		node.next_b = filterConstraints(node.next_b, body, filter);
	}
	return node;
};
Body.prototype.removeConstraint = function(constraint)
{
	this.constraintList = filterConstraints(this.constraintList, this, constraint);
};
Body.prototype.setPos = function(pos)
{
	this.activate();
	this.sanityCheck();
	if (pos === vzero) {
		pos = cp.v(0,0);
	}
	this.p = pos;
};
Body.prototype.setVel = function(velocity)
{
	this.activate();
	this.vx = velocity.x;
	this.vy = velocity.y;
};
Body.prototype.setAngVel = function(w)
{
	this.activate();
	this.w = w;
};
Body.prototype.setAngleInternal = function(angle)
{
	assert(!isNaN(angle), "Internal Error: Attempting to set body's angle to NaN");
	this.a = angle;//fmod(a, (cpFloat)M_PI*2.0f);
	this.rot.x = Math.cos(angle);
	this.rot.y = Math.sin(angle);
};
Body.prototype.setAngle = function(angle)
{
	this.activate();
	this.sanityCheck();
	this.setAngleInternal(angle);
};
Body.prototype.velocity_func = function(gravity, damping, dt)
{
	var vx = this.vx * damping + (gravity.x + this.f.x * this.m_inv) * dt;
	var vy = this.vy * damping + (gravity.y + this.f.y * this.m_inv) * dt;
	var v_limit = this.v_limit;
	var lensq = vx * vx + vy * vy;
	var scale = (lensq > v_limit*v_limit) ? v_limit / Math.sqrt(lensq) : 1;
	this.vx = vx * scale;
	this.vy = vy * scale;
	var w_limit = this.w_limit;
	this.w = clamp(this.w*damping + this.t*this.i_inv*dt, -w_limit, w_limit);
	this.sanityCheck();
};
Body.prototype.position_func = function(dt)
{
	this.p.x += (this.vx + this.v_biasx) * dt;
	this.p.y += (this.vy + this.v_biasy) * dt;
	this.setAngleInternal(this.a + (this.w + this.w_bias)*dt);
	this.v_biasx = this.v_biasy = 0;
	this.w_bias = 0;
	this.sanityCheck();
};
Body.prototype.resetForces = function()
{
	this.activate();
	this.f = new Vect(0,0);
	this.t = 0;
};
Body.prototype.applyForce = function(force, r)
{
	this.activate();
	this.f = vadd(this.f, force);
	this.t += vcross(r, force);
};
Body.prototype.applyImpulse = function(j, r)
{
	this.activate();
	apply_impulse(this, j.x, j.y, r);
};
Body.prototype.getVelAtPoint = function(r)
{
	return vadd(new Vect(this.vx, this.vy), vmult(vperp(r), this.w));
};
Body.prototype.getVelAtWorldPoint = function(point)
{
	return this.getVelAtPoint(vsub(point, this.p));
};
Body.prototype.getVelAtLocalPoint = function(point)
{
	return this.getVelAtPoint(vrotate(point, this.rot));
};
Body.prototype.eachShape = function(func)
{
	for(var i = 0, len = this.shapeList.length; i < len; i++) {
		func(this.shapeList[i]);
	}
};
Body.prototype.eachConstraint = function(func)
{
	var constraint = this.constraintList;
	while(constraint) {
		var next = constraint.next(this);
		func(constraint);
		constraint = next;
	}
};
Body.prototype.eachArbiter = function(func)
{
	var arb = this.arbiterList;
	while(arb){
		var next = arb.next(this);
		arb.swappedColl = (this === arb.body_b);
		func(arb);
		arb = next;
	}
};
Body.prototype.local2World = function(v)
{
	return vadd(this.p, vrotate(v, this.rot));
};
Body.prototype.world2Local = function(v)
{
	return vunrotate(vsub(v, this.p), this.rot);
};
Body.prototype.localToWorld = Body.prototype.local2World;
Body.prototype.worldToLocal = Body.prototype.world2Local;
Body.prototype.kineticEnergy = function()
{
	var vsq = this.vx*this.vx + this.vy*this.vy;
	var wsq = this.w * this.w;
	return (vsq ? vsq*this.m : 0) + (wsq ? wsq*this.i : 0);
};
var SpatialIndex = cp.SpatialIndex = function(staticIndex)
{
	this.staticIndex = staticIndex;
	if(staticIndex){
		if(staticIndex.dynamicIndex){
			throw new Error("This static index is already associated with a dynamic index.");
		}
		staticIndex.dynamicIndex = this;
	}
};
SpatialIndex.prototype.collideStatic = function(staticIndex, func)
{
	if(staticIndex.count > 0){
		var query = staticIndex.query;
		this.each(function(obj) {
			query(obj, new BB(obj.bb_l, obj.bb_b, obj.bb_r, obj.bb_t), func);
		});
	}
};
var BBTree = cp.BBTree = function(staticIndex)
{
	SpatialIndex.call(this, staticIndex);
	this.velocityFunc = null;
	this.leaves = {};
	this.count = 0;
	this.root = null;
	this.pooledNodes = null;
	this.pooledPairs = null;
	this.stamp = 0;
};
BBTree.prototype = Object.create(SpatialIndex.prototype);
var numNodes = 0;
var Node = function(tree, a, b)
{
	this.obj = null;
	this.bb_l = min(a.bb_l, b.bb_l);
	this.bb_b = min(a.bb_b, b.bb_b);
	this.bb_r = max(a.bb_r, b.bb_r);
	this.bb_t = max(a.bb_t, b.bb_t);
	this.parent = null;
	this.setA(a);
	this.setB(b);
};
BBTree.prototype.makeNode = function(a, b)
{
	var node = this.pooledNodes;
	if(node){
		this.pooledNodes = node.parent;
		node.constructor(this, a, b);
		return node;
	} else {
		numNodes++;
		return new Node(this, a, b);
	}
};
var numLeaves = 0;
var Leaf = function(tree, obj)
{
	this.obj = obj;
	tree.getBB(obj, this);
	this.parent = null;
	this.stamp = 1;
	this.pairs = null;
	numLeaves++;
};
BBTree.prototype.getBB = function(obj, dest)
{
	var velocityFunc = this.velocityFunc;
	if(velocityFunc){
		var coef = 0.1;
		var x = (obj.bb_r - obj.bb_l)*coef;
		var y = (obj.bb_t - obj.bb_b)*coef;
		var v = vmult(velocityFunc(obj), 0.1);
		dest.bb_l = obj.bb_l + min(-x, v.x);
		dest.bb_b = obj.bb_b + min(-y, v.y);
		dest.bb_r = obj.bb_r + max( x, v.x);
		dest.bb_t = obj.bb_t + max( y, v.y);
	} else {
		dest.bb_l = obj.bb_l;
		dest.bb_b = obj.bb_b;
		dest.bb_r = obj.bb_r;
		dest.bb_t = obj.bb_t;
	}
};
BBTree.prototype.getStamp = function()
{
	var dynamic = this.dynamicIndex;
	return (dynamic && dynamic.stamp ? dynamic.stamp : this.stamp);
};
BBTree.prototype.incrementStamp = function()
{
	if(this.dynamicIndex && this.dynamicIndex.stamp){
		this.dynamicIndex.stamp++;
	} else {
		this.stamp++;
	}
}
var numPairs = 0;
var Pair = function(leafA, nextA, leafB, nextB)
{
	this.prevA = null;
	this.leafA = leafA;
	this.nextA = nextA;
	this.prevB = null;
	this.leafB = leafB;
	this.nextB = nextB;
};
BBTree.prototype.makePair = function(leafA, nextA, leafB, nextB)
{
	var pair = this.pooledPairs;
	if (pair)
	{
		this.pooledPairs = pair.prevA;
		pair.prevA = null;
		pair.leafA = leafA;
		pair.nextA = nextA;
		pair.prevB = null;
		pair.leafB = leafB;
		pair.nextB = nextB;
		return pair;
	} else {
		numPairs++;
		return new Pair(leafA, nextA, leafB, nextB);
	}
};
Pair.prototype.recycle = function(tree)
{
	this.prevA = tree.pooledPairs;
	tree.pooledPairs = this;
};
var unlinkThread = function(prev, leaf, next)
{
	if(next){
		if(next.leafA === leaf) next.prevA = prev; else next.prevB = prev;
	}
	if(prev){
		if(prev.leafA === leaf) prev.nextA = next; else prev.nextB = next;
	} else {
		leaf.pairs = next;
	}
};
Leaf.prototype.clearPairs = function(tree)
{
	var pair = this.pairs,
		next;
	this.pairs = null;
	while(pair){
		if(pair.leafA === this){
			next = pair.nextA;
			unlinkThread(pair.prevB, pair.leafB, pair.nextB);
		} else {
			next = pair.nextB;
			unlinkThread(pair.prevA, pair.leafA, pair.nextA);
		}
		pair.recycle(tree);
		pair = next;
	}
};
var pairInsert = function(a, b, tree)
{
	var nextA = a.pairs, nextB = b.pairs;
	var pair = tree.makePair(a, nextA, b, nextB);
	a.pairs = b.pairs = pair;
	if(nextA){
		if(nextA.leafA === a) nextA.prevA = pair; else nextA.prevB = pair;
	}
	if(nextB){
		if(nextB.leafA === b) nextB.prevA = pair; else nextB.prevB = pair;
	}
};
Node.prototype.recycle = function(tree)
{
	this.parent = tree.pooledNodes;
	tree.pooledNodes = this;
};
Leaf.prototype.recycle = function(tree)
{
};
Node.prototype.setA = function(value)
{
	this.A = value;
	value.parent = this;
};
Node.prototype.setB = function(value)
{
	this.B = value;
	value.parent = this;
};
Leaf.prototype.isLeaf = true;
Node.prototype.isLeaf = false;
Node.prototype.otherChild = function(child)
{
	return (this.A == child ? this.B : this.A);
};
Node.prototype.replaceChild = function(child, value, tree)
{
	assertSoft(child == this.A || child == this.B, "Node is not a child of parent.");
	if(this.A == child){
		this.A.recycle(tree);
		this.setA(value);
	} else {
		this.B.recycle(tree);
		this.setB(value);
	}
	for(var node=this; node; node = node.parent){
		var a = node.A;
		var b = node.B;
		node.bb_l = min(a.bb_l, b.bb_l);
		node.bb_b = min(a.bb_b, b.bb_b);
		node.bb_r = max(a.bb_r, b.bb_r);
		node.bb_t = max(a.bb_t, b.bb_t);
	}
};
Node.prototype.bbArea = Leaf.prototype.bbArea = function()
{
	return (this.bb_r - this.bb_l)*(this.bb_t - this.bb_b);
};
var bbTreeMergedArea = function(a, b)
{
	return (max(a.bb_r, b.bb_r) - min(a.bb_l, b.bb_l))*(max(a.bb_t, b.bb_t) - min(a.bb_b, b.bb_b));
};
var bbProximity = function(a, b)
{
	return Math.abs(a.bb_l + a.bb_r - b.bb_l - b.bb_r) + Math.abs(a.bb_b + a.bb_t - b.bb_b - b.bb_t);
};
var subtreeInsert = function(subtree, leaf, tree)
{
	if(subtree == null){
		return leaf;
	} else if(subtree.isLeaf){
		return tree.makeNode(leaf, subtree);
	} else {
		var cost_a = subtree.B.bbArea() + bbTreeMergedArea(subtree.A, leaf);
		var cost_b = subtree.A.bbArea() + bbTreeMergedArea(subtree.B, leaf);
		if(cost_a === cost_b){
			cost_a = bbProximity(subtree.A, leaf);
			cost_b = bbProximity(subtree.B, leaf);
		}
		if(cost_b < cost_a){
			subtree.setB(subtreeInsert(subtree.B, leaf, tree));
		} else {
			subtree.setA(subtreeInsert(subtree.A, leaf, tree));
		}
		subtree.bb_l = min(subtree.bb_l, leaf.bb_l);
		subtree.bb_b = min(subtree.bb_b, leaf.bb_b);
		subtree.bb_r = max(subtree.bb_r, leaf.bb_r);
		subtree.bb_t = max(subtree.bb_t, leaf.bb_t);
		return subtree;
	}
};
Node.prototype.intersectsBB = Leaf.prototype.intersectsBB = function(bb)
{
	return (this.bb_l <= bb.r && bb.l <= this.bb_r && this.bb_b <= bb.t && bb.b <= this.bb_t);
};
var subtreeQuery = function(subtree, bb, func)
{
	if(subtree.intersectsBB(bb)){
		if(subtree.isLeaf){
			func(subtree.obj);
		} else {
			subtreeQuery(subtree.A, bb, func);
			subtreeQuery(subtree.B, bb, func);
		}
	}
};
var nodeSegmentQuery = function(node, a, b)
{
	var idx = 1/(b.x - a.x);
	var tx1 = (node.bb_l == a.x ? -Infinity : (node.bb_l - a.x)*idx);
	var tx2 = (node.bb_r == a.x ?  Infinity : (node.bb_r - a.x)*idx);
	var txmin = min(tx1, tx2);
	var txmax = max(tx1, tx2);
	var idy = 1/(b.y - a.y);
	var ty1 = (node.bb_b == a.y ? -Infinity : (node.bb_b - a.y)*idy);
	var ty2 = (node.bb_t == a.y ?  Infinity : (node.bb_t - a.y)*idy);
	var tymin = min(ty1, ty2);
	var tymax = max(ty1, ty2);
	if(tymin <= txmax && txmin <= tymax){
		var min_ = max(txmin, tymin);
		var max_ = min(txmax, tymax);
		if(0.0 <= max_ && min_ <= 1.0) return max(min_, 0.0);
	}
	return Infinity;
};
var subtreeSegmentQuery = function(subtree, a, b, t_exit, func)
{
	if(subtree.isLeaf){
		return func(subtree.obj);
	} else {
		var t_a = nodeSegmentQuery(subtree.A, a, b);
		var t_b = nodeSegmentQuery(subtree.B, a, b);
		if(t_a < t_b){
			if(t_a < t_exit) t_exit = min(t_exit, subtreeSegmentQuery(subtree.A, a, b, t_exit, func));
			if(t_b < t_exit) t_exit = min(t_exit, subtreeSegmentQuery(subtree.B, a, b, t_exit, func));
		} else {
			if(t_b < t_exit) t_exit = min(t_exit, subtreeSegmentQuery(subtree.B, a, b, t_exit, func));
			if(t_a < t_exit) t_exit = min(t_exit, subtreeSegmentQuery(subtree.A, a, b, t_exit, func));
		}
		return t_exit;
	}
};
BBTree.prototype.subtreeRecycle = function(node)
{
	if(node.isLeaf){
		this.subtreeRecycle(node.A);
		this.subtreeRecycle(node.B);
		node.recycle(this);
	}
};
var subtreeRemove = function(subtree, leaf, tree)
{
	if(leaf == subtree){
		return null;
	} else {
		var parent = leaf.parent;
		if(parent == subtree){
			var other = subtree.otherChild(leaf);
			other.parent = subtree.parent;
			subtree.recycle(tree);
			return other;
		} else {
			parent.parent.replaceChild(parent, parent.otherChild(leaf), tree);
			return subtree;
		}
	}
};
var bbTreeIntersectsNode = function(a, b)
{
	return (a.bb_l <= b.bb_r && b.bb_l <= a.bb_r && a.bb_b <= b.bb_t && b.bb_b <= a.bb_t);
};
Leaf.prototype.markLeafQuery = function(leaf, left, tree, func)
{
	if(bbTreeIntersectsNode(leaf, this)){
    if(left){
      pairInsert(leaf, this, tree);
    } else {
      if(this.stamp < leaf.stamp) pairInsert(this, leaf, tree);
      if(func) func(leaf.obj, this.obj);
    }
  }
};
Node.prototype.markLeafQuery = function(leaf, left, tree, func)
{
	if(bbTreeIntersectsNode(leaf, this)){
    this.A.markLeafQuery(leaf, left, tree, func);
    this.B.markLeafQuery(leaf, left, tree, func);
	}
};
Leaf.prototype.markSubtree = function(tree, staticRoot, func)
{
	if(this.stamp == tree.getStamp()){
		if(staticRoot) staticRoot.markLeafQuery(this, false, tree, func);
		for(var node = this; node.parent; node = node.parent){
			if(node == node.parent.A){
				node.parent.B.markLeafQuery(this, true, tree, func);
			} else {
				node.parent.A.markLeafQuery(this, false, tree, func);
			}
		}
	} else {
		var pair = this.pairs;
		while(pair){
			if(this === pair.leafB){
				if(func) func(pair.leafA.obj, this.obj);
				pair = pair.nextB;
			} else {
				pair = pair.nextA;
			}
		}
	}
};
Node.prototype.markSubtree = function(tree, staticRoot, func)
{
  this.A.markSubtree(tree, staticRoot, func);
  this.B.markSubtree(tree, staticRoot, func);
};
Leaf.prototype.containsObj = function(obj)
{
	return (this.bb_l <= obj.bb_l && this.bb_r >= obj.bb_r && this.bb_b <= obj.bb_b && this.bb_t >= obj.bb_t);
};
Leaf.prototype.update = function(tree)
{
	var root = tree.root;
	var obj = this.obj;
	if(!this.containsObj(obj)){
		tree.getBB(this.obj, this);
		root = subtreeRemove(root, this, tree);
		tree.root = subtreeInsert(root, this, tree);
		this.clearPairs(tree);
		this.stamp = tree.getStamp();
		return true;
	}
	return false;
};
Leaf.prototype.addPairs = function(tree)
{
	var dynamicIndex = tree.dynamicIndex;
	if(dynamicIndex){
		var dynamicRoot = dynamicIndex.root;
		if(dynamicRoot){
			dynamicRoot.markLeafQuery(this, true, dynamicIndex, null);
		}
	} else {
		var staticRoot = tree.staticIndex.root;
		this.markSubtree(tree, staticRoot, null);
	}
};
BBTree.prototype.insert = function(obj, hashid)
{
	var leaf = new Leaf(this, obj);
	this.leaves[hashid] = leaf;
	this.root = subtreeInsert(this.root, leaf, this);
	this.count++;
	leaf.stamp = this.getStamp();
	leaf.addPairs(this);
	this.incrementStamp();
};
BBTree.prototype.remove = function(obj, hashid)
{
	var leaf = this.leaves[hashid];
	delete this.leaves[hashid];
	this.root = subtreeRemove(this.root, leaf, this);
	this.count--;
	leaf.clearPairs(this);
	leaf.recycle(this);
};
BBTree.prototype.contains = function(obj, hashid)
{
	return this.leaves[hashid] != null;
};
var voidQueryFunc = function(obj1, obj2){};
BBTree.prototype.reindexQuery = function(func)
{
	if(!this.root) return;
	var hashid,
		leaves = this.leaves;
	for (hashid in leaves)
	{
		leaves[hashid].update(this);
	}
	var staticIndex = this.staticIndex;
	var staticRoot = staticIndex && staticIndex.root;
	this.root.markSubtree(this, staticRoot, func);
	if(staticIndex && !staticRoot) this.collideStatic(this, staticIndex, func);
	this.incrementStamp();
};
BBTree.prototype.reindex = function()
{
	this.reindexQuery(voidQueryFunc);
};
BBTree.prototype.reindexObject = function(obj, hashid)
{
	var leaf = this.leaves[hashid];
	if(leaf){
		if(leaf.update(this)) leaf.addPairs(this);
		this.incrementStamp();
	}
};
BBTree.prototype.pointQuery = function(point, func)
{
	this.query(new BB(point.x, point.y, point.x, point.y), func);
};
BBTree.prototype.segmentQuery = function(a, b, t_exit, func)
{
	if(this.root) subtreeSegmentQuery(this.root, a, b, t_exit, func);
};
BBTree.prototype.query = function(bb, func)
{
	if(this.root) subtreeQuery(this.root, bb, func);
};
BBTree.prototype.count = function()
{
	return this.count;
};
BBTree.prototype.each = function(func)
{
	var hashid;
	for(hashid in this.leaves)
	{
		func(this.leaves[hashid].obj);
	}
};
var bbTreeMergedArea2 = function(node, l, b, r, t)
{
	return (max(node.bb_r, r) - min(node.bb_l, l))*(max(node.bb_t, t) - min(node.bb_b, b));
};
var partitionNodes = function(tree, nodes, offset, count)
{
	if(count == 1){
		return nodes[offset];
	} else if(count == 2) {
		return tree.makeNode(nodes[offset], nodes[offset + 1]);
	}
	var node = nodes[offset];
	var bb_l = node.bb_l,
		bb_b = node.bb_b,
		bb_r = node.bb_r,
		bb_t = node.bb_t;
	var end = offset + count;
	for(var i=offset + 1; i<end; i++){
		node = nodes[i];
		bb_l = min(bb_l, node.bb_l);
		bb_b = min(bb_b, node.bb_b);
		bb_r = max(bb_r, node.bb_r);
		bb_t = max(bb_t, node.bb_t);
	}
	var splitWidth = (bb_r - bb_l > bb_t - bb_b);
	var bounds = new Array(count*2);
	if(splitWidth){
		for(var i=offset; i<end; i++){
			bounds[2*i + 0] = nodes[i].bb_l;
			bounds[2*i + 1] = nodes[i].bb_r;
		}
	} else {
		for(var i=offset; i<end; i++){
			bounds[2*i + 0] = nodes[i].bb_b;
			bounds[2*i + 1] = nodes[i].bb_t;
		}
	}
	bounds.sort(function(a, b) {
		return a - b;
	});
	var split = (bounds[count - 1] + bounds[count])*0.5;
	var a_l = bb_l, a_b = bb_b, a_r = bb_r, a_t = bb_t;
	var b_l = bb_l, b_b = bb_b, b_r = bb_r, b_t = bb_t;
	if(splitWidth) a_r = b_l = split; else a_t = b_b = split;
	var right = end;
	for(var left=offset; left < right;){
		var node = nodes[left];
		if(bbTreeMergedArea2(node, b_l, b_b, b_r, b_t) < bbTreeMergedArea2(node, a_l, a_b, a_r, a_t)){
			right--;
			nodes[left] = nodes[right];
			nodes[right] = node;
		} else {
			left++;
		}
	}
	if(right == count){
		var node = null;
		for(var i=offset; i<end; i++) node = subtreeInsert(node, nodes[i], tree);
		return node;
	}
	return NodeNew(tree,
		partitionNodes(tree, nodes, offset, right - offset),
		partitionNodes(tree, nodes, right, end - right)
	);
};
BBTree.prototype.optimize = function()
{
	var nodes = new Array(this.count);
	var i = 0;
	for (var hashid in this.leaves)
	{
		nodes[i++] = this.nodes[hashid];
	}
	tree.subtreeRecycle(root);
	this.root = partitionNodes(tree, nodes, nodes.length);
};
var nodeRender = function(node, depth)
{
	if(!node.isLeaf && depth <= 10){
		nodeRender(node.A, depth + 1);
		nodeRender(node.B, depth + 1);
	}
	var str = '';
	for(var i = 0; i < depth; i++) {
		str += ' ';
	}
	console.log(str + node.bb_b + ' ' + node.bb_t);
};
BBTree.prototype.log = function(){
	if(this.root) nodeRender(this.root, 0);
};
var CollisionHandler = cp.CollisionHandler = function()
{
	this.a = this.b = 0;
};
CollisionHandler.prototype.begin = function(arb, space){return true;};
CollisionHandler.prototype.preSolve = function(arb, space){return true;};
CollisionHandler.prototype.postSolve = function(arb, space){};
CollisionHandler.prototype.separate = function(arb, space){};
var CP_MAX_CONTACTS_PER_ARBITER = 4;
var Arbiter = function(a, b) {
	this.e = 0;
	this.u = 0;
	this.surface_vr = vzero;
	this.a = a; this.body_a = a.body;
	this.b = b; this.body_b = b.body;
	this.thread_a_next = this.thread_a_prev = null;
	this.thread_b_next = this.thread_b_prev = null;
	this.contacts = null;
	this.stamp = 0;
	this.handler = null;
	this.swappedColl = false;
	this.state = 'first coll';
};
Arbiter.prototype.getShapes = function()
{
	if (this.swappedColl){
		return [this.b, this.a];
	}else{
		return [this.a, this.b];
	}
}
Arbiter.prototype.totalImpulse = function()
{
	var contacts = this.contacts;
	var sum = new Vect(0,0);
	for(var i=0, count=contacts.length; i<count; i++){
		var con = contacts[i];
		sum.add(vmult(con.n, con.jnAcc));
	}
	return this.swappedColl ? sum : sum.neg();
};
Arbiter.prototype.totalImpulseWithFriction = function()
{
	var contacts = this.contacts;
	var sum = new Vect(0,0);
	for(var i=0, count=contacts.length; i<count; i++){
		var con = contacts[i];
		sum.add(new Vect(con.jnAcc, con.jtAcc).rotate(con.n));
	}
	return this.swappedColl ? sum : sum.neg();
};
Arbiter.prototype.totalKE = function()
{
	var eCoef = (1 - this.e)/(1 + this.e);
	var sum = 0;
	var contacts = this.contacts;
	for(var i=0, count=contacts.length; i<count; i++){
		var con = contacts[i];
		var jnAcc = con.jnAcc;
		var jtAcc = con.jtAcc;
		sum += eCoef*jnAcc*jnAcc/con.nMass + jtAcc*jtAcc/con.tMass;
	}
	return sum;
};
Arbiter.prototype.ignore = function()
{
	this.state = 'ignore';
};
Arbiter.prototype.getA = function()
{
	return this.swappedColl ? this.b : this.a;
};
Arbiter.prototype.getB = function()
{
	return this.swappedColl ? this.a : this.b;
};
Arbiter.prototype.isFirstContact = function()
{
	return this.state === 'first coll';
};
var ContactPoint = function(point, normal, dist)
{
	this.point = point;
	this.normal = normal;
	this.dist = dist;
};
Arbiter.prototype.getContactPointSet = function()
{
	var set = new Array(this.contacts.length);
	var i;
	for(i=0; i<set.length; i++){
		set[i] = new ContactPoint(this.contacts[i].p, this.contacts[i].n, this.contacts[i].dist);
	}
	return set;
};
Arbiter.prototype.getNormal = function(i)
{
	var n = this.contacts[i].n;
	return this.swappedColl ? vneg(n) : n;
};
Arbiter.prototype.getPoint = function(i)
{
	return this.contacts[i].p;
};
Arbiter.prototype.getDepth = function(i)
{
	return this.contacts[i].dist;
};
var unthreadHelper = function(arb, body, prev, next)
{
	if(prev){
		if(prev.body_a === body) {
			prev.thread_a_next = next;
		} else {
			prev.thread_b_next = next;
		}
	} else {
		body.arbiterList = next;
	}
	if(next){
		if(next.body_a === body){
			next.thread_a_prev = prev;
		} else {
			next.thread_b_prev = prev;
		}
	}
};
Arbiter.prototype.unthread = function()
{
	unthreadHelper(this, this.body_a, this.thread_a_prev, this.thread_a_next);
	unthreadHelper(this, this.body_b, this.thread_b_prev, this.thread_b_next);
	this.thread_a_prev = this.thread_a_next = null;
	this.thread_b_prev = this.thread_b_next = null;
};
Arbiter.prototype.update = function(contacts, handler, a, b)
{
	if(this.contacts){
		for(var i=0; i<this.contacts.length; i++){
			var old = this.contacts[i];
			for(var j=0; j<contacts.length; j++){
				var new_contact = contacts[j];
				if(new_contact.hash === old.hash){
					new_contact.jnAcc = old.jnAcc;
					new_contact.jtAcc = old.jtAcc;
				}
			}
		}
	}
	this.contacts = contacts;
	this.handler = handler;
	this.swappedColl = (a.collision_type !== handler.a);
	this.e = a.e * b.e;
	this.u = a.u * b.u;
	this.surface_vr = vsub(a.surface_v, b.surface_v);
	this.a = a; this.body_a = a.body;
	this.b = b; this.body_b = b.body;
	if(this.state == 'cached') this.state = 'first coll';
};
Arbiter.prototype.preStep = function(dt, slop, bias)
{
	var a = this.body_a;
	var b = this.body_b;
	for(var i=0; i<this.contacts.length; i++){
		var con = this.contacts[i];
		con.r1 = vsub(con.p, a.p);
		con.r2 = vsub(con.p, b.p);
		con.nMass = 1/k_scalar(a, b, con.r1, con.r2, con.n);
		con.tMass = 1/k_scalar(a, b, con.r1, con.r2, vperp(con.n));
		con.bias = -bias*min(0, con.dist + slop)/dt;
		con.jBias = 0;
		con.bounce = normal_relative_velocity(a, b, con.r1, con.r2, con.n)*this.e;
	}
};
Arbiter.prototype.applyCachedImpulse = function(dt_coef)
{
	if(this.isFirstContact()) return;
	var a = this.body_a;
	var b = this.body_b;
	for(var i=0; i<this.contacts.length; i++){
		var con = this.contacts[i];
		var nx = con.n.x;
		var ny = con.n.y;
		var jx = nx*con.jnAcc - ny*con.jtAcc;
		var jy = nx*con.jtAcc + ny*con.jnAcc;
		apply_impulses(a, b, con.r1, con.r2, jx * dt_coef, jy * dt_coef);
	}
};
var numApplyImpulse = 0;
var numApplyContact = 0;
Arbiter.prototype.applyImpulse = function()
{
	numApplyImpulse++;
	var a = this.body_a;
	var b = this.body_b;
	var surface_vr = this.surface_vr;
	var friction = this.u;
	for(var i=0; i<this.contacts.length; i++){
		numApplyContact++;
		var con = this.contacts[i];
		var nMass = con.nMass;
		var n = con.n;
		var r1 = con.r1;
		var r2 = con.r2;
		var vrx = b.vx - r2.y * b.w - (a.vx - r1.y * a.w);
		var vry = b.vy + r2.x * b.w - (a.vy + r1.x * a.w);
		var vbn = n.x*(b.v_biasx - r2.y * b.w_bias - a.v_biasx + r1.y * a.w_bias) +
				n.y*(r2.x*b.w_bias + b.v_biasy - r1.x * a.w_bias - a.v_biasy);
		var vrn = vdot2(vrx, vry, n.x, n.y);
		var vrt = vdot2(vrx + surface_vr.x, vry + surface_vr.y, -n.y, n.x);
		var jbn = (con.bias - vbn)*nMass;
		var jbnOld = con.jBias;
		con.jBias = max(jbnOld + jbn, 0);
		var jn = -(con.bounce + vrn)*nMass;
		var jnOld = con.jnAcc;
		con.jnAcc = max(jnOld + jn, 0);
		var jtMax = friction*con.jnAcc;
		var jt = -vrt*con.tMass;
		var jtOld = con.jtAcc;
		con.jtAcc = clamp(jtOld + jt, -jtMax, jtMax);
		var bias_x = n.x * (con.jBias - jbnOld);
		var bias_y = n.y * (con.jBias - jbnOld);
		apply_bias_impulse(a, -bias_x, -bias_y, r1);
		apply_bias_impulse(b, bias_x, bias_y, r2);
		var rot_x = con.jnAcc - jnOld;
		var rot_y = con.jtAcc - jtOld;
		apply_impulses(a, b, r1, r2, n.x*rot_x - n.y*rot_y, n.x*rot_y + n.y*rot_x);
	}
};
Arbiter.prototype.callSeparate = function(space)
{
	var handler = space.lookupHandler(this.a.collision_type, this.b.collision_type);
	handler.separate(this, space);
};
Arbiter.prototype.next = function(body)
{
	return (this.body_a == body ? this.thread_a_next : this.thread_b_next);
};
var numContacts = 0;
var Contact = function(p, n, dist, hash)
{
	this.p = p;
	this.n = n;
	this.dist = dist;
	this.r1 = this.r2 = vzero;
	this.nMass = this.tMass = this.bounce = this.bias = 0;
	this.jnAcc = this.jtAcc = this.jBias = 0;
	this.hash = hash;
	numContacts++;
};
var NONE = [];
var circle2circleQuery = function(p1, p2, r1, r2)
{
	var mindist = r1 + r2;
	var delta = vsub(p2, p1);
	var distsq = vlengthsq(delta);
	if(distsq >= mindist*mindist) return;
	var dist = Math.sqrt(distsq);
	return new Contact(
		vadd(p1, vmult(delta, 0.5 + (r1 - 0.5*mindist)/(dist ? dist : Infinity))),
		(dist ? vmult(delta, 1/dist) : new Vect(1, 0)),
		dist - mindist,
		0
	);
};
var circle2circle = function(circ1, circ2)
{
	var contact = circle2circleQuery(circ1.tc, circ2.tc, circ1.r, circ2.r);
	return contact ? [contact] : NONE;
};
var circle2segment = function(circleShape, segmentShape)
{
	var seg_a = segmentShape.ta;
	var seg_b = segmentShape.tb;
	var center = circleShape.tc;
	var seg_delta = vsub(seg_b, seg_a);
	var closest_t = clamp01(vdot(seg_delta, vsub(center, seg_a))/vlengthsq(seg_delta));
	var closest = vadd(seg_a, vmult(seg_delta, closest_t));
	var contact = circle2circleQuery(center, closest, circleShape.r, segmentShape.r);
	if(contact){
		var n = contact.n;
		return (
			(closest_t === 0 && vdot(n, segmentShape.a_tangent) < 0) ||
			(closest_t === 1 && vdot(n, segmentShape.b_tangent) < 0)
		) ? NONE : [contact];
	} else {
		return NONE;
	}
}
var last_MSA_min = 0;
var findMSA = function(poly, planes)
{
	var min_index = 0;
	var min = poly.valueOnAxis(planes[0].n, planes[0].d);
	if(min > 0) return -1;
	for(var i=1; i<planes.length; i++){
		var dist = poly.valueOnAxis(planes[i].n, planes[i].d);
		if(dist > 0) {
			return -1;
		} else if(dist > min){
			min = dist;
			min_index = i;
		}
	}
	last_MSA_min = min;
	return min_index;
};
var findVertsFallback = function(poly1, poly2, n, dist)
{
	var arr = [];
	var verts1 = poly1.tVerts;
	for(var i=0; i<verts1.length; i+=2){
		var vx = verts1[i];
		var vy = verts1[i+1];
		if(poly2.containsVertPartial(vx, vy, vneg(n))){
			arr.push(new Contact(new Vect(vx, vy), n, dist, hashPair(poly1.hashid, i)));
		}
	}
	var verts2 = poly2.tVerts;
	for(var i=0; i<verts2.length; i+=2){
		var vx = verts2[i];
		var vy = verts2[i+1];
		if(poly1.containsVertPartial(vx, vy, n)){
			arr.push(new Contact(new Vect(vx, vy), n, dist, hashPair(poly2.hashid, i)));
		}
	}
	return arr;
};
var findVerts = function(poly1, poly2, n, dist)
{
	var arr = [];
	var verts1 = poly1.tVerts;
	for(var i=0; i<verts1.length; i+=2){
		var vx = verts1[i];
		var vy = verts1[i+1];
		if(poly2.containsVert(vx, vy)){
			arr.push(new Contact(new Vect(vx, vy), n, dist, hashPair(poly1.hashid, i>>1)));
		}
	}
	var verts2 = poly2.tVerts;
	for(var i=0; i<verts2.length; i+=2){
		var vx = verts2[i];
		var vy = verts2[i+1];
		if(poly1.containsVert(vx, vy)){
			arr.push(new Contact(new Vect(vx, vy), n, dist, hashPair(poly2.hashid, i>>1)));
		}
	}
	return (arr.length ? arr : findVertsFallback(poly1, poly2, n, dist));
};
var poly2poly = function(poly1, poly2)
{
	var mini1 = findMSA(poly2, poly1.tPlanes);
	if(mini1 == -1) return NONE;
	var min1 = last_MSA_min;
	var mini2 = findMSA(poly1, poly2.tPlanes);
	if(mini2 == -1) return NONE;
	var min2 = last_MSA_min;
	if(min1 > min2)
		return findVerts(poly1, poly2, poly1.tPlanes[mini1].n, min1);
	else
		return findVerts(poly1, poly2, vneg(poly2.tPlanes[mini2].n), min2);
};
var segValueOnAxis = function(seg, n, d)
{
	var a = vdot(n, seg.ta) - seg.r;
	var b = vdot(n, seg.tb) - seg.r;
	return min(a, b) - d;
};
var findPointsBehindSeg = function(arr, seg, poly, pDist, coef)
{
	var dta = vcross(seg.tn, seg.ta);
	var dtb = vcross(seg.tn, seg.tb);
	var n = vmult(seg.tn, coef);
	var verts = poly.tVerts;
	for(var i=0; i<verts.length; i+=2){
		var vx = verts[i];
		var vy = verts[i+1];
		if(vdot2(vx, vy, n.x, n.y) < vdot(seg.tn, seg.ta)*coef + seg.r){
			var dt = vcross2(seg.tn.x, seg.tn.y, vx, vy);
			if(dta >= dt && dt >= dtb){
				arr.push(new Contact(new Vect(vx, vy), n, pDist, hashPair(poly.hashid, i)));
			}
		}
	}
};
var seg2poly = function(seg, poly)
{
	var arr = [];
	var planes = poly.tPlanes;
	var numVerts = planes.length;
	var segD = vdot(seg.tn, seg.ta);
	var minNorm = poly.valueOnAxis(seg.tn, segD) - seg.r;
	var minNeg = poly.valueOnAxis(vneg(seg.tn), -segD) - seg.r;
	if(minNeg > 0 || minNorm > 0) return NONE;
	var mini = 0;
	var poly_min = segValueOnAxis(seg, planes[0].n, planes[0].d);
	if(poly_min > 0) return NONE;
	for(var i=0; i<numVerts; i++){
		var dist = segValueOnAxis(seg, planes[i].n, planes[i].d);
		if(dist > 0){
			return NONE;
		} else if(dist > poly_min){
			poly_min = dist;
			mini = i;
		}
	}
	var poly_n = vneg(planes[mini].n);
	var va = vadd(seg.ta, vmult(poly_n, seg.r));
	var vb = vadd(seg.tb, vmult(poly_n, seg.r));
	if(poly.containsVert(va.x, va.y))
		arr.push(new Contact(va, poly_n, poly_min, hashPair(seg.hashid, 0)));
	if(poly.containsVert(vb.x, vb.y))
		arr.push(new Contact(vb, poly_n, poly_min, hashPair(seg.hashid, 1)));
	if(minNorm >= poly_min || minNeg >= poly_min) {
		if(minNorm > minNeg)
			findPointsBehindSeg(arr, seg, poly, minNorm, 1);
		else
			findPointsBehindSeg(arr, seg, poly, minNeg, -1);
	}
	if(arr.length === 0){
		var mini2 = mini * 2;
		var verts = poly.tVerts;
		var poly_a = new Vect(verts[mini2], verts[mini2+1]);
		var con;
		if((con = circle2circleQuery(seg.ta, poly_a, seg.r, 0, arr))) return [con];
		if((con = circle2circleQuery(seg.tb, poly_a, seg.r, 0, arr))) return [con];
		var len = numVerts * 2;
		var poly_b = new Vect(verts[(mini2+2)%len], verts[(mini2+3)%len]);
		if((con = circle2circleQuery(seg.ta, poly_b, seg.r, 0, arr))) return [con];
		if((con = circle2circleQuery(seg.tb, poly_b, seg.r, 0, arr))) return [con];
	}
	return arr;
};
var circle2poly = function(circ, poly)
{
	var planes = poly.tPlanes;
	var mini = 0;
	var min = vdot(planes[0].n, circ.tc) - planes[0].d - circ.r;
	for(var i=0; i<planes.length; i++){
		var dist = vdot(planes[i].n, circ.tc) - planes[i].d - circ.r;
		if(dist > 0){
			return NONE;
		} else if(dist > min) {
			min = dist;
			mini = i;
		}
	}
	var n = planes[mini].n;
	var verts = poly.tVerts;
	var len = verts.length;
	var mini2 = mini<<1;
	var ax = verts[mini2];
	var ay = verts[mini2+1];
	var bx = verts[(mini2+2)%len];
	var by = verts[(mini2+3)%len];
	var dta = vcross2(n.x, n.y, ax, ay);
	var dtb = vcross2(n.x, n.y, bx, by);
	var dt = vcross(n, circ.tc);
	if(dt < dtb){
		var con = circle2circleQuery(circ.tc, new Vect(bx, by), circ.r, 0, con);
		return con ? [con] : NONE;
	} else if(dt < dta) {
		return [new Contact(
			vsub(circ.tc, vmult(n, circ.r + min/2)),
			vneg(n),
			min,
			0
		)];
	} else {
		var con = circle2circleQuery(circ.tc, new Vect(ax, ay), circ.r, 0, con);
		return con ? [con] : NONE;
	}
};
CircleShape.prototype.collisionCode = 0;
SegmentShape.prototype.collisionCode = 1;
PolyShape.prototype.collisionCode = 2;
CircleShape.prototype.collisionTable = [
	circle2circle,
	circle2segment,
	circle2poly
];
SegmentShape.prototype.collisionTable = [
	null,
	function(segA, segB) { return NONE; },
	seg2poly
];
PolyShape.prototype.collisionTable = [
	null,
	null,
	poly2poly
];
var collideShapes = cp.collideShapes = function(a, b)
{
	assert(a.collisionCode <= b.collisionCode, 'Collided shapes must be sorted by type');
	return a.collisionTable[b.collisionCode](a, b);
};
var defaultCollisionHandler = new CollisionHandler();
var Space = cp.Space = function() {
	this.stamp = 0;
	this.curr_dt = 0;
	this.bodies = [];
	this.rousedBodies = [];
	this.sleepingComponents = [];
	this.staticShapes = new BBTree(null);
	this.activeShapes = new BBTree(this.staticShapes);
	this.arbiters = [];
	this.contactBuffersHead = null;
	this.cachedArbiters = {};
	this.constraints = [];
	this.locked = 0;
	this.collisionHandlers = {};
	this.defaultHandler = defaultCollisionHandler;
	this.postStepCallbacks = [];
	this.iterations = 10;
	this.gravity = vzero;
	this.damping = 1;
	this.idleSpeedThreshold = 0;
	this.sleepTimeThreshold = Infinity;
	this.collisionSlop = 0.1;
	this.collisionBias = Math.pow(1 - 0.1, 60);
	this.collisionPersistence = 3;
	this.enableContactGraph = false;
	this.staticBody = new Body(Infinity, Infinity);
	this.staticBody.nodeIdleTime = Infinity;
	this.collideShapes = this.makeCollideShapes();
};
Space.prototype.getCurrentTimeStep = function() { return this.curr_dt; };
Space.prototype.setIterations = function(iter) { this.iterations = iter; };
Space.prototype.isLocked = function()
{
	return this.locked;
};
var assertSpaceUnlocked = function(space)
{
	assert(!space.locked, "This addition/removal cannot be done safely during a call to cpSpaceStep() \
 or during a query. Put these calls into a post-step callback.");
};
Space.prototype.addCollisionHandler = function(a, b, begin, preSolve, postSolve, separate)
{
	assertSpaceUnlocked(this);
	this.removeCollisionHandler(a, b);
	var handler = new CollisionHandler();
	handler.a = a;
	handler.b = b;
	if(begin) handler.begin = begin;
	if(preSolve) handler.preSolve = preSolve;
	if(postSolve) handler.postSolve = postSolve;
	if(separate) handler.separate = separate;
	this.collisionHandlers[hashPair(a, b)] = handler;
};
Space.prototype.removeCollisionHandler = function(a, b)
{
	assertSpaceUnlocked(this);
	delete this.collisionHandlers[hashPair(a, b)];
};
Space.prototype.setDefaultCollisionHandler = function(begin, preSolve, postSolve, separate)
{
	assertSpaceUnlocked(this);
	var handler = new CollisionHandler();
	if(begin) handler.begin = begin;
	if(preSolve) handler.preSolve = preSolve;
	if(postSolve) handler.postSolve = postSolve;
	if(separate) handler.separate = separate;
	this.defaultHandler = handler;
};
Space.prototype.lookupHandler = function(a, b)
{
	return this.collisionHandlers[hashPair(a, b)] || this.defaultHandler;
};
Space.prototype.addShape = function(shape)
{
	var body = shape.body;
	if(body.isStatic()) return this.addStaticShape(shape);
	assert(!shape.space, "This shape is already added to a space and cannot be added to another.");
	assertSpaceUnlocked(this);
	body.activate();
	body.addShape(shape);
	shape.update(body.p, body.rot);
	this.activeShapes.insert(shape, shape.hashid);
	shape.space = this;
	return shape;
};
Space.prototype.addStaticShape = function(shape)
{
	assert(!shape.space, "This shape is already added to a space and cannot be added to another.");
	assertSpaceUnlocked(this);
	var body = shape.body;
	body.addShape(shape);
	shape.update(body.p, body.rot);
	this.staticShapes.insert(shape, shape.hashid);
	shape.space = this;
	return shape;
};
Space.prototype.addBody = function(body)
{
	assert(!body.isStatic(), "Static bodies cannot be added to a space as they are not meant to be simulated.");
	assert(!body.space, "This body is already added to a space and cannot be added to another.");
	assertSpaceUnlocked(this);
	this.bodies.push(body);
	body.space = this;
	return body;
};
Space.prototype.addConstraint = function(constraint)
{
	assert(!constraint.space, "This shape is already added to a space and cannot be added to another.");
	assertSpaceUnlocked(this);
	var a = constraint.a, b = constraint.b;
	a.activate();
	b.activate();
	this.constraints.push(constraint);
	constraint.next_a = a.constraintList; a.constraintList = constraint;
	constraint.next_b = b.constraintList; b.constraintList = constraint;
	constraint.space = this;
	return constraint;
};
Space.prototype.filterArbiters = function(body, filter)
{
	for (var hash in this.cachedArbiters)
	{
		var arb = this.cachedArbiters[hash];
		if(
			(body === arb.body_a && (filter === arb.a || filter === null)) ||
			(body === arb.body_b && (filter === arb.b || filter === null))
		){
			if(filter && arb.state !== 'cached') arb.callSeparate(this);
			arb.unthread();
			deleteObjFromList(this.arbiters, arb);
			delete this.cachedArbiters[hash];
		}
	}
};
Space.prototype.removeShape = function(shape)
{
	var body = shape.body;
	if(body.isStatic()){
		this.removeStaticShape(shape);
	} else {
		assert(this.containsShape(shape),
			"Cannot remove a shape that was not added to the space. (Removed twice maybe?)");
		assertSpaceUnlocked(this);
		body.activate();
		body.removeShape(shape);
		this.filterArbiters(body, shape);
		this.activeShapes.remove(shape, shape.hashid);
		shape.space = null;
	}
};
Space.prototype.removeStaticShape = function(shape)
{
	assert(this.containsShape(shape),
		"Cannot remove a static or sleeping shape that was not added to the space. (Removed twice maybe?)");
	assertSpaceUnlocked(this);
	var body = shape.body;
	if(body.isStatic()) body.activateStatic(shape);
	body.removeShape(shape);
	this.filterArbiters(body, shape);
	this.staticShapes.remove(shape, shape.hashid);
	shape.space = null;
};
Space.prototype.removeBody = function(body)
{
	assert(this.containsBody(body),
		"Cannot remove a body that was not added to the space. (Removed twice maybe?)");
	assertSpaceUnlocked(this);
	body.activate();
	deleteObjFromList(this.bodies, body);
	body.space = null;
};
Space.prototype.removeConstraint = function(constraint)
{
	assert(this.containsConstraint(constraint),
		"Cannot remove a constraint that was not added to the space. (Removed twice maybe?)");
	assertSpaceUnlocked(this);
	constraint.a.activate();
	constraint.b.activate();
	deleteObjFromList(this.constraints, constraint);
	constraint.a.removeConstraint(constraint);
	constraint.b.removeConstraint(constraint);
	constraint.space = null;
};
Space.prototype.containsShape = function(shape)
{
	return (shape.space === this);
};
Space.prototype.containsBody = function(body)
{
	return (body.space == this);
};
Space.prototype.containsConstraint = function(constraint)
{
	return (constraint.space == this);
};
Space.prototype.uncacheArbiter = function(arb)
{
	delete this.cachedArbiters[hashPair(arb.a.hashid, arb.b.hashid)];
	deleteObjFromList(this.arbiters, arb);
};
Space.prototype.eachBody = function(func)
{
	this.lock(); {
		var bodies = this.bodies;
		for(var i=0; i<bodies.length; i++){
			func(bodies[i]);
		}
		var components = this.sleepingComponents;
		for(var i=0; i<components.length; i++){
			var root = components[i];
			var body = root;
			while(body){
				var next = body.nodeNext;
				func(body);
				body = next;
			}
		}
	} this.unlock(true);
};
Space.prototype.eachShape = function(func)
{
	this.lock(); {
		this.activeShapes.each(func);
		this.staticShapes.each(func);
	} this.unlock(true);
};
Space.prototype.eachConstraint = function(func)
{
	this.lock(); {
		var constraints = this.constraints;
		for(var i=0; i<constraints.length; i++){
			func(constraints[i]);
		}
	} this.unlock(true);
};
Space.prototype.reindexStatic = function()
{
	assert(!this.locked, "You cannot manually reindex objects while the space is locked. Wait until the current query or step is complete.");
	this.staticShapes.each(function(shape){
		var body = shape.body;
		shape.update(body.p, body.rot);
	});
	this.staticShapes.reindex();
};
Space.prototype.reindexShape = function(shape)
{
	assert(!this.locked, "You cannot manually reindex objects while the space is locked. Wait until the current query or step is complete.");
	var body = shape.body;
	shape.update(body.p, body.rot);
	this.activeShapes.reindexObject(shape, shape.hashid);
	this.staticShapes.reindexObject(shape, shape.hashid);
};
Space.prototype.reindexShapesForBody = function(body)
{
	for(var shape = body.shapeList; shape; shape = shape.next){
		this.reindexShape(shape);
	}
};
Space.prototype.useSpatialHash = function(dim, count)
{
	throw new Error('Spatial Hash not implemented.');
	var staticShapes = new SpaceHash(dim, count, null);
	var activeShapes = new SpaceHash(dim, count, staticShapes);
	this.staticShapes.each(function(shape){
		staticShapes.insert(shape, shape.hashid);
	});
	this.activeShapes.each(function(shape){
		activeShapes.insert(shape, shape.hashid);
	});
	this.staticShapes = staticShapes;
	this.activeShapes = activeShapes;
};
Space.prototype.activateBody = function(body)
{
	assert(!body.isRogue(), "Internal error: Attempting to activate a rogue body.");
	if(this.locked){
		if(this.rousedBodies.indexOf(body) === -1) this.rousedBodies.push(body);
	} else {
		this.bodies.push(body);
		for(var i = 0; i < body.shapeList.length; i++){
			var shape = body.shapeList[i];
			this.staticShapes.remove(shape, shape.hashid);
			this.activeShapes.insert(shape, shape.hashid);
		}
		for(var arb = body.arbiterList; arb; arb = arb.next(body)){
			var bodyA = arb.body_a;
			if(body === bodyA || bodyA.isStatic()){
				var a = arb.a, b = arb.b;
				this.cachedArbiters[hashPair(a.hashid, b.hashid)] = arb;
				arb.stamp = this.stamp;
				arb.handler = this.lookupHandler(a.collision_type, b.collision_type);
				this.arbiters.push(arb);
			}
		}
		for(var constraint = body.constraintList; constraint; constraint = constraint.nodeNext){
			var bodyA = constraint.a;
			if(body === bodyA || bodyA.isStatic()) this.constraints.push(constraint);
		}
	}
};
Space.prototype.deactivateBody = function(body)
{
	assert(!body.isRogue(), "Internal error: Attempting to deactivate a rogue body.");
	deleteObjFromList(this.bodies, body);
	for(var i = 0; i < body.shapeList.length; i++){
		var shape = body.shapeList[i];
		this.activeShapes.remove(shape, shape.hashid);
		this.staticShapes.insert(shape, shape.hashid);
	}
	for(var arb = body.arbiterList; arb; arb = arb.next(body)){
		var bodyA = arb.body_a;
		if(body === bodyA || bodyA.isStatic()){
			this.uncacheArbiter(arb);
		}
	}
	for(var constraint = body.constraintList; constraint; constraint = constraint.nodeNext){
		var bodyA = constraint.a;
		if(body === bodyA || bodyA.isStatic()) deleteObjFromList(this.constraints, constraint);
	}
};
var componentRoot = function(body)
{
	return (body ? body.nodeRoot : null);
};
var componentActivate = function(root)
{
	if(!root || !root.isSleeping(root)) return;
	assert(!root.isRogue(), "Internal Error: componentActivate() called on a rogue body.");
	var space = root.space;
	var body = root;
	while(body){
		var next = body.nodeNext;
		body.nodeIdleTime = 0;
		body.nodeRoot = null;
		body.nodeNext = null;
		space.activateBody(body);
		body = next;
	}
	deleteObjFromList(space.sleepingComponents, root);
};
Body.prototype.activate = function()
{
	if(!this.isRogue()){
		this.nodeIdleTime = 0;
		componentActivate(componentRoot(this));
	}
};
Body.prototype.activateStatic = function(filter)
{
	assert(this.isStatic(), "Body.activateStatic() called on a non-static body.");
	for(var arb = this.arbiterList; arb; arb = arb.next(this)){
		if(!filter || filter == arb.a || filter == arb.b){
			(arb.body_a == this ? arb.body_b : arb.body_a).activate();
		}
	}
};
Body.prototype.pushArbiter = function(arb)
{
	assertSoft((arb.body_a === this ? arb.thread_a_next : arb.thread_b_next) === null,
		"Internal Error: Dangling contact graph pointers detected. (A)");
	assertSoft((arb.body_a === this ? arb.thread_a_prev : arb.thread_b_prev) === null,
		"Internal Error: Dangling contact graph pointers detected. (B)");
	var next = this.arbiterList;
	assertSoft(next === null || (next.body_a === this ? next.thread_a_prev : next.thread_b_prev) === null,
		"Internal Error: Dangling contact graph pointers detected. (C)");
	if(arb.body_a === this){
		arb.thread_a_next = next;
	} else {
		arb.thread_b_next = next;
	}
	if(next){
		if (next.body_a === this){
			next.thread_a_prev = arb;
		} else {
			next.thread_b_prev = arb;
		}
	}
	this.arbiterList = arb;
};
var componentAdd = function(root, body){
	body.nodeRoot = root;
	if(body !== root){
		body.nodeNext = root.nodeNext;
		root.nodeNext = body;
	}
};
var floodFillComponent = function(root, body)
{
	if(!body.isRogue()){
		var other_root = componentRoot(body);
		if(other_root == null){
			componentAdd(root, body);
			for(var arb = body.arbiterList; arb; arb = arb.next(body)){
				floodFillComponent(root, (body == arb.body_a ? arb.body_b : arb.body_a));
			}
			for(var constraint = body.constraintList; constraint; constraint = constraint.next(body)){
				floodFillComponent(root, (body == constraint.a ? constraint.b : constraint.a));
			}
		} else {
			assertSoft(other_root === root, "Internal Error: Inconsistency detected in the contact graph.");
		}
	}
};
var componentActive = function(root, threshold)
{
	for(var body = root; body; body = body.nodeNext){
		if(body.nodeIdleTime < threshold) return true;
	}
	return false;
};
Space.prototype.processComponents = function(dt)
{
	var sleep = (this.sleepTimeThreshold !== Infinity);
	var bodies = this.bodies;
	for(var i=0; i<bodies.length; i++){
		var body = bodies[i];
		assertSoft(body.nodeNext === null, "Internal Error: Dangling next pointer detected in contact graph.");
		assertSoft(body.nodeRoot === null, "Internal Error: Dangling root pointer detected in contact graph.");
	}
	if(sleep){
		var dv = this.idleSpeedThreshold;
		var dvsq = (dv ? dv*dv : vlengthsq(this.gravity)*dt*dt);
		for(var i=0; i<bodies.length; i++){
			var body = bodies[i];
			var keThreshold = (dvsq ? body.m*dvsq : 0);
			body.nodeIdleTime = (body.kineticEnergy() > keThreshold ? 0 : body.nodeIdleTime + dt);
		}
	}
	var arbiters = this.arbiters;
	for(var i=0, count=arbiters.length; i<count; i++){
		var arb = arbiters[i];
		var a = arb.body_a, b = arb.body_b;
		if(sleep){
			if((b.isRogue() && !b.isStatic()) || a.isSleeping()) a.activate();
			if((a.isRogue() && !a.isStatic()) || b.isSleeping()) b.activate();
		}
		a.pushArbiter(arb);
		b.pushArbiter(arb);
	}
	if(sleep){
		var constraints = this.constraints;
		for(var i=0; i<constraints.length; i++){
			var constraint = constraints[i];
			var a = constraint.a, b = constraint.b;
			if(b.isRogue() && !b.isStatic()) a.activate();
			if(a.isRogue() && !a.isStatic()) b.activate();
		}
		for(var i=0; i<bodies.length;){
			var body = bodies[i];
			if(componentRoot(body) === null){
				floodFillComponent(body, body);
				if(!componentActive(body, this.sleepTimeThreshold)){
					this.sleepingComponents.push(body);
					for(var other = body; other; other = other.nodeNext){
						this.deactivateBody(other);
					}
					continue;
				}
			}
			i++;
			body.nodeRoot = null;
			body.nodeNext = null;
		}
	}
};
Body.prototype.sleep = function()
{
	this.sleepWithGroup(null);
};
Body.prototype.sleepWithGroup = function(group){
	assert(!this.isStatic() && !this.isRogue(), "Rogue and static bodies cannot be put to sleep.");
	var space = this.space;
	assert(space, "Cannot put a rogue body to sleep.");
	assert(!space.locked, "Bodies cannot be put to sleep during a query or a call to cpSpaceStep(). Put these calls into a post-step callback.");
	assert(group === null || group.isSleeping(), "Cannot use a non-sleeping body as a group identifier.");
	if(this.isSleeping()){
		assert(componentRoot(this) === componentRoot(group), "The body is already sleeping and it's group cannot be reassigned.");
		return;
	}
	for(var i = 0; i < this.shapeList.length; i++){
		this.shapeList[i].update(this.p, this.rot);
	}
	space.deactivateBody(this);
	if(group){
		var root = componentRoot(group);
		this.nodeRoot = root;
		this.nodeNext = root.nodeNext;
		this.nodeIdleTime = 0;
		root.nodeNext = this;
	} else {
		this.nodeRoot = this;
		this.nodeNext = null;
		this.nodeIdleTime = 0;
		space.sleepingComponents.push(this);
	}
	deleteObjFromList(space.bodies, this);
};
Space.prototype.activateShapesTouchingShape = function(shape){
	if(this.sleepTimeThreshold !== Infinity){
		this.shapeQuery(shape, function(shape, points) {
			shape.body.activate();
		});
	}
};
Space.prototype.pointQuery = function(point, layers, group, func)
{
	var helper = function(shape){
		if(
			!(shape.group && group === shape.group) && (layers & shape.layers) &&
			shape.pointQuery(point)
		){
			func(shape);
		}
	};
	var bb = new BB(point.x, point.y, point.x, point.y);
	this.lock(); {
		this.activeShapes.query(bb, helper);
		this.staticShapes.query(bb, helper);
	} this.unlock(true);
};
Space.prototype.pointQueryFirst = function(point, layers, group)
{
	var outShape = null;
	this.pointQuery(point, layers, group, function(shape) {
		if(!shape.sensor) outShape = shape;
	});
	return outShape;
};
Space.prototype.nearestPointQuery = function(point, maxDistance, layers, group, func)
{
	var helper = function(shape){
		if(!(shape.group && group === shape.group) && (layers & shape.layers)){
			var info = shape.nearestPointQuery(point);
			if(info.d < maxDistance) func(shape, info.d, info.p);
		}
	};
	var bb = bbNewForCircle(point, maxDistance);
	this.lock(); {
		this.activeShapes.query(bb, helper);
		this.staticShapes.query(bb, helper);
	} this.unlock(true);
};
Space.prototype.nearestPointQueryNearest = function(point, maxDistance, layers, group)
{
	var out;
	var helper = function(shape){
		if(!(shape.group && group === shape.group) && (layers & shape.layers) && !shape.sensor){
			var info = shape.nearestPointQuery(point);
			if(info.d < maxDistance && (!out || info.d < out.d)) out = info;
		}
	};
	var bb = bbNewForCircle(point, maxDistance);
	this.activeShapes.query(bb, helper);
	this.staticShapes.query(bb, helper);
	return out;
};
cp.SHAPE_FILTER_ALL = {
        group:cp.NO_GROUP,
        categories:cp.ALL_CATEGORIES,
        mask:cp.ALL_CATEGORIES
};
Space.prototype.pointQueryNearest = function(point, maxDistance, filter)
{
    var out = this.nearestPointQueryNearest(point, maxDistance, filter.mask, filter.group);
    if (typeof out != 'undefined') {
        out.distance = out.d;
        out.point = out.p;
    }
    return out;
};
Space.prototype.segmentQuery = function(start, end, layers, group, func)
{
	var helper = function(shape){
		var info;
		if(
			!(shape.group && group === shape.group) && (layers & shape.layers) &&
			(info = shape.segmentQuery(start, end))
		){
			func(shape, info.t, info.n);
		}
		return 1;
	};
	this.lock(); {
		this.staticShapes.segmentQuery(start, end, 1, helper);
		this.activeShapes.segmentQuery(start, end, 1, helper);
	} this.unlock(true);
};
Space.prototype.segmentQueryFirst = function(start, end, layers, group)
{
	var out = null;
	var helper = function(shape){
		var info;
		if(
			!(shape.group && group === shape.group) && (layers & shape.layers) &&
			!shape.sensor &&
			(info = shape.segmentQuery(start, end)) &&
			(out === null || info.t < out.t)
		){
			out = info;
		}
		return out ? out.t : 1;
	};
	this.staticShapes.segmentQuery(start, end, 1, helper);
	this.activeShapes.segmentQuery(start, end, out ? out.t : 1, helper);
    if (out && out !== "null" && out !== "undefined") {
        out.normal = out.n;
        out.alpha = out.t;
        out.p = out.point = cp.v.lerp(start, end, out.t);
    }
	return out;
};
Space.prototype.bbQuery = function(bb, layers, group, func)
{
	var helper = function(shape){
		if(
			!(shape.group && group === shape.group) && (layers & shape.layers) &&
			bbIntersects2(bb, shape.bb_l, shape.bb_b, shape.bb_r, shape.bb_t)
		){
			func(shape);
		}
	};
	this.lock(); {
		this.activeShapes.query(bb, helper);
		this.staticShapes.query(bb, helper);
	} this.unlock(true);
};
Space.prototype.shapeQuery = function(shape, func)
{
	var body = shape.body;
	if(body){
		shape.update(body.p, body.rot);
	}
	var bb = new BB(shape.bb_l, shape.bb_b, shape.bb_r, shape.bb_t);
	var anyCollision = false;
	var helper = function(b){
		var a = shape;
		if(
			(a.group && a.group === b.group) ||
			!(a.layers & b.layers) ||
			a === b
		) return;
		var contacts;
		if(a.collisionCode <= b.collisionCode){
			contacts = collideShapes(a, b);
		} else {
			contacts = collideShapes(b, a);
			for(var i=0; i<contacts.length; i++) contacts[i].n = vneg(contacts[i].n);
		}
		if(contacts.length){
			anyCollision = !(a.sensor || b.sensor);
			if(func){
				var set = new Array(contacts.length);
				for(var i=0; i<contacts.length; i++){
					set[i] = new ContactPoint(contacts[i].p, contacts[i].n, contacts[i].dist);
				}
				func(b, set);
			}
		}
	};
	this.lock(); {
		this.activeShapes.query(bb, helper);
		this.staticShapes.query(bb, helper);
	} this.unlock(true);
	return anyCollision;
};
Space.prototype.addPostStepCallback = function(func)
{
	assertSoft(this.locked,
		"Adding a post-step callback when the space is not locked is unnecessary. " +
		"Post-step callbacks will not called until the end of the next call to cpSpaceStep() or the next query.");
	this.postStepCallbacks.push(func);
};
Space.prototype.runPostStepCallbacks = function()
{
	for(var i = 0; i < this.postStepCallbacks.length; i++){
		this.postStepCallbacks[i]();
	}
	this.postStepCallbacks = [];
};
Space.prototype.lock = function()
{
	this.locked++;
};
Space.prototype.unlock = function(runPostStep)
{
	this.locked--;
	assert(this.locked >= 0, "Internal Error: Space lock underflow.");
	if(this.locked === 0 && runPostStep){
		var waking = this.rousedBodies;
		for(var i=0; i<waking.length; i++){
			this.activateBody(waking[i]);
		}
		waking.length = 0;
		this.runPostStepCallbacks();
	}
};
Space.prototype.makeCollideShapes = function()
{
	var space_ = this;
	return function(a, b){
		var space = space_;
		if(
			!(a.bb_l <= b.bb_r && b.bb_l <= a.bb_r && a.bb_b <= b.bb_t && b.bb_b <= a.bb_t)
			|| a.body === b.body
			|| (a.group && a.group === b.group)
			|| !(a.layers & b.layers)
		) return;
		var handler = space.lookupHandler(a.collision_type, b.collision_type);
		var sensor = a.sensor || b.sensor;
		if(sensor && handler === defaultCollisionHandler) return;
		if(a.collisionCode > b.collisionCode){
			var temp = a;
			a = b;
			b = temp;
		}
		var contacts = collideShapes(a, b);
		if(contacts.length === 0) return;
		var arbHash = hashPair(a.hashid, b.hashid);
		var arb = space.cachedArbiters[arbHash];
		if (!arb){
			arb = space.cachedArbiters[arbHash] = new Arbiter(a, b);
		}
		arb.update(contacts, handler, a, b);
		if(arb.state == 'first coll' && !handler.begin(arb, space)){
			arb.ignore();
		}
		if(
			(arb.state !== 'ignore') &&
			handler.preSolve(arb, space) &&
			!sensor
		){
			space.arbiters.push(arb);
		} else {
			arb.contacts = null;
			if(arb.state !== 'ignore') arb.state = 'normal';
		}
		arb.stamp = space.stamp;
	};
};
Space.prototype.arbiterSetFilter = function(arb)
{
	var ticks = this.stamp - arb.stamp;
	var a = arb.body_a, b = arb.body_b;
	if(
		(a.isStatic() || a.isSleeping()) &&
		(b.isStatic() || b.isSleeping())
	){
		return true;
	}
	if(ticks >= 1 && arb.state != 'cached'){
		arb.callSeparate(this);
		arb.state = 'cached';
	}
	if(ticks >= this.collisionPersistence){
		arb.contacts = null;
		return false;
	}
	return true;
};
var updateFunc = function(shape)
{
	var body = shape.body;
	shape.update(body.p, body.rot);
};
Space.prototype.step = function(dt)
{
	if(dt === 0) return;
	assert(vzero.x === 0 && vzero.y === 0, "vzero is invalid");
	this.stamp++;
	var prev_dt = this.curr_dt;
	this.curr_dt = dt;
    var i;
    var j;
    var hash;
	var bodies = this.bodies;
	var constraints = this.constraints;
	var arbiters = this.arbiters;
	for(i=0; i<arbiters.length; i++){
		var arb = arbiters[i];
		arb.state = 'normal';
		if(!arb.body_a.isSleeping() && !arb.body_b.isSleeping()){
			arb.unthread();
		}
	}
	arbiters.length = 0;
	this.lock(); {
		for(i=0; i<bodies.length; i++){
			bodies[i].position_func(dt);
		}
		this.activeShapes.each(updateFunc);
		this.activeShapes.reindexQuery(this.collideShapes);
	} this.unlock(false);
	this.processComponents(dt);
	this.lock(); {
		for(hash in this.cachedArbiters) {
			if(!this.arbiterSetFilter(this.cachedArbiters[hash])) {
				delete this.cachedArbiters[hash];
			}
		}
		var slop = this.collisionSlop;
		var biasCoef = 1 - Math.pow(this.collisionBias, dt);
		for(i=0; i<arbiters.length; i++){
			arbiters[i].preStep(dt, slop, biasCoef);
		}
		for(i=0; i<constraints.length; i++){
			var constraint = constraints[i];
			constraint.preSolve(this);
			constraint.preStep(dt);
		}
		var damping = Math.pow(this.damping, dt);
		var gravity = this.gravity;
		for(i=0; i<bodies.length; i++){
			bodies[i].velocity_func(gravity, damping, dt);
		}
		var dt_coef = (prev_dt === 0 ? 0 : dt/prev_dt);
		for(i=0; i<arbiters.length; i++){
			arbiters[i].applyCachedImpulse(dt_coef);
		}
		for(i=0; i<constraints.length; i++){
			constraints[i].applyCachedImpulse(dt_coef);
		}
		for(i=0; i<this.iterations; i++){
			for(j=0; j<arbiters.length; j++){
				arbiters[j].applyImpulse();
			}
			for(j=0; j<constraints.length; j++){
				constraints[j].applyImpulse();
			}
		}
		for(i=0; i<constraints.length; i++){
			constraints[i].postSolve(this);
		}
		for(i=0; i<arbiters.length; i++){
			arbiters[i].handler.postSolve(arbiters[i], this);
		}
	} this.unlock(true);
};
var relative_velocity = function(a, b, r1, r2){
	var v1_sumx = a.vx + (-r1.y) * a.w;
	var v1_sumy = a.vy + ( r1.x) * a.w;
	var v2_sumx = b.vx + (-r2.y) * b.w;
	var v2_sumy = b.vy + ( r2.x) * b.w;
	return new Vect(v2_sumx - v1_sumx, v2_sumy - v1_sumy);
};
var normal_relative_velocity = function(a, b, r1, r2, n){
	var v1_sumx = a.vx + (-r1.y) * a.w;
	var v1_sumy = a.vy + ( r1.x) * a.w;
	var v2_sumx = b.vx + (-r2.y) * b.w;
	var v2_sumy = b.vy + ( r2.x) * b.w;
	return vdot2(v2_sumx - v1_sumx, v2_sumy - v1_sumy, n.x, n.y);
};
var apply_impulse = function(body, jx, jy, r){
	body.vx += jx * body.m_inv;
	body.vy += jy * body.m_inv;
	body.w += body.i_inv*(r.x*jy - r.y*jx);
};
var apply_impulses = function(a, b, r1, r2, jx, jy)
{
	apply_impulse(a, -jx, -jy, r1);
	apply_impulse(b, jx, jy, r2);
};
var apply_bias_impulse = function(body, jx, jy, r)
{
	body.v_biasx += jx * body.m_inv;
	body.v_biasy += jy * body.m_inv;
	body.w_bias += body.i_inv*vcross2(r.x, r.y, jx, jy);
};
var k_scalar_body = function(body, r, n)
{
	var rcn = vcross(r, n);
	return body.m_inv + body.i_inv*rcn*rcn;
};
var k_scalar = function(a, b, r1, r2, n)
{
	var value = k_scalar_body(a, r1, n) + k_scalar_body(b, r2, n);
	assertSoft(value !== 0, "Unsolvable collision or constraint.");
	return value;
};
var k_tensor = function(a, b, r1, r2, k1, k2)
{
	var k11, k12, k21, k22;
	var m_sum = a.m_inv + b.m_inv;
	k11 = m_sum; k12 = 0;
	k21 = 0;     k22 = m_sum;
	var a_i_inv = a.i_inv;
	var r1xsq =  r1.x * r1.x * a_i_inv;
	var r1ysq =  r1.y * r1.y * a_i_inv;
	var r1nxy = -r1.x * r1.y * a_i_inv;
	k11 += r1ysq; k12 += r1nxy;
	k21 += r1nxy; k22 += r1xsq;
	var b_i_inv = b.i_inv;
	var r2xsq =  r2.x * r2.x * b_i_inv;
	var r2ysq =  r2.y * r2.y * b_i_inv;
	var r2nxy = -r2.x * r2.y * b_i_inv;
	k11 += r2ysq; k12 += r2nxy;
	k21 += r2nxy; k22 += r2xsq;
	var determinant = k11*k22 - k12*k21;
	assertSoft(determinant !== 0, "Unsolvable constraint.");
	var det_inv = 1/determinant;
	k1.x =  k22*det_inv; k1.y = -k12*det_inv;
	k2.x = -k21*det_inv; k2.y =  k11*det_inv;
};
var mult_k = function(vr, k1, k2)
{
	return new Vect(vdot(vr, k1), vdot(vr, k2));
};
var bias_coef = function(errorBias, dt)
{
	return 1 - Math.pow(errorBias, dt);
};
var Constraint = cp.Constraint = function(a, b)
{
	this.a = a;
	this.b = b;
	this.space = null;
	this.next_a = null;
	this.next_b = null;
	this.maxForce = Infinity;
	this.errorBias = Math.pow(1 - 0.1, 60);
	this.maxBias = Infinity;
};
Constraint.prototype.activateBodies = function()
{
	if(this.a) this.a.activate();
	if(this.b) this.b.activate();
};
Constraint.prototype.preStep = function(dt) {};
Constraint.prototype.applyCachedImpulse = function(dt_coef) {};
Constraint.prototype.applyImpulse = function() {};
Constraint.prototype.getImpulse = function() { return 0; };
Constraint.prototype.preSolve = function(space) {};
Constraint.prototype.postSolve = function(space) {};
Constraint.prototype.next = function(body)
{
	return (this.a === body ? this.next_a : this.next_b);
};
var PinJoint = cp.PinJoint = function(a, b, anchr1, anchr2)
{
	Constraint.call(this, a, b);
	this.anchr1 = anchr1;
	this.anchr2 = anchr2;
	var p1 = (a ? vadd(a.p, vrotate(anchr1, a.rot)) : anchr1);
	var p2 = (b ? vadd(b.p, vrotate(anchr2, b.rot)) : anchr2);
	this.dist = vlength(vsub(p2, p1));
	assertSoft(this.dist > 0, "You created a 0 length pin joint. A pivot joint will be much more stable.");
	this.r1 = this.r2 = null;
	this.n = null;
	this.nMass = 0;
	this.jnAcc = this.jnMax = 0;
	this.bias = 0;
};
PinJoint.prototype = Object.create(Constraint.prototype);
PinJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	this.r1 = vrotate(this.anchr1, a.rot);
	this.r2 = vrotate(this.anchr2, b.rot);
	var delta = vsub(vadd(b.p, this.r2), vadd(a.p, this.r1));
	var dist = vlength(delta);
	this.n = vmult(delta, 1/(dist ? dist : Infinity));
	this.nMass = 1/k_scalar(a, b, this.r1, this.r2, this.n);
	var maxBias = this.maxBias;
	this.bias = clamp(-bias_coef(this.errorBias, dt)*(dist - this.dist)/dt, -maxBias, maxBias);
	this.jnMax = this.maxForce * dt;
};
PinJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	var j = vmult(this.n, this.jnAcc*dt_coef);
	apply_impulses(this.a, this.b, this.r1, this.r2, j.x, j.y);
};
PinJoint.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var n = this.n;
	var vrn = normal_relative_velocity(a, b, this.r1, this.r2, n);
	var jn = (this.bias - vrn)*this.nMass;
	var jnOld = this.jnAcc;
	this.jnAcc = clamp(jnOld + jn, -this.jnMax, this.jnMax);
	jn = this.jnAcc - jnOld;
	apply_impulses(a, b, this.r1, this.r2, n.x*jn, n.y*jn);
};
PinJoint.prototype.getImpulse = function()
{
	return Math.abs(this.jnAcc);
};
var SlideJoint = cp.SlideJoint = function(a, b, anchr1, anchr2, min, max)
{
	Constraint.call(this, a, b);
	this.anchr1 = anchr1;
	this.anchr2 = anchr2;
	this.min = min;
	this.max = max;
	this.r1 = this.r2 = this.n = null;
	this.nMass = 0;
	this.jnAcc = this.jnMax = 0;
	this.bias = 0;
};
SlideJoint.prototype = Object.create(Constraint.prototype);
SlideJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	this.r1 = vrotate(this.anchr1, a.rot);
	this.r2 = vrotate(this.anchr2, b.rot);
	var delta = vsub(vadd(b.p, this.r2), vadd(a.p, this.r1));
	var dist = vlength(delta);
	var pdist = 0;
	if(dist > this.max) {
		pdist = dist - this.max;
		this.n = vnormalize_safe(delta);
	} else if(dist < this.min) {
		pdist = this.min - dist;
		this.n = vneg(vnormalize_safe(delta));
	} else {
		this.n = vzero;
		this.jnAcc = 0;
	}
	this.nMass = 1/k_scalar(a, b, this.r1, this.r2, this.n);
	var maxBias = this.maxBias;
	this.bias = clamp(-bias_coef(this.errorBias, dt)*pdist/dt, -maxBias, maxBias);
	this.jnMax = this.maxForce * dt;
};
SlideJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	var jn = this.jnAcc * dt_coef;
	apply_impulses(this.a, this.b, this.r1, this.r2, this.n.x * jn, this.n.y * jn);
};
SlideJoint.prototype.applyImpulse = function()
{
	if(this.n.x === 0 && this.n.y === 0) return;
	var a = this.a;
	var b = this.b;
	var n = this.n;
	var r1 = this.r1;
	var r2 = this.r2;
	var vr = relative_velocity(a, b, r1, r2);
	var vrn = vdot(vr, n);
	var jn = (this.bias - vrn)*this.nMass;
	var jnOld = this.jnAcc;
	this.jnAcc = clamp(jnOld + jn, -this.jnMax, 0);
	jn = this.jnAcc - jnOld;
	apply_impulses(a, b, this.r1, this.r2, n.x * jn, n.y * jn);
};
SlideJoint.prototype.getImpulse = function()
{
	return Math.abs(this.jnAcc);
};
var PivotJoint = cp.PivotJoint = function(a, b, anchr1, anchr2)
{
	Constraint.call(this, a, b);
	if(typeof anchr2 === 'undefined') {
		var pivot = anchr1;
		anchr1 = (a ? a.world2Local(pivot) : pivot);
		anchr2 = (b ? b.world2Local(pivot) : pivot);
	}
	this.anchr1 = anchr1;
	this.anchr2 = anchr2;
	this.r1 = this.r2 = vzero;
	this.k1 = new Vect(0,0); this.k2 = new Vect(0,0);
	this.jAcc = vzero;
	this.jMaxLen = 0;
	this.bias = vzero;
};
PivotJoint.prototype = Object.create(Constraint.prototype);
PivotJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	this.r1 = vrotate(this.anchr1, a.rot);
	this.r2 = vrotate(this.anchr2, b.rot);
	k_tensor(a, b, this.r1, this.r2, this.k1, this.k2);
	this.jMaxLen = this.maxForce * dt;
	var delta = vsub(vadd(b.p, this.r2), vadd(a.p, this.r1));
	this.bias = vclamp(vmult(delta, -bias_coef(this.errorBias, dt)/dt), this.maxBias);
};
PivotJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	apply_impulses(this.a, this.b, this.r1, this.r2, this.jAcc.x * dt_coef, this.jAcc.y * dt_coef);
};
PivotJoint.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var r1 = this.r1;
	var r2 = this.r2;
	var vr = relative_velocity(a, b, r1, r2);
	var j = mult_k(vsub(this.bias, vr), this.k1, this.k2);
	var jOld = this.jAcc;
	this.jAcc = vclamp(vadd(this.jAcc, j), this.jMaxLen);
	apply_impulses(a, b, this.r1, this.r2, this.jAcc.x - jOld.x, this.jAcc.y - jOld.y);
};
PivotJoint.prototype.getImpulse = function()
{
	return vlength(this.jAcc);
};
var GrooveJoint = cp.GrooveJoint = function(a, b, groove_a, groove_b, anchr2)
{
	Constraint.call(this, a, b);
	this.grv_a = groove_a;
	this.grv_b = groove_b;
	this.grv_n = vperp(vnormalize(vsub(groove_b, groove_a)));
	this.anchr2 = anchr2;
	this.grv_tn = null;
	this.clamp = 0;
	this.r1 = this.r2 = null;
	this.k1 = new Vect(0,0);
	this.k2 = new Vect(0,0);
	this.jAcc = vzero;
	this.jMaxLen = 0;
	this.bias = null;
};
GrooveJoint.prototype = Object.create(Constraint.prototype);
GrooveJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	var ta = a.local2World(this.grv_a);
	var tb = a.local2World(this.grv_b);
	var n = vrotate(this.grv_n, a.rot);
	var d = vdot(ta, n);
	this.grv_tn = n;
	this.r2 = vrotate(this.anchr2, b.rot);
	var td = vcross(vadd(b.p, this.r2), n);
	if(td <= vcross(ta, n)){
		this.clamp = 1;
		this.r1 = vsub(ta, a.p);
	} else if(td >= vcross(tb, n)){
		this.clamp = -1;
		this.r1 = vsub(tb, a.p);
	} else {
		this.clamp = 0;
		this.r1 = vsub(vadd(vmult(vperp(n), -td), vmult(n, d)), a.p);
	}
	k_tensor(a, b, this.r1, this.r2, this.k1, this.k2);
	this.jMaxLen = this.maxForce * dt;
	var delta = vsub(vadd(b.p, this.r2), vadd(a.p, this.r1));
	this.bias = vclamp(vmult(delta, -bias_coef(this.errorBias, dt)/dt), this.maxBias);
};
GrooveJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	apply_impulses(this.a, this.b, this.r1, this.r2, this.jAcc.x * dt_coef, this.jAcc.y * dt_coef);
};
GrooveJoint.prototype.grooveConstrain = function(j){
	var n = this.grv_tn;
	var jClamp = (this.clamp*vcross(j, n) > 0) ? j : vproject(j, n);
	return vclamp(jClamp, this.jMaxLen);
};
GrooveJoint.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var r1 = this.r1;
	var r2 = this.r2;
	var vr = relative_velocity(a, b, r1, r2);
	var j = mult_k(vsub(this.bias, vr), this.k1, this.k2);
	var jOld = this.jAcc;
	this.jAcc = this.grooveConstrain(vadd(jOld, j));
	apply_impulses(a, b, this.r1, this.r2, this.jAcc.x - jOld.x, this.jAcc.y - jOld.y);
};
GrooveJoint.prototype.getImpulse = function()
{
	return vlength(this.jAcc);
};
GrooveJoint.prototype.setGrooveA = function(value)
{
	this.grv_a = value;
	this.grv_n = vperp(vnormalize(vsub(this.grv_b, value)));
	this.activateBodies();
};
GrooveJoint.prototype.setGrooveB = function(value)
{
	this.grv_b = value;
	this.grv_n = vperp(vnormalize(vsub(value, this.grv_a)));
	this.activateBodies();
};
var defaultSpringForce = function(spring, dist){
	return (spring.restLength - dist)*spring.stiffness;
};
var DampedSpring = cp.DampedSpring = function(a, b, anchr1, anchr2, restLength, stiffness, damping)
{
	Constraint.call(this, a, b);
	this.anchr1 = anchr1;
	this.anchr2 = anchr2;
	this.restLength = restLength;
	this.stiffness = stiffness;
	this.damping = damping;
	this.springForceFunc = defaultSpringForce;
	this.target_vrn = this.v_coef = 0;
	this.r1 = this.r2 = null;
	this.nMass = 0;
	this.n = null;
};
DampedSpring.prototype = Object.create(Constraint.prototype);
DampedSpring.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	this.r1 = vrotate(this.anchr1, a.rot);
	this.r2 = vrotate(this.anchr2, b.rot);
	var delta = vsub(vadd(b.p, this.r2), vadd(a.p, this.r1));
	var dist = vlength(delta);
	this.n = vmult(delta, 1/(dist ? dist : Infinity));
	var k = k_scalar(a, b, this.r1, this.r2, this.n);
	assertSoft(k !== 0, "Unsolvable this.");
	this.nMass = 1/k;
	this.target_vrn = 0;
	this.v_coef = 1 - Math.exp(-this.damping*dt*k);
	var f_spring = this.springForceFunc(this, dist);
	apply_impulses(a, b, this.r1, this.r2, this.n.x * f_spring * dt, this.n.y * f_spring * dt);
};
DampedSpring.prototype.applyCachedImpulse = function(dt_coef){};
DampedSpring.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var n = this.n;
	var r1 = this.r1;
	var r2 = this.r2;
	var vrn = normal_relative_velocity(a, b, r1, r2, n);
	var v_damp = (this.target_vrn - vrn)*this.v_coef;
	this.target_vrn = vrn + v_damp;
	v_damp *= this.nMass;
	apply_impulses(a, b, this.r1, this.r2, this.n.x * v_damp, this.n.y * v_damp);
};
DampedSpring.prototype.getImpulse = function()
{
	return 0;
};
var defaultSpringTorque = function(spring, relativeAngle){
	return (relativeAngle - spring.restAngle)*spring.stiffness;
}
var DampedRotarySpring = cp.DampedRotarySpring = function(a, b, restAngle, stiffness, damping)
{
	Constraint.call(this, a, b);
	this.restAngle = restAngle;
	this.stiffness = stiffness;
	this.damping = damping;
	this.springTorqueFunc = defaultSpringTorque;
	this.target_wrn = 0;
	this.w_coef = 0;
	this.iSum = 0;
};
DampedRotarySpring.prototype = Object.create(Constraint.prototype);
DampedRotarySpring.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	var moment = a.i_inv + b.i_inv;
	assertSoft(moment !== 0, "Unsolvable spring.");
	this.iSum = 1/moment;
	this.w_coef = 1 - Math.exp(-this.damping*dt*moment);
	this.target_wrn = 0;
	var j_spring = this.springTorqueFunc(this, a.a - b.a)*dt;
	a.w -= j_spring*a.i_inv;
	b.w += j_spring*b.i_inv;
};
DampedRotarySpring.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var wrn = a.w - b.w;//normal_relative_velocity(a, b, r1, r2, n) - this.target_vrn;
	var w_damp = (this.target_wrn - wrn)*this.w_coef;
	this.target_wrn = wrn + w_damp;
	var j_damp = w_damp*this.iSum;
	a.w += j_damp*a.i_inv;
	b.w -= j_damp*b.i_inv;
};
var RotaryLimitJoint = cp.RotaryLimitJoint = function(a, b, min, max)
{
	Constraint.call(this, a, b);
	this.min = min;
	this.max = max;
	this.jAcc = 0;
	this.iSum = this.bias = this.jMax = 0;
};
RotaryLimitJoint.prototype = Object.create(Constraint.prototype);
RotaryLimitJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	var dist = b.a - a.a;
	var pdist = 0;
	if(dist > this.max) {
		pdist = this.max - dist;
	} else if(dist < this.min) {
		pdist = this.min - dist;
	}
	this.iSum = 1/(1/a.i + 1/b.i);
	var maxBias = this.maxBias;
	this.bias = clamp(-bias_coef(this.errorBias, dt)*pdist/dt, -maxBias, maxBias);
	this.jMax = this.maxForce * dt;
	if(!this.bias) this.jAcc = 0;
};
RotaryLimitJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	var a = this.a;
	var b = this.b;
	var j = this.jAcc*dt_coef;
	a.w -= j*a.i_inv;
	b.w += j*b.i_inv;
};
RotaryLimitJoint.prototype.applyImpulse = function()
{
	if(!this.bias) return;
	var a = this.a;
	var b = this.b;
	var wr = b.w - a.w;
	var j = -(this.bias + wr)*this.iSum;
	var jOld = this.jAcc;
	if(this.bias < 0){
		this.jAcc = clamp(jOld + j, 0, this.jMax);
	} else {
		this.jAcc = clamp(jOld + j, -this.jMax, 0);
	}
	j = this.jAcc - jOld;
	a.w -= j*a.i_inv;
	b.w += j*b.i_inv;
};
RotaryLimitJoint.prototype.getImpulse = function()
{
	return Math.abs(joint.jAcc);
};
var RatchetJoint = cp.RatchetJoint = function(a, b, phase, ratchet)
{
	Constraint.call(this, a, b);
	this.angle = 0;
	this.phase = phase;
	this.ratchet = ratchet;
	this.angle = (b ? b.a : 0) - (a ? a.a : 0);
	this.iSum = this.bias = this.jAcc = this.jMax = 0;
};
RatchetJoint.prototype = Object.create(Constraint.prototype);
RatchetJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	var angle = this.angle;
	var phase = this.phase;
	var ratchet = this.ratchet;
	var delta = b.a - a.a;
	var diff = angle - delta;
	var pdist = 0;
	if(diff*ratchet > 0){
		pdist = diff;
	} else {
		this.angle = Math.floor((delta - phase)/ratchet)*ratchet + phase;
	}
	this.iSum = 1/(a.i_inv + b.i_inv);
	var maxBias = this.maxBias;
	this.bias = clamp(-bias_coef(this.errorBias, dt)*pdist/dt, -maxBias, maxBias);
	this.jMax = this.maxForce * dt;
	if(!this.bias) this.jAcc = 0;
};
RatchetJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	var a = this.a;
	var b = this.b;
	var j = this.jAcc*dt_coef;
	a.w -= j*a.i_inv;
	b.w += j*b.i_inv;
};
RatchetJoint.prototype.applyImpulse = function()
{
	if(!this.bias) return;
	var a = this.a;
	var b = this.b;
	var wr = b.w - a.w;
	var ratchet = this.ratchet;
	var j = -(this.bias + wr)*this.iSum;
	var jOld = this.jAcc;
	this.jAcc = clamp((jOld + j)*ratchet, 0, this.jMax*Math.abs(ratchet))/ratchet;
	j = this.jAcc - jOld;
	a.w -= j*a.i_inv;
	b.w += j*b.i_inv;
};
RatchetJoint.prototype.getImpulse = function(joint)
{
	return Math.abs(joint.jAcc);
};
var GearJoint = cp.GearJoint = function(a, b, phase, ratio)
{
	Constraint.call(this, a, b);
	this.phase = phase;
	this.ratio = ratio;
	this.ratio_inv = 1/ratio;
	this.jAcc = 0;
	this.iSum = this.bias = this.jMax = 0;
};
GearJoint.prototype = Object.create(Constraint.prototype);
GearJoint.prototype.preStep = function(dt)
{
	var a = this.a;
	var b = this.b;
	this.iSum = 1/(a.i_inv*this.ratio_inv + this.ratio*b.i_inv);
	var maxBias = this.maxBias;
	this.bias = clamp(-bias_coef(this.errorBias, dt)*(b.a*this.ratio - a.a - this.phase)/dt, -maxBias, maxBias);
	this.jMax = this.maxForce * dt;
};
GearJoint.prototype.applyCachedImpulse = function(dt_coef)
{
	var a = this.a;
	var b = this.b;
	var j = this.jAcc*dt_coef;
	a.w -= j*a.i_inv*this.ratio_inv;
	b.w += j*b.i_inv;
};
GearJoint.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var wr = b.w*this.ratio - a.w;
	var j = (this.bias - wr)*this.iSum;
	var jOld = this.jAcc;
	this.jAcc = clamp(jOld + j, -this.jMax, this.jMax);
	j = this.jAcc - jOld;
	a.w -= j*a.i_inv*this.ratio_inv;
	b.w += j*b.i_inv;
};
GearJoint.prototype.getImpulse = function()
{
	return Math.abs(this.jAcc);
};
GearJoint.prototype.setRatio = function(value)
{
	this.ratio = value;
	this.ratio_inv = 1/value;
	this.activateBodies();
};
var SimpleMotor = cp.SimpleMotor = function(a, b, rate)
{
	Constraint.call(this, a, b);
	this.rate = rate;
	this.jAcc = 0;
	this.iSum = this.jMax = 0;
};
SimpleMotor.prototype = Object.create(Constraint.prototype);
SimpleMotor.prototype.preStep = function(dt)
{
	this.iSum = 1/(this.a.i_inv + this.b.i_inv);
	this.jMax = this.maxForce * dt;
};
SimpleMotor.prototype.applyCachedImpulse = function(dt_coef)
{
	var a = this.a;
	var b = this.b;
	var j = this.jAcc*dt_coef;
	a.w -= j*a.i_inv;
	b.w += j*b.i_inv;
};
SimpleMotor.prototype.applyImpulse = function()
{
	var a = this.a;
	var b = this.b;
	var wr = b.w - a.w + this.rate;
	var j = -wr*this.iSum;
	var jOld = this.jAcc;
	this.jAcc = clamp(jOld + j, -this.jMax, this.jMax);
	j = this.jAcc - jOld;
	a.w -= j*a.i_inv;
	b.w += j*b.i_inv;
};
SimpleMotor.prototype.getImpulse = function()
{
	return Math.abs(this.jAcc);
};
})();
