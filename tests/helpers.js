/**
 * wg-id3 - ID3 unit test helpers
 */
// (C) Alexandre Morin 2015 - 2016
const assert = require('assert');
const utils = require('wg-utils');
const ID3 = require('../lib/id3.js');
const M4A = require('../lib/m4a.js');

function checkTag(fileName, expectedTitle, expectedArtist, expectedAlbum, expectedYear, expextedTrackNumber, callback) {
  var parser;
  if (utils.getExtension(fileName) === 'mp3') parser = new ID3();
  else if (utils.getExtension(fileName) === 'm4a') parser = new M4A();
  return parser.read(__dirname + "/data/" + fileName, function(err, tag) {
    if (err) assert.ifError(err);
    if (expectedTitle === null) {
      assert(tag === null, "No tag");
      callback = expectedArtist;
      return callback();
    }
    assert.strictEqual(expectedTitle, tag.title, "Bad title");
    assert.strictEqual(expectedArtist, tag.artist, "Bad artist");
    assert.strictEqual(expectedAlbum, tag.album, "Bad album");
    assert.strictEqual(expectedYear, tag.year, "Bad year");
    assert.strictEqual(expextedTrackNumber, tag.trackNumber, "Bad track number");
    return callback();
  });
}

/**
 * Public interface
 */
module.exports = {
  checkTag: checkTag,
};
