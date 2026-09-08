// https://developers.google.com/closure/compiler/docs/js-for-compiler#types
/*
Debug parameters:

specify device's address:
jsonp=192.168.1.22:1111

debug mode:
debug=<n>
 1 = print debug info, shorter timeout
 2 = simulate actions on server (upload, delete, ...)
 3 = don't connect to server, test UI elements

*/

function log(n) {
   console.log(n);
}
function err(n) {
   console.error(n);
}
function dir(o){
   console.dir(o);
}

function deb(n){
   if(debugMode)
      log(n);
}

function assert(e){
   if(!e){
      // TODO report error
      log("assertion failed");
   }
}

function here(){ log("!!!"); }

var readOnly;

/**
 * @type jQueryObject
 */
var browserPane;  // #browser_pane

/**
 * @type jQueryObject
 */
var titleBar;
var treeList;  // #tree_list
var gridScroll;
var gridIn; // #grid_in
var gridToolbar, butDelete, butRename, butDirNew, butUpload, butGetZip, butMarker;
var filesInfo;
var wrapText = true;

function resized() {
   var win = $(window);
   var winW = win.width();
   var winH = win.height();
//   log("resized h "+winH);

   var h = winH - browserPane.position().top;
   browserPane.css("left", 0);
   
   browserPane.find("#tree_list, #grid_list").height(h);
   gridScroll.height(h - gridToolbar.outerHeight());
   
   divUploads.find("#queue #in").css("max-height", (h)+"px");  // height of uploads queue same as browser height
}


var infoLine;
var divUploads;
/**
 * @type Number
 */
var infoMsgTimeOut;
var showHidden;

/**
 * @type String
 */
var deviceUri = g.getParameterByName("jsonp") || window.location.host;

var debugMode = parseInt(g.getParameterByName("debug"));

/**
 * @param le {jQueryObject}
 */
function bindTexts(le){
   for(var i=1; i<arguments.length; i+=2)
      le.find("#"+arguments[i]).text(arguments[i+1]);
}

/**
 * @param le {jQueryObject}
 * @param b
 */
function bindExpandable(le, b){
   le.find("#exp").attr("expanded", b);
}

var leVolume, leDir, leFile, leMedia;
var popupMenu;
var divProgress;
var menu, cover;
var localizedStrings = [];

function localize(){
   // load localization strings
   $.ajax({
      dataType: "json",
      url: "loc.json?cmd=localize",
      async: false,
      success: function(loc){
         //dir(loc); return;
         localizedStrings = loc;
      },
      error: function(xhr, st){
         showError("Localize failed: "+st);
      }
   });
}

/**
 * @const
 * commands for drag callback
 * Drag callback is called with params:
 *    dragCmd - this const
 *    dt - $(drag target)
 *    this - drag context data
 */
var DRAG_TARGET = 0, DRAG_LEAVE = 1, DRAG_DROP = 2;

/**
 * Drag handling for list entries
 * Additional members used on "this":
 *    copy - set by ctrl key when copy is required instead of move
 *    validDest - set by check if destination is valid
 *    
 */
function leDrag(dragCmd, dt){
   var de = dt.parent(); // dt is ".le_in", so get le from it
   var allowCopyMove = false; // copying not implemented in copyMoveSingleFile
   switch(dragCmd){
   case DRAG_TARGET:
//      logLe(de);
      if(de.closest("#tree_list").length && !isDirExpanded(de)){
         // expand dir in tree list after pointing on it for a while
         this.timer = window.setTimeout(function(){
            onDirClicked(de, DIR_LIST_TREE);
         }, 1000);
      }
      this.setCopying = function(on){
         if(this.copying!==on){
            this.copying = on;
            this.toast.text(localizedStrings[on ? 21 : 22]);
         }
      };
      this.setCopying(false);
      this.toast.show();

      if(allowCopyMove){
         // catch also ctrl for switching copy/move mode
         var _this = this;
         de.attr("tabindex", 0); // for key to work
         de.keydown(function(e){
            if(e.keyCode==17)
               _this.setCopying(true);
         }).keyup(function(e){
            if(e.keyCode==17)
               _this.setCopying(false);
         });
      }
      de.focus();
      
      // check if target is valid
      this.validDest = true;
      var dePath = getLeFullPath(de);
      //log(dePath);
      for(var i=this.sel.length; --i>=0; ){
         var p = getLeFullPath($(this.sel[i]));
//         log(p+" > "+dePath);
         if(g.isPathInPath(p, dePath)){
            this.validDest = false;
            this.markTargetValid(false);
            break;
         }
      }
      break;
   case DRAG_LEAVE:
      if(allowCopyMove){
         de.off("keydown").off("keyup");
         de.removeAttr("tabindex");
      }
      break;
   case DRAG_DROP:
      if(!this.validDest){
         showError("Destination is not valid");
         break;
      }
      askCopyMove(de, this.sel, this.copying);
      break;
   }
}

function deleteDrag(dragCmd, dt){
   switch(dragCmd){
   case DRAG_TARGET:
      this.toast.text(localizedStrings[2]).show();
      break;
   case DRAG_DROP:
      askToDelete(this.sel);
      break;
   }
}

function renameDrag(dragCmd, dt){
   switch(dragCmd){
   case DRAG_TARGET:
      this.toast.text(localizedStrings[3]).show();
      break;
   case DRAG_DROP:
      askRename(this.sel);
      //dir(this.sel);
      //logLe(this.sel);
      break;
   }
}

function zipDrag(dragCmd, dt){
   switch(dragCmd){
   case DRAG_TARGET:
      this.toast.text(localizedStrings[30]).show();
      break;
   case DRAG_DROP:
      opDownloadAsZip(this.sel);
      break;
   }
}

/**
 * Drag handler for auto-scroll tree list.
 */
function dragTreeScroll(dragCmd, dt, data){
   if(dragCmd!=DRAG_TARGET)
      return;
   var up = dt.attr("id")=="up";
   data = data || this;
   //log("scroll "+dt.attr("id"));
   data.timer = window.setTimeout(function(){
      var sTop = treeList.scrollTop();
      var leChld = treeList.find(".le_in");
      var leH = leChld.outerHeight() || 30;
      
      var sTo = sTop + leH * (up ? -1 : 1);
//      treeList.scrollTop(sTo);
      treeList.animate({"scrollTop": sTo}, 75);
      // repeat same
      dragTreeScroll(dragCmd, dt, data);
   }, 100);
}

/**
 * @returns context dragData associated with drag
 * It has members:
 *    sel - collection of le's being dragged (originals)
 *    currTarget - current target
 *    onDrag - curren't target drag callback fnc
 *    timer - timeOut timer associated with current drag target
 *    toast - element moving with mouse and showing toast info
 *    markTargetValid - function to mark if target is valid or not
 */
function onDragBegin(_sel){
   if(!readOnly){
      var fake = function(){};
      setButtonEnabled(butDelete, fake);
      if(_sel.length==1)
         setButtonEnabled(butRename, fake);
      setButtonEnabled(butDirNew, false);
      setButtonEnabled(butUpload, false);
   }
   return {
      sel: _sel,
      onTargeted: function(t){
         this.unTarget();
         this.currTarget = t;
         this.onDrag = window[t.attr("onDrag")];
         t.addClass("drag-hover");
         if(this.onDrag){
            this.onDrag(DRAG_TARGET, t);
         }
      },
      unTarget: function(){
         if(this.currTarget){
            this.currTarget.removeClass("drag-hover");
            this.onDrag(DRAG_LEAVE, this.currTarget);
            this.currTarget = undefined;
            this.onDrag = undefined;
            if(this.timer){
               window.clearTimeout(this.timer);
               this.timer = undefined;
            }
            this.toast.hide();
            this.markTargetValid(undefined);
         }
      },
      drop: function(){
         var dt = this.currTarget;
         if(dt){
            this._onDrag = this.onDrag;
            this.unTarget();
            this._onDrag(DRAG_DROP, dt);
         }
      },
      toast: $("#drag-toast")
   };
}

function elementHitTest(domE, x, y, stop){
   var dt = null;
   // hit test up to root
   for(var e=domE; e!=stop; e=e.parentNode){
      if(e.style["visibility"]=="hidden") // skip hidden
         return false;
      var rc = e.getBoundingClientRect();
      if(!(x>=rc.left && y>=rc.top && x<rc.right && y<rc.bottom))
         return false;
      if(e===domE){
         dt = $(domE);
         if(dt.attr("disabled")) // skip if draggable target is disabledon 
            return false;
         // exception for scrollers
         if(dt.hasClass("drag_scroll"))
            return dt;
      }
   }
   return dt;
}

function onDragMove(ev, dragData){
   
   var x = ev.clientX, y = ev.clientY;
   var stop = browserPane.parent().get(0);
   var currT = dragData.currTarget ? dragData.currTarget.get(0) : null;
   if(currT && elementHitTest(currT, x, y, stop))
      return;  // current target remains, fast quit
   
   // check all drag targets
   var tgts = $("[onDrag]");
   for(var i=tgts.length; --i>=0; ){
      var _dt = tgts[i];
      var dt = elementHitTest(_dt, x, y, stop);
      if(dt){
         // found new target
         dragData.onTargeted(dt);
         return;
      }
   }
   // nothing found
   dragData.unTarget();
}

function onDragEnd(dragData){
   dragData.drop();
   updateMarked();   // to refresh buttons
}

/**
 * Event for mouse-down on draggable items.
 * Drag & drop processing is run here:
 * - install events for mouse move and release
 * - move single le or all marked le's with mouse
 * - calls onDragBegin, onDragMove, onDragEnd to provide sub-functions
 */
function dragMouseDown(ev){
   if(ev.button!==0){
      /*log(ev.button)
      if(ev.button===1)
         processRightClick(ev);*/
      return;
   }
   if(readOnly)
      return;
   var le = $(this).closest(".le");
   if(!getLeParent(le))
      return;
   
   var p = le.parent();
   var sel = p.find(".le[marked]");
   if(!sel.length){
      sel = le;
   }else{
      if(sel.index(le)<0)  // we must really drag marked element
         return;
   }
   var drag = null;  // array of le's
   
   var doc = $(document);
   doc.on("mousemove", function(e){
      if(!drag){
         var dX = e.clientX - ev.clientX; dX *= dX;
         var dY = e.clientY - ev.clientY; dY *= dY;
         var d = Math.sqrt(dX+dY);
         if(d < 5)  // watch treshold
            return;
         // really start dragging now
         drag = [];
         
         sel.each(function(){
            var d = {
                  le: $(this)
            };
            var le = d.le.clone(); // make copy of le for dragging
            d.leDrag = le;
            //logLe(_le)
            le.find("[onDrag]").removeAttr("onDrag");
            le.addClass("dragged");   // this makes it have special look, and position: fixed
            p.append(le);   // add it to same parent, so that it has same look
            
            le.width(d.le.width()); // retain width (mainly for tree view)
            
            d.le.css("visibility", "hidden");
            
            var leOffs = d.le.offset();
            le.offset(leOffs);  // position it
            d.relOffsX = leOffs.left - ev.clientX;
            d.relOffsY = leOffs.top - ev.clientY;
            
            drag.push(d);
         });
         drag.data = onDragBegin(sel);
//         t.text(localizedStrings[21]);
//         t.show();
         drag.data.markTargetValid = function(is){
            var cls = "drag-target-invalid";
            drag.forEach(function(sd){
               if(is===false)
                  sd.leDrag.addClass(cls);
               else
                  sd.leDrag.removeClass(cls);
            });
         };
      }
      drag.forEach(function(sd){
         sd.leDrag.offset({ "left": e.clientX + sd.relOffsX, "top": e.clientY + sd.relOffsY });
      });
      drag.data.toast.offset({ "left": e.clientX + 0, "top": e.clientY + 30 });
      onDragMove(e, drag.data);
   });
   doc.one("mouseup", function(e){
      doc.off("mousemove");
//      return;  // TEST
      if(drag){
         drag.forEach(function(d){
            d.leDrag.remove();
            d.le.css("visibility", "visible");
         });
         onDragEnd(drag.data);
      }
   });
   // cancel out any text selections
//   document.body.focus();
   
   // prevent text selection in IE
   //document.onselectstart = function(){ return false; };
   // prevent IE from trying to drag an image
   //target.ondragstart = function() { return false; };
   return false;
}

function flashReadOnly(){
   var rd = $("#read_only");
   if(!rd.is(":animated")){
//   rd.stop(true, false);
      var off = { opacity: .2 }, on = { opacity: 1 }, tm = 100;
      for(var i=0; i<3; i++)
         rd.animate(off, tm).animate(on, tm);
   }
}

function deDrag(ev){
   if(readOnly){
      flashReadOnly();
      ev.originalEvent.preventDefault(); // 🚀 强行阻断拖拽默认行为，防止越界上传
      ev.originalEvent.stopPropagation();
      return;
   }
   ev = ev.originalEvent;
   ev.stopPropagation();
   ev.preventDefault();
   var dt = ev.dataTransfer;
   var t = ev.type;
   var el = $(this);
   if(t=="dragenter"){
      $(".drag-hover").removeClass("drag-hover");
      el.addClass("drag-hover");
      try{ dt.effectAllowed = "copy"; }catch(e){}
   }else if(t=="dragover"){
      dt.dropEffect = "copy";
      el.addClass("drag-hover");
   }else if(t=="dragleave" || t=="dragend" || t=="drop"){
      el.removeClass("drag-hover");
   }
   if(t=="drop"){
      var de = (this == gridIn[0]) ? currentDir : el.closest(".le");
      startUploadOfFiles(de, dt.files, dt.items);
   }
}

function gridListDrag(ev){
   if(!currentDir)
      dragPrevent(ev);
   else{
//      $(this).addClass("debug");
      deDrag.call(this, ev);
   }
}

function dragPrevent(ev){
   ev = ev.originalEvent;
   var dt = ev.dataTransfer;
   var t = ev.type;
   if(t=="dragenter"){
      try{
         dt.effectAllowed = "none";
      }catch(e){}
   }else if(t=="dragover"){
      dt.dropEffect = "none";
   }
   ev.preventDefault();
   ev.stopPropagation();
}

