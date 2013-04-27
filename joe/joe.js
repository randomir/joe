/**
 * Poor Joe's cross-browser JavaScript helper library.
 * ~ think of it as a 3kB jQuery for modern browsers :-)
 *
 * Very basic DOM manipulation, events, AJAX.
 * Works in: Chrome 1+, Firefox 3.5+, IE 8+, Opera 10+, Safari 4+.
 *
 * Written by Radomir Stevanovic, April 2013.
 * Source: https://github.com/randomir/joe/.
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

        dispatch: function(elem, type) {
            if (document.createEvent) {
                var event = document.createEvent("Event");
                event.initEvent(type, true, false);
                elem.dispatchEvent(event);
            } else if (document.createEventObject) {
                event = document.createEventObject();
                elem.fireEvent("on"+type, event);
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
        // $().on("click", someFn)
        on: function(type, fn) {
            return this.each(function() {
                joe.fn.attach(this, type, fn);
            });
        },

        // $().trigger("click")
        trigger: function(type, fn) {
            return this.each(function() {
                joe.fn.dispatch(this, type);
            });
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
        toggleClass: function(cls) {
            return this.each(function() {
                var e = $(this);
                e.hasClass(cls) ? e.removeClass(cls) : e.addClass(cls);
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
        // ex 1: $.ajax({url: "loc", data: {k: "test x", n: 2}})
        //  --> GET loc?k=test%20x&n=2
        // ex 2: $.ajax({url: "loc", method: "post", data: "str"})
        //  --> POST loc, body == str
        // ex 3: $.ajax({url: "loc", method: "post", data: {key: "value", x: 3.14})
        //  --> POST loc, body == key=value&x=3.14
        ajax: function(config) {
            var req = new XMLHttpRequest(), url = config.url;
            if (!req || !url) return;
            
            var one = function() {};
            var onError = config.error || one,
                onSuccess = config.success || one,
                onComplete = config.complete || one;
            
            var method = (config.method || "GET").toUpperCase();
            var data = config.data;
            if (method == "GET" && typeof data == "object") {
                url = joe.fn.urlcat(url, data);
                data = undefined;
            }
            
            req.open(method, url, !!config.async);
            req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            
            if (method == "POST" && typeof data == "object") {
                data = joe.fn.kvjoin(data);
                req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            }
            
            req.onreadystatechange = function () {
                if (req.readyState != 4 || req.status == 0) return;
                if (req.status != 200 && req.status != 304) {
                    onError(req, req.statusText);
                } else {
                    var type = req.getResponseHeader("content-type"), data = req.responseText;
                    if (type === "application/json" && JSON) data = data && JSON.parse(data);
                    onSuccess(data, req.statusText, req);
                }
                onComplete(req, req.statusText);
            }
            if (req.readyState == 4) return;
            try {
                req.send(data);
            } catch (e) {
                onError(req, req.statusText, e);
                onComplete(req, req.statusText);
            }
        }
    });
    
    joe.fn.extend(joe.fn, joe);
    
    return window.joe = window.$ = joe;

})(window, undefined);