/**
 * wg-id3 - NPM package entry point
 */
// (C) Alexandre Morin 2015 - 2016

const ID3 = require('./lib/id3.js');
const M4A = require('./lib/m4a.js');

/**
 * Public interface
 */
module.exports = {
  ID3: ID3,
  M4A: M4A
};