function processRightClick(ev){

   var marked = getMarkedLeInGrid();
   if(marked.length)
      return;
   
   var le = $(this).closest(".le");
   var fileName = getLeName(le);
   
   var pm = popupMenu.clone();
   pm.find("#title").text(fileName);
   var itmTempl = pm.find("#item");
   var itemsDiv = itmTempl.parent();
   itmTempl.remove();

   var dir = isDir(le);
   var isRoot = !getLeParent(le);
   var hidden = isLeHidden(le);
   function _isDir(){ return dir; }

   function canHideUnhide(){
      return dir && !isRoot && fileName.charAt(0)!=='.';
   }
   
   // init items
   var items =
      [
       { text: 7, icon: "img/op_new_folder.png", isEnabled: function(){ return dir && !readOnly; }, fn: opNewDir }
       , { text: 2, icon: "img/op_delete.png", isEnabled: function(){ return !readOnly && !isRoot; }, fn: opDelete }
       , { text: 3, icon: "img/op_rename.png", isEnabled: function(){ return !readOnly && !isRoot; }, fn: opRename }
       , { text: 30, icon: "img/download_zip.png", fn: opDownloadAsZip }
       , { text: 31, icon: "img/download.png", isEnabled: function(){ return !dir; }, fn: opDownload }
       , { text: 32, icon: "img/op_hide.png", isEnabled: function(){ return canHideUnhide() && !hidden; }, fn: function(){ opHideUnhide(le, true); } }
       , { text: 33, icon: "img/op_unhide.png", isEnabled: function(){ return canHideUnhide() && hidden; }, fn: function(){ opHideUnhide(le, false); } }
       ];
   
   var numItems = 0;
   for(var i=0; i<items.length; i++){
      var def = items[i];
      if(def.isEnabled && !def.isEnabled())
         continue;
      var itm = itmTempl.clone();
      itm.find("#text").text(localizedStrings[def.text]);
      itm.find("img").attr("src", def.icon);
      itm.click(def.fn, function(e){
         unCover();
         e.data(le);
      });
      itemsDiv.append(itm);
      ++numItems;
   }
   if(!numItems){
      deb("No menu items");
      return;
   }
   
   var body = $("body");
   body.append(pm);
   
   var win = $(window);
   
   var pmW = pm.width(), pmH = pm.height();
   pm.css("left", Math.min(win.width()-pmW, Math.max(0, ev.clientX - pmW/2)));
   
   var winH = win.height();
   var y = ev.clientY;
   if(y+pmH >= winH){
//      if(y<winH/2)
//      y = y - pmH;
      y = winH - pmH;
   }
   pm.css("top", y);
   pm.show();
   coverShow(function(){
      pm.fadeOut("fast", function(){
         pm.remove();
      });
   });
   
   return false;
}

/**
 * Handles uploading of files.
 */
function UploadTask(){

   deb("Creating upload task");
   // one-time append progress circle
   if(divUploads.find("#progress-circle").length==0)
      divUploads.append(divProgress.clone());

   var queue = divUploads.find("#queue");
   var _prog = divUploads.find("#progress");
   var queueIn = queue.find("#in");
   var pinned = false;
   queue.find("#title").off().click(function(){
      pinned = true;
   });
   
   var fileTempl = divUploads.find(".file");
   fileTempl.hide();
   
   var cancelAll = queue.find("#cancel_all");

   var currFile = null; // {jQueryObject}
   var isQueueVisible = false;
   
   function finished(){
      currFile = null;
      cancelAll.off();
      divUploads.fadeOut("fast");
      uploadTask = null;
      deb("Upload task done");
   }
   
   cancelAll.off().one("click", function(){
      deb("Cancel all uploads");
      // simply simulate as if all cancel buttons were clicked
      divUploads.find(".file #cancel").trigger("click");
      finished();
   });

   var $Pos = _prog.find("#pos"), $Perc = _prog.find("#percent");
   var stat = _prog.find("#stat");
   var cnt = divUploads.find("#counter");
   var remTime = queue.find("#remain_time");
   remTime.text("");
   cnt.hide();

   var speedCnt = new SpeedCounter();
   var lastPercent = -1, lastPos = 0;

   function progress(currPos, totalPos){
      var p = totalPos ? Math.floor(currPos / totalPos * 100) : 0;
      if(lastPercent!==p){
         lastPercent = p;
         p += '%';
         $Pos.css("width", p);
         $Perc.text(p);
      }
      if(currPos){
         var d = currPos - lastPos;
         if(speedCnt.tick(d)){
            var bytesPerSec = speedCnt.getBytesPerSec();
            var s = g.getReadableFileSizeString(bytesPerSec)+"/s";
            stat.text(s);
            if(//isQueueVisible &&
                  speedCnt.isStable()){
               if(bytesPerSec){
                  var leftSize = 0;
                  var q = queue.find(".file");
                  for(var i=q.length; --i>=0; ){
                     var divF = $(q[i]);
                     var f = divF.data("file");
                     if(f && !getDirectoryObject(divF.data("fsEntry")))
                        leftSize += f.size;
                  }
                  leftSize += totalPos - currPos;
                  var t = Math.floor(leftSize / bytesPerSec + .5);
//                  log(t)
                  s = '-';
                  if(t>3600){
                     s += Math.floor(t / 3600);
                     t %= 3600;
                  }
                  var m = Math.floor(t / 60);
                  if(m<10) s += '0';
                  s += m;
                  s += ':';
                  var _s = t%60;
                  if(_s<10) s += '0';
                  s += _s;
               }else
                  s = '?'; // zero transfer rate, unknown time
               remTime.text(s);
            }
         }
      }else{
         stat.text('');
      }
      lastPos = currPos;
   }
   progress(0, 0);
   
   var numAdded = 0, numStarted = 0, numUploaded = 0;
   this.showCounter = function(){
      if(numAdded>1){
         cnt.text(numStarted+"/"+numAdded);
         cnt.show();
      }else
         cnt.hide();
   };

   var currXhr = null;

   var _this = this;
   var currDirRefreshTimer = 0;
   var volFreeSpace = null;

   function getDirectoryObject(fsEntry){ // return FileSystemDirectoryEntry or null
      if(fsEntry!=null && fsEntry.isDirectory)
         return fsEntry;
      return null;
   }

   this.startNext = function(){
      var divF = queue.find(".file:first");
      if(divF.length==0){
         finished();
         if(numUploaded)
            showInfoMsg("Files uploaded: "+numUploaded);
         return;
      }
      ++numStarted;
      this.showCounter();
      
      divF.stop(true, true);
      divUploads.append(divF);   // make the file current one
      currFile = divF;
      var file = divF.data("file");
      var fsEntry = divF.data("fsEntry"); // FileSystemEntry; may be null
      deb("Starting upload: "+file.name);
      var de = divF.data("de");
      var path = divF.data("path");

      var cleanDiv = function(){
         divF.remove();
         currFile = null;
      }
      var cleanAndNext = function(){
         cleanDiv();
         _this.startNext();
      }
//      dir(file)
      var fsDir = getDirectoryObject(fsEntry);
      if(fsDir){
         deb("Upload item is directory: "+fsDir.name);
         cleanDiv(); // remove the dir from list
         var basePath = path+'/';
         var addFile = function(f, entry){
            _this.add(de, basePath, f, entry, true);
         }
         // start reading content of dir async, keep the dir entry in list while doing it
         var reader = fsDir.createReader();
         var readCb = function(files){
             // resolve one file at time
             var i = 0;
             var resolveEntry = function(){
                while(i<files.length){
                   var entry = files[i++];
                   if(entry.isFile){
                      // getting file is done async, continue in callback
                      entry.file(function(f){
                         addFile(f, entry);
                         resolveEntry();
                      });
                      return;
                   }else if(entry.isDirectory){
                      // pass entry in place of 'file', enough is that it has 'name' property
                      addFile(entry, entry);
                   }else
                      continue;
                }
                if(files.length!=0)
                   reader.readEntries(readCb, cleanAndNext);
                else
                   _this.startNext();
             };
             resolveEntry();
          }
         reader.readEntries(readCb, cleanAndNext);
         return;
      }

      g.isValidFile(file, function(is){
         if(!is){
            // guess that it is folder
            showError("Folders can't be uploaded: "+file.name);
            cleanAndNext();
            return;
         }
         progress(0, 0);
//         log(path)
         
         var onSuccess = function(js){
            var len = js["length"];
            deb("Upload success "+len);
            currFile = null;
            
            volFreeSpace = js["vol_free_space"] || volFreeSpace;
            if(entriesEqual(de, currentDir)){
               // refresh current dir (not too frequently)
               if(!currDirRefreshTimer){
                  currDirRefreshTimer = setTimeout(function(){
                     currDirRefreshTimer = 0;
                     if(entriesEqual(de, currentDir)){ // still same?
                        deb("Refresh curr dir");
                        onDirClicked(de, DIR_LIST_GRID);
                        if(volFreeSpace){
                           var ve = getLeVolume(de);
                           if(ve)
                              bindVolumeSize(ve, volFreeSpace);
                           volFreeSpace = null;
                        }
                     }
                  }, 1000);
               }
            }
            divF.remove();
            ++numUploaded;
            _this.startNext();
         };
         if(debugMode>=2){
            if(debugMode>=4)
               return;
            // simulate upload
            var p = 0;
            var t = 0;
            t = window.setInterval(function(){
               p += 4;
               if(p>=100){
                  clearInterval(t);
                  onSuccess({"length": file.size, "vol_free_space": 98765});
               }else
                  progress(Math.floor(file.size*p/100), file.size);
            }, 100);
            currXhr = { abort: function(){ clearInterval(t); }};
            return;
         }
         var cmd = "cmd=file" + "&size="+file.size + "&file_date="+file.lastModified;
         cmd = appendFileSystemParam(de, cmd);
         currXhr = ajaxCall(path, cmd, onSuccess, null, "POST", true, {
            xhr: function(){
               // customize xhr
               var x = $.ajaxSettings.xhr();
               if(x.upload){
                  x.upload.addEventListener('progress', function(e){
                     progress(e.loaded, e.total);
                  });
               }
               return x;
            },
            data: file,
            error: function(xhr, st){
               deb("Upload failure: "+st);
               cleanDiv();
               if(st!="abort"){
                  showError("Upload error: "+st);
//                  finished();
                  _this.startNext();
               }
            },
//            contentType: false,
            processData: false
         });
      });
   };
   this.add = function(de, basePath, file, fsEntry, prepend){
      // add file element to queue
      var path = basePath+file.name;
      var divFile = fileTempl.clone();
      divFile.data("de", de).data("file", file).data("path", path).data("fsEntry", fsEntry);
      divFile.find("#name").text(file.name);
      {
         var size = "";
         if(!getDirectoryObject(fsEntry))
            size = g.getReadableFileSizeString(file.size);
         divFile.find("#size").text(size);
      }
//      log(path);
      
      divFile.find("#cancel").click(function(){
         divFile.remove();
         --numAdded;
         if(currFile && divFile.get(0)===currFile.get(0)){
            deb("Cancel active upload");
            --numStarted;
            currFile = null;
            if(currXhr){
               currXhr.abort();
               currXhr = null;
            }
            var q = "cmd=delete";
            q = appendFileSystemParam(de, q);
            // try to delete the file (no error checking)
            ajaxCall(path, q, function(js, task){
               //deb("Deleted "+js["ok"]);   // may be false, since server also deletes incomplete transfers
            }, null, "DELETE");
            _this.startNext();
         }else{
            deb("Cancel scheduled upload");
            _this.showCounter();
         }
         if(numAdded<=1)
            cnt.hide();
      });

      if(!prepend)
         queueIn.append(divFile);
      else
         queueIn.prepend(divFile);
      divFile.show();
      
//      divFile.slideDown("fast");

      ++numAdded;
   };

   var qHideTimer = 0;
//   var QUEUE_HIDE_SPEED = 250;

   function showQueue(){
//      queue.stop(true, true);
//      queue.slideDown(QUEUE_HIDE_SPEED);
//      remTime.text("");
      queue.show();
      queueIn.scrollTop(queueIn.prop("scrollHeight"));
      if(qHideTimer){
         clearTimeout(qHideTimer);
         qHideTimer = 0;
      }
   }
   function hideQueue(){
//      queue.slideUp(QUEUE_HIDE_SPEED);
      queue.hide();
   }
   function hideQueueWithDelay(delay){
      if(!qHideTimer)
         qHideTimer = setTimeout(function(){
            qHideTimer = 0;
            hideQueue();
         }, delay);
   }
   
   var bar = $("#bottom_bar");
   divUploads.hover(function(ev){
      isQueueVisible = ev.type=="mouseenter";
      //deb(ev.type);
      if(isQueueVisible){
         bar.css("z-index", 11);
         coverShow(function(){
            queue.stop(true, false);
            hideQueue();
            bar.css("z-index", "");
            pinned = false;
         });
//         initCoverClick();
         showQueue();
      }else{
         if(!pinned)
            unCover();
      }
   });
   /*queue.show();
   hideQueueWithDelay(1000);*/
   queue.hide();
   
   /*this.shortShowQueue = function(){
      if(!isQueueVisible){
         showQueue();
         hideQueueWithDelay(2000);
      }
   };*/
   divUploads.fadeIn("slow");
   
}

var uploadTask = null;

function startUploadOfFiles(de, files, items){
   var create = !uploadTask;
   if(create)
      uploadTask = new UploadTask();

   var basePath = getLeFullPath(de)+'/';
   for(var i=0; i<files.length; i++){
      var fsEntry = null;
      if(items!=null && items.length==files.length){
         var item = items[i];
         if(item && (typeof item.webkitGetAsEntry === "function")){
            fsEntry = item.webkitGetAsEntry();
            // check for Mozilla's window.FileSystemEntry, as it doesn't work properly on Chrome - FileSystemFileEntry.file() hangs
            /*try{
               if(!(fsEntry instanceof FileSystemEntry))
                  fsEntry = null;
            }catch(e){
               fsEntry = null;
            }*/
            //if(fsEntry.constructor.name != "FileSystemEntry")
         }
      }
      uploadTask.add(de, basePath, files[i], fsEntry);
   }
   
   uploadTask.showCounter();
//   uploadTask.shortShowQueue();
   if(create)
      uploadTask.startNext();
}

function bindDragAndDropEvents(el, fn){
   el.on("dragenter", fn)
      .on("dragover", fn)
      .on("dragleave", fn)
      .on("dragend", fn)
      .on("drop", fn);
}

function cssBgndImg(e, url){
   e.css("background-image", 'url("'+url+'")');
}

var canPlayVideoMp4 = false
var canPlayAudioMap = {}

function canPlayAudio(mime){
   if(mime===undefined)
      return false
   var can = canPlayAudioMap[mime]
   if(can===undefined){
      can = false
      var a = $("<audio>")[0];
      if(a instanceof HTMLMediaElement && a.canPlayType)
         can = !!a.canPlayType(mime);
      canPlayAudioMap[mime] = can
   }
   return can
}

