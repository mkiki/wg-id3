/**
 * wg-id3 - ID3 tag management
 *
 * Utility functions to read/write ID3 tags
 *
 * References:
 * - http://id3.org/Developer%20Information
 */
// (C) Alexandre Morin 2015 - 2016

const fs = require('fs');
const extend = require('extend');
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const PullStream = require('wg-streams').PullStream;

const log = Log.getLogger('wg-id3::id3');


/**
 * Compute safe-sync value from long value.
 * Basically we skip bit 7 of every bite
 */
var safeSync = function(l) {
  var a = l & 0x7f;
  l >>= 8;
  var b = l & 0x7f;
  l >>= 8;
  var c = l & 0x7f;
  l >>= 8;
  var d = l & 0x7f;
  l = (((((d<<7)+c)<<7)+b)<<7)+a;
  return l;
}



/** ================================================================================
  * Type definitions
  * ================================================================================ */


/**
 * @typedef ID3Tag
 *
 * @property {string} title - The song title
 * @property {string} artist - The song artist (band name)
 * @property {string} album - The song album
 * @property {number} year - The song / album release year
 * @property {number} trackNumber - The song track number in the album
 */

/**
 * @typedef ID3TagHeader
 *
 * @property {integer} major - The ID3v2 major version (ex: 2, 3, 4 for v2.2, v2.3, v2.4)
 * @property {integer} minor - The minor version
 * @property {boolean} unsynchronisation - If this tag is using unsynchronization
 * @property {integer} size - The tag length
 */

/**
 * @typedef ID3FrameHeader
 *
 * @property {string} id - The frame name
 * @property {integer} size - The frame size, in bytes
 * @property {integer} flags - 
 */


/**
 * Creates a ID3 parser object
 */
var ID3 = function() {
  this.stream = undefined;
  this.tag = undefined;
  this._clear();
}

/**
 * Clear information about the current tag being processed
 */
ID3.prototype._clear = function() {
  this.tag = {
    title: "",
    artist: "",
    album: "",
    year: undefined,
    trackNumber: undefined
  };
}

/**
 * Read the tag for a M4A file
 * @param {string} fileName - is the fully qualified file name
 * @return {ID3Tag} is the parsed tag
 */
ID3.prototype.read = function(fileName, callback) {
  var that = this;
  log.debug({fileName:fileName}, "Scanning file for ID3 tag");
  this._clear();
  that.stream = new PullStream();
  return that.stream.fromFile(fileName, function(err) {
    if (err) return callback(err);

    while (true) {
      // A ID3v2 tag can be detected with the following pattern:
      // $49 44 33 yy yy xx zz zz zz zz
      // Where yy is less than $FF, xx is the 'flags' byte and zz is less than $80.
      var beginning = that.stream.scan3Bytes(4801587);
      if (!beginning) {
        log.debug({fileName:fileName}, "ID3 marker not found");
        return callback(undefined, null);
      }

      var chunk = that.stream.chunk("Header", 7);
      var major = chunk.readByte();
      if (major < 2) {
        log.debug({major:major, fileName:fileName}, "ID3 tag found but version not supported (<2). Looking for other tags.");
        continue;
      }
      if (major >=5 ) {
        log.debug({major:major, fileName:fileName}, "ID3 tag found but version not supported (>=5). Looking for other tags.");
        continue;
      }
      var minor = chunk.readByte();
      var flags = chunk.readByte();
      // The first bit (bit 7) in the 'ID3 flags' is indicating whether or not
      // unsynchronisation is used (see section 5 for details); a set bit indicates usage.
      unsynchronisation = flags && 0x80;
      // ID3 tags version 3 and above use bit 6 to indicate an extended header
      extendedHeader = false;
      if( major >= 3) extendedHeader = flags & 0x40;
      var size = safeSync(chunk.readLong());
      if (extendedHeader) {
        return callback(new Exception({fileName:fileName}, "Cannot read extended heaer yet"));
      }
      var header = {
        major: major,
        minor: minor,
        unsynchronisation: unsynchronisation,
        size: size
      };
      log.debug({header:header}, "ID3 tag found");
      that._readFrames(header);
      return callback(undefined, that.tag);
    };
  });
}

/**
 * Read the ID3 frames
 *
 * @param {ID3TagHeader} tagHeader - the tag header
 */
