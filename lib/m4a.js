/**
 * wg-id3 - M4A tag management
 *
 * Utility functions to read/write M4A tags
 *
 * References
 *
 * http://atomicparsley.sourceforge.net/mpeg-4files.html
 *
 */
// (C) Alexandre Morin 2015 - 2016

const fs = require('fs');
const extend = require('extend');
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const PullStream = require('wg-streams').PullStream;

const log = Log.getLogger('wg-id3::m4a');


/** ================================================================================
  * Type definitions
  * ================================================================================ */


/**
 * @typedef M4ATag
 *
 * @property {string} title - The song title
 * @property {string} artist - The song artist (band name)
 * @property {string} album - The song album
 * @property {number} year - The song / album release year
 * @property {number} trackNumber - The song track number in the album
 */



/**
 * Creates a M4A parser object
 */
var M4A = function() {
  this.stream = undefined;
  this.tag = undefined;
  this._clear();
}

/**
 * Clear information about the current tag being processed
 */
M4A.prototype._clear = function() {
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
 * @return {M4ATag} is the parsed tag
 */
M4A.prototype.read = function(fileName, callback) {
  var that = this;
  this._clear();
  that.stream = new PullStream();
  return that.stream.fromFile(fileName, function(err) {
    if (err) return done(err);
    return that._readAtoms(function(err) {
        return callback(undefined, that.tag);
    });
  });
}

/**
 * Read the atoms for the current file/stream
 * @return - the list of atoms
 */
M4A.prototype._readAtoms = function(callback) {
  var that = this;
  var chunk = that.stream.chunk("Whole file");
  var atoms = that._readSubAtoms(chunk);
  if (atoms.length > 0 && atoms[0].header.name !== 'ftyp')
    return callback(new Exception({atom:atoms[0]}, "First atom expected to be ftyp"));
  return callback(undefined, atoms);
}

/**
 * Recursively read M4A atoms
 * @param {Chunk} parentChunk - is the Chunk (see streams.js) of the parent atom
 * @return - the list of atoms
 */
M4A.prototype._readSubAtoms = function(parentChunk) {
  var that = this;
  var atoms = [];
  log.debug("Reading sub-atoms");

  while(parentChunk.hasMore()) {

    var chunkHeader = parentChunk.chunk("Atom header", 8);
    var atomSize = chunkHeader.readLong();
    var atomName = chunkHeader.readASCII4();
    var atomHeader = {
      size: atomSize,
      name: atomName
    };
    log.debug({atomHeader:atomHeader}, "Found atom header");

    var chunkData = parentChunk.chunk("Atom data (" + atomName + ")", atomSize-8);
    var atomData = undefined;
    atomName = atomName.toLowerCase();
    if (atomName ===  'moov' || atomName ===  'udta' || atomName ===  'ilst') {
      atomData = { atoms: that._readSubAtoms(chunkData) }
    }
    if (atomName === 'meta') {
      var flags = chunkData.readLong();
      atomData = { atoms: that._readSubAtoms(chunkData) }
    }
    if (atomName === '©nam' || atomName === '©art' || atomName === '©alb' ||
      atomName === 'aart' || atomName === 'trkn' || atomName === '©day') {
      data = that._readSubAtoms(chunkData);
      if (data) {
        for (var i=0; i<data.length; i++) {
          if (data[i].header.name === 'data') {
            if (atomName === '©nam' || atomName === '©art' || atomName === '©alb' ||  atomName === 'aart') {
              atomData = data[i].data;
              if (that.tag.title === "" && atomName === '©nam') that.tag.title = atomData;
              if (that.tag.artist === "" && atomName === '©art') that.tag.artist = atomData;
              if (that.tag.artist === "" && atomName === 'aart') that.tag.artist = atomData;
              if (that.tag.album === "" && atomName === '©alb') that.tag.album = atomData;
            }
            if (atomName === '©day') {
              var year = data[i].data;
              if (year && year !== "") {
                year = parseInt(year, 10);
                if (year > 0) {
                  atomData = year;
                  if (that.tag.year === undefined) that.tag.year = year;
                }
              }
            }
            if (atomName === 'trkn') {
              var trackNumber = +data[i].data.readUInt8(3);
              if (trackNumber && trackNumber > 0) {
                if (that.tag.trackNumber === undefined) that.tag.trackNumber = trackNumber;
              }
            }
            break;
          }
        }
      }
    }
    if (atomName === 'data') {
      var version = chunkData.readByte();
      var flags = chunkData.read3Bytes();
      var padding = chunkData.readLong();
      if (flags === 0) {
        atomData = chunkData.readBuffer();
      }
      if (flags === 1) {
        atomData = chunkData.readStringUTF8();
      }
    }

    chunkData.skip();
    if (atomData) {
      log.debug({atomData:atomData}, "Decoded atom data");
      atoms.push({header:atomHeader, data:atomData});
    }
  };

  return atoms;
}




/**
 * Public interface
 */
module.exports = M4A;
