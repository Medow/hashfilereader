
var chunkSize = 1024*1024; // bytes
var timeout = 10; // millisec

var inputElement = document.getElementById("document");
inputElement.addEventListener("change", handleFiles, false);
$("#document").click(function(event){
    clear();
})

function handleFiles() {
    var file = this.files[0];
    if(file===undefined){
        return;
    }
    var SHA256 = CryptoJS.algo.MD5.create();
    var counter = 0;
    var self = this;

    var timeStart = new Date().getTime();
    var timeEnd = 0;
    $("#timeStart").val(new Date(timeStart));
    $("#fileSize").val(humanFileSize(file.size,true));
    chunkSize = parseInt($("#chunkSize").val());

    loading(file,
        function (data) {
            var wordBuffer = (data);
            SHA256.update(wordBuffer);
            counter += data.byteLength;
            //console.log((( counter / file.size)*100).toFixed(0) + '%');
        }, function (data) {
            //console.log('100%');
            var encrypted = SHA256.finalize().toString();
            $("#hash").val(encrypted);
            timeEnd = new Date().getTime();

            $("#timeStart").val(new Date(timeStart));
            $("#timeEnd").val(new Date(timeEnd));
            $("#timeDelta").val((timeEnd-timeStart)/1000+' sec');
            $("#chunkTotal").val(chunkTotal);
            $("#chunkReorder").val(chunkReorder);
        });

};

function clear(){
    $("#timeStart").val('');
    $("#timeEnd").val('');
    $("#timeDelta").val('');
    $("#hash").val('');
    $("#fileSize").val('');
    $("#chunkTotal").val('');
    $("#chunkReorder").val('');

    lastOffset = 0;
    chunkReorder = 0;
    chunkTotal = 0;
}


function loading(file, callbackProgress, callbackFinal) {
    var HASH_CHUNK_SIZE = 65536, //64 * 1024
        longs = [],
        temp = file.size;

    function read(start, end, callback) {
        var reader = new FileReader();
        reader.onload = function(e) {
            callback.call(reader, process(e.target.result));
        };

        if (end === undefined) {
            reader.readAsBinaryString(file.slice(start));
        } else {
            reader.readAsBinaryString(file.slice(start, end));
        }
    }

    function process(chunk) {
        for (var i = 0; i < chunk.length; i++) {
            longs[(i + 8) % 8] += chunk.charCodeAt(i);
        }
    }

    function binl2hex(a) {
        var b = 255,
            d = '0123456789abcdef',
            e = '',
            c = 7;

        a[1] += a[0] >> 8;
        a[0] = a[0] & b;
        a[2] += a[1] >> 8;
        a[1] = a[1] & b;
        a[3] += a[2] >> 8;
        a[2] = a[2] & b;
        a[4] += a[3] >> 8;
        a[3] = a[3] & b;
        a[5] += a[4] >> 8;
        a[4] = a[4] & b;
        a[6] += a[5] >> 8;
        a[5] = a[5] & b;
        a[7] += a[6] >> 8;
        a[6] = a[6] & b;
        a[7] = a[7] & b;
        for (d, e, c; c > -1; c--) {
            e += d.charAt(a[c] >> 4 & 15) + d.charAt(a[c] & 15);
        }
        return e;
    }


    for (var i = 0; i < 8; i++) {
        longs[i] = temp & 255;
        temp = temp >> 8;
    }

    read(0, HASH_CHUNK_SIZE, function() {
        read(file.size - HASH_CHUNK_SIZE, undefined, function() {
            callback.call(null, file, binl2hex(longs));
        });
    });
}

function callbackRead(obj, file, evt, callbackProgress, callbackFinal){
    if( $("#switchMode").is(':checked') ){
        callbackRead_buffered(obj, file, evt, callbackProgress, callbackFinal);
    } else {
        callbackRead_waiting(obj, file, evt, callbackProgress, callbackFinal);
    }
}

var lastOffset = 0;
var chunkReorder = 0;
var chunkTotal = 0;
// time reordering
function callbackRead_waiting(reader, file, evt, callbackProgress, callbackFinal){
    if(lastOffset === reader.offset) {
        console.log("[",reader.size,"]",reader.offset,'->', reader.offset+reader.size,"");
        lastOffset = reader.offset+reader.size;
        callbackProgress(evt.target.result);
        if ( reader.offset + reader.size >= file.size ){
            lastOffset = 0;
            callbackFinal();
        }
        chunkTotal++;
    } else {
        console.log("[",reader.size,"]",reader.offset,'->', reader.offset+reader.size,"wait");
        setTimeout(function () {
            callbackRead_waiting(reader,file,evt, callbackProgress, callbackFinal);
        }, timeout);
        chunkReorder++;
    }
}
// memory reordering
var previous = [];
function callbackRead_buffered(reader, file, evt, callbackProgress, callbackFinal){
    chunkTotal++;

    if(lastOffset !== reader.offset){
        // out of order
        console.log("[",reader.size,"]",reader.offset,'->', reader.offset+reader.size,">>buffer");
        previous.push({ offset: reader.offset, size: reader.size, result: reader.result});
        chunkReorder++;
        return;
    }

    function parseResult(offset, size, result) {
        lastOffset = offset + size;
        callbackProgress(result);
        if (offset + size >= file.size) {
            lastOffset = 0;
            callbackFinal();
        }
    }

    // in order
    console.log("[",reader.size,"]",reader.offset,'->', reader.offset+reader.size,"");
    parseResult(reader.offset, reader.size, reader.result);

    // resolve previous buffered
    var buffered = [{}]
    while (buffered.length > 0) {
        buffered = previous.filter(function (item) {
            return item.offset === lastOffset;
        });
        buffered.forEach(function (item) {
            console.log("[", item.size, "]", item.offset, '->', item.offset + item.size, "<<buffer");
            parseResult(item.offset, item.size, item.result);
            previous.remove(item);
        })
    }

}

Array.prototype.remove = Array.prototype.remove || function(val){
    var i = this.length;
    while(i--){
        if (this[i] === val){
            this.splice(i,1);
        }
    }
};

// Human file size
function humanFileSize(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}