function detectMediaFeatures(){
   var v = $("<video>")[0];
   if(v instanceof HTMLMediaElement && v.canPlayType)
      canPlayVideoMp4 = !!v.canPlayType("video/mp4");
   
   /*var a = $("<audio>")[0];
   if(a instanceof HTMLMediaElement && a.canPlayType)
      //canPlayAudioMp3 = !!a.canPlayType("audio/mpeg");
      canPlayAudioMp3 = canPlayAudio("audio/mpeg");*/
}

function onReady(){

   showHidden = g.getBooleanPref("showHidden", false);
    //   $(".button").button();
   var win = $(window);
   win.resize(resized);
   win.on("beforeunload", beforePageClose);
   infoLine = $("#info_line #in");
   infoLine.hide();
   
   divUploads = $("#uploads");
   if(debugMode==3) divUploads.show();

     //   showInfoMsg("Ha ha\nLopo");
   browserPane = $("#browser_pane");
   cover = $(".cover");
   cover.on("contextmenu", function(){ unCover(); return false; });
   cover.click(unCover);
   var body = $("#body");
   body.on("contextmenu", function(ev){
      //      console.dir(ev);
      return false;
   });
   localize();
   
   treeList = browserPane.find("#tree_list");
   var gl = browserPane.find("#grid_list");
   gridScroll = gl.find("#grid_scroll");
   gridIn = gl.find("#grid_in");
   bindDragAndDropEvents(gridIn, gridListDrag);
   gridToolbar = gl.find("#toolbar");

   filesInfo = gridToolbar.find("#files_info");
   var repo = $("#repo");
   /*if(debugMode)
      repo.show();*/
   
   if(debugMode)  // show all debug elements
      $(".debug").show();
   {
      // fix pane to include scrollbar width
      var sw = g.getScrollBarWidth();
      var e = gl.find("#grid_in");//browserPane;
      var w = parseInt(e.css("width"));
      e.css("width", (w+sw)+"px");
   }
   var bgnd = $("#bgnd-img");
   {
      var wallpaper = g.getPref("bgnd");
      if(wallpaper)
         cssBgndImg(bgnd, wallpaper);
   }

   buttonDef = repo.find(".but");

   leVolume = repo.find("#le_volume");
   leDir = repo.find("#le_dir");
   leFile = repo.find("#le_file");
   leMedia = repo.find("#le_media");
   popupMenu = repo.find("#popup");

   leDir.find(".le_in").mousedown(dragMouseDown);

   {
      var leDirs = leVolume.add(leDir);
      
      var varleDirsIn = leDirs.find(".le_in");
      varleDirsIn.click(onDirInClicked);
      bindDragAndDropEvents(varleDirsIn, deDrag);
      leDir.hover(dirHover);
   }

   var leFiles = leFile.add(leMedia);
   leFiles.click(onEntryClicked).mousedown(dragMouseDown);
   //   bindDragAndDropEvents(leFiles, dragPrevent);

   repo.find(".le_in").on("contextmenu", processRightClick);
   $(".le #mark").click(onMarkClicked);
   
   body.keydown(onKeyDown);
   
   divProgress = repo.find("#progress-circle");
   
   $(".but").each(function(){
      if(this===buttonDef.get(0))
         return;
      var el = $(this);
      var b = buttonDef.clone();
      $.each(this.attributes, function(){
         if(this.name==="img")
            return;
         if(this.value)
            b.attr(this.name, this.value);
      });
      var img = el.attr("img");
      if(img){
         if(img.indexOf("/")==-1)
            img = "img/"+img+".png";
         //log(img);
         cssBgndImg(b.find(".icon"), img);
      }
      var h = el.html();
      if(h)
         b.html(b.html()+h);
      
      el.replaceWith(b);
      b.dblclick(function(ev){ ev.stopPropagation(); ev.preventDefault(); });
   });
   
   butDelete = gridToolbar.find("#delete");
   butRename = gridToolbar.find("#rename");
   butDirNew = gridToolbar.find("#dirNew");
   butUpload = gridToolbar.find("#upload");
   butGetZip = gridToolbar.find("#get_zip");
   butMarker = gridToolbar.find("#marker");
   /*$('#description').perfectScrollbar({
      wheelSpeed: 40,
      wheelPropagation: false
   });*/
   menu = $("#menu");
     //   menu.click(menuClick);
   menu.hover(function(){
      menuHover(1);
   }, function(){
      menuHover();
   });

   browserPane.show();
   resized();

   titleBar = $("#title_bar");

   // disable accidental drag&drop on page to redirect to the file
   bindDragAndDropEvents(browserPane.add(bgnd).add(titleBar).add(cover), dragPrevent);

   titleBar.show();
   updateMarked();

   // preload images
   new Image().src = "img/popup_item.png";

   detectMediaFeatures();

   if(debugMode)
      showInfoMsg("Ready!");

   if(!debugMode || debugMode<=2){
      var dir = g.getSessionPref("currDir");
      listRoot(dir);
   }

   if(debugMode===4)
      debugStartMediaViewer();
   if(debugMode===5)
      debugStartAudioPlayer();
   if(debugMode===6)
      debugStartTextViewer();
    //   askPassword();
   // ================= 树状图革命：终极全局拦截委托 (无延迟对齐版) =================
   treeList.off("click", "#exp").on("click", "#exp", function(ev){
      ev.stopPropagation();
      ev.preventDefault();
      
      var expIcon = $(this); 
      var de = expIcon.closest(".le"); 
      
      // 物理核心升级：直接获取当前属性，如果为 undefined、空字符串或 "false"，统统视为需要展开的闭合状态
      var currentStatus = expIcon.attr("expanded");
      var isExpanded = (currentStatus === "true");
      
      if (!isExpanded) {
         // 闭合 -> 展开：一瞬间强行卡死 DOM 属性为字符串 "true"，让 CSS 没有任何踩空机会，立刻变减号！
         expIcon.attr("expanded", "true"); 
         
         var path = de.data("fullPath");
         listDir(path, de, DIR_LIST_TREE); 
      } else {
         // 展开 -> 闭合：一瞬间强行卡死 DOM 属性为字符串 "false"，立刻变加号！
         expIcon.attr("expanded", "false"); 
         
         de.find(".le").remove(); 
         
         if(currentDir && isEntryChildOf(currentDir, de, true)){
            setCurrentDir(de);
            listDir(getLeFullPath(de), de, DIR_LIST_GRID);
         }
      }
   });
   // =========================================================================
}

function centerDialog(d){
   d.css("margin-left", "-"+(d.outerWidth()/2)+"px");
   d.css("margin-top", "-"+(d.outerHeight()/2)+"px");
}

/**
 * Show dialog.
 * @param d = dialog
 * @param showCoverCb = function to call when cover is dismissed
 */
function showDialog(d, showCoverCb){
   if(showCoverCb){
//      initCoverClick();
      coverShow(function(){
         showCoverCb();
//         d.hide();
         d.fadeOut(100);
      });
   }
   centerDialog(d);
//   d.show();
   d.fadeIn(100);
   return d;
}

function opReloadPage(){
   $(window).off("beforeunload");
   location.reload();
}

function beforePageClose(ev){
//   log("page close");
   if(uploadTask)
      return "Uploads are in progress. Close page anyway?";
   var textEd = $("#text_view");
   if(textEd.is(":visible") && textEd.hasClass("dirty"))
      return "Text editor has unsaved changes.";
}


function showInfoMsg(msg, isError){
   
   if(infoMsgTimeOut){
      window.clearInterval(infoMsgTimeOut);
      infoMsgTimeOut = 0;
   }
   var _e = infoLine.find("#msg");
   msg = g.nl2br(msg);
   _e.html(msg);
   infoLine.stop(true);
   infoLine.fadeTo(0, 1);
   var l = msg.length;
   l = Math.max(4000, Math.min(15000, l*40));
//   log(l);
   infoLine.find("#icon").attr("err", isError ? 1 : 0);
   
   if(debugMode===3) return;
   infoMsgTimeOut = window.setTimeout(function(){
      infoMsgTimeOut = 0;
      infoLine.fadeOut(500);
   }, l);
}

function showError(msg){
   if(!msg){
      log("undefined error");
      return;
   }
   showInfoMsg(msg, true);
}

/**
 * @param a {Object}
 * @param b {Object}
 * @returns {Number}
 */
function sortEntries(a, b){
   // first sort by type
   var tD = a.t-b.t;
   if(tD!=0)
      return tD;
   // equal types sort by name
   return a.n.toLowerCase().localeCompare(b.n.toLowerCase());
}

function prepareFileUri(uri){
   if(deviceUri)
      uri = "http://"+deviceUri+uri;
   return uri;
}

function bindTitle(le, name, isTree){
   var tit = le.find("#title");
   tit.text(name);
   showEllipsizedTextAsTitle(tit, isTree);
}

function showEllipsizedTextAsTitle(e, isTree){
   e.one("mouseenter", e, function(ev){
      var e = ev.data;
      if(isTree){
         if(this.offsetWidth<this.scrollWidth)
            e.attr("title", e.text());
      }else
      if((this.offsetLeft+this.offsetWidth) >= this.parentElement.offsetWidth)
         e.attr("title", e.text());
   });
   
}

function bindIconUri(le, uri){
   uri = prepareFileUri(uri);
   uri = uri.replace("'", "\\'");   // escape all single quotes, used below
   cssBgndImg(le.find("#icon"), uri);
}

/**
 * @param le {jQueryObject}
 * @param iconId {Number}
 */
function bindIconId(le, iconId){
   if(iconId){
      var uri = "/" + iconId+"?cmd=res_id";
//      log(uri);
      bindIconUri(le, uri);
   }
}

function bindAppIcon(le, ext){
   var uri = (ext === "apk") ? getLeFullPath(le) : "/" + ext;
   uri += "?cmd=ext_icon";
   bindIconUri(le, uri);
}

function bindThumbnail(ie, path){
   var uri = g.urlEncode(path)+"?cmd=thumbnail";
//   log(uri);
   bindIconUri(ie, uri);
}

/**
 * @constructor
 * @param le {jQueryObject}
 */
function BackgroundTask(le){
   this.le = le;
   if(le){
      le.find(".le_in").first().append(divProgress);
   }else
      gridIn.append(divProgress);
//   this.initTimeOut();
}

BackgroundTask.prototype = {
   le: null,
   finished: function(){
      if(currTask==this){
         currTask = null;
         divProgress.remove();
      }
   },
   cancel: function(){
      this.canceled = true;
      this.finished();
   },
   onError: function(status){
      this.finished();
      log("bgndtask err: "+status);
   }
};

/**
 * @type BackgroundTask
 */
var currTask;

function setCurrTask(t){
   if(currTask!=t){
      if(currTask)
         currTask.cancel();
      currTask = t;
   }
}

var currentDir;
var currNoSep;

function getLeParent(le){
   if(!le)
      return null;
   return le.data("parent");
}

/**
 * Set button enabled or disabled.
 * @param b {jQueryObject}
 * @param clickCb {Function} for click or null to disable
 */
function setButtonEnabled(b, clickCb, force){
   var isEn = !b.attr("disabled");
   var en = !!clickCb;
   if(en!=isEn || force){
      b.off("click");
      if(en){
         b.removeAttr("disabled");
         b.click(function(){ clickCb(); }); // must have anonymous, clickCb is called without 'event' param
      }else
         b.attr("disabled", "1");
   }
}


/**
 * @param de {jQueryObject}
 */
function setCurrentDir(de){
   if(de)
      de = getDirInTreeList(de);
   if(currentDir)
      currentDir.removeAttr("active");
   if(currNoSep)
      currNoSep.removeClass("no_separator");
   currentDir = de;
   if(de)
      de.attr("active", true);
   
   // activate buttons
   setButtonEnabled(gridToolbar.find("#dirUp"), getLeParent(currentDir) ? opUpDir: null);
   if(de){
      // fix separator around active dir
      var p = de.prev();
      if(!p || !p.hasClass("le")){
         p = de.parent();
         if(!p.hasClass("le"))
            p = null;
      }
      if(p){
         p = p.find(".le_in").first();
         p.addClass("no_separator");
      }
      currNoSep = p;
   }else{
      setButtonEnabled(butDirNew, false);
      setButtonEnabled(butUpload, false);
      filesInfo.find("#num_marked").hide();
      filesInfo.hide();
   }
   g.setSessionPref("currDir", getLeFullPath(de));
}

function getAllLeInGrid(){
   return gridIn.find(".le");
}

function getMarkedLeInGrid(){
   return gridIn.find(".le[marked]");
}

function collapseDir(de, inTreeOnly){
   var chld = de.find(".le");
   if(!inTreeOnly)
      chld = chld.add(getAllLeInGrid());
   chld.remove();
   // set collapsed expand mark
   if(!de.data("no_children"))   // but only if there're files inside 
      bindExpandable(de, "false");
}

/**
 * @param de {jQueryObject}
 */
function collapseAllSiblings(de){
   while(true){
      de.siblings(".le").each(function(i, v){
         collapseDir($(v), true);
      });
      de = de.parent(".le");
      if(!de.length)
         break;
   }
}

function getFileNameWithouPath(fn){
   return fn.substring(fn.lastIndexOf('/')+1);
}

function getLeFullPath(le){
   return le.data("fullPath");
}

function getLeName(le){
   var p = getLeFullPath(le);
   return getFileNameWithouPath(p);
}

function getLeUri(le, type){
   var path = getLeFullPath(le);
   var uri = g.urlEncode(path)+"?cmd="+type;
   uri = appendFileSystemParam(le, uri);
   uri = prepareFileUri(uri);
   return uri;
}

function getLeVolume(le){
   while(le && le.attr("id")!="le_volume")
      le = getLeParent(le);
   //return le.closest("#le_volume");
   return le;
}

function appendFileSystemParam(le, uri){
   var fs = le.data("fs");
   if(fs)
      uri += "&fs="+fs;
   return uri;
}

function getLeFileUri(le){ return getLeUri(le, "file"); }
function getLeImageUri(le){ return getLeUri(le, "image"); }
function getLeThumbnailUri(le){ return getLeUri(le, "thumbnail"); }

function isDir(le){
   return le.data("dir");
}

function isLeHidden(le){
   return le.attr("le_hidden");
}

function logLe(le){
   if(le)
      log(getLeFullPath(le));
}

