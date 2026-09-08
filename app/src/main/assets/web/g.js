/**
 * Global namespace.
 */
var g = {
   nl2br: function(s){
      if(s){
         s = s.toString();
         s = s.replace(/\n/g, "<br>"); // /\n+/g
      }
      return s;
   },
   niceJson: function(s){
      s = JSON.stringify(s, null, 3);
      s = g.nl2br(s);
      if(s)
         s = s.replace(/\s/g, "&nbsp;");
      return s;
   },
   getParameterByName: function(name) {
      name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
      var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"), results = regex.exec(location.search);
      return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
   },
   formatShortDateTime:
      /**
       * @param {Date} now
       * @param {number} time
       * @returns {String}
       */
   function(now, time){
      var tm = new Date(time);
      var y = tm.getFullYear();
      var s = "";

      if(y===now.getFullYear())
         y = undefined;
      var m = tm.getMonth()+1;
      var d = tm.getDate();
      s = d+'.'+m+'.';
      if(y)
         s += y;
      s += "   " + tm.getHours()+":"+tm.getMinutes();
//      s += ":"+tm.getSeconds();
      /*s = tm.toLocaleString();
      var y = tm.getFullYear();
      if(y===now.getFullYear())
         s = s.replace(y, "").trim();*/
      return s;
   },
   getReadableFileSizeString: function(v){
      var byteUnits = ['B', 'KB', 'MB', 'GB'];
      var i = 0;
      while(v>900 && i<3){
         v /= 1024;
         i++;
      }
      if(i>0){
         if(v<1)
            v = v.toFixed(2);
         else if(v < 10)
            v = v.toFixed(1);
         else
            v = v.toFixed();
      }
      return v+byteUnits[i];
   },
   urlEncode: function(s){
      var a = s.split('/');
      for(var i=a.length; --i>=0; )
         a[i] = encodeURIComponent(a[i]);
      s = a.join('/');
      return s;
   },
   getScrollBarWidth: function(){
      var _in = document.createElement('p');
      _in.style.width = "100%";
      _in.style.height = "200px";

      var out = document.createElement('div');
      out.style.position = "absolute";
      out.style.top = "0px";
      out.style.left = "0px";
      out.style.visibility = "hidden";
      out.style.width = "200px";
      out.style.height = "150px";
      out.style.overflow = "hidden";
      out.appendChild(_in);

      document.body.appendChild(out);
      var w1 = _in.offsetWidth;
      out.style.overflow = 'scroll';
      var w2 = _in.offsetWidth;
      if(w1 == w2)
         w2 = out.clientWidth;
      document.body.removeChild(out);
      return w1 - w2;
   },
    /*
    getCookie: function(name){
       name += "=";
       var ca = document.cookie.split(';');
       for(var i=0; i<ca.length; i++){
          var c = ca[i].trim();
          if(c.indexOf(name) == 0)
             return c.substring(name.length, c.length);
       }
       return null;
    }
    , removeCookie: function(n){
       document.cookie = n+"=; expires=-1";   
    }
    */
 /*, prefs: undefined
    , getPrefs: function(){
       var s = g.getCookie("prefs");
       if(s){
//          log(s);
          try{
             return $.parseJSON(s);
          }catch(ex){
             log(ex.toString());
          }
       }
       return {};
    }
    , savePrefs: function(p){
       var s = JSON.stringify(p);
       var days = 14;
       var d = new Date();
       d.setTime(+d + days * 864e+5);
       document.cookie = "prefs="+s+"; expires="+d.toUTCString();
    },*/
   canUseStorage: typeof(Storage)!=="undefined"/*(function(){
      try{
         return 'localStorage' in window && window['localStorage'] !== null;
      }catch(ex){
         return false;
      }
   }())*/,
   canUseSSE: typeof(EventSource)!=="undefined"/*(function(){
      try{
         return typeof(EventSource)!=="undefined";
      }catch(ex){
         return false;
      }
   }())*/,
   getPref: function(key){
      if(this.canUseStorage){
         try{
            return localStorage.getItem(key);
         }catch(ex){
         }
      }
   },
   getBooleanPref: function(key, defaultVal){
      var v = this.getPref(key);
      if(v)
         return v=="true";
      return !!defaultVal;
   },
   getIntPref: function(key){
      var v = this.getPref(key);
      if(v)
         v = parseInt(v);
      return v;
   },
   setPref: function(key, val){
      if(this.canUseStorage){
         try{
            localStorage.setItem(key, val);
         }catch(ex){
         }
      }
   },
   setSessionPref: function(key, val){
      if(this.canUseStorage){
         try{
            sessionStorage[key] = val;
         }catch(ex){
         }
      }
      
   },
   getSessionPref: function(key){
      if(this.canUseStorage){
         try{
            return sessionStorage[key];
         }catch(ex){
         }
      }
   },
   getExtension: function(fn){
      var v = fn.split('.');
      if(v.length <= 1)
         return null;
      return v.pop();
   },
   getParentPath: function(fn){
      var si = fn.lastIndexOf('/');
      return si == -1 ? null : fn.substring(0, si);
   },
   getMimeTypeBase: function(mt){
      if(mt){
         var sI = mt.indexOf('/');
         if(sI != -1)
            mt = mt.substring(0, sI);
      }
      return mt;
   },
   getMimeSubType: function(mt){
      if(mt)
         mt = mt.substring(mt.indexOf('/') + 1);
      return mt;
   },
   isPathInPath:/**
     * Check if given path (what) is in other path (where).
     */
       function(what, where) {
       var whatL = what.length;
       if(whatL===0)
          return false;
       var whereL = where.length;
       if(whatL > whereL || where.indexOf(what)!==0)
          return false;
       return (whatL===whereL || where.charAt(whatL)==='/' || what==="/");
   },
   isValidFile: function(f, cb){
      if(f.size > 1024 * 100){
         cb(true);
      }else{
         var rd = new FileReader();
         rd.onload = function(r){
            cb(true);
         };
         rd.onerror = function(){
            cb(false);
         };
         // load smaller chunk if possible
         /*
          * if(f.mozSlice) f = f.mozSlice(0, 8); else if(f.webkitSlice) f =
          * f.webkitSlice(0, 8);
          */
         try{
            rd.readAsArrayBuffer(f);
         }catch(ex){
            cb(false);
         }
      }
   },
   getStackTrace: function(){
      try{
         throw new Error("!!!!");
      }catch(ex){
         if(ex.stack){
            var s = ex.stack;
            var i = s.indexOf("!!!!");
            if(i >= 0)
               s = s.substring(i + 5);
            return s;
         }
         /*
          * else if(window.opera && ex.message) return ex.message;
          */
         var cs = [];
         for( var fn = arguments.callee; fn = fn.caller;){
            var n;
            if(fn.name !== undefined)
               n = fn.name || "anonymous";
            else{
               n = fn.toString();
               var exp = /^function ([^\s(]+).+/;
               if(exp.test(n))
                  n = n.split("\n")[0].replace(exp, "$1") || "anonymous";
               else
                  n = "anonymous";
               // n = s.substring(n.indexOf("function") + 8, n.indexOf('')) ||
               // 'anonymous';
            }
            cs.push(n);
         }
         return cs.join('\n');
      }
   },
   htmlEncode: function(v){
      return $('<div/>').text(v).html();
   }
    /*addBookmark: function(url, title){
      if(window.sidebar){ // For Mozilla Firefox Bookmark
         window.sidebar.addPanel(title, url, "");
      }else if(window.external || document.all){ // For IE Favorite
         window.external.AddFavorite(url, title);
      }else if(window.opera){ // For Opera Browsers
         var bm = $("a.jQueryBookmark");
         bm.attr("href", url);
         bm.attr("title", title);
         bm.attr("rel", "sidebar");
      }else{ // for other browsers which does not support
         alert('Your browser does not support bookmark action');
         return false;
      }
   },*/
};

function SpeedCounter(){
   var SECONDS = 16;
   var UPDATES_PER_SEC = 1;
   var TIME_SPAN_BUCKET_MS = 1000/UPDATES_PER_SEC;
   var buckets = [];
   for(var i=0; i<SECONDS*UPDATES_PER_SEC; i++)
      buckets[i] = 0;
   var begT = $.now();
   
   var lastUsedBucket = 0; // number of used buckets, allowing to calculate speed from beginning, improving accuracy up to SECONDS
   var bucketI = 0; // current bucket where we write, from zero up (not capped to buckets.length)

   this.tick = function(bytesCopied){
      var bI = (($.now()-begT)/TIME_SPAN_BUCKET_MS)&0x7fffffff;
      var upd = false;
      while(bucketI!=bI) {
         // clear buckets up to current
         upd = true;
         ++bucketI;
         bucketI &= 0x7fffffff;
         var dI = bucketI%buckets.length;
         if(lastUsedBucket<dI)
            lastUsedBucket = dI;
         buckets[dI] = 0;
      }
      buckets[bI%buckets.length] += bytesCopied;
      return upd;
   };
   
   this.getBytesPerSec = function(){
      var sum = 0;
      for(var i=lastUsedBucket+1; --i>=0; ){
         if(i!=bucketI) // don't count current one
            sum += buckets[i];
      }
      return Math.floor(sum * UPDATES_PER_SEC / lastUsedBucket);
   };
   
   this.isStable = function(){
      return lastUsedBucket*2>=buckets.length;
   };
}