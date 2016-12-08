import {qs, sprint, locationOf} from "./utils/core";
import Queue from "./utils/queue";
import EpubCFI from "./epubcfi";
import EventEmitter from "event-emitter";

/**
 * Find Locations for a Book
 * @param {Spine} spine
 * @param {request} request
 */
class Locations {
	constructor(spine, request) {
		this.spine = spine;
		this.request = request;

		this.q = new Queue(this);
		this.epubcfi = new EpubCFI();

		this._locations = [];
		this.total = 0;

		this.break = 150;

		this._current = 0;

	}

	/**
	 * Load all of sections in the book to generate locations
	 * @param  {int} chars how many chars to split on
	 * @return {object} locations
	 */
	generate(chars) {

		if (chars) {
			this.break = chars;
		}

		this.q.pause();

		this.spine.each(function(section) {

			this.q.enqueue(this.process.bind(this), section);

		}.bind(this));

		return this.q.run().then(function() {
			this.total = this._locations.length-1;

			if (this._currentCfi) {
				this.currentLocation = this._currentCfi;
			}

			return this._locations;
			// console.log(this.percentage(this.book.rendition.location.start), this.percentage(this.book.rendition.location.end));
		}.bind(this));

	}

	createRange () {
		return {
			startContainer: undefined,
			startOffset: undefined,
			endContainer: undefined,
			endOffset: undefined
		};
	}

	process(section) {

		return section.load(this.request)
			.then(function(contents) {
				var locations = this.parse(contents, section.cfiBase);
				this._locations = this._locations.concat(locations);
			}.bind(this));

	}

	parse(contents, cfiBase, chars) {
		var locations = [];
		var range;
		var doc = contents.ownerDocument;
		var body = qs(doc, "body");
		var counter = 0;
		var prev;
		var _break = chars || this.break;
		var parser = function(node) {
			var len = node.length;
			var dist;
			var pos = 0;

			if (node.textContent.trim().length === 0) {
				return false; // continue
			}

			// Start range
			if (counter == 0) {
				range = this.createRange();
				range.startContainer = node;
				range.startOffset = 0;
			}

			dist = _break - counter;

			// Node is smaller than a break,
			// skip over it
			if(dist > len){
				counter += len;
				pos = len;
			}

			while (pos < len) {
				// counter = this.break;
				pos += dist;
				// Gone over
				if(pos >= len){
					// Continue counter for next node
					counter = len - (pos - _break);
				// At End
				} else {
					// End the previous range
					range.endContainer = node;
					range.endOffset = pos;
					// cfi = section.cfiFromRange(range);
					let cfi = new EpubCFI(range, cfiBase).toString();
					locations.push(cfi);
					counter = 0;

					// Start new range
					pos += 1;
					range = this.createRange();
					range.startContainer = node;
					range.startOffset = pos;

					dist = _break;
				}
			}
			prev = node;
		};

		sprint(body, parser.bind(this));

		// Close remaining
		if (range && range.startContainer && prev) {
			range.endContainer = prev;
			range.endOffset = prev.length;
			// cfi = section.cfiFromRange(range);
			let cfi = new EpubCFI(range, cfiBase).toString();
			locations.push(cfi);
			counter = 0;
		}

		return locations;
	}

	locationFromCfi(cfi){
		// Check if the location has not been set yet
		if(this._locations.length === 0) {
			return -1;
		}
		return locationOf(cfi.start, this._locations, this.epubcfi.compare);
	}

	percentageFromCfi(cfi) {
		if(this._locations.length === 0) {
			return null;
		}
		// Find closest cfi
		var loc = this.locationFromCfi(cfi);
		// Get percentage in total
		return this.percentageFromLocation(loc);
	}

	percentageFromLocation(loc) {
		if (!loc || !this.total) {
			return 0;
		}
		return (loc / this.total);
	}

	cfiFromLocation(loc){
		var cfi = -1;
		// check that pg is an int
		if(typeof loc != "number"){
			loc = parseInt(loc);
		}

		if(loc >= 0 && loc < this._locations.length) {
			cfi = this._locations[loc];
		}

		return cfi;
	}

	cfiFromPercentage(value){
		var percentage = (value > 1) ? value / 100 : value; // Normalize value to 0-1
		var loc = Math.ceil(this.total * percentage);

		return this.cfiFromLocation(loc);
	}

	load(locations){
		this._locations = JSON.parse(locations);
		this.total = this._locations.length-1;
		return this._locations;
	}

	save(json){
		return JSON.stringify(this._locations);
	}

	getCurrent(json){
		return this._current;
	}

	setCurrent(curr){
		var loc;

		if(typeof curr == "string"){
			this._currentCfi = curr;
		} else if (typeof curr == "number") {
			this._current = curr;
		} else {
			return;
		}

		if(this._locations.length === 0) {
			return;
		}

		if(typeof curr == "string"){
			loc = this.locationFromCfi(curr);
			this._current = loc;
		} else {
			loc = curr;
		}

		this.emit("changed", {
			percentage: this.percentageFromLocation(loc)
		});
	}

	get currentLocation() {
		return this._current;
	}

	set currentLocation(curr) {
		this.setCurrent(curr);
	}

	length () {
		return this._locations.length;
	}
}

EventEmitter(Locations.prototype);

export default Locations;