/**
 * @param le {jQueryObject}
 * @param de {jQueryObject}
 */
function isEntryChildOf(le, de, orEquals){
   var leP = getLeFullPath(le), deP = getLeFullPath(de);
   if(g.isPathInPath(deP, leP)){
      if(orEquals || leP!=deP)
         return true;
   }
}

function entriesEqual(l1, l2){
   if(!l1 || !l2)
      return false;
   return getLeFullPath(l1)==getLeFullPath(l2);
}

var numMarked = 0;

function updateMarked(){
   var leAll = getAllLeInGrid();
   var leM = leAll.filter("[marked]");
   numMarked = leM.length;
   
   setButtonEnabled(butDirNew, canCreateDir() ? opNewDir : null);
   setButtonEnabled(butUpload, canCreateDir() ? opUpload : null);
   setButtonEnabled(butDelete, canDelete() ? opDelete : null);
   setButtonEnabled(butRename, canRename() ? opRename : null);
   //var markTit;
   var markIc;
   butMarker.off("click");
   //log("numM: "+numMarked + ", numA: "+leAll.length);
   if(numMarked==0){
      //markTit = "Mark all";
      markIc = "on";
      butMarker.click(markAll);
   }else{
      //markTit = "Clear marks";
      markIc = "off";
      butMarker.click(clearAllMarked);
   }
   cssBgndImg(butMarker.find(".icon"), "img/check_marker_"+markIc+".png");
   //log(allM.length);
   var numM = filesInfo.find("#num_marked");
   if(numMarked==0)
      numM.hide();
   else{
      numM.find("#text").text(numMarked);
      numM.show();
   }
}

function setLeMark(le, on){
   le = le.add(le.data("treeLe")).add(le.data("gridLe"));  // set mark on both 
   if(on)
      le.attr("marked", 1);
   else
      le.removeAttr("marked");   
}

function toggleMarked(le){
   setLeMark(le, !le.attr("marked"));
   updateMarked();
}


function markAll(){
   getAllLeInGrid().each(function(){
      setLeMark($(this), true);
   });
   updateMarked();
}

function clearAllMarked(){
   var m = getMarkedLeInGrid();
   if(m.length){
      //m.removeAttr("marked");
      getAllLeInGrid().each(function(){
         setLeMark($(this), false);
      });
      updateMarked();
   }
}

function onMarkClicked(ev){
   var le = $(this).closest(".le");
   toggleMarked(le);
   ev.stopPropagation();
}

function getDirInTreeList(de){
   var treeLe = de.data("treeLe");
   if(treeLe) // having dir in grid, get one in tree pane
      de = treeLe;
   return de;
}

function onDirClicked(de, listMode){
   if(listMode===undefined)
      listMode = DIR_LIST_DEFAULT;
   de = getDirInTreeList(de);
   var path = getLeFullPath(de);
   listDir(path, de, listMode);
   
   if((listMode&DIR_LIST_GRID)!==0)
      setCurrentDir(de);
}

function onDirInClicked(ev){
   var de = $(this).closest(".le"); // get actual le, as clicks are detected on .le_in
   
   if(ev.ctrlKey){
      toggleMarked(de);
   }else{
      clearAllMarked();
      onDirClicked(de);
   }
}

function isDirExpanded(de){
   return de.find("#exp").attr("expanded")=="true";
}

function downloadFile(url){
//   window.open(url);
   window.location.assign(url);
   
   /*
   $('<iframe>').attr('src', url).appendTo('body').load(function() {
      //$(this).remove();
      log("!");
   });
   */
   /*var a = document.createElement("a");
   a.href = url;
   $("body").append($(a));
   a.click();
   */
//   a.remove();
}

/*
function downloadFile1(url) {
   
   //If in Chrome or Safari - download via virtual link click
   if (window.downloadFile.isChrome || window.downloadFile.isSafari) {
       //Creating new link node.
       var link = document.createElement('a');
       link.href = url;

       if (link.download !== undefined){
           //Set HTML5 download attribute. This will prevent file from opening if supported.
           var fileName = url.substring(url.lastIndexOf('/') + 1, url.length);
           link.download = fileName;
       }

       //Dispatching click event.
       if (document.createEvent) {
           var e = document.createEvent('MouseEvents');
           e.initEvent('click' ,true ,true);
           link.dispatchEvent(e);
           return true;
       }
   }

   window.open(url);
}

window.downloadFile.isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') &gt; -1;
window.downloadFile.isSafari = navigator.userAgent.toLowerCase().indexOf('safari') &gt; -1;
*/

function isMediaViewableMime(mime){
   return (mime=="video/mp4" && canPlayVideoMp4) ||
      g.getMimeTypeBase(mime)=="image";
}

function startsWith(where, what){
   if(what===undefined || where===undefined)
      return false
   return where.lastIndexOf(what, 0) === 0
}

function onEntryClicked(ev){
   var le = $(this);
   if(ev.ctrlKey){
      toggleMarked(le);
      return;
   }
   
   var mime = le.data("mime");
   if(!mime && le.data("fs")=="root" && !g.getExtension(getLeFullPath(le))){ // mime-less files in root are treated as text files
      mime = "text/plain";
   }
   if(mime){
      if(isMediaViewableMime(mime)){
         // collect all media in folder
         var media = [];
         var all = getAllLeInGrid();
         var leI = -1;
         for(var i=0; i<all.length; i++){
            var le1 = $(all[i]);
            if(isDir(le1))
               continue;
            if(!isMediaViewableMime(le1.data("mime")))
               continue;
            if(leI===-1 && le1[0]===this)
               leI = media.length;
            media.push(le1);
         }
         if(leI!==-1){
            showMediaViewer(media, leI);
            return;
         }
         err("Media not found!");
      }else{
         if(startsWith(mime, "audio/")){
            if(canPlayAudio(mime)){
               // collect all media in folder
               var aud = [];
               var all = getAllLeInGrid();
               var leI = -1;
               for(var i=0; i<all.length; i++){
                  var le1 = $(all[i]);
                  var mime = le1.data("mime");
                  if(!canPlayAudio(mime))
                     continue;
                  if(leI===-1 && le1[0]===this)
                     leI = aud.length;
                  aud.push(le1);
               }
               if(leI!==-1){
                  startAudioPlay(aud, leI);
                  return;
               }
            }
         }else{
            var mtB = g.getMimeTypeBase(mime);
            if(mtB=="text"){
               startTextViewer(le);
               return;
            }
         }
      }
   }
   var uri = getLeFileUri(le);
   downloadFile(uri);
}

function getDirSize(de){
   
   /*var sz = de.data("dirSize");
   if(sz!==undefined){
      showDirSize(de, sz);
   }else{*/
      if(currTask){
         if(entriesEqual(currTask.le, de)){
            return;
         }
      }
      var path = getLeFullPath(de);
      assert(path);
      if(!path)
         return;
      
      var t = new BackgroundTask(de);
      ajaxCall(path, "cmd=dir_size", function(js, task){
         task.finished();
         
         var sz = js["size"];
//         de.add(de.data("treeLe")).add(de.data("gridLe")).data("dirSize", sz);
         showDirSize(de, sz);
      }, t, null, true);
//   }
}

function showDirSize(de, sz){
   de = de.add(de.data("treeLe")).add(de.data("gridLe")).find("#dir_size:first");
   de.text(g.getReadableFileSizeString(sz));
}

var lastDirHoverT;

function dirHover(ev){
   var le = $(this).closest(".le");
   var ve = getLeVolume(le);
   if(!ve || getLeFullPath(ve)=="/") // don't get dir size on root volume
      return;
   
   var on = ev.type=="mouseenter";
//   deb(getLeName(le)+": "+on)
   var t = le.data("hoverTimer");
   if(on){
      if(lastDirHoverT){
         window.clearTimeout(lastDirHoverT);
         lastDirHoverT = 0;
      }
      if(!t){
         t = window.setTimeout(function(){
            getDirSize(le);
         }, 2000);
         le.data("hoverTimer", t);
         lastDirHoverT = t;
      }
      ev.stopPropagation();
   }else{
      if(t){
         window.clearTimeout(t);
         le.removeData("hoverTimer");
         if(lastDirHoverT===t)
            lastDirHoverT = 0;
      }
   }
}

// 🚀 网页端安全防线升级：无延迟锁死只读控制按钮
function updateButtonsByReadOnly(){
   var m = $("#read_only");
   if(readOnly){
      m.show();
      // 物理剥夺当前只读环境下的全部写入特权
      setButtonEnabled(butDelete, null, true);
      setButtonEnabled(butRename, null, true);
      setButtonEnabled(butDirNew, null, true);
      setButtonEnabled(butUpload, null, true);
      $("#upload").css("opacity", "0.4").css("cursor", "default");
      $("#dirNew").css("opacity", "0.4").css("cursor", "default");
   }else{
      m.hide();
      // 恢复正常读写权限通路
      $("#upload").css("opacity", "1").css("cursor", "pointer");
      $("#dirNew").css("opacity", "1").css("cursor", "pointer");
      updateMarked(); // 交回给原有标记逻辑接管按钮高亮
   }
}

function bindVolumeSize(ve, szFree, szTotal){
   if(!szTotal)
      szTotal = ve.data("totalSpace");
   var sz = localizedStrings[6]+' '+g.getReadableFileSizeString(szFree)+'/'+g.getReadableFileSizeString(szTotal);
   bindTexts(ve, "file_size", sz);
}

var wasReadOnly;

/**
 * @const 
 */
var
   DIR_LIST_TREE = 1 // expand into tree view
   , DIR_LIST_GRID = 2 // expand into grid list
   , DIR_LIST_BOTH = 3
   , DIR_LIST_DEFAULT = 7   // list to both plus special behavior: collapse siblings
   ;

/**
 * @param task {BackgroundTask}
 */
function onDirListed(js, task, listMode, isRootList){
   
   task.finished();

   const pasePath = js["path"];
   var putToGrid = (listMode&DIR_LIST_GRID)!==0 || pasePath;
   var putToTree = (listMode&DIR_LIST_TREE)!==0;
   if(putToGrid)
      clearAllMarked();

   readOnly = js["read_only"];
   //var rdOnlyChanged = false;
   if(wasReadOnly!==readOnly){
      wasReadOnly = readOnly;
      //rdOnlyChanged = true;
      updateButtonsByReadOnly();
   }
   
   /** @type Array */
   var files = js["files"];
   if(!files){
      //task.finished();
      return false;
   }

   if(!isRootList)
      files.sort(sortEntries);
   
   var nextPath = pasePath;
   if(!nextPath)
      nextPath = task.listPath;
   if(nextPath!="/")
      nextPath += '/';
   
   var l = files.length;
   
   var now = new Date();

   var treeParent = task.le;
//   var depth = 0;
   if(!treeParent){
      treeParent = treeList;
   }else if(putToTree){
      bindExpandable(treeParent, "true"); 
   }
   
   if(putToTree)
      treeParent.find(".le").remove();
   if(putToGrid)
      getAllLeInGrid().remove();
   
   var numD = 0, numF = 0, numH = 0;
   
   for(var i=0; i<l; i++){
      var f = files[i];
      var hidden = f["hidden"];
      if(!showHidden && hidden){
         ++numH;
         continue;
      }
      var le = null;
      var type = f["t"];
      var name = f["n"];
      var fullPath = nextPath+name;
      switch(type){
      case 0: // volume
         le = leVolume.clone(true);
         var szTotal = f["space_total"];
         le.data("totalSpace", szTotal);
         bindVolumeSize(le, f["space_free"], szTotal);
         fullPath = f["mount"];
         var ic = f["icon_id"];
         if(ic)
            bindIconId(le, ic);
         if(!name)
            name = "/";
         var label = f["label"];
         if(label)
            name = name+" ("+label+')';
         break;
      case 1: // FILE_TYPE_DIR
         le = leDir.clone(true);
         if(!f["has_children"]){
            bindExpandable(le, "");   // hide expand mark
            le.data("no_children", true);
         }
         bindIconId(le, f["icon_id"]);
         break;
//      case 4: // app
      case 2: // file
         if(!putToGrid)
            continue;
         var mimeType = f["mime"];
         if(mimeType){
            var mtb = g.getMimeTypeBase(mimeType);
            if(mtb=="image" || mtb=="video"/* || mimeType=="application/pdf"*/){
               le = leMedia.clone(true);
               bindThumbnail(le, fullPath);
            }
         }
         if(!le){
            le = leFile.clone(true);
            var ext = g.getExtension(name);
            if(ext)
               bindAppIcon(le, ext);
         }
         if(mimeType)
            le.data("mime", mimeType);
         bindTexts(le, "time", g.formatShortDateTime(now, f["time"]),
               "file_size", g.getReadableFileSizeString(f["size"]));
         break;
      }
      if(!le)
         continue;
      {
         var fs = f["fs"]; // save file system of entry
         if(fs)
            le.data("fs", fs);
      }
      {
         var symLink = f["sym_link"];
         if(symLink){
            name += " 鈫� "+symLink;
            if(symLink.charAt(0)==='/')
               fullPath = symLink;
         }
      }
      
      bindTitle(le, name, type!=2);
      le.data("fullPath", fullPath);
      if(hidden)
         le.attr("le_hidden", 1);
      if(task.le)
         le.data("parent", task.le);
      if(type!=2){
         le.data("dir", 1);
         if(putToTree){
            var le1 = le.clone(true);
            le1.data("dir", 1);
            le1.data("treeLe", le);
            le.data("gridLe", le1);
            le.find("#exp").attr("expanded", "false");

            treeParent.append(le);
            le = le1;
         }
         ++numD;
      }else
         ++numF;
      if(putToGrid)
         gridIn.append(le);
   }
   if(putToGrid){
      gridIn.scrollTop(0);
      /*var s = files.length+' '+(files.length==1 ? "item" : "items");
      if(numH)
         s += " ("+numH+" hidden)";*/
      filesInfo.find("#num_dirs").text(numD);
      filesInfo.find("#num_files").text(numF);
      var h = filesInfo.find("#num_hidden");
      if(numH){
         h.text('('+numH+' '+localizedStrings[20]+')');
         h.show();
      }else
         h.hide();
      filesInfo.show();
      updateMarked();
   }
   
   if(task.le){
      // smooth scroll so that expanded dir is visible
      var allE = treeList.find(".le");
      if(allE.length){
         //var totH = allE.first().height();
         var avlH = treeList.height();
         //if(totH>avlH)
         { // scrolling possible?
            var sTop = treeList.scrollTop();
            var sTo = sTop;
            var leChld = task.le.find(".le_in");
            var leH = leChld.outerHeight();
            var deI = allE.index(task.le);
            var sMin = deI * leH;
            var sMax = (deI+leChld.length+1) * leH;
            var sVisBot = sMax - avlH;
            sTo = Math.min(Math.max(sTo, sVisBot), sMin);
            if(sTo!=sTop)
               //treeList.scrollTop(sTo);
               treeList.animate({"scrollTop": sTo}, 200);
         }
      }
   }
   return true;
}