ID3.prototype._readFrames = function(tagHeader) {
  var that = this;
  var framesChunk = that.stream.chunk("Frames", tagHeader.size);
  while (framesChunk.hasMore()) {

    var frameHeader = undefined;
    if (tagHeader.major === 2) {
      var chunk = framesChunk.chunk("Frame header v2", 6);
      var frameID = chunk.readASCII3();
      var frameSize = chunk.read3Bytes();
      frameHeader = {
        id: frameID,
        size: frameSize, 
        flags: 0
      };
    }
    if (tagHeader.major >=3) {
      var chunk = framesChunk.chunk("Frame header v3+", 10);
      var frameID = chunk.readByte();
      if (frameID === 0) {
        // Frame starting with 0 - See test file "07 - Blue Poles.mp3"
        // If only one zero, then try to skip - See test file "18 - When the sainta.mp3"
        if (chunk.hasMore() ) {
          frameID = chunk.readByte();
        }
        if (frameID === 0) {
          framesChunk.skip();
          log.debug("Encountered a frame header starting with 0x0000");
          break;
        }
        chunk.extend(1);
      }
      var frameID = String.fromCharCode(frameID) + chunk.readASCII3();
      var frameSize = chunk.readLong();
      if (tagHeader.major >= 4) frameSize = safeSync(frameSize);  // see https://serato.com/forum/discussion/61825
      var frameFlags = chunk.readShort();
      frameHeader = {
        id: frameID,
        size: frameSize,
        flags: frameFlags
      };
    }
    if (frameHeader.size === 0) {
      framesChunk.skip();
      log.debug("Encountered 0-size frame, considering it as padding");
      break;
    }
    log.debug({frameHeader:frameHeader}, "Found frame header");
    var chunk = framesChunk.chunk("Frame data (" + frameHeader.id + ")", frameHeader.size);
    if (that.tag.title === "" && frameHeader.id === 'TT2') that.tag.title = that._readTextFrame(tagHeader, chunk);
    if (that.tag.title === "" && frameHeader.id === 'TIT1') that.tag.title = that._readTextFrame(tagHeader, chunk);
    if (that.tag.title === "" && frameHeader.id === 'TIT2') that.tag.title = that._readTextFrame(tagHeader, chunk);
    if (that.tag.artist === "" && frameHeader.id === 'TP1') that.tag.artist = that._readTextFrame(tagHeader, chunk);
    if (that.tag.artist === "" && frameHeader.id === 'TP2') that.tag.artist = that._readTextFrame(tagHeader, chunk);
    if (that.tag.artist === "" && frameHeader.id === 'TPE1') that.tag.artist = that._readTextFrame(tagHeader, chunk);
    if (that.tag.artist === "" && frameHeader.id === 'TPE2') that.tag.artist = that._readTextFrame(tagHeader, chunk);
    if (that.tag.album === "" && frameHeader.id === 'TAL') that.tag.album = that._readTextFrame(tagHeader, chunk);
    if (that.tag.album === "" && frameHeader.id === 'TALB') that.tag.album = that._readTextFrame(tagHeader, chunk);
    if (that.tag.trackNumber === undefined && (frameHeader.id === 'TRK' || frameHeader.id === 'TRCK')) {
      var trk = that._readTextFrame(tagHeader, chunk).trim();
      if (trk !== "") {
        trk = parseInt(trk, 10);
        if (trk >0 && trk === trk) that.tag.trackNumber = trk;
      }
    }
    if (that.tag.year === undefined && (frameHeader.id === 'TYE' || frameHeader.id === 'TYER')) {
      var year = that._readTextFrame(tagHeader, chunk).trim();
      if (year !== "") {
        year = parseInt(year, 10);
        if (year >0 && year === year) that.tag.year = year;
      }
    }
    chunk.skip();
  }
}

/**
 * Read a text frame
 *
 * @param {ID3TagHeader} tagHeader - the tag header (because encoding may depend on version)
 * @param {Chunk} chunk - the frame data chunk
 * @return {stirng} - the decoded frame value
 *
 * Notes:
 * - It's not clear if strings should be 0-terminated or not. And we find both examples of
 *   strings that are and some that aren't (they finish at the chunk end boundary). Therefore,
 *   we're using readZString*(true), where "true" indicates that the string should be zero
 *   terminated, but we do not care if it isn't
 *
 * 00 – ISO-8859-1 (ASCII).
 * 01 – UCS-2 (UTF-16 encoded Unicode with BOM), in ID3v2.2 and ID3v2.3.
 * 02 – UTF-16BE encoded Unicode without BOM, in ID3v2.4.
 * 03 – UTF-8 encoded Unicode, in ID3v2.4.
 *
 * from: http://en.wikipedia.org/wiki/ID3
 */
ID3.prototype._readTextFrame = function(tagHeader, chunk) {
  var encoding = chunk.readByte();
  if (tagHeader.major === 2) {
    if (encoding === 0) return chunk.readZString88591(true);
    if (encoding === 1) return chunk.readZStringUTF16(true);
  }
  else if (tagHeader.major > 2) {
    if (encoding === 0) return chunk.readZString88591(true);
    if (encoding === 1) return chunk.readZStringUTF16(true);
    if (encoding === 3) return chunk.readZStringUTF8(true);
  }
  throw new Exception({encoding:encoding}, "Failed to read text frame (invalid or unsupported encoding)");
}
  

/**
 * Public interface
 */
module.exports = ID3;
