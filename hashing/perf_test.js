#!/usr/bin/env gjs

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

imports.searchPath.unshift('.');
imports.searchPath.unshift('../eclipse@blackjackshellac.ca/');
var FastSha256 = imports.fast_sha256;
var Base64 = imports.base64;
var Sha256 = imports.sha256;

function bufferToHex (buffer) {
  return [...new Uint8Array (buffer)]
    .map (b => b.toString (16).padStart (2, "0"))
    .join ("");
}

const byteToHex = [];
for (let n = 0; n <= 0xff; ++n) {
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
}

function hex(buff) {
  const hexOctets = new Array(buff.length);
  for (let i = 0; i < buff.length; ++i) {
    hexOctets[i] = byteToHex[buff[i]]
  }
  return hexOctets.join("");
}

const byteToHexLookup = (() => {
  let b2hl=[];
  for (let n = 0; n <= 0xff; ++n) {
    // convert byte to two digit hex string
    b2hl[n]=n.toString(16).padStart(2, "0");
  }
  return b2hl;
})();

function digest2hex(buff) {
  const hexOctets = new Array(buff.length);
  for (let i = 0; i < buff.length; ++i) {
    hexOctets[i] = byteToHexLookup[buff[i]]
  }
  return hexOctets.join("");
}

function base64ToHex(str) {
  const raw = ByteArray.fromString(str); //atob(str);
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const hex = raw.charCodeAt(i).toString(16);
    result += (hex.length === 2 ? hex : '0' + hex);
  }
  return result.toUpperCase();
}

let now=new Date().toString();
print(now);

now=ByteArray.fromString(now);

let h = FastSha256.sha256(now);

let b64 = Base64.bytesToBase64(h);
print(b64);

let hx = h.join('').toString(16);
print(hx);

print(bufferToHex(h));
print(hex(h));

function perf_test(desc, h, loops, callback) {
  print("\nloops="+loops);
  let z;
  let start=new Date();
  print(desc+": "+callback(h));
  for (let i=0; i < loops; i++) {
    z=callback(h);
  }
  let end=new Date();
  let ms=(end-start);
  let rate=Math.floor(loops/ms*1000);
  print(desc+": ms="+ms+" rate="+rate+"/sec");
}

let loops=100000;
perf_test("fast_sha256+digest2hex", now, loops, (uint8array) => {
  let hh=FastSha256.sha256(now);
  return digest2hex(hh);
});

perf_test("fast_sha256+hex", now, loops, (uint8array) => {
  let hh=FastSha256.sha256(uint8array);
  return hex(hh);
});

perf_test("sha256.digest2hex", now, loops, (uint8array) => {
  let hh=Sha256.hash(now);
  return digest2hex(hh);
});

perf_test("sha256.hex", now, loops, (uint8array) => {
  let hh=Sha256.hash(now);
  return hex(hh);
});

perf_test("bufferToHex", now, loops, (uint8array) => {
  return bufferToHex(uint8array);
});

perf_test("hex", now, loops, (uint8array) => {
  return hex(uint8array);
});

perf_test("digest2hex", now, loops, (uint8array) => {
  return digest2hex(uint8array);
});

perf_test("base64", now, loops, (uint8array) => {
  return Base64.bytesToBase64(uint8array);
});


