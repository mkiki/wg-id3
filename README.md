# Music file ID3/M4A tags management

## Installation

	npm link wg-log
	npm link wg-utils
	npm link wg-streams
	npm install


## Usage

	const ID3 = require('wg-id3').ID3;
	const M4A = require('wg-id3').M4A;

Extract an ID3 tag from a file. It supports ID3 v2.2, v2.3 and v2.4 tags.

	var parser = new ID3();
	return parser.read(__dirname + "/file.mp3", function(err, tag) {
		...

Extract a M4A tag from a file

	var parser = new M4A();
	return parser.read(__dirname + "/file.m4a", function(err, tag) {
		...


## Tag structure

The following attributes are extracted from music files

<table>
<tr>
	<td> title </td>
	<td> string </td>
	<td> The song title </td>
</tr>
<tr>
	<td> artist </td>
	<td> string </td>
	<td> The song artist (band name) </td>
</tr>
<tr>
	<td> album </td>
	<td> string </td>
	<td> The song album </td>
</tr>
<tr>
	<td> year </td>
	<td> number </td>
	<td> The song / album release year </td>
</tr>
<tr>
	<td> trackNumber </td>
	<td> number </td>
	<td> The song track number in the album </td>
</tr>
</table>


