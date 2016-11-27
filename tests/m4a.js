/**
 * wg-id3 - ID3 tag reader unit tests
 */
// (C) Alexandre Morin 2015 - 2016

const assert = require('assert');
const fs = require('fs');
const M4A = require('../lib/m4a.js');
const helpers = require('./helpers.js');

describe('M4A', function() {

  it('Check M4A tags', function(done) {
    return helpers.checkTag("01 - Nihil.m4a", 'Nihil', '3teeth', '3teeth', 2014, 1, function() {
      return done();
    });
  });

});

