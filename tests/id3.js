/**
 * wg-id3 - ID3 tag reader unit tests
 */
// (C) Alexandre Morin 2015 - 2016

const assert = require('assert');
const fs = require('fs');
const ID3 = require('../lib/id3.js');
const helpers = require('./helpers.js');

describe('ID3', function() {

  it('Check ID3 tags', function(done) {
    return helpers.checkTag("19 - Look at the rain.mp3", 'Look at the rain', 'Meat Puppets', 'No Strings Attached', undefined, 19, function() {
      return helpers.checkTag("02 - Act of Supremacy.mp3", 'Act of Supremacy', 'Aborted', 'The Purity Of Perversion', 1999, 2, function() {
        return helpers.checkTag("03 - Juke Box Jive.mp3", 'Juke Box Jive', 'Rubettes (the)', 'The Very Best Of', 1998, 3, function() {
          return helpers.checkTag("07 - Blue Poles.mp3", 'Blue Poles', 'Smith (Patti)', 'Peace and Noise', 1997, 7, function() {
            // version 2.4 with frame length > 128
            return helpers.checkTag("11 - Say Hello Wave Goodbye'91 (the long Goodbye - extendet mendelsohn remix).mp3", "Say Hello Wave Goodbye'91 (the long Goodbye - extendet mendelsohn remix)", 'Soft Cell', 'The Twelve Inch Singles Collection (Disc 3)', undefined, 11, function() {
              // version 2.3 with GEOB frame with size > 128
              return helpers.checkTag("08 - Les éléphants d'inde.mp3", "Les éléphants d'inde", 'Satellites (les)', 'Riches & Célèbres', undefined, 8, function() {
                // This one does not have an ID3 tag but as the string "ID3 in it"
                return helpers.checkTag("02 - Rhapsody in Blue.mp3", null, function() {
                  // Problem with zero terminated stringd
                  return helpers.checkTag("13 - Words.mp3", 'Words', 'Alien Ant Farm', 'truANT', undefined, 13, function() {
                    // Partial metadata
                    return helpers.checkTag("04 - Phase IV.mp3", '', 'Porcupine Tree', '', undefined, undefined, function() {
                      return done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  it('Check ID3 tags (2)', function(done) {
    return helpers.checkTag("18 - When the sainta.mp3", 'When the saint', 'Toy Dolls (the)', 'Twenty two tunes live', 1990, 18, function() {
      return done();
    });
  });

  it('Should not work for M4A tags', function(done) {
    var parser = new ID3();
    return parser.read(__dirname + "/data/12 Octopus4.m4a", function(err, tag) {
      if (err) return done(err);
      assert.strictEqual(null, tag); // no ID3 tag (this is a M4A file)
      return done();
    });
  });

});

