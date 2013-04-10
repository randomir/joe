/**
 * Poor Joe's cross-browser JavaScript helper library.
 * ~ think of it as a 3kB jQuery for modern browsers :-)
 *
 * Very basic DOM manipulation, events, AJAX.
 * Works in: Chrome 1+, Firefox 3.5+, IE 8+, Opera 10+, Safari 4+.
 *
 * Written by Radomir Stevanovic, April 2013.
 */

(function(window, undefined) {
    if (window.joe) return window.joe;
    
    //Function.prototype.partial = function() {
    //    var f = this, fixed = [].slice.apply(arguments);
    //    return function() {
    //        var args = [].slice.apply(arguments);
    //        return f.apply(f, fixed.concat(args));
    //    }
    //};
    
    var document = window.document;

    var joe = function(selector, elem) {
        return new joe.init(selector, elem);
    };

    joe.init = function(selector, elem) {
        // joe(Node)
        if (selector.nodeType) {
            return this.extend([selector]);
        }
        
        // joe("css selector" [, parentNode])
        if (typeof selector === "string") {
            return this.extend(joe.fn.select(selector, elem));
        }
        
        // joe(onLoadHandler)
        if (typeof selector === "function") {
            joe.fn.attach(window, "load", selector);
        }
    };
    
    joe.fn = joe.init.prototype = {
        // joe.fn.attach(window, "load", someFn)
        attach: function(elem, type, fn) {
            var handler = function() {
                var ret = fn && fn.apply(this, arguments);
                if (ret === false) {
                    var event = arguments[0];
                    event.preventDefault && event.preventDefault();
                    event.stopPropagation && event.stopPropagation();
                    event.returnValue = false;  // IE fix
                }
                return ret;
            };
            if (elem.addEventListener) {
                elem.addEventListener(type, handler, false);
            } else if (elem.attachEvent)  {
                elem.attachEvent("on"+type, handler);
            }
        },
        
        // joe.fn.select(".test, a > input[type=radio]" [, parentNode])
        select: function(selector, parent) {
            if (!parent) parent = document;
            return parent.querySelectorAll(selector);
        },
        
        extend: function(src, dest) {
            dest = dest || this;
            if (src.length) {
                for (var i = 0; i < src.length; i++) {
                    dest[i] = src[i];
                }
                dest.length = src.length;
            } else {
                for (prop in src) {
                    dest[prop] = src[prop];
                }
            }
            return dest;
        }
    };

    Array.prototype.forEach = function(fn, data) {
        for (var i = 0; i < this.length; i++) {
            fn.call(this[i], i, data);
        }
        return this;
    };
    
    Array.prototype.filtered = function(keep) {
        var result = [];
        this.forEach(function() {
            if (keep.call(this)) result.push(this);
        });
        return result;
    };
    
    if (!('contains' in String.prototype)) {
        String.prototype.contains = function(str, startIndex) {
            return -1 !== this.indexOf(str, startIndex);
        };
    }
    
    // basic (instance related)
    joe.init.prototype.extend({
        // $(elem).on("click", someFn)
        on: function(type, fn) {
            this.attach(this[0], type, fn);
        },
        
        // $().each(function(idx, data) { this <- elementIterated }, data)
        each: Array.prototype.forEach,
        
        // $().css({backgroundColor: "..", position: "relative"})
        css: function(styles) {
            return this.each(function() {
                joe.fn.extend(styles, this.style);
            });
        },
        
        // $().html([innerHTML])
        html: function(html) {
            return html ? (this[0].innerHTML=html, this): this[0].innerHTML;
        },
        
        // $().text([textContent])
        text: function(text) {
            return text ? (this[0].textContent=text, this) : this[0].textContent;
        },
        
        // $().attr(name [, value])
        attr: function(name, value) {
            return value ? (this[0].setAttribute(name, value), this) : this[0].getAttribute(name);
        }
    });
    
    joe.init.prototype.extend({
        hasClass: function(cls) {
            return this[0].className.contains(cls);
        },
        addClass: function(cls) {
            return this.each(function() {
                if (!this.className.contains(cls)) this.className += " " + cls;
            });
        },
        removeClass: function(cls) {
            return this.each(function() {
                this.className = this.className.split(" ").filtered(function() { return this.toString() !== cls; }).join(" ");
            });
        },
        hide: function() {
            return this.css({display: "none"});
        },
        show: function() {
            return this.css({display: "inherit"});
        }
    });
    
    joe.fn.extend({
        kvjoin: function(object, glue, encode) {
            if (!glue) glue = '&';
            if (encode !== false) encode = true;
            var pairs = [];
            var _encode = function(x) { return encode ? encodeURIComponent(x) : x; };
            for (var key in object) {
                if (object[key]) pairs.push(
                    _encode(key) +
                    '=' +
                    _encode(object[key])
                );
            }
            return pairs.join(glue);
        },
        urlcat: function(base, params) {
            return base + (base.contains("?") ? "&" : "?") + joe.fn.kvjoin(params);
        },
        
        // config options: str:url, str:method, str/obj:data, boolean:async, fn:success, fn:error, fn:complete
        ajax: function(config) {
            var req = createXMLHTTPObject(), url = config.url;
            if (!req || !url) return;
            
            var method = (config.method || "GET").toUpperCase();
            var data = config.data;
            if (method == "GET" && data) {
                url = joe.fn.urlcat(url, data);
                data = undefined;
            }
            
            req.open(method, url, !!config.async);
            //req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            //req.setRequestHeader("User-Agent", "joe/0.1");
            if (method == "POST") req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            
            req.onreadystatechange = function () {
                if (req.readyState != 4) return;
                if (req.status == 0) return;
                if (req.status != 200 && req.status != 304) {
                    config.error && config.error(req, req.statusText);
                } else {
                    config.success && config.success(req.response, req.statusText, req);
                }
                config.complete && config.complete(req, req.statusText);
            }
            if (req.readyState == 4) return;
            try {
                req.send(data);
            } catch (e) {
                config.error && config.error(req, req.statusText, e);
            }
        }
    });

    var XMLHttpFactories = [
        function() { return new XMLHttpRequest() },
        function() { return new ActiveXObject("Msxml2.XMLHTTP") },
        function() { return new ActiveXObject("Msxml3.XMLHTTP") },
        function() { return new ActiveXObject("Microsoft.XMLHTTP") }
    ];
    var createXMLHTTPObject = function () {
        var xmlhttp = false;
        for (var i = 0; i < XMLHttpFactories.length; i++) {
            try {
                xmlhttp = XMLHttpFactories[i]();
            } catch (e) {
                continue;
            }
            break;
        }
        return xmlhttp;
    };
    
    joe.fn.extend(joe.fn, joe);
    
    return window.joe = window.$ = joe;

})(window, undefined);