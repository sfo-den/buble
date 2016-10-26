var assert = require('assert');
// var sinon = require('sinon');


describe('ePub', function() {
	var ePub = require('../src/epub');
	var server;
	before(function(){
		/*
		// var packageContents = fs.readFileSync(__dirname + '/../books/moby-dick/OPS/package.opf', 'utf8');
		// var tocContents = fs.readFileSync(__dirname + '/../books/moby-dick/OPS/toc.xhtml', 'utf8');
		var packageContents = require('raw!./fixtures/moby-dick/OPS/package.opf');
		var tocContents = require('raw!./fixtures/moby-dick/OPS/toc.xhtml');

		server = sinon.fakeServer.create();
		server.autoRespond = true;

		server.respondWith("moby-dick/OPS/package.opf", [200, {
			"Content-Type": "text/xml"
		}, packageContents]);

		server.respondWith("moby-dick/OPS/toc.xhtml", [200, {
			"Content-Type": "application/xhtml+xml"
		}, tocContents]);
		*/

	});
	after(function(){
		// server.restore();
	});

	it('should open a epub', function(done) {
		var book = ePub("/fixtures/alice/OPS/package.opf");

		book.opened.then(function(){
			assert.equal( book.isOpen, true, "book is opened" );
			assert.equal( book.url, "http://localhost:9876/fixtures/alice/OPS/package.opf", "book url is passed to new Book" );
			done();
		});
	});

	it('should open a archived epub', function(done) {
		var book = ePub("/fixtures/alice.epub");

		assert(typeof (JSZip) !== "undefined", "JSZip is present" );

		book.opened.then(function(){
			assert.equal( book.isOpen, true, "book is opened" );
			assert.equal( book.url, "/", "book url is empty as book is archived" );
			done();
		});
	});

});