function canDelete(){
   return !readOnly &&
      (numMarked || getLeParent(currentDir));
}

function doDelete(sel, onResult, noDirRefresh){
   var t = new BackgroundTask(currentDir);
   t.sel = sel;
   t.i = 0;
   t.cd = currentDir;
   
   var simulation = debugMode>=2;
   if(simulation)  // simulation mode
      setCurrTask(t);
   
   var dlg = showCancelableDialog("img/op_delete.png", 29, "", function(){
      if(t.i<sel.length){
         deb("Canceled deleting");
         var isActiveTask = currTask==t;
         t.cancel();
         if(isActiveTask && !noDirRefresh)
            onDirClicked(t.cd);
      }
   });
   t.divMsg = dlg.find("#msg");
   
   var volFreeSpace = null;
   
   function deleteSingleFile(){
      var le = $(t.sel[t.i]);
      var path = getLeFullPath(le);

      {
         var s = getFileNameWithouPath(path);
         if(t.sel.length>1){
            s = "<b>"+(t.i+1)+'/'+t.sel.length+"</b> "+g.htmlEncode(s);
            t.divMsg.html(s);
         }else
            t.divMsg.text(s);
      }
      
      function deleteDone(js, task){
         if(task.canceled){
            deb("Deleting canceled");
            if(onResult)
               onResult(false);
            return;
         }
         var ok = js["ok"];
         if(++task.i===task.sel.length || !ok)
            task.finished();
         if(ok){
            volFreeSpace = js["vol_free_space"] || volFreeSpace;
            if(task.cd && isEntryChildOf(task.cd, le, true)){
               task.cd = getLeParent(le);
               //setCurrentDir(task.cd);
               deb("deleted curr dir or parent, new cd is "+getLeFullPath(task.cd));
            }
            if(task.i < task.sel.length){
               deleteSingleFile();
               return;
            }
         }else
            showError(localizedStrings[15]+' '+path);
         // work done
         unCover();
         
         if(volFreeSpace){
            // update volume's free space info
            var ve = task.cd.closest("#le_volume");
            if(ve)
               bindVolumeSize(ve, volFreeSpace);
         }
         
         // refresh current dir
         if(currentDir!=task.cd)
            setCurrentDir(task.cd);
         if(task.cd && !noDirRefresh)
            listDir(getLeFullPath(task.cd), task.cd);  // refresh curr dir  
         if(onResult)
            onResult(ok);
      }
      if(simulation){
         log("Simulate delete "+path);
         setTimeout(function(){
            deleteDone({"ok": true, "vol_free_space": 1234}, t);
         }, t.i==0 ? 500 : 200);
      }else{
         var q = "cmd=delete";
         q = appendFileSystemParam(le, q);
         ajaxCall(path, q, deleteDone, t, "DELETE", true);
      }
   }
   deleteSingleFile();
}

function askToDelete(sel, onResult, noDirRefresh){
//   if(debugMode>=2) return doDelete(sel);
   var msg =
      sel.length===1 ?
            getLeName(sel) :
               sel.length+' '+localizedStrings[23];
   dlgOkCancel("img/op_delete.png", 2, msg, function(){
      doDelete(sel, onResult, noDirRefresh);
   });
}

function opDelete(sel){
   if(!sel)
      sel = getMarkedLeInGrid();
   if(!sel.length)
      sel = currentDir;
   askToDelete(sel);
}

function copyMoveSingleFile(t, de, sel, i, cd, copy){
   var le = $(sel[i]);
   var srcPath = getLeFullPath(le);
   var dstPath = getLeFullPath(de);
   var leDstPath = dstPath+'/'+getFileNameWithouPath(srcPath);
   var cmd = "cmd=rename&n="+encodeURIComponent(leDstPath);
   cmd = appendFileSystemParam(le, cmd);
//   log(srcPath)
   ajaxCall(srcPath, cmd, function(js, task){
      var ok = js["ok"];
      if(++i==sel.length || !ok)
         t.finished();
      if(ok){
         /*
         if(isEntryChildOf(cd, le, true)){
            cd = getLeParent(le);
            //setCurrentDir(cd);
            log("deleted curr dir or parent, new cd is "+getLeFullPath(cd));
         }
         */
         if(i<sel.length)
            copyMoveSingleFile(t, de, sel, i, cd, copy);
         else{
            // work done
            if(currentDir!=cd)
               setCurrentDir(cd);
            listDir(getLeFullPath(cd), cd);  // refresh curr dir
         }
      }else
         showError(localizedStrings[24]+' '+srcPath);
   }, t, "PUT", copy);  // if copying, don't use timeout (it takes time on device)
}

function doCopyMove(de, sel, copy){
   var t = new BackgroundTask(de);
   var cd = getDirInTreeList(de);
   if(getLeFullPath(currentDir).length < getLeFullPath(cd).length)
      cd = currentDir;
   copyMoveSingleFile(t, de, sel, 0, cd, copy);
}

function askCopyMove(de, sel, copy){
//   var dePath = getLeFullPath(de);
//   log(this.sel.length);
   var msg =
      sel.length===1 ?
            getLeName(sel) :
               sel.length+' '+localizedStrings[23];
            
            msg += " &rarr; " + getLeName(de);
   dlgOkCancel("img/op_move.png", copy ? 21 : 22, msg, function(){
      doCopyMove(de, sel, copy);
   });
}

function canRename(){
   if (readOnly) return false;
   
   var markedItems = getMarkedLeInGrid();
   if (markedItems && markedItems.length === 1) {
      return true;
   }

   return !!getLeParent(currentDir);
}


function askRename(le, onResult){
   var path = getLeFullPath(le);
   var srcName = getFileNameWithouPath(path);
   path = g.getParentPath(path);
   
   function doRename(dstName){
      var dstPath = path+'/'+dstName; 
      
      var q = "cmd=rename&n=" + encodeURIComponent(dstPath) + "&src=" + encodeURIComponent(srcName);
      
      q = appendFileSystemParam(le, q);
      if (q.indexOf("fs=") === -1) {
         var activeLe = getMarkedLeInGrid().first();
         if (!activeLe.length && currentDir) activeLe = currentDir;
         if (activeLe.length) {
            q = appendFileSystemParam(activeLe, q);
         }
      }
      
      ajaxCall(path, q,
            function(js, task){
         task.finished();
         if(js["ok"]){
            bindTitle(le, dstName, false);
            le.data("fullPath", dstPath);
            var tle = le.data("treeLe");
            if(tle){
               bindTitle(tle, dstName, true);
               tle.data("fullPath", dstPath);
            }else{
               if(!onResult)
                  opDirRefresh();
            }
            if(onResult)
               onResult(dstName);
            return;
         }
         showError(localizedStrings[14] + ' ' + srcName);
      }, new BackgroundTask(le), "PUT");
   }
//   doRename(srcName, "!"); return;
   showNameDialog("img/op_rename.png", 3, srcName + " &rarr; [?]", function(n){
      doRename(n);
   }, {"path": path}, srcName);
}

function opRename(sel){
   if(!sel)
      sel = getMarkedLeInGrid();
   if(!sel.length)
      sel = currentDir;
   if(sel.length==1){
      askRename(sel);
      clearAllMarked();
   }
}

function opDirRefresh(){
   if(currentDir){
      var path = getLeFullPath(currentDir);
      listDir(path, currentDir);
   }else
      listRoot();
}

function opUpDir(){
   var p = getLeParent(currentDir);
   if(p)
      onDirClicked(p);
}

function opShowHidden(){
   showHidden = !showHidden;
   g.setPref("showHidden", showHidden);
   showInfoMsg(localizedStrings[8]+": "+(showHidden ? localizedStrings[9] : localizedStrings[10]));
   opDirRefresh();
}

function canCreateDir(){
   return !readOnly && !numMarked && currentDir;
}

function opNewDir(de){
   if(!de)
      de = currentDir;
   if(!de)
      return;
   var path = getLeFullPath(de);
   
   function doDirCreate(name){
      var q = "cmd=new_dir";
      q = appendFileSystemParam(de, q);
      ajaxCall(path+'/'+name, q, function(js, task){
         task.finished();
         if(js["ok"]){
//            if(!entriesEqual(de, currentDir))
//               setCurrentDir(de);
//            listDir(path, de);//, entriesEqual(de, currentDir) ? DIR_LIST_DEFAULT : DIR_LIST_TREE);
            onDirClicked(de);
            return;
         }
         showError(localizedStrings[12]+' '+path);
      }, new BackgroundTask(de), "PUT");
   }
   
   showNameDialog("img/op_new_folder.png", 7, path+'/', function(n){
      doDirCreate(n);
   }, {"path": path});
}

function opUpload(){
   if(currentDir){
      var inp = gridToolbar.find("#in_upload");
      inp.click();
   }
}

function opUploadPick(ev){
   startUploadOfFiles(currentDir, ev.target.files, null);
   ev.target.files = null;
}

function opDownloadAsZip(sel){
   if(!currentDir)
      return;
   var butPress = !sel;
   if(butPress)
      sel = getMarkedLeInGrid();
//   var hasSel = !!sel;
   var singleDir = (sel.length===1 && isDir(sel));
   var path = getLeFullPath(singleDir ? sel : currentDir);
   var pathForName = sel.length===1 ? getLeFullPath(sel) : path;
//   log(path); return;
//   dir(sel); return;
   function download(){
      var name = getFileNameWithouPath(pathForName);
      // last path of uri is fake ".zip" name, ignored by X-plore server, used for nice name of downloaded zip in browser
      path += '/'+name+".zip";

      var q = "cmd=zip";
      q = appendFileSystemParam(currentDir, q);
      if(sel.length && !singleDir){
         for(var i=0; i<sel.length; i++){
            var f = $(sel[i]);
            var fn = encodeURIComponent(getLeName(f));
            q += "&f="+fn;
         }
      }
      var uri = prepareFileUri(path+"?"+q);
      deb(uri);
      downloadFile(uri);
   }
   if(butPress){
      var msg;
      if(sel.length<=1)
         msg = pathForName;
      else
         msg = sel.length+' '+localizedStrings[23];
      dlgOkCancel("img/download_zip.png", 30, msg, download);
   }else
      download();
}

function opDownload(le){
   var uri = getLeFileUri(le)+"&mime=application%2Foctet-stream";
   downloadFile(uri);
}

function canHide(le){
   getLeFullPath(le);
}

function opHideUnhide(le, hide){
   var q = "cmd=hide_unhide";
   if(hide)
      q += "&hide";
   ajaxCall(getLeFullPath(le), q, function(js, task){
      task.finished();
      if(js["ok"]){
         le = le.add(le.data("treeLe")).add(le.data("gridLe"));
         if(hide)
            le.attr("le_hidden", 1);
         else
            le.removeAttr("le_hidden");
         return;
      }
      showError("Error");
   }, new BackgroundTask(le), "PUT");
}

function getBookmarkUrl(){
   var url = "http://loc/xp-wifi/wifi/lcg-web";
   var href = location.href.replace(/\/$/, ""); // no trailing slash
   url += "?device_name=" + deviceInfo.deviceName +
      "&ip=" + encodeURIComponent(href);
   
   return url;
}

function opExit(){
   ajaxCall("/", "cmd=quit", function(js, task){
      task.finished();
//      log("quit "+js["ok"]);
      var url = getBookmarkUrl();
      if(js["ok"])
         url += "#quit";
      location.replace(url);
   }, new BackgroundTask(), "PUT");
}

function opBookmark(){
   window.open(getBookmarkUrl()+"#bookmark");
}


var password = "", passHash;

function byteArrayToHexeHexString(arr){
   var r = "";
   for(var i=0; i<arr.length; i++){
       var s = arr[i].toString(16);
       if(s.length<2)
          s = '0'+s;
       r += s;
   }
   return r;
}

function setPassword(pass, cb){
   password = pass;
   if(!password){
      passHash = undefined;
      return;
   }
   var f = function(){
      var m = md5(pass);
      var b = function(i){ // get byte from int[]
         return (m[i>>>2] >>> ((i&3)*8)) & 0xff;
      };
      var t = [(b(0)^b(6)),
               (b(1)^b(7)),
               (b(2)^b(8)),
               (b(3)^b(9)),
               (b(4)^b(10)),
               (b(5)^b(11))];
      passHash = byteArrayToHexeHexString(t);
      cb();
   };
   if(typeof md5==="function")
      f();
   else
      $.getScript("md5.js", f);
}

function askPassword(){
   deb("Asking pass");
   showNameDialog("img/lock.png", 13, null, function(p){
      log("Password entered");
      setPassword(p, listRoot);
   }, {"type": "password" }, password);
}

function askDonation(r){
   deb("Asking donation");
   var icon = prepareFileUri("/" + r["icon_id"]+"?cmd=res_id");
   showCancelableDialog(icon, r["title"], r["text"], listRoot);
}

/**
 * @returns {jqXhr}
 */
/**
 * @returns {jqXhr}
 */
function ajaxCall(path, q, onResult, bgTask, method, noTimeout, _opts){
   
   var uri = g.urlEncode(path)+'?'+q;

   var parts = uri.split('?');
   if (parts.length > 1) {
      parts[0] = parts[0].replace(/%2F/g, "/"); // 只清洗前半段路径
      uri = parts.join('?'); // 重新合体，确保后半段参数的编码完好无损
   } else {
      uri = uri.replace(/%2F/g, "/");
   }

   if(bgTask)
      setCurrTask(bgTask);
   if(passHash)
      uri += "&pass="+passHash;
   uri = prepareFileUri(uri);
   var opts = {
      dataType: "json",
      success: function(data, status){
         onResult(data, bgTask);
      },
      error: function(xhr, st){
         if(bgTask){
            switch(xhr.status){
            case 401:
               bgTask.finished();
               // 🚀 物理拦截：强行唤醒我们刚刚补齐的网页端专属登录弹窗
               (function() {
                  var dlg = $("#dlgLogin");
                  var inpUser = dlg.find("#login_user");
                  var inpPwd = dlg.find("#login_pwd");
                  var form = dlg.find("#in_login_form");
                  
                  form.off("submit").on("submit", function(ev) {
                     ev.preventDefault();
                     unCover();
                     
                     var u = inpUser.val();
                     var p = inpPwd.val();
                     
                     // 物理注入凭证头：修改全局 ajax 默认配置，强行挂载 Authorization 认证请求头
                     $.ajaxSetup({
                        headers: {
                           'Authorization': 'Basic ' + btoa(u + ':' + p)
                        }
                     });
                     
                     // 凭证重绑完毕，无延迟发起原路网络请求冲锋
                     ajaxCall(path, q, onResult, bgTask, method, noTimeout, _opts);
                  });
                  
                  // 物理撑开专属弹窗
                  showDialog(dlg, function() {});
                  inpUser.focus();
               })();
               return;
            case 403:
               if(xhr.responseText.charAt(0)=='{'){
                  var r = $.parseJSON(xhr.responseText);
                  if(r["err"]==="Donation required"){
                     bgTask.finished();
                     askDonation(r);
                     return;
                  }
               }
            }
            if(!bgTask.wakeAttempt && deviceInfo.gcmId){
               deb("Try to wake up device");
               bgTask.wakeAttempt = true;
               var wurl = buildGcmWakeUrl(deviceInfo.gcmId);
               $.ajax(wurl, {
                  dataType: "json",
                  success: function(js){
                     if(js["OK"]){
                        deb("Successfully sent awake signal");
                        ajaxCall(path, q, onResult, bgTask, method, noTimeout, _opts);
                     }else
                        bgTask.onError(st);
                  },
                  error: function(){
                     bgTask.onError(st);
                  },
                  timeout: 8000
               });
            }else
               bgTask.onError(st);
         }
      }
   };
   if(_opts){  // merge with provided options
      for(var n in _opts)
         opts[n] = _opts[n];
   }
   if(!noTimeout)
      opts.timeout = 1000 * (debugMode ? 5 : 10);
   if(method)
      opts.type = method;
   return $.ajax(uri, opts);
}

function ListingTask(path, le){
   var t = new BackgroundTask(le);
   t.listPath = path;
   t.onError = function(st){
      this.finished();
      showError("Listing folder error: "+st);
   };
   return t;
}

/**
 * @param path {String}
 */
function listDir(path, le, listMode){

   if(listMode===undefined)
      listMode = DIR_LIST_DEFAULT;
   var q = "cmd=list";
   if((listMode&DIR_LIST_GRID)===0) // if not listing into grid, limit it to dirs
      q += "&filter=dirs";
   q = appendFileSystemParam(le, q);
   ajaxCall(path, q, function(js, task){
      if(currTask==task)
         onDirListed(js, task, listMode);
      else{
         log("task not active");
         // task is no longer active one, ignore
         task.finished();
      }
   }, new ListingTask(path, le));
}

var deviceInfo = {};

function listRoot(openDir){
   
//   openDir += "/la";  // TEST
   function dirListed(js, task){
      if(onDirListed(js, task, DIR_LIST_TREE, !task.le)){
         var des = (task.le || treeList).find(".le");
         var de = null;
         var endSearch = true;
         if(openDir){
            // search active dir among listed
            for(var i=0; i<des.length; ++i){
               var le = $(des[i]);
               var p = getLeFullPath(le);
               if(g.isPathInPath(p, openDir)){
                  de = le;
                  if(p!=openDir)
                     endSearch = false;
                  break;
               }
            }
            if(!de) // not found, activate last listed dir
               de = task.le;
         }
         if(!de && des.length)
            de = $(des[0]);   // expand 1st dir
         
         if(de){
            var path = getLeFullPath(de);
            if(endSearch){
               // last dir to expand
               listDir(path, de);
               setCurrentDir(de);
            }else{
               // list and recurse
               var q = appendFileSystemParam(de, "cmd=list&filter=dirs");
               ajaxCall(path, q, dirListed, new ListingTask(path, de));
            }
         }
      }
   }
   
   var path = "/";
   ajaxCall(path, "cmd=list_root&filter=dirs", function(js, task){
      // fetch device data
      deviceInfo.gcmId = js["gcm_id"];
      var dev = js["device_name"];
      deviceInfo.deviceName = dev;
      deviceInfo.deviceUuid = js["device_uuid"];
      
      titleBar.find("#device_name").text(dev);
      //if(debugMode) log("GCM: "+deviceInfo.gcmId);
      // continue with dir listing
      dirListed(js, task);
   }, new ListingTask(path));
}

var coverAnim = 100;

/**
 * Install event for clicking cover to uncover it.
 *//*
function initCoverClick(){
   cover.one("click", function(){
      unCover();
   });
}*/

function unCover(){
   cover.fadeOut(coverAnim);
//   cover.off("click");
   cover.trigger("dismiss");
}

function coverShow(onDismiss){
   if(onDismiss)
      cover.one("dismiss", onDismiss);
   cover.fadeIn(coverAnim);
}

function menuHover(on){
   /*if(menu.attr("active"))
      return;*/
   var subm = menu.find("#submenu");
   if(on){
      if(cover.is(":visible"))
         return;
      menu.css("z-index", 11);
      subm.show(coverAnim);
      coverShow(function(){
         menu.css("z-index", "");
         subm.hide(coverAnim);
         menu.removeAttr("active");
      });
   }else{
      if(subm.is(":visible"))
         unCover();
   }
}

function getTreeSibling(de, offs){
   if(de){
      var allLe = treeList.find(".le_in").parent();
      var i = allLe.index(de[0]) + offs;
      if(i>=0 && i<allLe.length)
         return $(allLe[i]);
   }
   return null;
}

/**
 * @const
 */
//var KEY_MODIFY_CTRL = 0x2000, KEY_MODIFY_ALT = 0x4000, KEY_MODIFY_SHIFT = 0x8000;

var keyShortcuts = {
      46: function(){   // Del
         if(canDelete())
            opDelete();
      }
      , 0x1b: function(){  // Esc
         if(numMarked)
            clearAllMarked();
      },
      8: function(){ // Backspace
         opUpDir();
      },
      113: function(){ // F2
         if(canRename())
            opRename();
      }
      , 33: function(){ // Page up
         /*var p = getLeParent(currentDir);
         if(p)
            onDirClicked(p);*/
         opUpDir();
      }
      , 37: function(){ // Left
         if(currentDir && !currTask){
            if(isDirExpanded(currentDir))
               collapseDir(currentDir, true);
            else{
               var p = getLeParent(currentDir);
               if(p){
                  setCurrentDir(p);
                  onDirClicked(p);
               }
            }
         }
      }
      , 39: function(){ // Right
         if(currentDir && !currTask){
            if(currentDir.find("#exp").attr("expanded")==="false")
               onDirClicked(currentDir);
            else{
               var de = getTreeSibling(currentDir, 1);
               if(de)
                  onDirClicked(de, DIR_LIST_GRID);
            }
         }
      }
      , 38: function(){ // Up
         if(!currTask){
            var de = getTreeSibling(currentDir, -1);
            if(de)
               onDirClicked(de, DIR_LIST_GRID);
         }
      }
      , 40: function(){ // down
         if(!currTask){
            var de = getTreeSibling(currentDir, 1);
            if(de)
               onDirClicked(de, DIR_LIST_GRID);
         }
      }
      , 13: function(){ // Enter
         /*if(currentDir && !currTask)
            onDirClicked(currentDir);*/
         opDirRefresh();
      }
      , 70: function(){ // F
         if(canCreateDir())
            opNewDir();
      }
      , 72: opShowHidden   // H
      , 65: function(ev){  // A
         if(!ev.ctrlKey)
            return false;
         markAll();
      }
      , 85: opDirRefresh  // U
}, keyDebugShortcuts = {
      112: function(){  // F1
         if(!less.watchMode){
            less.watch();
            log("less watch");
         }else{
            less.unwatch();
            log("less unwatch");
         }         
      },
      114: function(){   // F3
         lop.xui = 1;   // intentional error
      },
      115: function(){   // F4
         // upload test
         var b0 = new Blob(['<a id="a"><b id="b">hey!</b></a>'], {type: 'text/html'});
         b0.name = "Blob.html";
         var b1 = new Blob(['Hello my dear'], {type: 'text/plain'});
         b1.name = "Blob.txt";
         var e = leDir.clone().data("fullPath", "/sdcard/1");
         for(var i=(debugMode>=4) ? 20 : 1; --i>=0; )
            startUploadOfFiles(e, [b0, b1], null);
      },
      117: function(){   // F6
         opDownloadAsZip();
      },
      118: function(){   // F7
         if(debugMode===4)
            debugStartMediaViewer();
         else if(debugMode===5)
            debugStartAudioPlayer();
      }
};

/**
 * Process keyboard shortcuts.
 * @param shortcuts is object which maps keyCode to function to be called
 *    the func may return false to indicate that shortcut shall not be consumed
 * @returns {Boolean} it shortcut was consumed
 */
function processKeyShortcuts(ev, shortcuts, _this){
   var fn = shortcuts[ev.keyCode];
   if(fn){
      var r;
      if(_this)
         r = fn.call(_this, ev);
      else
         r = fn(ev);
      if(r!==false)
         return true;
   }
}

function onKeyDown(ev){
   if(cover.is(":visible")){
      // when cover is on, allow only Esc
      if(ev.keyCode==0x1b){
         unCover();
         ev.preventDefault();
//         ev.stopPropagation();
      }
      return;
   }
   if(processKeyShortcuts(ev, keyShortcuts) ||
         (debugMode && processKeyShortcuts(ev, keyDebugShortcuts))){
      ev.preventDefault();
   }
   else if(debugMode && ev.ctrlKey && ev.keyCode!=17)
      log("Key: "+ev.key+", code: "+ev.keyCode);
}

/*
function menuClick(ev){
   //var origin = ev.target; log(origin.tagName);
   //log("menuClick");
//   menu.attr("active", true);
//   initCoverClick();
}
*/

function checkFileExists(path, cb){
   var q = "cmd=exists";
   
   var activeLe = getMarkedLeInGrid().first();
   if (!activeLe.length && currentDir) activeLe = currentDir;
   if (activeLe.length) {
      q = appendFileSystemParam(activeLe, q);
   }
   
   ajaxCall(path, q, function(js, task){
      task.finished();
      var exists = js["exists"];
      if(exists!==undefined)
         cb(exists);
   }, new BackgroundTask());
}

function enableElement(el, b){
   if(!b)
      el.attr("disabled", true);
   else
      el.removeAttr("disabled");   
}

function setElementReadOnly(el, b){
   if(b)
      el.attr("readonly", true);
   else
      el.removeAttr("readonly");   
}

function showNameDialog(icon, title, msg, onOk, opts, initText){
   var dlg = $("#dlgEnterName");
   
   cssBgndImg(dlg.find("#icon"), icon);
   dlg.find("#title #text").text(localizedStrings[title]);
   dlg.find("#msg").html(msg);
   
   opts = opts || {};
   var path = opts["path"];

   var inp = dlg.find("#in #text");
   var selEnd = 0;
   inp.val(initText);
   inp.attr("type", opts["type"] || "text");
   inp.off();  // all previous events away
   if(initText){
      selEnd = initText.length;
      if(path){
         var ext = g.getExtension(initText);
         if(ext)
            selEnd -= ext.length+1;
      }
   }
   
   var okBut = dlg.find("input[type=submit], button, input[type=button]").filter(function() {
      return $(this).text().trim() === "OK" || $(this).val() === "OK";
   });
   
   if(path){
      enableElement(okBut, false);
      // install checker for valid filename
      inp.on("input", function(ev){
         var p = path+'/'+inp.val();
         checkFileExists(p, function(ex){
            enableElement(okBut, !ex);
         });
      });
   }else
      enableElement(okBut, true);
   var form = dlg.find("form");
   form.off();  // all previous events away
   form.submit(function(ev){
      ev.preventDefault();
      unCover();
      var n = inp.val();
      onOk(n);
   });
   showDialog(dlg, function(){});
   inp.focus();
   inp.get(0).setSelectionRange(0, selEnd);
}

function dlgOkCancel(icon, title, msg, onOk, clone, onCancel){
   var dlg = $("#dlgOkCancel");
   if(clone){
      var d = dlg.clone(true);
      dlg.parent().append(d);
      dlg = d;
   }
   cssBgndImg(dlg.find("#icon"), icon);
   dlg.find("#title #text").text(localizedStrings[title]);
   dlg.find("#msg").html(msg);
   
   var okBut = dlg.find("#ok");
   okBut.off("click").click(function(){
      unCover();
      onOk();
   });
   dlg.find("#cancel").off("click").click(function(){
      unCover();
      if(onCancel)
         onCancel();
   });
   showDialog(dlg, function(){
      if(clone)
         dlg.remove();
   });
   okBut.focus();
   return dlg;
}

function showCancelableDialog(icon, title, msg, onCancel){
   var dlg = $("#dlgCancelable");
   
   cssBgndImg(dlg.find("#icon"), icon);
   if(typeof title==="number")
      title = localizedStrings[title];
   dlg.find("#title #text").text(title);
   dlg.find("#msg").html(msg);
   showDialog(dlg, onCancel);
   return dlg;
}

function changeMediaVolume(dir){
   var vol = Math.round(this.volume*10 + dir);
   this.volume = Math.max(0, Math.min(1, vol*.1));
}

function toggleMediaPlay(){
   if(this.paused)
      this.play();
   else
      this.pause();
}

function showMediaViewer(allMedia, currI){

   var num = allMedia.length;
   
   var viewer = browserPane.find("#media_viewer");
   var canvasHolder = viewer.find("#media_canvas");
   var counter = viewer.find("#counter");
   var mediaInfo = viewer.find("#media_info"); mediaInfo.text('');
   var name = viewer.find("#name"); name.text('');
   var progress = divProgress.clone();
   var body = $("body");
   var controls = viewer.find("#controls");
   var butPrev = controls.find("#prev");
   var butNext = controls.find("#next");
   var butDownload = controls.find("#download");
   var butRen = controls.find("#rename");
   var butDel = controls.find("#delete");
   var butSlideshow = controls.find("#slideshow");
   
   var slideshowDelay = g.getIntPref("slideshowDelay") || 5;
   var slideshowRepeat = g.getPref("slideshowRepeat");
   slideshowRepeat = (slideshowRepeat===null) ? false : (slideshowRepeat=="true");
   var slideshowVideoPlay = true;
   
   var canList = num>1;
   var someDeleted = false;
   if(!readOnly){
      butDel.show();
      butDel.off().click(function(){
         // try to delete current file
         if(isFullscreen())
            fullscreenOff();
         var i = currI;
         askToDelete(allMedia[i], function(ok){
            if(!ok)
               return;
            someDeleted = true;
            deb("media del: "+i);
            allMedia.splice(i, 1);
            num = allMedia.length;
            if(!num){
               close();
            }else{
               canList = num>1;
               if(!canList)
                  counter.hide();
               if(currI===i){
                  if(currI>=num)
                     currI = num-1;
                  limitCache();
                  loadMedia(currI);
               }
               enableControls();
            }
         }, true);
      });
      butRen.show().off().click(function(){
         if(isFullscreen())
            fullscreenOff();
         askRename(allMedia[currI], function(n){
            name.text(n);
         });
      });
   }else{
      butDel.hide();
      butRen.hide();
   }
   
   butDownload.off().click(function(){
      opDownload(allMedia[currI]);
   });
   
   if(canList){
      counter.show();
//      controls.show();
   }else{
      counter.hide();
//      controls.hide();
   }
   // cache file's url -> img
   var imgCache = {};
   function enableControls(force){
      setButtonEnabled(butPrev, currI>0 ? goToPrev : null, force);
      setButtonEnabled(butNext, currI<num-1 ? goToNext : null, force);
   }
   enableControls(true);
   
   var slideShowOn = false;
   var slideShowTimeout = 0;
   
   function slideShowScheduleNext(){
      if(num){
         slideShowUnschedule();
         function slideShowNext(){
            slideShowTimeout = 0;
            if(slideshowRepeat || currI<num-1){
               deb("Slideshow next");
               currI = (currI+1) % num;
               loadMedia(currI);
            }else{
               deb("Slideshow end");
               slideShowStop();
            }
         }
         slideShowTimeout = window.setTimeout(slideShowNext, slideshowDelay*1000);
      }
   }
   function slideShowUnschedule(){
      if(slideShowTimeout){
         window.clearTimeout(slideShowTimeout);
         slideShowTimeout = 0;
      }
   }
   
   function limitCache(){
      var i = currI;
      // get urls of current image and prev/next
      var uP = i>0 ? getLeFileUri(allMedia[i-1]) : '';
      var uC = getLeFileUri(allMedia[i]);
      var uN = i<num-1 ? getLeFileUri(allMedia[i+1]) : '';
      for(var url in imgCache){
         if(url==uP || url==uC || url==uN)
            continue;
         deb("Remove img from cache: "+getFileNameWithouPath(url));
         var img = imgCache[url];
         if(!img.is(":visible"))
            img.removeAttr("src");
         delete imgCache[url];
      }
   }
   function goToPrev(){
      slideShowUnschedule();
      if(currI>0)
         loadMedia(--currI);
   }
   function goToNext(){
      slideShowUnschedule();
      if(currI<num-1)
         loadMedia(++currI);
   }
   var DEBUG_SPEED = false;//debugMode===4;
   var canvasFadeSpeed = 400;
   
   if(DEBUG_SPEED)
      canvasFadeSpeed *= 5;
   
   function fitMediaElement(_e, where){
      var e = _e[0];
      var fitW = where.width(), fitH = where.height();
      if(e.tagName=="IMG"){
         var w = e.width, h = e.height;
         var rW = fitW / w, rH = fitH / h;
         if(rW<rH)
            _e.css("width", fitW).css("height", "");
         else
            _e.css("width", "").css("height", fitH);
      }else if(e.tagName=="VIDEO"){
       _e.removeAttr("width").removeAttr("height");
       _e.css({maxWidth: fitW, maxHeight: fitH, width: "auto", height: "auto"});
      }
   }
   
   var currVideo = null;
   /**
    * Assign element to new canvas with effect.
    * element is placed into black div covering entire canvas size
    */
   function showCanvas(el, isThumb){
      var oldCanvases = canvasHolder.find(".media_box");
      
      var d = $("<div>");
      d.addClass("media_box").append(el);
      d.hide();
      canvasHolder.append(d);

      fitMediaElement(el, canvasHolder);
      freeVideo();
      
      d.fadeIn(canvasFadeSpeed, function(){
         oldCanvases.remove();
      });
      if(!isThumb && slideShowOn)
         slideShowScheduleNext();
   }

   function showImage(img){
      img.css('image-orientation', 'from-image');
      showCanvas(img);
      /*var e = img[0];
      if(e.width && e.height)
         mediaInfo.text(e.width+'x'+e.height);*/   // disabled, it shows wrong resolution
   }

   function showVideo(le){
      var url = getLeFileUri(le);
      var thumbUrl = getLeThumbnailUri(le, "thumbnail");
      var vid = $("<video>");
      var v = vid[0];
      vid.attr("poster", thumbUrl);
      v.src = url;
      
      v.controls = true;
//      v.preload = "metadata";
      
      var vol = g.getPref("volume");
      if(!vol)
         vol = 50;
      v.volume = parseInt(vol)/100;
      v.onvolumechange = function(){
//         log(this.volume);
         var v = Math.round(this.volume*100);
         g.setPref("volume", v);
         showInfoMsg(localizedStrings[38]+' '+v+'%');
      };
      v.onended = function(){
         if(slideShowOn && slideshowVideoPlay)
            goToNext();
            //slideShowScheduleNext();
      };
      showCanvas(vid);
      
      currVideo = vid;
      if(slideShowOn && slideshowVideoPlay){
         slideShowUnschedule();
         v.play();
      }
   }
   
   function freeVideo(){
      if(currVideo){
         currVideo.removeAttr("poster");
         var v = currVideo[0];
         v.src = ""; // don't set to null or undefined, FF will try to load it
         v.onvolumechange = null;
         v.onended = null;
         currVideo = null;
      }
   }
   
   function showError(err){
      var d = $("<div>");
      d.text(err);
      d.addClass("error");
      canvasHolder.append(d);
      showCanvas(d);
   }

   var loadsInProgress = 0;
   function loadMedia(imgI, preload){
      var le = allMedia[imgI];
      var n = getLeName(le);
      if(!preload){
         deb("Load "+n);
         enableControls();
         limitCache();
         if(canList)
            counter.text((imgI+1)+'/'+num);
         name.text(n);
      }else
         deb("Preload "+n);
      
      if(!preload)
         mediaInfo.text('');
      
      function preloadAdjacent(){
         if(currI<num-1)
            loadMedia(currI+1, true);  // next
         if(currI)
            loadMedia(currI-1, true);  // prev
      }

      var mimeBase = g.getMimeTypeBase(le.data("mime"));
      
      if(mimeBase=="video"){
         if(!preload){
            showVideo(le);
            preloadAdjacent();
         }
         return;
      }
      
      var url = getLeImageUri(le);
//      deb("Img url: "+url);
      {
         var img = imgCache[url];
         if(img){
            deb("Found in cache: "+n);
            if(!preload){
               if(img.is(":visible"))
                  img = img.clone();   // make copy for case it's displayed
               showImage(img);
               preloadAdjacent();
            }
            return;
         }
      }
      if(!loadsInProgress++)
         canvasHolder.append(progress);
      
      function loadDone(){
         if(!--loadsInProgress)
            progress.remove();
      }
      
      if(!preload){
         // bind thumbnail first
         var thumbUrl = getLeThumbnailUri(le, "thumbnail");
         var img = $("<img>");
         img.attr("src", thumbUrl);
         showCanvas(img, true);
      }
      var img = $("<img>");
      // actual load of image
      img.on("load", function(){
         img.off();
         function loadSuccess(){
            deb("loadSuccess: "+n);
            // put it to cache
            if(imgCache){  // when cache is null, viewer is closed
               if(imgI>=currI-1 && imgI<=currI+1){
                  deb("Cache img "+n);
                  imgCache[url] = img;
               }else{
                  deb("Not caching img "+n);
               }
               if(!preload && imgI===currI){
                  showImage(img);
                  preloadAdjacent();
               }
            }
            loadDone();
         }
         if(DEBUG_SPEED){
            window.setTimeout(function(){loadSuccess(url);}, 2000);
         }else
            loadSuccess(url);
      });
      img.on("error", function(e){
         img.off();
         err("Can't load image");
         loadDone();
         if(!preload && imgI===currI){
            showError("Load error");
         }
      });
      img.attr("src", url);
   }
   
   var fullscreenExit = null;

   function fullscreenOn(){
      viewer.addClass("fullscreen");
      var t = viewer[0];
      var doc = $(document);
      if(t.requestFullscreen){
         t.requestFullscreen();
         fullscreenExit = document.exitFullscreen;
         doc.off("fullscreenchange").on("fullscreenchange", function(e){
            /*if(!document.fullScreenElement)
               fullscreenOff();*/
         });
      }else if(t.msRequestFullscreen){
         t.msRequestFullscreen();
         fullscreenExit = document.msExitFullscreen;
         doc.off("msfullscreenchange").on("msfullscreenchange", function(e){
            if(!document.msFullScreenElement)
               fullscreenOff();
         });
      }else if(t.mozRequestFullScreen){
         t.mozRequestFullScreen();
         fullscreenExit = document.mozCancelFullScreen;
         doc.off("mozfullscreenchange").on("mozfullscreenchange", function(e){
            if(!document.mozFullScreenElement)
               fullscreenOff();
         });
      }else if(t.webkitRequestFullscreen){
         t.webkitRequestFullscreen();
         fullscreenExit = document.webkitExitFullscreen;
         doc.off("webkitfullscreenchange").on("webkitfullscreenchange", function(e){
            if(!document.webkitFullscreenElement)
               fullscreenOff();
         });
      }
      onResize();
   }
   function fullscreenOff(){
      viewer.removeClass("fullscreen");
      if(fullscreenExit)
         fullscreenExit.call(document);
      onResize(); // fixes fullscreen exit by Esc
   }
   function isFullscreen(){
      return viewer.hasClass("fullscreen");
   }
   if(isFullscreen())
      fullscreenOff();
   
   function toggleFullscreen(){
      if(!isFullscreen())
         fullscreenOn();
      else
         fullscreenOff();
   }
   
   function slideShowStop(){
      slideShowUnschedule();
      if(slideShowOn){
         slideShowOn = false;
         cssBgndImg(butSlideshow.find(".icon"), "img/slideshow_on.png");
      }
   }
   function toggleSlideShow(){
      if(!slideShowOn){
         slideShowOn = true;
         cssBgndImg(butSlideshow.find(".icon"), "img/slideshow_off.png");
         if(currVideo && slideshowVideoPlay)
            videoPlay();
         else
            slideShowScheduleNext();
      }else{
         slideShowStop();
      }
      deb("Slideshow "+slideShowOn);
   }
//   butSlideshow.off().click(toggleSlideShow);
   setButtonEnabled(butSlideshow, num ? toggleSlideShow : null, true);
   
   function goBack(){
      if(isFullscreen())
         fullscreenOff();
      else
         close();
   }
   
   function isPlayingVideo(){
      return currVideo && !currVideo[0].paused;
   }
   function videoPlay(){
      currVideo[0].play();
   }
   function videoSeek(dir){
      var v = currVideo[0];
      var t = v.currentTime;
      if(dir>0)
         t += 30;
      else
         t -= 5;
      v.currentTime = t;
      /*if(v.paused)
         v.play();*/
   }
   
   function options(){
      if(isFullscreen())
         fullscreenOff();
      
      var ssd = slideshowDelay;
      var ssr = slideshowRepeat;
      
      var dlg = dlgOkCancel("img/op_settings.png", 40, localizedStrings[39], function(){
         if(slideshowDelay!==ssd)
            g.setPref("slideshowDelay", slideshowDelay = ssd);
         if(slideshowRepeat!==ssr)
            g.setPref("slideshowRepeat", slideshowRepeat = ssr);
      }, true);
      
      var buttons = dlg.find("#buttons");
      {
         // slideshow delay
         var ssdMin = 2, ssdMax = 10;
         var e = $('<div>'+localizedStrings[41]+': <input type="range" size="4" min="'+ssdMin+'" max="'+ssdMax+'"> <span id="sec" style="min-width: 20px; display: inline-block; text-align: right;"></span> '+localizedStrings[42]+'</div>');
         buttons.before(e);
         var delay = e.find("input");
         delay.val(ssd);
         var sec = e.find("#sec");
         function delayChange(){
            var d = parseInt(delay.val());
            if(d){
               d = Math.max(ssdMin, Math.min(ssdMax, d));
               sec.text(ssd = d);
            }
         }
         delay.change(delayChange).on("input", delayChange);
         delay.change();
      }
      
//      if(debugMode)
      {
         var e = $('<div style="margin-top: 10px;"><label><input type="checkbox"> '+localizedStrings[44]+'</label></div>');
         buttons.before(e);
         var repeat = e.find("input");
         if(ssr)
            repeat.attr("checked", "true");
         repeat.click(function(){
            ssr = this.checked;
         });
      }
      
      centerDialog(dlg);
   }
   
   shortcuts = {
      0x1b: goBack,
      8: goBack, // Backspace
      37: function(){ // left
         if(isPlayingVideo()){
            videoSeek(-1);
         }else
            goToPrev();
      },
      39: function(){ // right
         if(isPlayingVideo()){
            videoSeek(1);
         }else
            goToNext();
      },
      38: function(){ // up
         if(currVideo)
            changeMediaVolume.call(currVideo[0], 1);
      },
      40: function(){ // down
         if(currVideo)
            changeMediaVolume.call(currVideo[0], -1);
      },
      13: function(ev){ // Enter
         //if(ev.altKey)
            toggleFullscreen();
      },
      46: function(){   // Del
         butDel.click();
      },
      113: function(){ // F2
         butRen.click();
      },
      32: function(){  // Space
         if(currVideo){
            slideShowStop();
            toggleMediaPlay.call(currVideo[0]);
         }else
            toggleSlideShow();
      },
      114: options  // F3
   };
   
   function onKey(ev){
      if(cover.is(":visible"))
         return onKeyDown(ev);   // call global
      if(processKeyShortcuts(ev, shortcuts, this))
         ev.preventDefault();
   }
   
   function onResize(){
      canvasHolder.find("img,video").each(function(){
         var img = $(this);
         fitMediaElement(img, img.parent());
      });
   }
   var win = $(window);
   win.resize(onResize);
   
   viewer.dblclick(toggleFullscreen);
   var butClose = viewer.find("#close");
   var butFull = viewer.find("#fullscreen");
   var butOptions = viewer.find("#options");
   butOptions.off().click(options);
   
   
   function close(){
      fullscreenOff();
      progress.remove();
      body.off("keydown").keydown(onKeyDown);
      viewer.off("dblclick");
      
      cover.fadeOut(coverAnim, function(){ 
         if(cover.hasClass("cloned-cover")) cover.remove(); 
      });      
      
      win.off("resize", onResize);
      viewer.find(".but").off();
      slideShowStop();
      freeVideo();
      imgCache = null;
      viewer.fadeOut("fast", function(){
         // free resources
         canvasHolder.find("img").removeAttr("src");
         canvasHolder.find(".media_box").remove();
      });
      if(someDeleted)
         opDirRefresh();
   }
   
   butClose.click(close);
   butFull.off().click(toggleFullscreen);
   
   body.off("keydown").keydown(onKey);
   
   viewer.fadeIn("fast");
   loadMedia(currI);
   
   if(currVideo)
      videoPlay();
}

function debugStartMediaViewer(video){
   var le0 = $("<div>"); le0.data("fullPath", "/storage/sdcard1/Pictures/Rotated/90.jpeg").data("mime", "image/jpeg");
   var le1 = $("<div>"); le1.data("fullPath", "/storage/sdcard1/Pictures/Rotated/0.jpeg").data("mime", "image/jpeg");
//   var ve = $("<div>"); ve.data("fullPath", "/sdcard/Video/LittleMan.mp4").data("mime", "video/mp4");
   var les = [le0, le1];
   if(video){
      var ve = $("<div>"); ve.data("fullPath", "/sdcard/Video/Hugo.mp4").data("mime", "video/mp4");
      les = [le0, ve];
   }
   showMediaViewer(les, 0);
}

function debugStartAudioPlayer(){
   var le = $("<div>"); le.data("fullPath", "/sdcard/Tests/Audio/Test.mp3");
   var le1 = $("<div>"); le1.data("fullPath", "/sdcard/Tests/Audio/Cruel Summer.mp3");
   startAudioPlay([le, le1], 0);
}

function startTextViewer(le){
   
   var body = $("body");
   var viewer = browserPane.find("#text_view");
   var canvas = viewer.find("#canvas");
   var textArea = viewer.find("#text");
   textArea.text('');
   var name = viewer.find("#name");
   var mediaInfo = viewer.find("#media_info"); mediaInfo.text('');
   var editInfo = viewer.find("#edit_info"); editInfo.hide();
   var progress = divProgress.clone();
   
   var fileName = getLeName(le);
   name.text(fileName);
   var path = getLeFullPath(le);
   
   textArea.on("contextmenu", function(ev){
      // allow context menu (don't let body forbid it)
      ev.stopPropagation();
   });
   
   var uri = g.urlEncode(path)+'?'+appendFileSystemParam(le, "cmd=text_file");
   uri = prepareFileUri(uri);
   
   var xhr = null;
   var closed = false;
   
   var cov = cover.clone();
   cov.hide().css("z-index", viewer.css("z-index")-1);
   cover.parent().append(cov);
   
   var dirty = false;
   function markDirty(on){
      dirty = on;
      if(on)
         viewer.addClass("dirty");
      else
         viewer.removeClass("dirty");
   }
   function isDirty(){
      return dirty; //viewer.hasClass("dirty");
   }
   markDirty(false);
   
   function close(){
      closed = true;
      if(xhr)
         xhr.abort();
      progress.remove();
      body.off("keydown").keydown(onKeyDown);
      textArea.val('').off();
      viewer.find(".but").off();
      viewer.fadeOut("fast");
   }
   var butClose = viewer.find("#close");
   var butEdit = viewer.find("#start_edit");
   var butSave = viewer.find("#save");
   var butWrap = viewer.find("#wrap");

   setElementReadOnly(textArea, true);
   butSave.hide();

   function updateWrap(){
      if(wrapText){
         textArea.removeClass("text-no-wrap");
         cssBgndImg(butWrap.find(".icon"), "img/wrap_text_on.png");
      }else{
         textArea.addClass("text-no-wrap");
         cssBgndImg(butWrap.find(".icon"), "img/wrap_text_off.png");
      }
   }
   updateWrap();
   function toggleWrap(){
      wrapText = !wrapText;
      updateWrap();
   }
   butWrap.click(toggleWrap);

   function showInfo(){
      mediaInfo.text(this.value.length);
   }
   
   function beginEdit(){
      var spd = "slow";
      editInfo.show(spd);
      butEdit.hide(spd);
      setButtonEnabled(butSave, null, true);
      butSave.show(spd);
      showInfoMsg(localizedStrings[48]);
      
      setElementReadOnly(textArea, false);
      textArea.on("input", function(ev){
         if(!isDirty()){
            markDirty(true);
            name.text("* "+fileName);
            setButtonEnabled(butSave, save);
         }
//         dir(this)
         showInfo.call(this);
      });
   }
   if(!readOnly){
      butEdit.show();
      butEdit.click(beginEdit);
   }else{
      butEdit.hide();
   }
   var hadBom = null;  // if edited text had byte-order-mark
   
   function save(thenClose){
      if(!isDirty())
         return;
      if(xhr)
         return;
         
      function afterSave(){
         showInfoMsg(localizedStrings[49]);  // "Saved"
         // reset to unmodified
         markDirty(false);
         name.text(fileName);
         setButtonEnabled(butSave, null);
         if(thenClose)
            close();
      }
      
      canvas.append(progress);
      setElementReadOnly(textArea, true);
      
      var opts = {
         type: "POST",
         xhr: function(){
            var x = $.ajaxSettings.xhr();
            xhr = x;
            return x;
         },
         contentType: "text/plain; charset=utf-8",
         dataType: "json",
         data: textArea.val(),
         processData: false,
         success: function(js){
            if(js["ok"]){
               afterSave();
            }else{
               var err = js["err"];
               if(err && !closed)
                  showError("Save error: "+err);
            }
         },
         error: function(){
            if(!closed)
               showError("Save error");
         },
         complete: function(){
            xhr = null;
            progress.remove();
            setElementReadOnly(textArea, false);
         },
         headers: {},
         timeout: 30000
      };
      if(hadBom)
         opts.headers["x-bom"] = 1;
      $.ajax(uri, opts);
   }
   function askSaveAndClose(){
      if(isDirty()){
//         enableElement(textArea, false);
         var dlg = dlgOkCancel("img/op_text_edit.png", 50, "", function(){
            save(true);
         }, true, function(){
            close();
         });
         dlg.find("#ok").text(localizedStrings[9]);
         dlg.find("#cancel").text(localizedStrings[10]);
      }else
         close();
   }
   butClose.click(askSaveAndClose);
   
   function textLoaded(val){
      /*if(le.data("mime")=="text/html")
         text.html(val);
      else*/
      textArea.val(val);
      
      enableElement(textArea, true);
      textArea.focus();
      showInfo.call(textArea[0]);
   }
   enableElement(textArea, false);
   
   shortcuts = {
         0x1b: askSaveAndClose,
         69: function(ev){ // E
            if(!ev.ctrlKey)
               return false;
            if(butEdit.is(":visible"))
               butEdit.click();
         },
         83: function(ev){ // S
            if(!ev.ctrlKey)
               return false;
            save();
         }
   };
   
   function onKey(ev){
      if(cover.is(":visible"))
         return onKeyDown(ev);   // call global
      if(processKeyShortcuts(ev, shortcuts, this))
         ev.preventDefault();
   }
   body.off("keydown").keydown(onKey);
   
//   coverShow(askSaveAndClose);
   cov.fadeIn(coverAnim);
   viewer.fadeIn("fast");
   {
      canvas.append(progress);
      
      xhr = new XMLHttpRequest();
      xhr.open("GET", uri, true);
//      x.overrideMimeType('text/plain; charset=US-ASCII');
//      x.responseType = 'text';
      xhr.onreadystatechange = function(e){
         if(this.readyState==4){
            progress.remove();
            xhr = null;
            var err = null;
            if(this.status==200){
//               dir(this)
               hadBom = this.getResponseHeader("x-bom")==="1";
               var mt = this.getResponseHeader("Content-Type");
               if(mt==="application/json"){
                  err = $.parseJSON(this.response);
                  err = err["err"];
                  if(!err)
                     err = "Unknown error";
               }else{
                  textLoaded(this.response);
                  return;
               }
            }else if(!closed){
               err = "Can't load text";
            }
            showError(err);
            close();
         }
      };
      xhr.send();     
   }
}

function debugStartTextViewer(){
   var le = $("<div>"); 
   le.data("fullPath", 
         "/sdcard/Tests/Text/tel.txt");
//         "/sdcard/Tests/Text/Chinese.txt");
   startTextViewer(le);
}

onerror = function(msg, url, line){
   var report = {
         "msg": msg
         , "line": line
         , "url": getFileNameWithouPath(url)
         , "userAgent": navigator.userAgent
   };
   
   ajaxCall("", "cmd=web_error", function(js){
      log("Error report sent "+js["ok"]);
   }, null, "POST", false, {
      data: JSON.stringify(report),
      processData: false,
      contentType: 'application/json',
      error: function(){
         //log("Failed to send error report");
         // ignore for now, it should be sent
      }
   });
   if(!debugMode)
      return true;
//   alert(msg);
};

function testBut(){
   flashReadOnly();
//   log(g.getStackTrace());
}

function startAudioPlay(tracks, currI){
   var dlg = $("#dlgAudioPlay");
   cssBgndImg(dlg.find("#icon"), "img/op_music.png");
   dlg.find("#title #text").text(localizedStrings[43]);
   var body = $("body");
   var butInBg = dlg.find("#bgnd");
   var restoreBut = $("#audio_but");
   var counter = dlg.find("#counter");
   var name = dlg.find("#name");
   var butPrev = dlg.find("#prev");
   var butNext = dlg.find("#next");
   var audio = dlg.find("audio");
   var butRepeat = dlg.find("#repeat");
   var butShuffle = dlg.find("#shuffle");
   
   var fs = getLeParent(tracks[0]).data("fs");
   var num = tracks.length;
   // get track paths from le's, because le's may be destroyed as we play in bgnd
   for(var i=0; i<num; i++)
      tracks[i] = getLeFullPath(tracks[i]);
   

   var repeat = g.getBooleanPref("audioRepeat", true);
   var shuffle = g.getBooleanPref("audioShuffle", false);
   var randomOrder = null;
   
   function shuffleTracks(forceFirst){
      randomOrder = [];
      var tmp = [];
      for(var i=0; i<num; i++){
         if(i!==forceFirst)
            tmp.push(i);
      }
      if(forceFirst!==undefined)
         randomOrder.push(forceFirst);
      while(tmp.length){
         var i = Math.floor(Math.random()*tmp.length);
         randomOrder.push(tmp[i]);
         tmp.splice(i, 1);
      }
   }
   
   if(shuffle){
      shuffleTracks(currI);
      currI = 0;
   }
   {
      var vol = g.getPref("volume");
      if(!vol)
         vol = 50;
      audio[0].volume = parseInt(vol)/100;
      audio.on("volumechange", function(){
         var v = Math.round(this.volume*100);
         g.setPref("volume", v);
         showInfoMsg(localizedStrings[38]+' '+v+'%');
      });
      audio.on("ended", function(){
         if(goToNext()===false){
            if(restoreBut.is(":visible")){
               restoreBut.hide("fast", shutdown);
            }
         }
      });
      audio.on("error", function(e){
         showError("Error opening audio");
      });
   }
   
   butRepeat.attr("checked", repeat).click(function(){
      butRepeat.attr("checked", repeat=!repeat);
      g.setPref("audioRepeat", repeat);
      enableControls();
   });
   butShuffle.attr("checked", shuffle).click(function(){
      butShuffle.attr("checked", shuffle=!shuffle);
      g.setPref("audioShuffle", shuffle);
      if(shuffle)
         shuffleTracks();
      else
         randomOrder = null;
   });
   
   function enableControls(force){
      setButtonEnabled(butPrev, currI>0 ? goToPrev : null, force);
      setButtonEnabled(butNext, (currI<num-1 || repeat) ? goToNext : null, force);
   }
   enableControls(true);
   
   function loadMedia(){
      var i = currI;
      if(randomOrder)
         i = randomOrder[i];
      var path = tracks[i];
      var tit = "";
      if(num>1){
         var c = (currI+1)+'/'+num;
         counter.text(c);
         tit += c+"  ";
      }
      
      var uri = g.urlEncode(path)+"?cmd=file";
      if(fs)
         uri += "&fs="+fs;
      uri = prepareFileUri(uri);

      var n = getFileNameWithouPath(path);
      tit += n;
      name.text(n).removeAttr("title");
      showEllipsizedTextAsTitle(name);
      
      audio.attr("src", uri);
      enableControls();
      audio[0].play();
      
      restoreBut.attr("title", tit);
   }

   function goToPrev(){
      if(currI>0)
         loadMedia(--currI);
   }
   function goToNext(){
      if(currI==num-1 && repeat){
         currI = -1;
         if(shuffle)
            shuffleTracks();
      }
      if(currI<num-1)
         loadMedia(++currI);
      else
         return false;
   }
   
   shortcuts = {
      0x1b: unCover,
      8: unCover, // Backspace
      37: goToPrev, // left
      39: goToNext, // right
      38: function(){ // up
         changeMediaVolume.call(audio[0], 1);
      },
      40: function(){ // down
         changeMediaVolume.call(audio[0], -1);
      },
//      114: options // F3
      32: function(){  // Space
         toggleMediaPlay.call(audio[0]);
      },
      36: function(){   // Home
         butInBg.click();
      }
   };
      
   function onKey(ev){
      if(processKeyShortcuts(ev, shortcuts, this))
         ev.preventDefault();
   }
   
   loadMedia();

   function shutdown(){
      dlg.find(".but").off();
      name.off();
      audio.off();
      audio[0].pause();
      audio.removeAttr("src");
      restoreBut.removeAttr("title");
   }
   function hideDlg(){
      body.off("keydown").keydown(onKeyDown);
      if(restoreBut.is(":visible"))
         return;
      shutdown();
   }
      
   dlg.find("#close").click(unCover);
   function show(){
      body.off("keydown").keydown(onKey);
      showDialog(dlg, hideDlg);
   }
   
   butInBg.click(function(){
      var showSpd = "fast";
      restoreBut.one("click", function(){
         show();
         restoreBut.hide(showSpd);
      });
      restoreBut.show(showSpd);
      unCover();
   });
   show();
}